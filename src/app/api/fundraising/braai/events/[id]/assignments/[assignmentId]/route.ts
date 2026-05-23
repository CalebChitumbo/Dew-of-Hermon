import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { canPlanBraai, getCaller } from "../../../../_auth";
import type { AssignmentStatus } from "@/types";

export const dynamic = "force-dynamic";

const VALID_STATUSES: AssignmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "DECLINED",
  "NO_RESPONSE",
];

export async function PUT(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const caller = await getCaller(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: braaiEventId, assignmentId } = await params;
    const ref = adminDb.collection("braaiAssignments").doc(assignmentId);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }
    const data = doc.data()!;
    if (data.braaiEventId !== braaiEventId) {
      return NextResponse.json(
        { error: "Assignment does not belong to this braai" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const status = body.status as AssignmentStatus | undefined;
    const notes = body.notes as string | null | undefined;

    // Either the assignee can update their own (confirm/decline), or a planner.
    const isSelf = data.userId === caller.uid;
    const isPlanner = await canPlanBraai(caller);
    if (!isSelf && !isPlanner) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      update.status = status;
      if (status === "CONFIRMED") {
        update.confirmedAt = new Date();
      }
    }
    if (notes !== undefined) {
      update.notes = notes || null;
    }

    await ref.update(update);
    const updated = (await ref.get()).data()!;
    return NextResponse.json({
      assignment: {
        id: ref.id,
        braaiEventId: updated.braaiEventId,
        responsibilityKey: updated.responsibilityKey,
        responsibilityName: updated.responsibilityName,
        phase: updated.phase,
        userId: updated.userId,
        userName: updated.userName,
        userEmail: updated.userEmail,
        userPhone: updated.userPhone || null,
        status: updated.status,
        emailSent: updated.emailSent || false,
        emailSentAt: updated.emailSentAt?.toDate?.()?.toISOString() || null,
        confirmedAt: updated.confirmedAt?.toDate?.()?.toISOString() || null,
        notes: updated.notes || null,
        createdAt: updated.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: updated.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error updating braai assignment:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update assignment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const caller = await getCaller(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (caller.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only the Chairperson (Super Admin) can delete braai assignments" },
        { status: 403 }
      );
    }

    const { id: braaiEventId, assignmentId } = await params;
    const ref = adminDb.collection("braaiAssignments").doc(assignmentId);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }
    if (doc.data()!.braaiEventId !== braaiEventId) {
      return NextResponse.json(
        { error: "Assignment does not belong to this braai" },
        { status: 400 }
      );
    }
    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting braai assignment:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete assignment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
