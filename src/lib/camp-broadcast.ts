import { randomBytes } from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail, validateEmailConfig } from "@/lib/email";
import { getAppUrl } from "@/lib/camp-registration-email";
import {
  broadcastRecipient,
  buildBroadcastEmail,
  findBroadcastTokens,
  type BroadcastComposition,
} from "@/lib/camp-broadcast-template";
import type { CampBroadcastOutcome, CampDefinition } from "@/types";

/**
 * Sending side of camp announcements.
 *
 * The composer writes one message with `{{placeholders}}`; this module turns it
 * into one personalized email per camper and records what happened to each
 * copy. Per-camper problems never abort the run — a camper with no email
 * address shouldn't stop the other seventy-nine getting theirs.
 */

export const CAMP_BROADCASTS_COLLECTION = "campBroadcasts";

/** Per-camper outcomes kept on the broadcast document. Camps run to tens of
 *  campers, so this only bites if a camp ever grows past the cap. */
export const MAX_STORED_OUTCOMES = 300;

interface SendResult {
  queued: boolean;
  to?: string;
  reason?: string;
}

/** True when the message needs the camper's personal tracking link, which we
 *  can only build once the registration has a claim token. */
function usesTrackUrl(composition: BroadcastComposition): boolean {
  const tokens = [
    ...findBroadcastTokens(composition.subject),
    ...findBroadcastTokens(composition.body),
  ];
  return tokens.includes("trackUrl");
}

/**
 * Sends one camper's copy of an announcement.
 *
 * Returns `{queued: false, reason}` rather than throwing, so the caller can
 * report a per-camper failure and carry on with the rest of the register.
 */
export async function sendCampBroadcastEmail(
  registrationId: string,
  data: FirebaseFirestore.DocumentData,
  camp: CampDefinition,
  composition: BroadcastComposition
): Promise<SendResult> {
  const configError = validateEmailConfig();
  if (configError) {
    return { queued: false, reason: configError };
  }

  const recipient = broadcastRecipient(data);
  if (!recipient) {
    return { queued: false, reason: "No email address on the registration" };
  }

  try {
    let trackUrl = "";
    if (usesTrackUrl(composition)) {
      // Older registrations predate the claim token; mint one so the link in
      // this announcement works, exactly as the QR email does.
      let claimToken: string | undefined = data.claimToken;
      if (!claimToken) {
        claimToken = randomBytes(24).toString("hex");
        await adminDb
          .collection("campRegistrations")
          .doc(registrationId)
          .update({ claimToken, updatedAt: new Date() });
      }
      trackUrl = `${getAppUrl()}/rops-camp/track?rid=${encodeURIComponent(
        registrationId
      )}&token=${encodeURIComponent(claimToken)}&email=${encodeURIComponent(recipient)}`;
    }

    const { subject, text, html } = buildBroadcastEmail(
      { registrationId, camper: data, camp, recipient, trackUrl },
      composition
    );

    await sendEmail({
      to: recipient,
      subject,
      text,
      html,
      ...(composition.replyTo ? { replyTo: composition.replyTo } : {}),
    });

    return { queued: true, to: recipient };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Failed to queue camp announcement for ${registrationId}:`, err);
    return { queued: false, reason: message };
  }
}

/** Sends a whole audience in small parallel batches — quick enough for a full
 *  camp without hammering Firestore or blowing the function's time budget. */
export async function sendCampBroadcast(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  camp: CampDefinition,
  composition: BroadcastComposition,
  chunkSize = 10
): Promise<CampBroadcastOutcome[]> {
  const outcomes: CampBroadcastOutcome[] = [];

  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (doc): Promise<CampBroadcastOutcome> => {
        const data = doc.data();
        const name = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
        const result = await sendCampBroadcastEmail(doc.id, data, camp, composition);
        if (result.queued) {
          return {
            registrationId: doc.id,
            name,
            to: result.to ?? null,
            status: "sent",
          };
        }
        const noEmail = result.reason === "No email address on the registration";
        return {
          registrationId: doc.id,
          name,
          to: null,
          status: noEmail ? "skipped" : "failed",
          reason: result.reason,
        };
      })
    );
    outcomes.push(...results);
  }

  return outcomes;
}
