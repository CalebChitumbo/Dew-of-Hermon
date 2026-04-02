import { adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";

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

export { DEPT_ROLE_TEMPLATES };

/**
 * Auto-create eventDepartmentRoles skeleton for an approved event.
 */
export async function createDepartmentRoleSkeletons(eventId: string) {
  const batch = adminDb.batch();
  const now = new Date();

  for (const template of DEPT_ROLE_TEMPLATES) {
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

/**
 * Notify targeted members about an approved event.
 * Sends to members in the targeted Life Group, or all active members if target is "ALL" or null.
 */
export async function notifyTargetedMembers(
  eventId: string,
  eventTitle: string,
  lifeGroupTarget: string | null
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let usersQuery: any = adminDb.collection("users").where("isActive", "==", true);

    if (lifeGroupTarget && lifeGroupTarget !== "ALL") {
      usersQuery = usersQuery.where("lifeGroup", "==", lifeGroupTarget);
    }

    const usersSnap = await usersQuery.get();

    const lifeGroupLabel =
      lifeGroupTarget && lifeGroupTarget !== "ALL"
        ? ` (${lifeGroupTarget.charAt(0) + lifeGroupTarget.slice(1).toLowerCase()} Life Group)`
        : "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const doc of usersSnap.docs as any[]) {
      const userData = doc.data();
      await createNotificationWithEmail({
        userId: doc.id,
        title: `New Event: ${eventTitle}`,
        message: `A new event "${eventTitle}"${lifeGroupLabel} has been scheduled. Check the calendar for details.`,
        type: "event",
        link: "/calendar",
        recipientEmail: userData.email,
        email: {
          subject: `New Event: ${eventTitle}`,
          text: `A new event "${eventTitle}"${lifeGroupLabel} has been scheduled. Log in to view the details on the calendar.`,
        },
      }).catch(console.error);
    }
  } catch (err) {
    console.error("Failed to notify targeted members:", err);
  }
}

/**
 * Notify department managers that their role assignments are ready for an event.
 */
export async function notifyDepartmentManagers(
  eventId: string,
  eventTitle: string
) {
  const deptNames = DEPT_ROLE_TEMPLATES.map((t) => t.deptName);

  for (const deptName of deptNames) {
    const deptSnap = await adminDb
      .collection("departments")
      .where("name", "==", deptName)
      .limit(1)
      .get();

    if (deptSnap.empty) continue;
    const deptId = deptSnap.docs[0].id;

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
