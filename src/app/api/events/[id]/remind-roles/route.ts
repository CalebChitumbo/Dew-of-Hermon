import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import { UserRole } from "@/types";
import { format } from "date-fns";

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

// Avoid spamming department heads with back-to-back nudges. A manual reminder
// can only be sent once every few hours per event.
const REMINDER_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

// ─── POST /api/events/[id]/remind-roles ───
// Lets the event creator (or Events & Fellowship Manager / Admin) nudge the
// department heads who still have unassigned roles on an APPROVED event.
// Access: event creator, ADMIN+, or Events & Fellowship Manager.

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

    if (!hasMinRole(caller.role, "DEPARTMENT_LEAD")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eventData = eventDoc.data()!;

    // Permission: event creator, ADMIN+, or Events & Fellowship Manager.
    // Mirrors the edit-event permission set in /api/events/[id] (PATCH).
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
        {
          error:
            "Forbidden: Only the event creator, Events & Fellowship Manager, or Admin can send role reminders",
        },
        { status: 403 }
      );
    }

    // Department roles only exist once the event is approved.
    if (eventData.approvalStatus !== "APPROVED") {
      return NextResponse.json(
        {
          error:
            "Reminders can only be sent once the event is approved and department roles exist.",
        },
        { status: 400 }
      );
    }

    // Find the unfilled department roles for this event.
    const unfilledSnap = await adminDb
      .collection("eventDepartmentRoles")
      .where("eventId", "==", eventId)
      .where("assignedUserId", "==", null)
      .get();

    if (unfilledSnap.empty) {
      return NextResponse.json({
        sent: 0,
        totalUnfilled: 0,
        notifiedDepartments: [],
        departmentsWithoutLead: [],
        message: "All department roles are already assigned.",
      });
    }

    // Cooldown: don't let reminders be fired repeatedly.
    const now = new Date();
    const lastReminderAt = eventData.lastRoleReminderAt?.toDate?.() || null;
    if (
      lastReminderAt &&
      now.getTime() - lastReminderAt.getTime() < REMINDER_COOLDOWN_MS
    ) {
      const remainingMs =
        REMINDER_COOLDOWN_MS - (now.getTime() - lastReminderAt.getTime());
      const remainingMins = Math.ceil(remainingMs / 60000);
      const wait =
        remainingMins >= 60
          ? `${Math.ceil(remainingMins / 60)} hour(s)`
          : `${remainingMins} minute(s)`;
      return NextResponse.json(
        {
          error: `A reminder was already sent recently. Please wait about ${wait} before reminding again.`,
        },
        { status: 429 }
      );
    }

    // Group the unfilled roles by department.
    const byDept = new Map<
      string,
      { departmentId: string; departmentName: string; roles: string[] }
    >();
    for (const roleDoc of unfilledSnap.docs) {
      const r = roleDoc.data();
      if (!byDept.has(r.departmentId)) {
        byDept.set(r.departmentId, {
          departmentId: r.departmentId,
          departmentName: r.departmentName,
          roles: [],
        });
      }
      byDept.get(r.departmentId)!.roles.push(r.role);
    }

    const eventTitle = eventData.title || "an upcoming event";
    const eventStart = eventData.startDate?.toDate?.() || null;
    const eventDateStr = eventStart
      ? format(eventStart, "EEE, d MMM yyyy")
      : "the scheduled date";
    const rolesLink = `/manage/events/${eventId}/roles`;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://dew-of-hermon-xy9h.vercel.app";
    const senderName = caller.name || "An event organizer";

    let sent = 0;
    const notified = new Set<string>();
    const notifiedDepartments: string[] = [];
    const departmentsWithoutLead: string[] = [];

    for (const [deptId, info] of Array.from(byDept.entries())) {
      const leadsSnap = await adminDb
        .collection("users")
        .where("leadsDepartmentIds", "array-contains", deptId)
        .where("isActive", "==", true)
        .get();

      if (leadsSnap.empty) {
        departmentsWithoutLead.push(info.departmentName);
        continue;
      }

      const roleList = info.roles.join(", ");
      let notifiedThisDept = false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const lead of leadsSnap.docs as any[]) {
        if (notified.has(lead.id)) {
          notifiedThisDept = true;
          continue;
        }
        notified.add(lead.id);
        const leadData = lead.data();
        try {
          await createNotificationWithEmail({
            userId: lead.id,
            title: "Reminder: Unfilled Event Roles",
            message: `${senderName} is reminding you that ${info.departmentName} has ${info.roles.length} unfilled role(s) for "${eventTitle}" on ${eventDateStr}: ${roleList}.`,
            type: "reminder",
            link: rolesLink,
            recipientEmail: leadData.email,
            email: {
              subject: `Reminder: Please assign roles for "${eventTitle}"`,
              text: `Hi ${leadData.name || "there"},\n\n${senderName} is reminding you that your department (${info.departmentName}) still has ${info.roles.length} unfilled role(s) for the event "${eventTitle}" on ${eventDateStr}.\n\nUnfilled roles: ${roleList}\n\nPlease assign team members as soon as possible.\n\nView the role board: ${appUrl}${rolesLink}`,
            },
          });
          sent++;
          notifiedThisDept = true;
        } catch (err) {
          console.error(
            `Role reminder failed for ${leadData.email}:`,
            err instanceof Error ? err.message : err
          );
        }
      }

      if (notifiedThisDept) notifiedDepartments.push(info.departmentName);
    }

    // Only stamp the cooldown if we actually reached someone.
    if (sent > 0) {
      await eventRef.update({
        lastRoleReminderAt: now,
        lastRoleReminderBy: caller.uid,
      });
    }

    return NextResponse.json({
      sent,
      totalUnfilled: unfilledSnap.size,
      notifiedDepartments,
      departmentsWithoutLead,
    });
  } catch (error) {
    console.error("POST /api/events/[id]/remind-roles error:", error);
    return NextResponse.json(
      { error: "Failed to send role reminders" },
      { status: 500 }
    );
  }
}
