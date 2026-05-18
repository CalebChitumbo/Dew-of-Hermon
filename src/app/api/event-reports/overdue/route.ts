import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  effectiveEndDate,
  getCallerFromSession,
} from "@/lib/event-reports-helpers";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import { EventReportStatus, EventType } from "@/types";

export const dynamic = "force-dynamic";

interface OverdueEvent {
  id: string;
  title: string;
  type: EventType;
  startDate: string | null;
  endDate: string | null;
  venue: string;
  createdBy: string;
  createdByName: string | null;
  reportStatus: "NONE" | "DRAFT" | "CHANGES_REQUESTED";
  reviewComments: string | null;
}

// ─── GET /api/event-reports/overdue ───
// Returns events whose effective end date has passed and where the post-event
// report is missing (NONE), still a draft (DRAFT), or sent back for changes
// (CHANGES_REQUESTED). Used by the Chairperson dashboard to identify who needs
// chasing.

export async function GET() {
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

    const eventsSnap = await adminDb
      .collection("events")
      .where("approvalStatus", "==", "APPROVED")
      .get();

    if (eventsSnap.empty) {
      return NextResponse.json({ events: [] });
    }

    const now = new Date();
    const pastDocs = eventsSnap.docs.filter((doc) => {
      const end = effectiveEndDate(doc.data());
      return end !== null && end <= now;
    });

    if (pastDocs.length === 0) {
      return NextResponse.json({ events: [] });
    }

    const reportRefs = pastDocs.map((d) =>
      adminDb.collection("eventReports").doc(d.id)
    );
    const reportDocs = await adminDb.getAll(...reportRefs);

    const statusByEventId = new Map<string, EventReportStatus>();
    const reviewCommentsByEventId = new Map<string, string | null>();
    for (const doc of reportDocs) {
      if (doc.exists) {
        const d = doc.data()!;
        statusByEventId.set(doc.id, d.status as EventReportStatus);
        reviewCommentsByEventId.set(doc.id, d.reviewComments ?? null);
      }
    }

    const creatorIds = new Set<string>();
    for (const doc of pastDocs) {
      const cb: string | undefined = doc.data().createdBy;
      if (cb) creatorIds.add(cb);
    }

    const creatorNames = new Map<string, string>();
    if (creatorIds.size > 0) {
      const userRefs = Array.from(creatorIds).map((uid) =>
        adminDb.collection("users").doc(uid)
      );
      const userDocs = await adminDb.getAll(...userRefs);
      for (const u of userDocs) {
        if (u.exists) {
          creatorNames.set(u.id, u.data()!.name || "");
        }
      }
    }

    const events: OverdueEvent[] = [];
    for (const doc of pastDocs) {
      const data = doc.data();
      const reportStatus = statusByEventId.get(doc.id);
      const effective: "NONE" | "DRAFT" | "CHANGES_REQUESTED" | "SUBMITTED" | "REVIEWED" =
        reportStatus ?? "NONE";

      if (effective === "SUBMITTED" || effective === "REVIEWED") continue;

      events.push({
        id: doc.id,
        title: data.title,
        type: data.type as EventType,
        startDate: data.startDate?.toDate?.()?.toISOString() ?? null,
        endDate: data.endDate?.toDate?.()?.toISOString() ?? null,
        venue: data.venue || "",
        createdBy: data.createdBy || "",
        createdByName: creatorNames.get(data.createdBy || "") || null,
        reportStatus: effective,
        reviewComments: reviewCommentsByEventId.get(doc.id) ?? null,
      });
    }

    // Sort: NONE first, then CHANGES_REQUESTED, then DRAFT; within each, oldest
    // events first (most overdue).
    const priority: Record<string, number> = {
      NONE: 0,
      CHANGES_REQUESTED: 1,
      DRAFT: 2,
    };
    events.sort((a, b) => {
      const aP = priority[a.reportStatus] ?? 99;
      const bP = priority[b.reportStatus] ?? 99;
      if (aP !== bP) return aP - bP;
      return (a.endDate ?? "").localeCompare(b.endDate ?? "");
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET /api/event-reports/overdue error:", error);
    return NextResponse.json(
      { error: "Failed to fetch overdue events" },
      { status: 500 }
    );
  }
}
