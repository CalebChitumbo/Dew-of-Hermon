import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { canAssignAnyRole, canAssignOwnDeptRole } from "@/lib/permissions";
import { UserRole, AssignmentStatus } from "@/types";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id: serviceId, assignmentId } = await params;
    const body = await request.json();
    const { status, notes, callerRole, callerId } = body;

    // For status updates, either the assigned user themselves or an admin can do it
    const assignmentDoc = await adminDb
      .collection("serviceAssignments")
      .doc(assignmentId)
      .get();

    if (!assignmentDoc.exists) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    const assignmentData = assignmentDoc.data()!;

    // Verify this assignment belongs to the specified service
    if (assignmentData.serviceId !== serviceId) {
      return NextResponse.json(
        { error: "Assignment does not belong to this service" },
        { status: 400 }
      );
    }

    // Permission: the assigned user can confirm/decline their own, admins can do anything
    const isOwnAssignment = callerId && assignmentData.userId === callerId;
    const isAdmin = callerRole && canAssignAnyRole(callerRole as UserRole);
    const isDeptLead = callerRole && canAssignOwnDeptRole(callerRole as UserRole);

    if (!isOwnAssignment && !isAdmin && !isDeptLead) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const validStatuses: AssignmentStatus[] = [
      "PENDING",
      "CONFIRMED",
      "DECLINED",
      "NO_RESPONSE",
    ];

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (status !== undefined) {
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.status = status;

      if (status === "CONFIRMED") {
        updateData.confirmedAt = new Date();
      }
    }

    if (notes !== undefined) {
      updateData.notes = notes || null;
    }

    await adminDb
      .collection("serviceAssignments")
      .doc(assignmentId)
      .update(updateData);

    // Fetch the updated document
    const updatedDoc = await adminDb
      .collection("serviceAssignments")
      .doc(assignmentId)
      .get();
    const updatedData = updatedDoc.data()!;

    return NextResponse.json({
      assignment: {
        id: updatedDoc.id,
        serviceId: updatedData.serviceId,
        roleId: updatedData.roleId,
        roleName: updatedData.roleName,
        userId: updatedData.userId,
        userName: updatedData.userName,
        userEmail: updatedData.userEmail,
        userPhone: updatedData.userPhone || null,
        status: updatedData.status,
        emailSent: updatedData.emailSent || false,
        emailSentAt: updatedData.emailSentAt?.toDate?.()?.toISOString() || null,
        confirmedAt: updatedData.confirmedAt?.toDate?.()?.toISOString() || null,
        notes: updatedData.notes || null,
        createdAt: updatedData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error("Error updating assignment:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update assignment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id: serviceId, assignmentId } = await params;
    const { searchParams } = new URL(request.url);
    const callerRole = searchParams.get("callerRole") as UserRole | null;

    if (!callerRole || (!canAssignAnyRole(callerRole) && !canAssignOwnDeptRole(callerRole))) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const assignmentDoc = await adminDb
      .collection("serviceAssignments")
      .doc(assignmentId)
      .get();

    if (!assignmentDoc.exists) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    const assignmentData = assignmentDoc.data()!;

    // Verify this assignment belongs to the specified service
    if (assignmentData.serviceId !== serviceId) {
      return NextResponse.json(
        { error: "Assignment does not belong to this service" },
        { status: 400 }
      );
    }

    await adminDb.collection("serviceAssignments").doc(assignmentId).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting assignment:", error);
    return NextResponse.json(
      { error: "Failed to delete assignment" },
      { status: 500 }
    );
  }
}
