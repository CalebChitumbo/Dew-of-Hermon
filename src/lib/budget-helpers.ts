import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import type {
  BudgetRequestStatus,
  BudgetRequestStatusHistoryEntry,
} from "@/types";

const FINANCE_DEPT_NAME = "Finance";
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

interface CreateBudgetRequestInput {
  eventId: string;
  eventTitle: string;
  eventStartDate: Date;
  requestedAmount: number;
  currency: string;
  purpose: string;
  requestedBy: string;
  requestedByName: string;
}

/**
 * Creates a new budgetRequests doc in PENDING_TREASURER, writes the FK back
 * to the parent event, and returns the new request id.
 */
export async function createBudgetRequest({
  eventId,
  eventTitle,
  eventStartDate,
  requestedAmount,
  currency,
  purpose,
  requestedBy,
  requestedByName,
}: CreateBudgetRequestInput): Promise<string> {
  const now = new Date();
  const initialHistory: BudgetRequestStatusHistoryEntry = {
    status: "PENDING_TREASURER",
    changedBy: requestedBy,
    changedByName: requestedByName,
    changedAt: now,
    comments: null,
  };

  const requestRef = await adminDb.collection("budgetRequests").add({
    eventId,
    eventTitle,
    eventStartDate,
    requestedAmount,
    currency,
    purpose,
    requestedBy,
    requestedByName,
    status: "PENDING_TREASURER" as BudgetRequestStatus,

    approvedAmount: null,
    treasurerId: null,
    treasurerName: null,
    treasurerDecidedAt: null,
    treasurerComments: null,

    statusHistory: [initialHistory],
    createdAt: now,
    updatedAt: now,
  });

  await adminDb.collection("events").doc(eventId).update({
    budgetRequestId: requestRef.id,
    updatedAt: now,
  });

  return requestRef.id;
}

export async function transitionBudgetRequest(
  requestId: string,
  newStatus: BudgetRequestStatus,
  actor: { uid: string; name: string },
  comments: string | null = null,
  patch: Record<string, unknown> = {}
): Promise<void> {
  const now = new Date();
  const historyEntry: BudgetRequestStatusHistoryEntry = {
    status: newStatus,
    changedBy: actor.uid,
    changedByName: actor.name,
    changedAt: now,
    comments,
  };

  await adminDb.collection("budgetRequests").doc(requestId).update({
    ...patch,
    status: newStatus,
    updatedAt: now,
    statusHistory: FieldValue.arrayUnion(historyEntry),
  });
}

/**
 * Marks the budget request as CANCELLED. Called when the parent event is
 * rejected or deleted. Safe to call when no request exists.
 */
export async function cancelBudgetRequestForEvent(
  eventId: string,
  actor: { uid: string; name: string },
  reason: string | null = null
): Promise<void> {
  const snap = await adminDb
    .collection("budgetRequests")
    .where("eventId", "==", eventId)
    .limit(1)
    .get();
  if (snap.empty) return;
  const doc = snap.docs[0];
  const currentStatus = doc.data().status as BudgetRequestStatus | undefined;
  if (
    currentStatus === "APPROVED" ||
    currentStatus === "REJECTED" ||
    currentStatus === "CANCELLED"
  ) {
    return;
  }

  await transitionBudgetRequest(doc.id, "CANCELLED", actor, reason);
}

// ─── Notifications ───

export async function notifyTreasurersOfBudgetRequest(
  requestId: string,
  eventTitle: string,
  requestedAmount: number,
  currency: string
): Promise<void> {
  const leads = await getDepartmentLeads(FINANCE_DEPT_NAME);
  if (leads.length === 0) {
    console.warn(
      `[notifyTreasurersOfBudgetRequest] No active leads found for ${FINANCE_DEPT_NAME}; request ${requestId} not notified.`
    );
    return;
  }

  const message = `Budget request for "${eventTitle}" (${currency} ${requestedAmount.toLocaleString()}) is awaiting your review.`;

  for (const lead of leads) {
    await createNotificationWithEmail({
      userId: lead.id,
      title: "Budget Request Awaiting Review",
      message,
      type: "event",
      link: `/manage/finance/approvals`,
      recipientEmail: lead.email || undefined,
      email: {
        subject: `Budget request: ${eventTitle}`,
        text: `${message}\n\nReview and approve/reduce/reject in the Accounts Approvals queue.`,
      },
    }).catch(console.error);
  }
}

type BudgetDecision = "APPROVED" | "REJECTED";

/**
 * Notify the Events Coordinator(s) and the event creator about a treasurer
 * decision on the budget request.
 */
export async function notifyEventsLeadOfBudgetDecision(params: {
  requestId: string;
  eventId: string;
  eventTitle: string;
  eventCreatorId: string | null;
  decision: BudgetDecision;
  approvedAmount: number | null;
  currency: string;
  requestedAmount: number;
  comments: string | null;
}): Promise<void> {
  const {
    eventTitle,
    eventCreatorId,
    decision,
    approvedAmount,
    currency,
    requestedAmount,
    comments,
  } = params;
  const leads = await getDepartmentLeads(EVENTS_DEPT_NAME);

  const reduced =
    decision === "APPROVED" &&
    approvedAmount !== null &&
    approvedAmount < requestedAmount;

  const title =
    decision === "APPROVED"
      ? reduced
        ? "Budget Approved (Reduced)"
        : "Budget Approved"
      : "Budget Rejected";

  const message =
    decision === "APPROVED"
      ? reduced
        ? `Treasurer approved a reduced budget for "${eventTitle}": ${currency} ${approvedAmount?.toLocaleString()} (requested ${currency} ${requestedAmount.toLocaleString()}).${comments ? ` Notes: ${comments}` : ""}`
        : `Treasurer approved the full budget (${currency} ${requestedAmount.toLocaleString()}) for "${eventTitle}".`
      : `Treasurer rejected the budget request for "${eventTitle}".${comments ? ` Reason: ${comments}` : ""}`;

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
