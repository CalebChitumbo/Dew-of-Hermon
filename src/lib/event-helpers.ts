import { adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";

// ─── Department role templates to auto-create on event approval ───

const DEPT_ROLE_TEMPLATES: { deptName: string; roles: string[] }[] = [
  {
    deptName: "Media",
    roles: ["Sound", "Publicity", "Coverage"],
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
 * Returns a summary of created roles and any missing departments.
 */
export async function createDepartmentRoleSkeletons(eventId: string): Promise<{
  created: number;
  missingDepartments: string[];
}> {
  const batch = adminDb.batch();
  const now = new Date();
  let created = 0;
  const missingDepartments: string[] = [];

  for (const template of DEPT_ROLE_TEMPLATES) {
    const deptSnap = await adminDb
      .collection("departments")
      .where("name", "==", template.deptName)
      .limit(1)
      .get();

    if (deptSnap.empty) {
      console.warn(
        `[createDepartmentRoleSkeletons] Department not found: "${template.deptName}" — ` +
        `${template.roles.length} role(s) skipped for event ${eventId}. ` +
        `Ensure this department exists in the departments collection.`
      );
      missingDepartments.push(template.deptName);
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
      created++;
    }
  }

  await batch.commit();

  if (missingDepartments.length > 0) {
    console.warn(
      `[createDepartmentRoleSkeletons] Event ${eventId}: Created ${created} role(s), ` +
      `but ${missingDepartments.length} department(s) were missing: ${missingDepartments.join(", ")}`
    );
  }

  return { created, missingDepartments };
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
 * Notify all active Chairpersons (SUPER_ADMIN) that a post-event report has been
 * submitted and is awaiting review.
 */
export async function notifyChairpersonsOfReportSubmission(
  eventId: string,
  eventTitle: string,
  initiatorName: string
): Promise<void> {
  try {
    const chairpersonsSnap = await adminDb
      .collection("users")
      .where("role", "==", "SUPER_ADMIN")
      .where("isActive", "==", true)
      .get();

    for (const doc of chairpersonsSnap.docs) {
      const data = doc.data();
      await createNotificationWithEmail({
        userId: doc.id,
        title: "New Event Report Submitted",
        message: `${initiatorName} submitted a post-event report for "${eventTitle}". Please review.`,
        type: "event",
        link: `/manage/events/reports/review/${eventId}`,
        recipientEmail: data.email,
        email: {
          subject: `Event Report Submitted: ${eventTitle}`,
          text: `${initiatorName} has submitted the post-event report for "${eventTitle}". Log in to review the report.`,
        },
      }).catch(console.error);
    }
  } catch (err) {
    console.error("Failed to notify chairpersons of report submission:", err);
  }
}

/**
 * Notify the next executive approval tier that an event is waiting for them.
 * tier "VICE_CHAIR" notifies active Vice Chairpersons; "CHAIR" notifies active
 * Chairpersons (SUPER_ADMIN).
 */
export async function notifyApproversOfPendingEvent(
  eventTitle: string,
  tier: "VICE_CHAIR" | "CHAIR"
): Promise<void> {
  try {
    const role = tier === "VICE_CHAIR" ? "VICE_CHAIRPERSON" : "SUPER_ADMIN";
    const label = tier === "VICE_CHAIR" ? "Vice Chairperson" : "Chairperson";
    const snap = await adminDb
      .collection("users")
      .where("role", "==", role)
      .where("isActive", "==", true)
      .get();

    for (const doc of snap.docs) {
      const data = doc.data();
      await createNotificationWithEmail({
        userId: doc.id,
        title: `Event Awaiting Your Approval (${label})`,
        message: `"${eventTitle}" has passed the previous review stage and is awaiting your approval.`,
        type: "event",
        link: `/manage/events/approvals`,
        recipientEmail: data.email,
        email: {
          subject: `Event Awaiting ${label} Approval: ${eventTitle}`,
          text: `"${eventTitle}" is awaiting your approval. Please review it in the Event Approvals queue.`,
        },
      }).catch(console.error);
    }
  } catch (err) {
    console.error(`Failed to notify ${tier} approvers:`, err);
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
