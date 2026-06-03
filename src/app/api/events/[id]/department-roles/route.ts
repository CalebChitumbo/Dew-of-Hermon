import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
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

// ─── GET /api/events/[id]/department-roles ───
// Returns all eventDepartmentRoles documents for the specified event.
// Access: DEPARTMENT_LEAD+

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

    if (!hasMinRole(caller.role, "DEPARTMENT_LEAD")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const snap = await adminDb
      .collection("eventDepartmentRoles")
      .where("eventId", "==", eventId)
      .get();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roles = snap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        eventId: data.eventId,
        departmentId: data.departmentId,
        departmentName: data.departmentName,
        role: data.role,
        assignedUserId: data.assignedUserId || null,
        assignedUserName: data.assignedUserName || null,
        assignedAt: data.assignedAt?.toDate?.()?.toISOString() || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    // Sort by departmentName then role for consistent ordering
    roles.sort((a: { departmentName: string; role: string }, b: { departmentName: string; role: string }) => {
      const deptCmp = a.departmentName.localeCompare(b.departmentName);
      return deptCmp !== 0 ? deptCmp : a.role.localeCompare(b.role);
    });

    return NextResponse.json({ roles });
  } catch (error) {
    console.error("GET /api/events/[id]/department-roles error:", error);
    return NextResponse.json(
      { error: "Failed to fetch department roles" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/events/[id]/department-roles ───
// Assigns (or clears) a user from a department role.
// Body: { roleId: string, assignedUserId: string | null, assignedUserName: string | null }
// Access: ADMIN+ can assign any role; DEPARTMENT_LEAD can only assign roles in their own dept.

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

    const body = await request.json();
    const { roleId, assignedUserId, assignedUserName } = body;

    if (!roleId) {
      return NextResponse.json(
        { error: "roleId is required" },
        { status: 400 }
      );
    }

    // Load the role document
    const roleRef = adminDb.collection("eventDepartmentRoles").doc(roleId);
    const roleDoc = await roleRef.get();

    if (!roleDoc.exists) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const roleData = roleDoc.data()!;

    // Verify this role belongs to the specified event
    if (roleData.eventId !== eventId) {
      return NextResponse.json(
        { error: "Role does not belong to this event" },
        { status: 400 }
      );
    }

    // Permission check: ADMIN+ can assign any role;
    // DEPARTMENT_LEAD can only assign roles in departments they lead.
    if (!hasMinRole(caller.role, "ADMIN")) {
      if (!caller.leadsDepartmentIds.includes(roleData.departmentId)) {
        return NextResponse.json(
          {
            error:
              "Forbidden: You can only assign roles in departments you lead",
          },
          { status: 403 }
        );
      }
    }

    const now = new Date();

    const isClearing = assignedUserId === null || assignedUserId === undefined;

    await roleRef.update({
      assignedUserId: isClearing ? null : assignedUserId,
      assignedUserName: isClearing ? null : (assignedUserName || null),
      assignedAt: isClearing ? null : now,
    });

    // Notify the newly assigned user (if assigning, not clearing)
    if (!isClearing && assignedUserId) {
      const eventDoc = await adminDb.collection("events").doc(eventId).get();
      const eventTitle = eventDoc.exists
        ? eventDoc.data()?.title || "an upcoming event"
        : "an upcoming event";

      const assigneeDoc = await adminDb
        .collection("users")
        .doc(assignedUserId)
        .get();

      if (assigneeDoc.exists) {
        await createNotificationWithEmail({
          userId: assignedUserId,
          title: "Role Assignment",
          message: `You have been assigned as "${roleData.role}" (${roleData.departmentName}) for ${eventTitle}.`,
          type: "assignment",
          link: `/manage/events/${eventId}/roles`,
          recipientEmail: assigneeDoc.data()?.email,
          email: {
            subject: `Role Assignment: ${roleData.role} — ${eventTitle}`,
            text: `You have been assigned as "${roleData.role}" in the ${roleData.departmentName} department for the event "${eventTitle}".\n\nPlease log in to view the event details.`,
          },
        }).catch(console.error);
      }
    }

    return NextResponse.json({
      success: true,
      roleId,
      assignedUserId: isClearing ? null : assignedUserId,
      assignedUserName: isClearing ? null : (assignedUserName || null),
    });
  } catch (error) {
    console.error("PATCH /api/events/[id]/department-roles error:", error);
    return NextResponse.json(
      { error: "Failed to update role assignment" },
      { status: 500 }
    );
  }
}
