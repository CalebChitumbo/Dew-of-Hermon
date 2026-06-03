import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
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

// ─── Helper: Get Events & Fellowship department ID ───

async function getEventsFellowshipDeptId(): Promise<string | null> {
  const snap = await adminDb
    .collection("departments")
    .where("name", "==", "Events & Fellowship")
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
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
        speaker: data.speaker || null,
        objective: data.objective || null,
        isPaid: data.isPaid || false,
        attendanceFee: data.attendanceFee ?? null,
        attendanceFeeCurrency: data.attendanceFeeCurrency || null,
        transportRequired: data.transportRequired || false,
        transportNeeds: data.transportNeeds || null,
        transportRequestId: data.transportRequestId || null,
        budgetRequested: data.budgetRequested || false,
        budgetAmount: data.budgetAmount ?? null,
        budgetCurrency: data.budgetCurrency || null,
        budgetPurpose: data.budgetPurpose || null,
        budgetRequestId: data.budgetRequestId || null,
        mediaRequired: data.mediaRequired || false,
        mediaNeeds: data.mediaNeeds || null,
        mediaRequestId: data.mediaRequestId || null,
        foodRequired: data.foodRequired || false,
        foodNeeds: data.foodNeeds || null,
        foodRequestId: data.foodRequestId || null,
        viceChairApprovedBy: data.viceChairApprovedBy || null,
        viceChairApprovedAt: data.viceChairApprovedAt?.toDate?.()?.toISOString() || null,
        chairApprovedBy: data.chairApprovedBy || null,
        chairApprovedAt: data.chairApprovedAt?.toDate?.()?.toISOString() || null,
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
      speaker,
      objective,
      isPaid,
      attendanceFee,
      attendanceFeeCurrency,
      transportRequired,
      transportNeeds,
      budgetRequested,
      budgetAmount,
      budgetCurrency,
      budgetPurpose,
      mediaRequired,
      mediaNeeds,
      foodRequired,
      foodNeeds,
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

    const speakerValue =
      typeof speaker === "string" && speaker.trim() ? speaker.trim() : null;
    const objectiveValue =
      typeof objective === "string" && objective.trim() ? objective.trim() : null;
    if (!objectiveValue) {
      return NextResponse.json(
        { error: "objective is required" },
        { status: 400 }
      );
    }

    const paidAttendance = Boolean(isPaid);
    const feeAmount = paidAttendance ? Number(attendanceFee) : null;
    const feeCurrency =
      paidAttendance &&
      typeof attendanceFeeCurrency === "string" &&
      attendanceFeeCurrency.trim()
        ? attendanceFeeCurrency.trim()
        : null;
    if (paidAttendance) {
      if (feeAmount === null || !Number.isFinite(feeAmount) || feeAmount <= 0) {
        return NextResponse.json(
          { error: "attendanceFee must be a positive number when isPaid is true" },
          { status: 400 }
        );
      }
      if (!feeCurrency) {
        return NextResponse.json(
          { error: "attendanceFeeCurrency is required when isPaid is true" },
          { status: 400 }
        );
      }
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

    const needsMedia = Boolean(mediaRequired);
    const mediaNeedsValue =
      needsMedia && typeof mediaNeeds === "string" && mediaNeeds.trim().length > 0
        ? mediaNeeds.trim()
        : null;
    if (needsMedia && !mediaNeedsValue) {
      return NextResponse.json(
        { error: "mediaNeeds is required when mediaRequired is true" },
        { status: 400 }
      );
    }

    const needsFood = Boolean(foodRequired);
    const foodNeedsValue =
      needsFood && typeof foodNeeds === "string" && foodNeeds.trim().length > 0
        ? foodNeeds.trim()
        : null;
    if (needsFood && !foodNeedsValue) {
      return NextResponse.json(
        { error: "foodNeeds is required when foodRequired is true" },
        { status: 400 }
      );
    }

    // Every event runs the full chain: initiator → Events Lead (dispatch +
    // gather stakeholder confirmations) → Vice Chair → Chairperson. New events
    // start awaiting the Events Lead's dispatch.
    const approvalStatus = "PENDING_DISPATCH";

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
      approvedBy: null,
      approvedAt: null,
      createdByDepartmentId: createdByDepartmentId || null,
      coreRoles: (coreRoles || []).map((r: { role: string; assignedUserId?: string; assignedUserName?: string }) => ({
        role: r.role,
        assignedUserId: r.assignedUserId || null,
        assignedUserName: r.assignedUserName || null,
      })),
      speaker: speakerValue,
      objective: objectiveValue,
      isPaid: paidAttendance,
      attendanceFee: feeAmount,
      attendanceFeeCurrency: feeCurrency,
      transportRequired: needsTransport,
      transportNeeds: transportNeedsValue,
      transportRequestId: null,
      budgetRequested: wantsBudget,
      budgetAmount: budgetAmountValue,
      budgetCurrency: budgetCurrencyValue,
      budgetPurpose: budgetPurposeValue,
      budgetRequestId: null,
      mediaRequired: needsMedia,
      mediaNeeds: mediaNeedsValue,
      mediaRequestId: null,
      foodRequired: needsFood,
      foodNeeds: foodNeedsValue,
      foodRequestId: null,
      dispatchedAt: null,
      viceChairApprovedBy: null,
      viceChairApprovedAt: null,
      chairApprovedBy: null,
      chairApprovedAt: null,
      createdBy: caller.uid,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection("events").add(eventData);

    // Every new event awaits the Events Lead's dispatch. Notify the Events &
    // Fellowship managers so they can dispatch the flagged stakeholder requests.
    notifyEventsFellowshipManagers(docRef.id, title).catch(console.error);

    return NextResponse.json(
      {
        id: docRef.id,
        ...eventData,
        startDate: eventData.startDate.toISOString(),
        endDate: eventData.endDate?.toISOString() || null,
        approvedAt: null,
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
