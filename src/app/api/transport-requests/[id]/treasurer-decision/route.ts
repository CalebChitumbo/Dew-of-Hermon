import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import {
  notifyEventsLeadOfTransportDecision,
  notifyTransportCoordinators,
} from "@/lib/transport-helpers";
import { getSessionCaller as getCaller } from "@/lib/server-auth";
import { transitionIfStatus } from "@/lib/workflow-transitions";
import type { TransportRequestStatus } from "@/types";

export const dynamic = "force-dynamic";

type Action = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

const STATUS_BY_ACTION: Record<Action, TransportRequestStatus> = {
  APPROVE: "APPROVED",
  REQUEST_CHANGES: "PENDING_DETAILS",
  REJECT: "REJECTED_TREASURER",
};

// ─── PATCH /api/transport-requests/[id]/treasurer-decision ───
// Body: { action: "APPROVE" | "REQUEST_CHANGES" | "REJECT", comments?: string }

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await serverCheckFeatureAccess(
      "approve_accounts",
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Forbidden: Treasurer (Finance lead) or Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { action, comments } = (await request.json()) as {
      action: Action;
      comments?: string;
    };

    if (!action || !(action in STATUS_BY_ACTION)) {
      return NextResponse.json(
        { error: "Invalid action. Must be APPROVE, REQUEST_CHANGES, or REJECT" },
        { status: 400 }
      );
    }

    const trimmedComments =
      typeof comments === "string" && comments.trim() ? comments.trim() : null;
    if ((action === "REQUEST_CHANGES" || action === "REJECT") && !trimmedComments) {
      return NextResponse.json(
        { error: `Comments are required for ${action}` },
        { status: 400 }
      );
    }

    const now = new Date();
    const newStatus = STATUS_BY_ACTION[action];

    const txn = await transitionIfStatus({
      collection: "transportRequests",
      id,
      expectedStatus: "PENDING_TREASURER",
      newStatus,
      actor: { uid: caller.uid, name: caller.name },
      comments: trimmedComments,
      patch: {
        treasurerId: caller.uid,
        treasurerName: caller.name,
        treasurerDecidedAt: now,
        treasurerComments: trimmedComments,
      },
    });
    if (!txn.ok) {
      return NextResponse.json({ error: txn.error }, { status: txn.httpStatus });
    }
    const current = txn.current;

    // Resolve the event creator for downstream notifications
    let creatorId: string | null = null;
    try {
      const eventDoc = await adminDb
        .collection("events")
        .doc(current.eventId)
        .get();
      if (eventDoc.exists) {
        creatorId = eventDoc.data()?.createdBy || null;
      }
    } catch (err) {
      console.error("Failed to load event creator:", err);
    }

    if (action === "APPROVE" || action === "REJECT") {
      notifyEventsLeadOfTransportDecision({
        requestId: id,
        eventId: current.eventId,
        eventTitle: current.eventTitle,
        eventCreatorId: creatorId,
        decision: action === "APPROVE" ? "APPROVED" : "REJECTED",
        comments: trimmedComments,
      }).catch(console.error);
    } else {
      // REQUEST_CHANGES → back to the coordinator
      notifyTransportCoordinators(
        id,
        current.eventTitle,
        `Treasurer requested changes to the transport request for "${current.eventTitle}".${trimmedComments ? ` Notes: ${trimmedComments}` : ""}`
      ).catch(console.error);
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error(
      "PATCH /api/transport-requests/[id]/treasurer-decision error:",
      error
    );
    return NextResponse.json(
      { error: "Failed to record treasurer decision" },
      { status: 500 }
    );
  }
}
