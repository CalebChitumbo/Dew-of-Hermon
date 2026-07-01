import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  getFeaturePermissionsConfig,
  getDepartmentNameToIdMap,
} from "@/lib/feature-permissions-server";
import { checkFeatureAccess } from "@/lib/access-control";
import { createNotificationWithEmail } from "@/lib/notifications";
import { validateEmailConfig } from "@/lib/email";
import { UserRole, FeatureMinRoles, DepartmentAccessRule } from "@/types";

type FeatureConfig = { minRoles: FeatureMinRoles; rules: DepartmentAccessRule[] };

export const dynamic = "force-dynamic";

const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 6,
  VICE_CHAIRPERSON: 5,
  ADMIN: 4,
  DEPARTMENT_LEAD: 3,
  YOUTH_LEADER: 2,
  MEMBER: 1,
};
const hasMinRole = (role: string, min: string) =>
  (ROLE_HIERARCHY[role] || 0) >= (ROLE_HIERARCHY[min] || 0);

// A leader shouldn't get back-to-back digests. Skip anyone reminded within
// this window (mirrors the per-event cooldown on remind-roles).
const REMINDER_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

async function getCaller() {
  try {
    const session = (await cookies()).get("session");
    if (!session?.value) return null;
    const decoded = await adminAuth.verifySessionCookie(session.value);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    const d = userDoc.data()!;
    return {
      uid: decoded.uid,
      role: d.role as UserRole,
      name: (d.name as string) || "",
    };
  } catch {
    return null;
  }
}

// ─── Candidate recipient shape ───

interface Recipient {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  departmentIds: string[];
  leadsDepartmentIds: string[];
  lastPendingReminderAt: Date | null;
}

interface PendingItem {
  label: string;
  count: number;
  link: string;
}

// ─── The raw pending data, fetched once and evaluated per recipient ───

interface PendingData {
  eventStageCounts: Record<string, number>;
  eventReportsCount: number;
  joinManagerByDept: Record<string, number>;
  joinManagerTotal: number;
  joinChairCount: number;
  campusFollowUpCount: number;
  discipleshipCount: number;
  transportDetailsCount: number;
  transportTreasurerCount: number;
  mediaCount: number;
  foodCount: number;
  budgetTreasurerCount: number;
}

async function loadPendingData(): Promise<PendingData> {
  const [
    eventsSnap,
    reportsSnap,
    joinSnap,
    campusSnap,
    discipleshipSnap,
    transportSnap,
    mediaSnap,
    foodSnap,
    budgetSnap,
  ] = await Promise.all([
    adminDb
      .collection("events")
      .where("approvalStatus", "in", [
        "PENDING_DISPATCH",
        "PENDING_STAKEHOLDERS",
        "PENDING_VICE_CHAIR",
        "PENDING_CHAIR",
      ])
      .get(),
    adminDb.collection("eventReports").where("status", "==", "SUBMITTED").get(),
    adminDb
      .collection("departmentJoinRequests")
      .where("status", "in", ["PENDING_MANAGER", "PENDING_CHAIR"])
      .get(),
    adminDb
      .collection("followUpCards")
      .where("source", "==", "CAMPUS_MINISTRY")
      .where("status", "==", "PENDING_LEAD_APPROVAL")
      .get(),
    adminDb
      .collection("followUpCards")
      .where("status", "==", "NEW_CONTACT")
      .where("assigneeId", "==", null)
      .get(),
    adminDb
      .collection("transportRequests")
      .where("status", "in", ["PENDING_DETAILS", "PENDING_TREASURER"])
      .get(),
    adminDb
      .collection("mediaRequests")
      .where("status", "==", "PENDING_MEDIA")
      .get(),
    adminDb.collection("foodRequests").where("status", "==", "PENDING_FOOD").get(),
    adminDb
      .collection("budgetRequests")
      .where("status", "==", "PENDING_TREASURER")
      .get(),
  ]);

  const eventStageCounts: Record<string, number> = {};
  eventsSnap.docs.forEach((d) => {
    const s = d.data().approvalStatus as string;
    eventStageCounts[s] = (eventStageCounts[s] || 0) + 1;
  });

  const joinManagerByDept: Record<string, number> = {};
  let joinManagerTotal = 0;
  let joinChairCount = 0;
  joinSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.status === "PENDING_MANAGER") {
      joinManagerTotal += 1;
      const dept = data.departmentId as string | undefined;
      if (dept) joinManagerByDept[dept] = (joinManagerByDept[dept] || 0) + 1;
    } else if (data.status === "PENDING_CHAIR") {
      joinChairCount += 1;
    }
  });

  let transportDetailsCount = 0;
  let transportTreasurerCount = 0;
  transportSnap.docs.forEach((d) => {
    const s = d.data().status as string;
    if (s === "PENDING_DETAILS") transportDetailsCount += 1;
    else if (s === "PENDING_TREASURER") transportTreasurerCount += 1;
  });

  return {
    eventStageCounts,
    eventReportsCount: reportsSnap.size,
    joinManagerByDept,
    joinManagerTotal,
    joinChairCount,
    campusFollowUpCount: campusSnap.size,
    discipleshipCount: discipleshipSnap.size,
    transportDetailsCount,
    transportTreasurerCount,
    mediaCount: mediaSnap.size,
    foodCount: foodSnap.size,
    budgetTreasurerCount: budgetSnap.size,
  };
}

/**
 * Compute the queues awaiting a single leader/manager. This mirrors, item for
 * item, the gating in GET /api/pending-counts — so a leader is reminded of
 * exactly what their own sidebar badges show, no more and no less.
 */
function pendingForRecipient(
  r: Recipient,
  data: PendingData,
  config: FeatureConfig,
  deptMap: Record<string, string>
): PendingItem[] {
  const can = (featureKey: string) =>
    checkFeatureAccess(
      featureKey,
      r.role,
      r.departmentIds,
      r.leadsDepartmentIds,
      deptMap,
      config
    );

  const isAdminPlus = hasMinRole(r.role, "ADMIN");
  const isSuperAdmin = r.role === "SUPER_ADMIN";
  const items: PendingItem[] = [];
  const push = (label: string, count: number, link: string) => {
    if (count > 0) items.push({ label, count, link });
  };

  // 1. Event approvals — the stage(s) this user personally signs off.
  let approvalCount = 0;
  if (can("approve_events")) {
    approvalCount +=
      (data.eventStageCounts["PENDING_DISPATCH"] || 0) +
      (data.eventStageCounts["PENDING_STAKEHOLDERS"] || 0);
  }
  if (r.role === "VICE_CHAIRPERSON" || isSuperAdmin) {
    approvalCount += data.eventStageCounts["PENDING_VICE_CHAIR"] || 0;
  }
  if (isSuperAdmin) {
    approvalCount += data.eventStageCounts["PENDING_CHAIR"] || 0;
  }
  push(
    `${approvalCount} event${approvalCount === 1 ? "" : "s"} awaiting your approval`,
    approvalCount,
    "/manage/events/approvals"
  );

  // 2. Event reports awaiting the Chairperson's review.
  if (isSuperAdmin) {
    push(
      `${data.eventReportsCount} event report${data.eventReportsCount === 1 ? "" : "s"} awaiting your review`,
      data.eventReportsCount,
      "/manage/events/reports/review"
    );
  }

  // 3. Department join requests — manager stage (dept lead or ADMIN+/Vice)
  //    plus the chair stage (Chairperson only).
  let joinCount = 0;
  if (isAdminPlus || r.role === "VICE_CHAIRPERSON") {
    joinCount += data.joinManagerTotal;
  } else if (r.role === "DEPARTMENT_LEAD") {
    for (const deptId of r.leadsDepartmentIds) {
      joinCount += data.joinManagerByDept[deptId] || 0;
    }
  }
  if (isSuperAdmin) joinCount += data.joinChairCount;
  push(
    `${joinCount} department join request${joinCount === 1 ? "" : "s"} waiting for your action`,
    joinCount,
    "/manage/department-requests"
  );

  // 4. Campus Ministry follow-ups awaiting lead approval.
  if (can("approve_follow_up")) {
    push(
      `${data.campusFollowUpCount} campus follow-up${data.campusFollowUpCount === 1 ? "" : "s"} awaiting your approval`,
      data.campusFollowUpCount,
      "/department/campus-ministry"
    );
  }

  // 5. Discipleship — approved contacts not yet assigned.
  if (can("manage_follow_ups")) {
    push(
      `${data.discipleshipCount} new contact${data.discipleshipCount === 1 ? "" : "s"} to assign`,
      data.discipleshipCount,
      "/department/discipleship"
    );
  }

  // 6. Transport requests awaiting the coordinator's details.
  if (can("manage_transport_logistics")) {
    push(
      `${data.transportDetailsCount} transport request${data.transportDetailsCount === 1 ? "" : "s"} awaiting your details`,
      data.transportDetailsCount,
      "/manage/transport/requests"
    );
  }

  // 7. Media requests awaiting the Media coordinator's confirmation.
  if (can("manage_media")) {
    push(
      `${data.mediaCount} media request${data.mediaCount === 1 ? "" : "s"} awaiting your confirmation`,
      data.mediaCount,
      "/manage/media/requests"
    );
  }

  // 8. Food requests awaiting Food Logistics' confirmation.
  if (can("confirm_food")) {
    push(
      `${data.foodCount} food request${data.foodCount === 1 ? "" : "s"} awaiting your confirmation`,
      data.foodCount,
      "/manage/food/requests"
    );
  }

  // 9. Accounts — transport + budget requests awaiting the treasurer.
  if (can("approve_accounts")) {
    const accounts =
      data.transportTreasurerCount + data.budgetTreasurerCount;
    push(
      `${accounts} accounts approval${accounts === 1 ? "" : "s"} awaiting the treasurer`,
      accounts,
      "/manage/finance/approvals"
    );
  }

  return items;
}

async function loadRecipients(): Promise<Recipient[]> {
  // Only managers and departmental leads (and the admin staff above them) own
  // any of these queues — regular members and youth leaders never do. We filter
  // the role in memory so no extra composite index is required.
  const MANAGER_ROLES: ReadonlyArray<UserRole> = [
    "DEPARTMENT_LEAD",
    "ADMIN",
    "VICE_CHAIRPERSON",
    "SUPER_ADMIN",
  ];

  const snap = await adminDb
    .collection("users")
    .where("isActive", "==", true)
    .get();

  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: (data.name as string) || "there",
        email: (data.email as string) || null,
        role: data.role as UserRole,
        departmentIds: (data.departmentIds || []) as string[],
        leadsDepartmentIds: (data.leadsDepartmentIds || []) as string[],
        lastPendingReminderAt: data.lastPendingReminderAt?.toDate?.() || null,
      };
    })
    .filter((r) => MANAGER_ROLES.includes(r.role));
}

/**
 * Build the whole recipient → pending-items picture. Shared by GET (preview)
 * and POST (send).
 */
async function computePlan(excludeUid: string | null) {
  const [config, deptMap, data, recipients] = await Promise.all([
    getFeaturePermissionsConfig(),
    getDepartmentNameToIdMap(),
    loadPendingData(),
    loadRecipients(),
  ]);

  const plan = recipients
    .map((r) => ({
      recipient: r,
      items: pendingForRecipient(r, data, config, deptMap),
    }))
    .filter((p) => p.items.length > 0 && p.recipient.id !== excludeUid);

  return plan;
}

// ─── GET /api/pending-reminders ───
// Preview: who currently has pending items and how many, without sending.

export async function GET() {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasMinRole(caller.role, "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const plan = await computePlan(caller.uid);
    const totalItems = plan.reduce(
      (sum, p) => sum + p.items.reduce((s, i) => s + i.count, 0),
      0
    );
    const now = new Date();

    return NextResponse.json({
      recipientCount: plan.length,
      totalItems,
      recipients: plan.map((p) => ({
        id: p.recipient.id,
        name: p.recipient.name,
        itemCount: p.items.reduce((s, i) => s + i.count, 0),
        items: p.items.map((i) => ({ label: i.label, link: i.link })),
        hasEmail: !!p.recipient.email,
        // Lets the UI disable a per-person button that's still cooling down.
        onCooldown:
          !!p.recipient.lastPendingReminderAt &&
          now.getTime() - p.recipient.lastPendingReminderAt.getTime() <
            REMINDER_COOLDOWN_MS,
      })),
    });
  } catch (error) {
    console.error("GET /api/pending-reminders error:", error);
    return NextResponse.json(
      { error: "Failed to compute pending reminders" },
      { status: 500 }
    );
  }
}

// ─── POST /api/pending-reminders ───
// Emails responsible leaders/managers a digest of what's waiting on them.
// With no body, reminds every leader who has something pending. With a
// { userId } body, reminds only that one leader (so an admin can nudge a
// single person). Access: ADMIN and above (Chair / Vice / Admin staff).

export async function POST(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasMinRole(caller.role, "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Optional single-recipient target. Body may be empty for a broadcast.
    const body = (await request.json().catch(() => ({}))) as {
      userId?: string;
    };
    const targetUserId = body.userId || null;

    const configError = validateEmailConfig();
    if (configError) {
      console.error("Email config validation failed:", configError);
      return NextResponse.json(
        { error: "Email configuration error", message: configError },
        { status: 500 }
      );
    }

    let plan = await computePlan(caller.uid);

    if (targetUserId) {
      plan = plan.filter((p) => p.recipient.id === targetUserId);
      if (plan.length === 0) {
        return NextResponse.json({
          sent: 0,
          totalItems: 0,
          skippedCooldown: 0,
          noEmail: 0,
          recipients: [],
          message: "That leader has nothing waiting on them right now.",
        });
      }
    }

    if (plan.length === 0) {
      return NextResponse.json({
        sent: 0,
        totalItems: 0,
        skippedCooldown: 0,
        noEmail: 0,
        recipients: [],
        message: "Nothing is currently waiting on any leader.",
      });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://dew-of-hermon-xy9h.vercel.app";
    const now = new Date();
    const senderName = caller.name || "An administrator";

    let sent = 0;
    let skippedCooldown = 0;
    let noEmail = 0;
    const notifiedRecipients: string[] = [];

    for (const { recipient, items } of plan) {
      // Per-recipient cooldown so repeated clicks don't spam a leader.
      if (
        recipient.lastPendingReminderAt &&
        now.getTime() - recipient.lastPendingReminderAt.getTime() <
          REMINDER_COOLDOWN_MS
      ) {
        skippedCooldown += 1;
        continue;
      }

      if (!recipient.email) {
        noEmail += 1;
        continue;
      }

      const itemTotal = items.reduce((s, i) => s + i.count, 0);
      const textLines = items.map((i) => `• ${i.label} (${appUrl}${i.link})`);
      const htmlItems = items
        .map(
          (i) =>
            `<li style="margin-bottom:8px;">${i.label} — <a href="${appUrl}${i.link}" style="color:#14b8a6;">Open</a></li>`
        )
        .join("");

      const message = `${senderName} is reminding you that ${itemTotal} item${itemTotal === 1 ? "" : "s"} ${itemTotal === 1 ? "is" : "are"} waiting for your action.`;

      const text = [
        `Hi ${recipient.name},`,
        "",
        `${senderName} is reminding you that the following ${itemTotal === 1 ? "item is" : "items are"} currently waiting for your attention:`,
        "",
        ...textLines,
        "",
        "Please take a moment to action these when you can.",
        "",
        "Blessings,",
        "Potter's Wheel Team",
      ].join("\n");

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5C4033;">Items waiting for your attention</h2>
          <p>Hi ${recipient.name},</p>
          <p>${senderName} is reminding you that the following ${itemTotal === 1 ? "item is" : "items are"} currently waiting for your action:</p>
          <ul style="padding-left: 18px; color: #4b4b4b;">${htmlItems}</ul>
          <a href="${appUrl}/dashboard" style="display: inline-block; padding: 10px 24px; background-color: #14b8a6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 8px;">Open Dashboard</a>
          <p style="margin-top: 24px; color: #888;">Blessings,<br/>Potter's Wheel Team</p>
        </div>
      `;

      try {
        await createNotificationWithEmail({
          userId: recipient.id,
          recipientEmail: recipient.email,
          title: `${itemTotal} item${itemTotal === 1 ? "" : "s"} waiting for your attention`,
          message,
          type: "reminder",
          link: "/dashboard",
          email: {
            subject: `Reminder: ${itemTotal} item${itemTotal === 1 ? "" : "s"} waiting for your attention`,
            text,
            html,
          },
        });
        await adminDb
          .collection("users")
          .doc(recipient.id)
          .update({ lastPendingReminderAt: now });
        sent += 1;
        notifiedRecipients.push(recipient.name);
      } catch (err) {
        console.error(
          `Pending reminder failed for ${recipient.email}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    return NextResponse.json({
      sent,
      totalItems: plan.reduce(
        (sum, p) => sum + p.items.reduce((s, i) => s + i.count, 0),
        0
      ),
      skippedCooldown,
      noEmail,
      recipients: notifiedRecipients,
    });
  } catch (error) {
    console.error("POST /api/pending-reminders error:", error);
    return NextResponse.json(
      { error: "Failed to send pending reminders" },
      { status: 500 }
    );
  }
}
