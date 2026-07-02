import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { hasMinRole } from "@/lib/permissions";
import { getSessionCaller as getCaller } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

// ─── GET /api/events/[id] ───
// Returns a single event by ID.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;

    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const data = eventDoc.data()!;
    return NextResponse.json({
      id: eventDoc.id,
      title: data.title,
      description: data.description || null,
      type: data.type,
      startDate: data.startDate?.toDate?.()?.toISOString() || null,
      endDate: data.endDate?.toDate?.()?.toISOString() || null,
      venue: data.venue || "",
      isRecurring: data.isRecurring || false,
      lifeGroupTarget: data.lifeGroupTarget || null,
      approvalStatus: data.approvalStatus || "APPROVED",
      approvalComments: data.approvalComments || null,
      approvedBy: data.approvedBy || null,
      approvedAt: data.approvedAt?.toDate?.()?.toISOString() || null,
      createdByDepartmentId: data.createdByDepartmentId || null,
      coreRoles: data.coreRoles || [],
      createdBy: data.createdBy || "",
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
    });
  } catch (error) {
    console.error("GET /api/events/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/events/[id] ───
// Update event fields including core roles.
// Body: { coreRoles?: Array<{ role, assignedUserId, assignedUserName }>, ... }
// Access: Event creator, Events & Fellowship Manager, or ADMIN+

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;

    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(caller.role, "DEPARTMENT_LEAD")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eventData = eventDoc.data()!;

    // Permission: event creator, ADMIN+, or Events & Fellowship Manager
    const isCreator = eventData.createdBy === caller.uid;
    const isAdminPlus = hasMinRole(caller.role, "ADMIN");

    let isEfManager = false;
    if (!isCreator && !isAdminPlus) {
      const efSnap = await adminDb
        .collection("departments")
        .where("name", "==", "Events & Fellowship")
        .limit(1)
        .get();
      if (!efSnap.empty) {
        isEfManager =
          caller.role === "DEPARTMENT_LEAD" &&
          caller.leadsDepartmentIds.includes(efSnap.docs[0].id);
      }
    }

    if (!isCreator && !isAdminPlus && !isEfManager) {
      return NextResponse.json(
        { error: "Forbidden: Only the event creator, Events & Fellowship Manager, or Admin can edit this event" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const now = new Date();

    // Build update object — only allow specific fields to be updated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { updatedAt: now };

    if (body.coreRoles !== undefined) {
      updateData.coreRoles = (body.coreRoles || []).map(
        (r: { role: string; assignedUserId?: string; assignedUserName?: string }) => ({
          role: r.role,
          assignedUserId: r.assignedUserId || null,
          assignedUserName: r.assignedUserName || null,
        })
      );
    }

    if (body.title !== undefined) updateData.title = body.title;
    if (body.venue !== undefined) updateData.venue = body.venue;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.lifeGroupTarget !== undefined) updateData.lifeGroupTarget = body.lifeGroupTarget || null;

    // Material changes to an event that already passed Events-Lead review
    // (title, venue, audience) invalidate the sign-offs given for the old
    // details. Unless an Admin+ makes the change, send it back through the
    // approval pipeline. Staffing (coreRoles) and description edits are
    // operational and don't trigger re-approval.
    const MATERIAL_FIELDS = ["title", "venue", "lifeGroupTarget"] as const;
    const changedMaterial = MATERIAL_FIELDS.filter(
      (f) =>
        body[f] !== undefined && (body[f] || null) !== (eventData[f] ?? null)
    );
    const status = eventData.approvalStatus || "APPROVED";
    const pastLeadStage = [
      "APPROVED",
      "PENDING_VICE_CHAIR",
      "PENDING_CHAIR",
    ].includes(status);
    let approvalReset = false;
    if (changedMaterial.length > 0 && pastLeadStage && !isAdminPlus) {
      approvalReset = true;
      updateData.approvalStatus = "PENDING_DISPATCH";
      updateData.approvalComments = `Requires re-approval: ${changedMaterial.join(", ")} edited by ${caller.name} after the event passed Events Lead review.`;
      updateData.viceChairApprovedBy = null;
      updateData.viceChairApprovedAt = null;
      updateData.chairApprovedBy = null;
      updateData.chairApprovedAt = null;
      updateData.approvedBy = null;
      updateData.approvedAt = null;
    }

    await eventRef.update(updateData);

    return NextResponse.json({
      success: true,
      eventId,
      updated: Object.keys(updateData),
      approvalReset,
    });
  } catch (error) {
    console.error("PATCH /api/events/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}
