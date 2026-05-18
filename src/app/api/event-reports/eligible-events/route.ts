import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  effectiveEndDate,
  getCallerFromSession,
} from "@/lib/event-reports-helpers";
import { EventReportStatus } from "@/types";

export const dynamic = "force-dynamic";

// ─── GET /api/event-reports/eligible-events ───
// Returns events the caller initiated whose effective end date is in the past,
// each tagged with their current reportStatus ("NONE" if no report exists yet).

interface EligibleEvent {
  id: string;
  title: string;
  type: string;
  startDate: string | null;
  endDate: string | null;
  venue: string;
  approvalStatus: string;
  reportStatus: EventReportStatus | "NONE";
  reviewComments: string | null;
}

export async function GET() {
  try {
    const caller = await getCallerFromSession();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventsSnap = await adminDb
      .collection("events")
      .where("createdBy", "==", caller.uid)
      .get();

    if (eventsSnap.empty) {
      return NextResponse.json({ events: [] });
    }

    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eligibleDocs = eventsSnap.docs.filter((doc: any) => {
      const end = effectiveEndDate(doc.data());
      return end !== null && end <= now;
    });

    if (eligibleDocs.length === 0) {
      return NextResponse.json({ events: [] });
    }

    // Batch-fetch the corresponding eventReports docs by ID
    const reportRefs = eligibleDocs.map((d) =>
      adminDb.collection("eventReports").doc(d.id)
    );
    const reportDocs = await adminDb.getAll(...reportRefs);

    const reportByEventId = new Map<
      string,
      { status: EventReportStatus; reviewComments: string | null }
    >();
    for (const doc of reportDocs) {
      if (doc.exists) {
        const data = doc.data()!;
        reportByEventId.set(doc.id, {
          status: data.status,
          reviewComments: data.reviewComments ?? null,
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: EligibleEvent[] = eligibleDocs.map((doc: any) => {
      const data = doc.data();
      const report = reportByEventId.get(doc.id);
      return {
        id: doc.id,
        title: data.title,
        type: data.type,
        startDate: data.startDate?.toDate?.()?.toISOString() ?? null,
        endDate: data.endDate?.toDate?.()?.toISOString() ?? null,
        venue: data.venue || "",
        approvalStatus: data.approvalStatus || "APPROVED",
        reportStatus: report?.status ?? "NONE",
        reviewComments: report?.reviewComments ?? null,
      };
    });

    // Show urgent things first: CHANGES_REQUESTED → NONE → DRAFT → SUBMITTED → REVIEWED
    const priority: Record<string, number> = {
      CHANGES_REQUESTED: 0,
      NONE: 1,
      DRAFT: 2,
      SUBMITTED: 3,
      REVIEWED: 4,
    };
    events.sort((a, b) => {
      const aP = priority[a.reportStatus] ?? 99;
      const bP = priority[b.reportStatus] ?? 99;
      if (aP !== bP) return aP - bP;
      return (b.endDate ?? "").localeCompare(a.endDate ?? "");
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET /api/event-reports/eligible-events error:", error);
    return NextResponse.json(
      { error: "Failed to fetch eligible events" },
      { status: 500 }
    );
  }
}
