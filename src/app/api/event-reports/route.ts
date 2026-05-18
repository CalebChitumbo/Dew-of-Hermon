import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  getCallerFromSession,
  serializeReport,
  SerializedEventReport,
} from "@/lib/event-reports-helpers";
import { EventReportStatus, UserRole } from "@/types";

export const dynamic = "force-dynamic";

const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN"];

// ─── GET /api/event-reports ───
// Query params:
//   - status: optional EventReportStatus filter
//   - mine=true: caller's own reports only (initiator scope)
// Behavior:
//   - mine=true → always filtered to caller's reports (any role)
//   - else: ADMIN/SUPER_ADMIN see all; everyone else is forced to mine

export async function GET(request: Request) {
  try {
    const caller = await getCallerFromSession();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") as EventReportStatus | null;
    const mineParam = searchParams.get("mine") === "true";

    const restrictToOwn = mineParam || !ADMIN_ROLES.includes(caller.role);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = adminDb.collection("eventReports");

    if (restrictToOwn) {
      q = q.where("initiatorId", "==", caller.uid);
    }
    if (statusParam) {
      q = q.where("status", "==", statusParam);
    }

    const snap = await q.get();

    const reports = snap.docs.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc: any) => serializeReport(doc.id, doc.data())
    );

    // Sort: SUBMITTED queue first (oldest first → FIFO),
    // then everything else by updatedAt desc.
    reports.sort((a: SerializedEventReport, b: SerializedEventReport) => {
      const aPending = a.status === "SUBMITTED" ? 0 : 1;
      const bPending = b.status === "SUBMITTED" ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      if (a.status === "SUBMITTED" && b.status === "SUBMITTED") {
        return (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "");
      }
      return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    });

    return NextResponse.json({ reports });
  } catch (error) {
    console.error("GET /api/event-reports error:", error);
    return NextResponse.json(
      { error: "Failed to fetch event reports" },
      { status: 500 }
    );
  }
}
