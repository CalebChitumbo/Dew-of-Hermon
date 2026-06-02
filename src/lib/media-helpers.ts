import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import type {
  MediaRequestStatus,
  MediaRequestStatusHistoryEntry,
} from "@/types";

const MEDIA_DEPT_NAME = "Media";
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

interface CreateMediaRequestInput {
  eventId: string;
  eventTitle: string;
  eventStartDate: Date;
  needsDescription: string;
  routedBy: string;
  routedByName: string;
}

/**
 * Creates a new mediaRequests doc in PENDING_MEDIA, writes the FK back to the
 * parent event, and returns the new request id.
 */
export async function createMediaRequest({
  eventId,
  eventTitle,
  eventStartDate,
  needsDescription,
  routedBy,
  routedByName,
}: CreateMediaRequestInput): Promise<string> {
  const now = new Date();
  const initialHistory: MediaRequestStatusHistoryEntry = {
    status: "PENDING_MEDIA",
    changedBy: routedBy,
    changedByName: routedByName,
    changedAt: now,
    comments: null,
  };

  const requestRef = await adminDb.collection("mediaRequests").add({
    eventId,
    eventTitle,
    eventStartDate,
    needsDescription,
    status: "PENDING_MEDIA" as MediaRequestStatus,

    soundUserId: null,
    soundUserName: null,
    publicityUserId: null,
    publicityUserName: null,
    coverageUserId: null,
    coverageUserName: null,
    coordinatorNotes: null,

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
    mediaRequestId: requestRef.id,
    updatedAt: now,
  });

  return requestRef.id;
}

/**
 * Atomically updates status, bumps updatedAt, and appends to statusHistory.
 * Any extra fields in `patch` are merged into the doc.
 */
export async function transitionMediaRequest(
  requestId: string,
  newStatus: MediaRequestStatus,
  actor: { uid: string; name: string },
  comments: string | null = null,
  patch: Record<string, unknown> = {}
): Promise<void> {
  const now = new Date();
  const historyEntry: MediaRequestStatusHistoryEntry = {
    status: newStatus,
    changedBy: actor.uid,
    changedByName: actor.name,
    changedAt: now,
    comments,
  };

  await adminDb.collection("mediaRequests").doc(requestId).update({
    ...patch,
    status: newStatus,
    updatedAt: now,
    statusHistory: FieldValue.arrayUnion(historyEntry),
  });
}

/**
 * Marks the media request as CANCELLED. Called when the parent event is
 * rejected or deleted. Safe to call when no request exists.
 */
export async function cancelMediaRequestForEvent(
  eventId: string,
  actor: { uid: string; name: string },
  reason: string | null = null
): Promise<void> {
  const snap = await adminDb
    .collection("mediaRequests")
    .where("eventId", "==", eventId)
    .limit(1)
    .get();
  if (snap.empty) return;
  const doc = snap.docs[0];
  const currentStatus = doc.data().status as MediaRequestStatus | undefined;
  if (
    currentStatus === "CONFIRMED" ||
    currentStatus === "DECLINED" ||
    currentStatus === "CANCELLED"
  ) {
    return;
  }

  await transitionMediaRequest(doc.id, "CANCELLED", actor, reason);
}

// ─── Notifications ───

export async function notifyMediaCoordinators(
  requestId: string,
  eventTitle: string,
  customMessage?: string
): Promise<void> {
  const leads = await getDepartmentLeads(MEDIA_DEPT_NAME);
  if (leads.length === 0) {
    console.warn(
      `[notifyMediaCoordinators] No active leads found for ${MEDIA_DEPT_NAME}; request ${requestId} not notified. ` +
        "Make sure the Media department exists and has a DEPARTMENT_LEAD assigned."
    );
    return;
  }
  const message =
    customMessage ??
    `A new media request for "${eventTitle}" needs attention. Please assign Sound, Publicity, and Coverage, then confirm.`;

  for (const lead of leads) {
    await createNotificationWithEmail({
      userId: lead.id,
      title: "New Media Request",
      message,
      type: "event",
      link: `/manage/media/requests`,
      recipientEmail: lead.email || undefined,
      email: {
        subject: `Media request: ${eventTitle}`,
        text: `${message}\n\nView the request in the Media Requests queue.`,
      },
    }).catch(console.error);
  }
}

type MediaDecision = "CONFIRMED" | "DECLINED";

/**
 * Notify the Events Coordinator(s) and the event creator about a media
 * coordinator's decision on the media request.
 */
export async function notifyEventsLeadOfMediaDecision(params: {
  eventId: string;
  eventTitle: string;
  eventCreatorId: string | null;
  decision: MediaDecision;
  comments: string | null;
}): Promise<void> {
  const { eventTitle, eventCreatorId, decision, comments } = params;
  const leads = await getDepartmentLeads(EVENTS_DEPT_NAME);

  const title =
    decision === "CONFIRMED"
      ? "Media Confirmed"
      : "Media Could Not Be Provided";
  const message =
    decision === "CONFIRMED"
      ? `The Media team has assigned roles and confirmed coverage for "${eventTitle}".`
      : `The Media team could not provide media for "${eventTitle}".${comments ? ` Reason: ${comments}` : ""}`;

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
