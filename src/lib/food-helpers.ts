import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import type {
  FoodRequestStatus,
  FoodRequestStatusHistoryEntry,
} from "@/types";

const FOOD_DEPT_NAME = "Food Logistics";
const EVENTS_DEPT_NAME = "Events & Fellowship";

async function getDepartmentIdByName(name: string): Promise<string | null> {
  const snap = await adminDb
    .collection("departments")
    .where("name", "==", name)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

interface LeadRecipient {
  id: string;
  email: string | null;
  name: string;
}

async function getDepartmentLeads(deptName: string): Promise<LeadRecipient[]> {
  const deptId = await getDepartmentIdByName(deptName);
  if (!deptId) return [];
  const snap = await adminDb
    .collection("users")
    .where("leadsDepartmentIds", "array-contains", deptId)
    .where("isActive", "==", true)
    .get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      email: data.email || null,
      name: data.name || "",
    };
  });
}

interface CreateFoodRequestInput {
  eventId: string;
  eventTitle: string;
  eventStartDate: Date;
  needsDescription: string;
  routedBy: string;
  routedByName: string;
}

/**
 * Creates a new foodRequests doc in PENDING_FOOD, writes the FK back to the
 * parent event, and returns the new request id.
 */
export async function createFoodRequest({
  eventId,
  eventTitle,
  eventStartDate,
  needsDescription,
  routedBy,
  routedByName,
}: CreateFoodRequestInput): Promise<string> {
  const now = new Date();
  const initialHistory: FoodRequestStatusHistoryEntry = {
    status: "PENDING_FOOD",
    changedBy: routedBy,
    changedByName: routedByName,
    changedAt: now,
    comments: null,
  };

  const requestRef = await adminDb.collection("foodRequests").add({
    eventId,
    eventTitle,
    eventStartDate,
    needsDescription,
    status: "PENDING_FOOD" as FoodRequestStatus,

    headcount: null,
    menuPlan: null,
    coordinatorNotes: null,
    budgetRequestId: null,

    routedBy,
    routedByName,
    routedAt: now,
    confirmedBy: null,
    confirmedByName: null,
    confirmedAt: null,

    statusHistory: [initialHistory],
    createdAt: now,
    updatedAt: now,
  });

  await adminDb.collection("events").doc(eventId).update({
    foodRequestId: requestRef.id,
    updatedAt: now,
  });

  return requestRef.id;
}

/**
 * Atomically updates status, bumps updatedAt, and appends to statusHistory.
 * Any extra fields in `patch` are merged into the doc.
 */
export async function transitionFoodRequest(
  requestId: string,
  newStatus: FoodRequestStatus,
  actor: { uid: string; name: string },
  comments: string | null = null,
  patch: Record<string, unknown> = {}
): Promise<void> {
  const now = new Date();
  const historyEntry: FoodRequestStatusHistoryEntry = {
    status: newStatus,
    changedBy: actor.uid,
    changedByName: actor.name,
    changedAt: now,
    comments,
  };

  await adminDb.collection("foodRequests").doc(requestId).update({
    ...patch,
    status: newStatus,
    updatedAt: now,
    statusHistory: FieldValue.arrayUnion(historyEntry),
  });
}

/**
 * Marks the food request as CANCELLED. Called when the parent event is
 * rejected or deleted. Safe to call when no request exists.
 */
export async function cancelFoodRequestForEvent(
  eventId: string,
  actor: { uid: string; name: string },
  reason: string | null = null
): Promise<void> {
  const snap = await adminDb
    .collection("foodRequests")
    .where("eventId", "==", eventId)
    .limit(1)
    .get();
  if (snap.empty) return;
  const doc = snap.docs[0];
  const currentStatus = doc.data().status as FoodRequestStatus | undefined;
  if (
    currentStatus === "CONFIRMED" ||
    currentStatus === "DECLINED" ||
    currentStatus === "CANCELLED"
  ) {
    return;
  }

  await transitionFoodRequest(doc.id, "CANCELLED", actor, reason);
}

// ─── Notifications ───

export async function notifyFoodLeads(
  requestId: string,
  eventTitle: string,
  customMessage?: string
): Promise<void> {
  const leads = await getDepartmentLeads(FOOD_DEPT_NAME);
  if (leads.length === 0) {
    console.warn(
      `[notifyFoodLeads] No active leads found for ${FOOD_DEPT_NAME}; request ${requestId} not notified. ` +
        "Make sure the Food Logistics department exists and has a DEPARTMENT_LEAD assigned."
    );
    return;
  }
  const message =
    customMessage ??
    `A new food request for "${eventTitle}" needs planning. Please plan catering, request funds if needed, then confirm.`;

  for (const lead of leads) {
    await createNotificationWithEmail({
      userId: lead.id,
      title: "New Food Request",
      message,
      type: "event",
      link: `/manage/food/requests`,
      recipientEmail: lead.email || undefined,
      email: {
        subject: `Food request: ${eventTitle}`,
        text: `${message}\n\nView the request in the Food Requests queue.`,
      },
    }).catch(console.error);
  }
}

type FoodDecision = "CONFIRMED" | "DECLINED";

/**
 * Notify the Events Coordinator(s) and the event creator about a food lead's
 * decision on the food request.
 */
export async function notifyEventsLeadOfFoodDecision(params: {
  eventId: string;
  eventTitle: string;
  eventCreatorId: string | null;
  decision: FoodDecision;
  comments: string | null;
}): Promise<void> {
  const { eventTitle, eventCreatorId, decision, comments } = params;
  const leads = await getDepartmentLeads(EVENTS_DEPT_NAME);

  const title =
    decision === "CONFIRMED"
      ? "Food Confirmed"
      : "Food Could Not Be Provided";
  const message =
    decision === "CONFIRMED"
      ? `The Food Logistics team has confirmed catering for "${eventTitle}".`
      : `The Food Logistics team could not provide catering for "${eventTitle}".${comments ? ` Reason: ${comments}` : ""}`;

  const recipients = new Map<string, LeadRecipient>();
  for (const lead of leads) recipients.set(lead.id, lead);

  if (eventCreatorId && !recipients.has(eventCreatorId)) {
    const creatorDoc = await adminDb.collection("users").doc(eventCreatorId).get();
    if (creatorDoc.exists) {
      const data = creatorDoc.data()!;
      recipients.set(eventCreatorId, {
        id: eventCreatorId,
        email: data.email || null,
        name: data.name || "",
      });
    }
  }

  for (const recipient of Array.from(recipients.values())) {
    await createNotificationWithEmail({
      userId: recipient.id,
      title,
      message,
      type: "event",
      link: `/manage/events/approvals`,
      recipientEmail: recipient.email || undefined,
      email: {
        subject: `${title}: ${eventTitle}`,
        text: message,
      },
    }).catch(console.error);
  }
}
