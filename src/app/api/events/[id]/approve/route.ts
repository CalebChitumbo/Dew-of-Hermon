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

    const decoded = await adminAuth.verifyIdToken(session.value);
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
  SUPER_ADMIN: 5,
  ADMIN: 4,
  DEPARTMENT_LEAD: 3,
  YOUTH_LEADER: 2,
  MEMBER: 1,
};

function hasMinRole(role: string, required: string): boolean {
  return (ROLE_HIERARCHY[role] || 0) >= (ROLE_HIERARCHY[required] || 0);
}

// ─── Helper: Check if caller can approve events ───

async function checkCanApprove(
  role: string,
  leadsDepartmentIds: string[]
): Promise<boolean> {
  if (hasMinRole(role, "ADMIN")) return true;
  const efSnap = await adminDb
    .collection("departments")
    .where("name", "==", "Events & Fellowship")
    .limit(1)
    .get();
  if (efSnap.empty) return false;
  return role === "DEPARTMENT_LEAD" && leadsDepartmentIds.includes(efSnap.docs[0].id);
}

// ─── Department role templates to auto-create on event approval ───

const DEPT_ROLE_TEMPLATES: { deptName: string; roles: string[] }[] = [
  {
    deptName: "Media & Technical",
    roles: ["Camera", "Sound", "Visuals/Slides", "Social Media/Live"],
  },
  {
    deptName: "Hospitality",
    roles: ["Catering Lead", "Servers", "Cleanup"],
  },
  {
    deptName: "Transport & Logistics",
    roles: ["Driver(s)", "Logistics Coordinator"],
  },
  {
    deptName: "Youth Ablaze",
    roles: ["Intercession Lead", "Intercessors"],
  },
];

// ─── Helper: Auto-create eventDepartmentRoles skeleton for an approved event ───

async function createDepartmentRoleSkeletons(eventId: string) {
  const batch = adminDb.batch();
  const now = new Date();

  for (const template of DEPT_ROLE_TEMPLATES) {
    // Look up department by name
    const deptSnap = await adminDb
      .collection("departments")
      .where("name", "==", template.deptName)
      .limit(1)
      .get();

    if (deptSnap.empty) {
      console.warn(`Department not found: ${template.deptName}`);
      continue;
    }

    const deptId = deptSnap.docs[0].id;
    const deptName = deptSnap.docs[0].data().name;

    for (const roleName of template.roles) {
      const roleRef = adminDb.collection("eventDepartmentRoles").doc();
      batch.set(roleRef, {
        eventId,
        departmentId: deptId,
        departmentName: deptName,
        role: roleName,
        assignedUserId: null,
        assignedUserName: null,
        assignedAt: null,
        createdAt: now,
      });
    }
  }

  await batch.commit();
}

// ─── Helper: Notify department managers about their role assignments ───

async function notifyDepartmentManagers(eventId: string, eventTitle: string) {
  const deptNames = DEPT_ROLE_TEMPLATES.map((t) => t.deptName);

  for (const deptName of deptNames) {
    const deptSnap = await adminDb
      .collection("departments")
      .where("name", "==", deptName)
      .limit(1)
      .get();

    if (deptSnap.empty) continue;
    const deptId = deptSnap.docs[0].id;

    // Find leads for this department
    const leadsSnap = await adminDb
      .collection("users")
      .where("leadsDepartmentIds", "array-contains", deptId)
      .where("isActive", "==", true)
      .get();

    for (const lead of leadsSnap.docs) {
      const leadData = lead.data();
      await createNotificationWithEmail({
        userId: lead.id,
        title: "Event Role Assignments Ready",
        message: `The event "${eventTitle}" has been approved. Please assign ${deptName} roles.`,
        type: "event",
        link: `/manage/events/${eventId}/roles`,
        recipientEmail: leadData.email,
        email: {
          subject: `Action Required: Assign roles for "${eventTitle}"`,
          text: `The event "${eventTitle}" has been approved. Please log in to assign your department's roles.`,
        },
      }).catch(console.error);
    }
  }
}

// ─── PATCH /api/events/[id]/approve ───
// Body: { action: "APPROVE" | "REJECT" | "REQUEST_CHANGES", comments?: string }

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

    const canApprove = await checkCanApprove(caller.role, caller.leadsDepartmentIds);
    if (!canApprove) {
      return NextResponse.json(
        { error: "Forbidden: Events & Fellowship Manager or Admin access required" },
        { status: 403 }
      );
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eventData = eventDoc.data()!;
    const body = await request.json();
    const { action, comments } = body;

    if (!["APPROVE", "REJECT", "REQUEST_CHANGES"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be APPROVE, REJECT, or REQUEST_CHANGES" },
        { status: 400 }
      );
    }

    const now = new Date();

    if (action === "APPROVE") {
      await eventRef.update({
        approvalStatus: "APPROVED",
        approvedBy: caller.uid,
        approvedAt: now,
        approvalComments: comments || null,
        updatedAt: now,
      });

      // Auto-create department role skeletons
      createDepartmentRoleSkeletons(eventId).catch(console.error);

      // Notify department managers
      notifyDepartmentManagers(eventId, eventData.title).catch(console.error);

      // Notify event creator
      const creatorId = eventData.createdBy;
      if (creatorId) {
        const creatorDoc = await adminDb.collection("users").doc(creatorId).get();
        if (creatorDoc.exists) {
          await createNotificationWithEmail({
            userId: creatorId,
            title: "Event Approved",
            message: `Your event "${eventData.title}" has been approved and is now visible on the calendar.`,
            type: "event",
            link: "/calendar",
            recipientEmail: creatorDoc.data()?.email,
            email: {
              subject: `Event Approved: ${eventData.title}`,
              text: `Great news! Your event "${eventData.title}" has been approved and will appear on the calendar.`,
            },
          }).catch(console.error);
        }
      }

      return NextResponse.json({ success: true, approvalStatus: "APPROVED" });
    }

    if (action === "REJECT") {
      await eventRef.update({
        approvalStatus: "REJECTED",
        approvalComments: comments || null,
        updatedAt: now,
      });

      // Notify event creator
      const creatorId = eventData.createdBy;
      if (creatorId) {
        const creatorDoc = await adminDb.collection("users").doc(creatorId).get();
        if (creatorDoc.exists) {
          await createNotificationWithEmail({
            userId: creatorId,
            title: "Event Not Approved",
            message: `Your event "${eventData.title}" was not approved.${comments ? ` Reason: ${comments}` : ""}`,
            type: "event",
            link: "/manage/events/new",
            recipientEmail: creatorDoc.data()?.email,
            email: {
              subject: `Event Not Approved: ${eventData.title}`,
              text: `Your event "${eventData.title}" was not approved.${comments ? `\n\nReason: ${comments}` : ""}`,
            },
          }).catch(console.error);
        }
      }

      return NextResponse.json({ success: true, approvalStatus: "REJECTED" });
    }

    // REQUEST_CHANGES
    await eventRef.update({
      approvalStatus: "CHANGES_REQUESTED",
      approvalComments: comments || null,
      updatedAt: now,
    });

    // Notify event creator
    const creatorId = eventData.createdBy;
    if (creatorId) {
      const creatorDoc = await adminDb.collection("users").doc(creatorId).get();
      if (creatorDoc.exists) {
        await createNotificationWithEmail({
          userId: creatorId,
          title: "Changes Requested for Your Event",
          message: `Changes have been requested for "${eventData.title}".${comments ? ` Notes: ${comments}` : ""}`,
          type: "event",
          link: "/manage/events/new",
          recipientEmail: creatorDoc.data()?.email,
          email: {
            subject: `Changes Requested: ${eventData.title}`,
            text: `The Events & Fellowship team has requested changes to your event "${eventData.title}".${comments ? `\n\nNotes: ${comments}` : ""}`,
          },
        }).catch(console.error);
      }
    }

    return NextResponse.json({ success: true, approvalStatus: "CHANGES_REQUESTED" });
  } catch (error) {
    console.error("PATCH /api/events/[id]/approve error:", error);
    return NextResponse.json(
      { error: "Failed to process approval action" },
      { status: 500 }
    );
  }
}
