import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import {
  effectiveEndDate,
  getCallerFromSession,
} from "@/lib/event-reports-helpers";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import { EventReportStatus } from "@/types";

export const dynamic = "force-dynamic";

// ─── POST /api/event-reports/remind ───
// Body: { eventId?: string }
// If eventId is provided, send a reminder for that single event. Otherwise,
// send reminders to every initiator with an overdue report (no doc / DRAFT /
// CHANGES_REQUESTED) for an event whose end date has passed.

interface RemindResult {
  remindedCount: number;
  skippedCount: number;
}

const REMINDABLE_STATUSES = new Set<EventReportStatus | "NONE">([
  "NONE",
  "DRAFT",
  "CHANGES_REQUESTED",
]);

export async function POST(request: Request) {
  try {
    const caller = await getCallerFromSession();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canReview = await serverCheckFeatureAccess(
      "review_event_reports",
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );
    if (!canReview) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const eventIdParam: string | null =
      typeof body?.eventId === "string" && body.eventId.trim()
        ? body.eventId.trim()
        : null;

    let eventDocs: FirebaseFirestore.QueryDocumentSnapshot[];

    if (eventIdParam) {
      const doc = await adminDb.collection("events").doc(eventIdParam).get();
      if (!doc.exists) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }
      eventDocs = [doc as FirebaseFirestore.QueryDocumentSnapshot];
    } else {
      const snap = await adminDb
        .collection("events")
        .where("approvalStatus", "==", "APPROVED")
        .get();
      eventDocs = snap.docs;
    }

    const now = new Date();
    const pastDocs = eventDocs.filter((doc) => {
      const end = effectiveEndDate(doc.data());
      return end !== null && end <= now;
    });

    if (pastDocs.length === 0) {
      const result: RemindResult = { remindedCount: 0, skippedCount: 0 };
      return NextResponse.json(result);
    }

    const reportRefs = pastDocs.map((d) =>
      adminDb.collection("eventReports").doc(d.id)
    );
    const reportDocs = await adminDb.getAll(...reportRefs);
    const statusByEventId = new Map<string, EventReportStatus>();
    for (const d of reportDocs) {
      if (d.exists) statusByEventId.set(d.id, d.data()!.status as EventReportStatus);
    }

    const targets: Array<{
      eventId: string;
      eventTitle: string;
      initiatorId: string;
      status: EventReportStatus | "NONE";
    }> = [];

    for (const doc of pastDocs) {
      const data = doc.data();
      const status: EventReportStatus | "NONE" =
        statusByEventId.get(doc.id) ?? "NONE";
      if (!REMINDABLE_STATUSES.has(status)) continue;
      const initiatorId: string = data.createdBy || "";
      if (!initiatorId) continue;
      targets.push({
        eventId: doc.id,
        eventTitle: data.title || "your event",
        initiatorId,
        status,
      });
    }

    if (targets.length === 0) {
      const result: RemindResult = {
        remindedCount: 0,
        skippedCount: pastDocs.length,
      };
      return NextResponse.json(result);
    }

    // Pre-fetch initiator emails in one batch
    const uniqueInitiators = Array.from(new Set(targets.map((t) => t.initiatorId)));
    const initiatorRefs = uniqueInitiators.map((uid) =>
      adminDb.collection("users").doc(uid)
    );
    const initiatorDocs = await adminDb.getAll(...initiatorRefs);
    const emailByUid = new Map<string, string | null>();
    for (const d of initiatorDocs) {
      if (d.exists) {
        emailByUid.set(d.id, d.data()!.email ?? null);
      }
    }

    const statusBlurb = (s: EventReportStatus | "NONE"): string => {
      switch (s) {
        case "NONE":
          return "you haven't started it yet";
        case "DRAFT":
          return "your draft is still unsubmitted";
        case "CHANGES_REQUESTED":
          return "the Chairperson requested changes";
        default:
          return "";
      }
    };

    const settled = await Promise.allSettled(
      targets.map((t) =>
        createNotificationWithEmail({
          userId: t.initiatorId,
          title: "Reminder: Submit Event Report",
          message: `Reminder from the Chairperson: please submit the post-event report for "${t.eventTitle}".`,
          type: "event",
          link: `/manage/events/reports/${t.eventId}`,
          recipientEmail: emailByUid.get(t.initiatorId) ?? undefined,
          email: {
            subject: `Reminder: Event Report Due — ${t.eventTitle}`,
            text:
              `This is a reminder from the Chairperson that the post-event report for ` +
              `"${t.eventTitle}" is outstanding (${statusBlurb(t.status)}).\n\n` +
              `Please log in and submit it.`,
          },
        })
      )
    );

    let remindedCount = 0;
    for (const r of settled) {
      if (r.status === "fulfilled") remindedCount++;
    }
    const skippedCount = pastDocs.length - remindedCount;

    const result: RemindResult = { remindedCount, skippedCount };
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/event-reports/remind error:", error);
    return NextResponse.json(
      { error: "Failed to send reminders" },
      { status: 500 }
    );
  }
}
