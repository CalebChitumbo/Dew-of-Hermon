import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import type {
  TransportRequestStatus,
  TransportRequestStatusHistoryEntry,
} from "@/types";

const TRANSPORT_DEPT_NAME = "Transport & Logistics";
const FINANCE_DEPT_NAME = "Finance";
const EVENTS_DEPT_NAME = "Events & Fellowship";

// ─── Department lookup ───

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

// ─── Create / cancel ───

interface CreateTransportRequestInput {
  eventId: string;
  eventTitle: string;
  eventStartDate: Date;
  needsDescription: string;
  routedBy: string;
  routedByName: string;
}

/**
 * Creates a new transportRequests doc in PENDING_DETAILS and writes the FK
 * back to the parent event. Returns the new request id.
 */
export async function createTransportRequest({
  eventId,
  eventTitle,
  eventStartDate,
  needsDescription,
  routedBy,
  routedByName,
}: CreateTransportRequestInput): Promise<string> {
  const now = new Date();
  const initialHistory: TransportRequestStatusHistoryEntry = {
    status: "PENDING_DETAILS",
    changedBy: routedBy,
    changedByName: routedByName,
    changedAt: now,
    comments: null,
  };

  const requestRef = await adminDb.collection("transportRequests").add({
    eventId,
    eventTitle,
    eventStartDate,
    needsDescription,
    status: "PENDING_DETAILS" as TransportRequestStatus,

    vehicleType: null,
    vehicleCount: null,
    estimatedCost: null,
    currency: null,
    pickupLocation: null,
    dropoffLocation: null,
    pickupTime: null,
    returnTime: null,
    coordinatorNotes: null,

    routedBy,
    routedByName,
    routedAt: now,
    filledBy: null,
    filledByName: null,
    filledAt: null,
    treasurerId: null,
    treasurerName: null,
    treasurerDecidedAt: null,
    treasurerComments: null,

    statusHistory: [initialHistory],
    createdAt: now,
    updatedAt: now,
  });

  await adminDb.collection("events").doc(eventId).update({
    transportRequestId: requestRef.id,
    updatedAt: now,
  });

  return requestRef.id;
}

/**
 * Transition helper: atomically updates status, bumps updatedAt, and appends
 * to statusHistory. Any extra fields in `patch` are merged into the doc.
 */
export async function transitionTransportRequest(
  requestId: string,
  newStatus: TransportRequestStatus,
  actor: { uid: string; name: string },
  comments: string | null = null,
  patch: Record<string, unknown> = {}
): Promise<void> {
  const now = new Date();
  const historyEntry: TransportRequestStatusHistoryEntry = {
    status: newStatus,
    changedBy: actor.uid,
    changedByName: actor.name,
    changedAt: now,
    comments,
  };

  await adminDb.collection("transportRequests").doc(requestId).update({
    ...patch,
    status: newStatus,
    updatedAt: now,
    statusHistory: FieldValue.arrayUnion(historyEntry),
  });
}

/**
 * Marks the transport request as CANCELLED. Called when the parent event is
 * rejected or deleted. Safe to call when no request exists.
 */
export async function cancelTransportRequestForEvent(
  eventId: string,
  actor: { uid: string; name: string },
  reason: string | null = null
): Promise<void> {
  const snap = await adminDb
    .collection("transportRequests")
    .where("eventId", "==", eventId)
    .limit(1)
    .get();
  if (snap.empty) return;
  const doc = snap.docs[0];
  const currentStatus = doc.data().status as TransportRequestStatus | undefined;
  if (currentStatus === "APPROVED" || currentStatus === "CANCELLED") return;

  await transitionTransportRequest(doc.id, "CANCELLED", actor, reason);
  notifyTransportCoordinators(
    doc.id,
    doc.data().eventTitle,
    `Transport request cancelled${reason ? `: ${reason}` : ""}`
  ).catch(console.error);
}

// ─── Notifications ───

export async function notifyTransportCoordinators(
  requestId: string,
  eventTitle: string,
  customMessage?: string
): Promise<void> {
  const leads = await getDepartmentLeads(TRANSPORT_DEPT_NAME);
  if (leads.length === 0) {
    console.warn(
      `[notifyTransportCoordinators] No active leads found for ${TRANSPORT_DEPT_NAME}; request ${requestId} not notified.`
    );
    return;
  }
  const message =
    customMessage ??
    `A new transport request for "${eventTitle}" needs costing. Please review and submit vehicle, schedule, and cost details.`;

  for (const lead of leads) {
    await createNotificationWithEmail({
      userId: lead.id,
      title: "New Transport Request",
      message,
      type: "event",
      link: `/manage/transport/requests/${requestId}`,
      recipientEmail: lead.email || undefined,
      email: {
        subject: `Transport request: ${eventTitle}`,
        text: `${message}\n\nView the request in the Transport Requests queue.`,
      },
    }).catch(console.error);
  }
}

export async function notifyTreasurers(
  requestId: string,
  eventTitle: string,
  estimatedCost: number | null,
  currency: string | null
): Promise<void> {
  const leads = await getDepartmentLeads(FINANCE_DEPT_NAME);
  if (leads.length === 0) {
    console.warn(
      `[notifyTreasurers] No active leads found for ${FINANCE_DEPT_NAME}; request ${requestId} not notified. ` +
        "Make sure the Finance department exists and has a DEPARTMENT_LEAD assigned."
    );
    return;
  }
  const costLabel =
    estimatedCost !== null && currency
      ? ` (${currency} ${estimatedCost.toLocaleString()})`
      : "";
  const message = `Transport cost for "${eventTitle}"${costLabel} is ready for funds confirmation.`;

  for (const lead of leads) {
    await createNotificationWithEmail({
      userId: lead.id,
      title: "Transport Funds Confirmation Needed",
      message,
      type: "event",
      link: `/manage/finance/transport-approvals`,
      recipientEmail: lead.email || undefined,
      email: {
        subject: `Funds confirmation: transport for ${eventTitle}`,
        text: `${message}\n\nReview and approve/request changes in the Transport Approvals queue.`,
      },
    }).catch(console.error);
  }
}

type TreasurerDecision = "APPROVED" | "REQUEST_CHANGES" | "REJECTED";

/**
 * Notify the Events Coordinator(s) and the event creator about a treasurer
 * decision on the transport request.
 */
export async function notifyEventsLeadOfTransportDecision(
  params: {
    requestId: string;
    eventId: string;
    eventTitle: string;
    eventCreatorId: string | null;
    decision: TreasurerDecision;
    comments: string | null;
  }
): Promise<void> {
  const { requestId, eventId, eventTitle, eventCreatorId, decision, comments } = params;
  const leads = await getDepartmentLeads(EVENTS_DEPT_NAME);

  const decisionLabel =
    decision === "APPROVED"
      ? "approved"
      : decision === "REQUEST_CHANGES"
        ? "sent back for changes"
        : "rejected";

  const titleByDecision: Record<TreasurerDecision, string> = {
    APPROVED: "Transport Approved — Ready for Event Approval",
    REQUEST_CHANGES: "Treasurer Requested Transport Changes",
    REJECTED: "Treasurer Rejected Transport Request",
  };
  const messageByDecision: Record<TreasurerDecision, string> = {
    APPROVED: `The treasurer has confirmed funds for transport on "${eventTitle}". You can now approve the event.`,
    REQUEST_CHANGES: `The treasurer requested changes to the transport plan for "${eventTitle}".${comments ? ` Notes: ${comments}` : ""}`,
    REJECTED: `The treasurer rejected the transport request for "${eventTitle}".${comments ? ` Reason: ${comments}` : ""}`,
  };

  const link =
    decision === "APPROVED" || decision === "REJECTED"
      ? `/manage/events/approvals`
      : `/manage/transport/requests/${requestId}`;

  const recipients = new Map<string, LeadRecipient>();
  for (const lead of leads) recipients.set(lead.id, lead);

  // Include event creator on APPROVED and REJECTED (they need to know
  // the outcome). Skip duplicates.
  if (
    eventCreatorId &&
    (decision === "APPROVED" || decision === "REJECTED") &&
    !recipients.has(eventCreatorId)
  ) {
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
      title: titleByDecision[decision],
      message: messageByDecision[decision],
      type: "event",
      link,
      recipientEmail: recipient.email || undefined,
      email: {
        subject: `Transport ${decisionLabel}: ${eventTitle}`,
        text: messageByDecision[decision],
      },
    }).catch(console.error);
  }

  // Avoid unused-variable warning for eventId — the link already covers the route.
  void eventId;
}
