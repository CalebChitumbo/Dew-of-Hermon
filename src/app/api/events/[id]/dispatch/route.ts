import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import { dispatchStakeholderRequests } from "@/lib/event-stakeholders";
import { getSessionCaller as getCaller } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

// ─── POST /api/events/[id]/dispatch ───
// Events Lead dispatches requests to every flagged stakeholder at once.

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await serverCheckFeatureAccess(
      "approve_events",
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Forbidden: Events Lead or Admin access required" },
        { status: 403 }
      );
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const status = eventDoc.data()!.approvalStatus;
    // Idempotent: allow re-dispatch while still gathering confirmations.
    if (status !== "PENDING_DISPATCH" && status !== "PENDING_STAKEHOLDERS") {
      return NextResponse.json(
        {
          error: `Cannot dispatch an event in status ${status}; must be PENDING_DISPATCH.`,
        },
        { status: 409 }
      );
    }

    const result = await dispatchStakeholderRequests(eventId, {
      uid: caller.uid,
      name: caller.name,
    });

    await eventRef.update({
      approvalStatus: "PENDING_STAKEHOLDERS",
      dispatchedAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      approvalStatus: "PENDING_STAKEHOLDERS",
      ...result,
    });
  } catch (error) {
    console.error("POST /api/events/[id]/dispatch error:", error);
    return NextResponse.json(
      { error: "Failed to dispatch stakeholder requests" },
      { status: 500 }
    );
  }
}
