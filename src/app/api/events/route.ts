import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import {
  createDepartmentRoleSkeletons,
  notifyTargetedMembers,
  notifyDepartmentManagers,
} from "@/lib/event-helpers";
import {
  createBudgetRequest,
  notifyTreasurersOfBudgetRequest,
} from "@/lib/budget-helpers";
import { EventType, UserRole, LifeGroup } from "@/types";

export const dynamic = "force-dynamic";

// ─── Helper: Get caller info from session cookie ───

async function getCaller(): Promise<{
  uid: string;
  role: UserRole;
  name: string;
  leadsDepartmentIds: string[];
  departmentIds: string[];
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
      departmentIds: data.departmentIds || [],
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

// ─── Helper: Get Events & Fellowship department ID ───

async function getEventsFellowshipDeptId(): Promise<string | null> {
  const snap = await adminDb
    .collection("departments")
    .where("name", "==", "Events & Fellowship")
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

// ─── Helper: Check if a user can auto-approve events ───

async function canAutoApprove(
  role: string,
  leadsDepartmentIds: string[]
): Promise<boolean> {
  if (hasMinRole(role, "ADMIN")) return true;
  const efDeptId = await getEventsFellowshipDeptId();
  if (!efDeptId) return false;
  return role === "DEPARTMENT_LEAD" && leadsDepartmentIds.includes(efDeptId);
}

// ─── Helper: Notify Events & Fellowship managers about a pending event ───

async function notifyEventsFellowshipManagers(
  eventId: string,
  eventTitle: string
) {
  try {
    const efDeptId = await getEventsFellowshipDeptId();
    if (!efDeptId) return;

    // Find users who lead Events & Fellowship
    const managersSnap = await adminDb
      .collection("users")
      .where("leadsDepartmentIds", "array-contains", efDeptId)
      .where("isActive", "==", true)
      .get();

    // Also include ADMINs
    const adminsSnap = await adminDb
      .collection("users")
      .where("role", "in", ["ADMIN", "SUPER_ADMIN"])
      .where("isActive", "==", true)
      .get();

    const notified = new Set<string>();
    const recipients = [...managersSnap.docs, ...adminsSnap.docs];

    for (const doc of recipients) {
      if (notified.has(doc.id)) continue;
      notified.add(doc.id);

      await createNotificationWithEmail({
        userId: doc.id,
        title: "New Event Pending Approval",
        message: `"${eventTitle}" has been submitted and is awaiting your approval.`,
        type: "event",
        link: `/manage/events/approvals`,
        recipientEmail: doc.data().email,
        email: {
          subject: `Event Pending Approval: ${eventTitle}`,
          text: `A new event "${eventTitle}" has been submitted for approval. Please review it at your earliest convenience.`,
        },
      });
    }
  } catch (err) {
    console.error("Failed to notify Events & Fellowship managers:", err);
  }
}

// ─── GET /api/events ───
// Query params:
//   - startDate (ISO string) — filter events from this date
//   - endDate (ISO string) — filter events up to this date
//   - type (EventType) — filter by event type
//   - approvalStatus — filter by approval status (admin/manager use)

export async function GET(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const typeParam = searchParams.get("type");
    const approvalStatusParam = searchParams.get("approvalStatus");

    // Build query conditionally to avoid FirebaseFirestore namespace typing issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let eventsQuery: any = adminDb.collection("events");

    if (startDateParam) {
      eventsQuery = eventsQuery.where("startDate", ">=", new Date(startDateParam));
    }
    if (endDateParam) {
      eventsQuery = eventsQuery.where("startDate", "<=", new Date(endDateParam));
    }
    if (typeParam) {
      eventsQuery = eventsQuery.where("type", "==", typeParam);
    }
    if (approvalStatusParam) {
      eventsQuery = eventsQuery.where("approvalStatus", "==", approvalStatusParam);
    }

    eventsQuery = eventsQuery.orderBy("startDate", "asc");

    const snapshot = await eventsQuery.get();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
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
        transportRequired: data.transportRequired || false,
        transportNeeds: data.transportNeeds || null,
        transportRequestId: data.transportRequestId || null,
        budgetRequested: data.budgetRequested || false,
        budgetAmount: data.budgetAmount ?? null,
        budgetCurrency: data.budgetCurrency || null,
        budgetPurpose: data.budgetPurpose || null,
        budgetRequestId: data.budgetRequestId || null,
        createdBy: data.createdBy || "",
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
      };
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

// ─── POST /api/events ───
// Body: { title, type, startDate, endDate?, venue, description?, isRecurring?,
//         lifeGroupTarget?, createdByDepartmentId?, coreRoles? }
// DEPARTMENT_LEAD+ can create; ADMIN+ / Events&Fellowship Manager auto-approved

export async function POST(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(caller.role, "DEPARTMENT_LEAD")) {
      return NextResponse.json(
        { error: "Forbidden: Department Lead access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      type,
      startDate,
      endDate,
      venue,
      description,
      isRecurring,
      lifeGroupTarget,
      createdByDepartmentId,
      coreRoles,
      transportRequired,
      transportNeeds,
      budgetRequested,
      budgetAmount,
      budgetCurrency,
      budgetPurpose,
    } = body;

    if (!title || !type || !startDate || !venue) {
      return NextResponse.json(
        { error: "Missing required fields: title, type, startDate, venue" },
        { status: 400 }
      );
    }

    const validTypes: EventType[] = [
      "POTTERS_WHEEL_SERVICE",
      "ROPS_CAMP",
      "RETREAT",
      "SPECIAL_EVENT",
      "MEETING",
      "OUTREACH",
    ];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid event type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const validLifeGroups: Array<LifeGroup | "ALL"> = ["BRIDGE", "ANCHOR", "CORNERSTONE", "ALL"];
    if (lifeGroupTarget && !validLifeGroups.includes(lifeGroupTarget)) {
      return NextResponse.json(
        { error: `Invalid lifeGroupTarget. Must be one of: ${validLifeGroups.join(", ")} or null` },
        { status: 400 }
      );
    }

    const needsTransport = Boolean(transportRequired);
    const transportNeedsValue =
      needsTransport && typeof transportNeeds === "string" && transportNeeds.trim().length > 0
        ? transportNeeds.trim()
        : null;
    if (needsTransport && !transportNeedsValue) {
      return NextResponse.json(
        { error: "transportNeeds is required when transportRequired is true" },
        { status: 400 }
      );
    }

    const wantsBudget = Boolean(budgetRequested);
    const budgetAmountValue = wantsBudget ? Number(budgetAmount) : null;
    const budgetCurrencyValue =
      wantsBudget && typeof budgetCurrency === "string" && budgetCurrency.trim()
        ? budgetCurrency.trim()
        : null;
    const budgetPurposeValue =
      wantsBudget && typeof budgetPurpose === "string" && budgetPurpose.trim()
        ? budgetPurpose.trim()
        : null;
    if (wantsBudget) {
      if (
        budgetAmountValue === null ||
        !Number.isFinite(budgetAmountValue) ||
        budgetAmountValue <= 0
      ) {
        return NextResponse.json(
          { error: "budgetAmount must be a positive number when budgetRequested is true" },
          { status: 400 }
        );
      }
      if (!budgetCurrencyValue) {
        return NextResponse.json(
          { error: "budgetCurrency is required when budgetRequested is true" },
          { status: 400 }
        );
      }
      if (!budgetPurposeValue) {
        return NextResponse.json(
          { error: "budgetPurpose is required when budgetRequested is true" },
          { status: 400 }
        );
      }
    }

    // Determine approval status. Events with transport or budget needs always
    // go through the approval queue so the financial/logistical side can be
    // reviewed — even when the creator would normally auto-approve.
    const eligibleForAutoApproval = await canAutoApprove(
      caller.role,
      caller.leadsDepartmentIds
    );
    const autoApproved = eligibleForAutoApproval && !needsTransport && !wantsBudget;
    const approvalStatus = autoApproved ? "APPROVED" : "PENDING_APPROVAL";

    const now = new Date();
    const eventData = {
      title,
      type,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      venue,
      description: description || null,
      isRecurring: isRecurring || false,
      lifeGroupTarget: lifeGroupTarget || null,
      approvalStatus,
      approvalComments: null,
      approvedBy: autoApproved ? caller.uid : null,
      approvedAt: autoApproved ? now : null,
      createdByDepartmentId: createdByDepartmentId || null,
      coreRoles: (coreRoles || []).map((r: { role: string; assignedUserId?: string; assignedUserName?: string }) => ({
        role: r.role,
        assignedUserId: r.assignedUserId || null,
        assignedUserName: r.assignedUserName || null,
      })),
      transportRequired: needsTransport,
      transportNeeds: transportNeedsValue,
      transportRequestId: null,
      budgetRequested: wantsBudget,
      budgetAmount: budgetAmountValue,
      budgetCurrency: budgetCurrencyValue,
      budgetPurpose: budgetPurposeValue,
      budgetRequestId: null,
      createdBy: caller.uid,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection("events").add(eventData);

    // If the event requests extra funds, auto-create the budget request and
    // notify the treasurer(s). The events coordinator does not need to route
    // this manually — there's no costing step like with transport.
    if (wantsBudget && budgetAmountValue !== null && budgetCurrencyValue && budgetPurposeValue) {
      try {
        const budgetRequestId = await createBudgetRequest({
          eventId: docRef.id,
          eventTitle: title,
          eventStartDate: new Date(startDate),
          requestedAmount: budgetAmountValue,
          currency: budgetCurrencyValue,
          purpose: budgetPurposeValue,
          requestedBy: caller.uid,
          requestedByName: caller.name,
        });
        notifyTreasurersOfBudgetRequest(
          budgetRequestId,
          title,
          budgetAmountValue,
          budgetCurrencyValue
        ).catch(console.error);
      } catch (err) {
        console.error("Failed to create budget request:", err);
      }
    }

    // Notify Events & Fellowship managers if event needs approval
    if (approvalStatus === "PENDING_APPROVAL") {
      notifyEventsFellowshipManagers(docRef.id, title).catch(console.error);
    }

    // Auto-approved events: notify targeted life group members (or all members),
    // create department role skeletons, and notify department managers
    if (autoApproved) {
      notifyTargetedMembers(
        docRef.id,
        title,
        lifeGroupTarget || null
      ).catch(console.error);

      createDepartmentRoleSkeletons(docRef.id).catch(console.error);
      notifyDepartmentManagers(docRef.id, title).catch(console.error);
    }

    return NextResponse.json(
      {
        id: docRef.id,
        ...eventData,
        startDate: eventData.startDate.toISOString(),
        endDate: eventData.endDate?.toISOString() || null,
        approvedAt: eventData.approvedAt?.toISOString() || null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/events error:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
