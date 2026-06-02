import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { UserRole } from "@/types";

export const dynamic = "force-dynamic";

// ─── Helper: Get caller info from session cookie ───

async function getCaller(): Promise<{
  uid: string;
  role: UserRole;
  name: string;
  leadsDepartmentIds: string[];
} | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) return null;

    const decoded = await adminAuth.verifySessionCookie(session.value);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;

    const data = userDoc.data()!;
    return {
      uid: decoded.uid,
      role: data.role as UserRole,
      name: data.name || "",
      leadsDepartmentIds: data.leadsDepartmentIds || [],
    };
  } catch {
    return null;
  }
}

const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 6,
  VICE_CHAIRPERSON: 5,
  ADMIN: 4,
  DEPARTMENT_LEAD: 3,
  YOUTH_LEADER: 2,
  MEMBER: 1,
};

function hasMinRole(role: string, required: string): boolean {
  return (ROLE_HIERARCHY[role] || 0) >= (ROLE_HIERARCHY[required] || 0);
}

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

    await eventRef.update(updateData);

    return NextResponse.json({ success: true, eventId, updated: Object.keys(updateData) });
  } catch (error) {
    console.error("PATCH /api/events/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}
