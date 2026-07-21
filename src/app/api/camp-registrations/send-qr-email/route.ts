import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { DEFAULT_CAMP_ID } from "@/lib/camps";
import {
  getCallerWithDepartments,
  callerCanManageCampRegistrations,
} from "../_auth";
import { sendCampRegistrationEmail } from "@/lib/camp-registration-email";

export const dynamic = "force-dynamic";

const MAX_IDS = 200;
const CHUNK_SIZE = 10;

interface SendOutcome {
  id: string;
  name: string;
  status: "sent" | "skipped" | "failed";
  to?: string;
  reason?: string;
}

/**
 * Admin: (re)send the registration-details + QR check-in email.
 * Body: { ids: string[] } for specific registrations, or
 *       { all: true, campId? } for every registration in a camp.
 * Registrations without an email address are reported as skipped.
 */
export async function POST(request: Request) {
  try {
    const caller = await getCallerWithDepartments();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!(await callerCanManageCampRegistrations(caller))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));

    let docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    if (body.all === true) {
      const campId = (body.campId || DEFAULT_CAMP_ID).toString();
      const snapshot = await adminDb
        .collection("campRegistrations")
        .where("campId", "==", campId)
        .get();
      docs = snapshot.docs;
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      if (body.ids.length > MAX_IDS) {
        return NextResponse.json(
          { error: `Too many registrations in one request (max ${MAX_IDS})` },
          { status: 400 }
        );
      }
      const ids = body.ids.filter((id: unknown): id is string => typeof id === "string");
      const refs = ids.map((id: string) =>
        adminDb.collection("campRegistrations").doc(id)
      );
      const snaps = await adminDb.getAll(...refs);
      docs = snaps.filter(
        (s): s is FirebaseFirestore.QueryDocumentSnapshot => s.exists
      );
    } else {
      return NextResponse.json(
        { error: "Provide ids: string[] or all: true" },
        { status: 400 }
      );
    }

    // Send in small parallel chunks: fast enough for a full camp without
    // hammering Firestore or blowing the function's time budget.
    const outcomes: SendOutcome[] = [];
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(
        chunk.map(async (doc): Promise<SendOutcome> => {
          const data = doc.data();
          const name = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
          const result = await sendCampRegistrationEmail(doc.id, data);
          if (result.queued) {
            return { id: doc.id, name, status: "sent", to: result.to };
          }
          const noEmail = result.reason === "No email address on the registration";
          return {
            id: doc.id,
            name,
            status: noEmail ? "skipped" : "failed",
            reason: result.reason,
          };
        })
      );
      outcomes.push(...results);
    }

    const sent = outcomes.filter((o) => o.status === "sent").length;
    const skipped = outcomes.filter((o) => o.status === "skipped").length;
    const failed = outcomes.filter((o) => o.status === "failed").length;

    return NextResponse.json({ sent, skipped, failed, outcomes });
  } catch (error) {
    console.error("Error sending camp QR emails:", error);
    return NextResponse.json(
      { error: "Failed to send emails" },
      { status: 500 }
    );
  }
}
