import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getCamp, DEFAULT_CAMP_ID } from "@/lib/camps";
import {
  getCallerWithDepartments,
  callerCanManageCampRegistrations,
} from "../camp-registrations/_auth";
import {
  CAMP_BROADCASTS_COLLECTION,
  MAX_STORED_OUTCOMES,
  sendCampBroadcast,
} from "@/lib/camp-broadcast";
import {
  findUnknownBroadcastTokens,
  matchesBroadcastAudience,
  BROADCAST_AUDIENCES,
} from "@/lib/camp-broadcast-template";
import { serializeBroadcast } from "./_serialize";
import type { CampBroadcastAudience } from "@/types";

export const dynamic = "force-dynamic";

const MAX_SUBJECT = 200;
const MAX_BODY = 20_000;
/** A camp is tens of campers; anything near this is a mistake, not a mailing. */
const MAX_RECIPIENTS = 500;
const HISTORY_LIMIT = 30;

const VALID_AUDIENCES = BROADCAST_AUDIENCES.map((a) => a.value);

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/camp-broadcasts?campId=...
 *
 * Announcements already sent for a camp, newest first. Doubles as the template
 * library: the composer can load any past message back in as a starting point.
 */
export async function GET(request: Request) {
  try {
    const caller = await getCallerWithDepartments();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!(await callerCanManageCampRegistrations(caller))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const url = new URL(request.url);
    const campId = url.searchParams.get("campId") || DEFAULT_CAMP_ID;

    // Filter by campId only and sort in memory, so no composite index is
    // needed — the same approach the registrations list takes.
    const snapshot = await adminDb
      .collection(CAMP_BROADCASTS_COLLECTION)
      .where("campId", "==", campId)
      .get();

    const broadcasts = snapshot.docs
      .map((doc) => serializeBroadcast(doc.id, doc.data()))
      .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1))
      .slice(0, HISTORY_LIMIT);

    return NextResponse.json({ broadcasts });
  } catch (error) {
    console.error("Error fetching camp broadcasts:", error);
    return NextResponse.json(
      { error: "Failed to fetch announcements" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/camp-broadcasts
 *
 * Sends one announcement to an audience of campers, personalized per camper.
 * Body: { campId, subject, body, audience, registrationIds?, ctaLabel?,
 *         ctaUrl?, replyTo? }
 *
 * Registrations with no email address are reported as skipped rather than
 * failing the send.
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

    const campId: string = (body.campId || DEFAULT_CAMP_ID).toString();
    const camp = getCamp(campId);
    if (!camp) {
      return NextResponse.json({ error: "Unknown camp" }, { status: 400 });
    }

    const subject = optionalString(body.subject);
    const messageBody =
      typeof body.body === "string" && body.body.trim() ? body.body : null;
    if (!subject) {
      return NextResponse.json({ error: "A subject line is required" }, { status: 400 });
    }
    if (!messageBody) {
      return NextResponse.json({ error: "A message is required" }, { status: 400 });
    }
    if (subject.length > MAX_SUBJECT) {
      return NextResponse.json(
        { error: `Subject is too long (max ${MAX_SUBJECT} characters)` },
        { status: 400 }
      );
    }
    if (messageBody.length > MAX_BODY) {
      return NextResponse.json(
        { error: `Message is too long (max ${MAX_BODY} characters)` },
        { status: 400 }
      );
    }

    // A typo'd placeholder would otherwise reach campers as literal braces.
    const unknown = Array.from(
      new Set([
        ...findUnknownBroadcastTokens(subject),
        ...findUnknownBroadcastTokens(messageBody),
      ])
    );
    if (unknown.length > 0) {
      return NextResponse.json(
        {
          error: `Unknown placeholder${unknown.length === 1 ? "" : "s"}: ${unknown
            .map((t) => `{{${t}}}`)
            .join(", ")}`,
          unknownTokens: unknown,
        },
        { status: 400 }
      );
    }

    const audience: CampBroadcastAudience = VALID_AUDIENCES.includes(body.audience)
      ? body.audience
      : "ALL";

    const ctaLabel = optionalString(body.ctaLabel);
    const ctaUrl = optionalString(body.ctaUrl);
    if ((ctaLabel && !ctaUrl) || (ctaUrl && !ctaLabel)) {
      return NextResponse.json(
        { error: "A button needs both a label and a link" },
        { status: 400 }
      );
    }
    if (ctaUrl && !/^https?:\/\//i.test(ctaUrl)) {
      return NextResponse.json(
        { error: "The button link must start with http:// or https://" },
        { status: 400 }
      );
    }

    const replyTo = optionalString(body.replyTo);
    if (replyTo && !EMAIL_PATTERN.test(replyTo)) {
      return NextResponse.json(
        { error: `"${replyTo}" is not a valid reply-to email address` },
        { status: 400 }
      );
    }

    // Resolve the audience.
    const snapshot = await adminDb
      .collection("campRegistrations")
      .where("campId", "==", campId)
      .get();

    const selectedIds: string[] =
      audience === "SELECTED" && Array.isArray(body.registrationIds)
        ? body.registrationIds.filter((id: unknown): id is string => typeof id === "string")
        : [];

    if (audience === "SELECTED" && selectedIds.length === 0) {
      return NextResponse.json(
        { error: "Pick at least one camper to send to" },
        { status: 400 }
      );
    }

    const selectedSet = new Set(selectedIds);
    const docs = snapshot.docs.filter((doc) =>
      audience === "SELECTED"
        ? selectedSet.has(doc.id)
        : matchesBroadcastAudience(doc.data(), audience)
    );

    if (docs.length === 0) {
      return NextResponse.json(
        { error: "No campers match that audience" },
        { status: 400 }
      );
    }
    if (docs.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        { error: `Too many recipients in one send (max ${MAX_RECIPIENTS})` },
        { status: 400 }
      );
    }

    const composition = { subject, body: messageBody, ctaLabel, ctaUrl, replyTo };
    const outcomes = await sendCampBroadcast(docs, camp, composition);

    const sent = outcomes.filter((o) => o.status === "sent").length;
    const skipped = outcomes.filter((o) => o.status === "skipped").length;
    const failed = outcomes.filter((o) => o.status === "failed").length;

    // Keep failures and skips first so a truncated list still shows what needs
    // attention rather than a page of successes.
    const stored = [...outcomes]
      .sort((a, b) => rank(a.status) - rank(b.status))
      .slice(0, MAX_STORED_OUTCOMES);

    const now = new Date();
    const ref = await adminDb.collection(CAMP_BROADCASTS_COLLECTION).add({
      campId,
      subject,
      body: messageBody,
      audience,
      selectedIds,
      ctaLabel,
      ctaUrl,
      replyTo,
      sentBy: caller.uid,
      sentByName: caller.name,
      sentAt: now,
      recipientCount: outcomes.length,
      sentCount: sent,
      skippedCount: skipped,
      failedCount: failed,
      outcomes: stored,
    });

    return NextResponse.json({
      id: ref.id,
      recipientCount: outcomes.length,
      sent,
      skipped,
      failed,
      outcomes,
    });
  } catch (error) {
    console.error("Error sending camp announcement:", error);
    return NextResponse.json(
      { error: "Failed to send the announcement" },
      { status: 500 }
    );
  }
}

function rank(status: string): number {
  return status === "failed" ? 0 : status === "skipped" ? 1 : 2;
}
