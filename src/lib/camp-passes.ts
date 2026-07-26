import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import { getFeatureRecipients } from "@/lib/feature-permissions-server";
import type {
  CampPassStage,
  CampPassStatus,
  CampPassStatusHistoryEntry,
} from "@/types";

/**
 * ROPs Camp exit passes ("PASS system").
 *
 * A camper who needs to leave camp temporarily is signed off by three people
 * in order — Admissions → Camp Manager → Chairperson — and only the
 * Chairperson's approval mints a `passCode` and emails the QR ticket. The gate
 * scans that ticket exactly twice: once out, once back in. Any scan after that
 * is refused, so a forwarded screenshot or photocopy is worthless.
 */

// ─── Feature keys (configurable in Settings → Access Control) ───

export const PASS_FEATURE_ADMISSIONS = "camp_pass_admissions";
export const PASS_FEATURE_MANAGER = "camp_pass_manager";
export const PASS_FEATURE_CHAIR = "camp_pass_chair";
export const PASS_FEATURE_GATE = "scan_camp_passes";

export const PASS_STAGE_FEATURE: Record<CampPassStage, string> = {
  ADMISSIONS: PASS_FEATURE_ADMISSIONS,
  MANAGER: PASS_FEATURE_MANAGER,
  CHAIR: PASS_FEATURE_CHAIR,
};

/** The status a pass sits in while it waits for each stage. */
export const PASS_STAGE_STATUS: Record<CampPassStage, CampPassStatus> = {
  ADMISSIONS: "PENDING_ADMISSIONS",
  MANAGER: "PENDING_MANAGER",
  CHAIR: "PENDING_CHAIR",
};

/** Where an approval at each stage sends the pass next. */
export const PASS_STAGE_NEXT_STATUS: Record<CampPassStage, CampPassStatus> = {
  ADMISSIONS: "PENDING_MANAGER",
  MANAGER: "PENDING_CHAIR",
  CHAIR: "APPROVED",
};

export const PASS_STAGE_LABEL: Record<CampPassStage, string> = {
  ADMISSIONS: "Admissions",
  MANAGER: "Camp Manager",
  CHAIR: "Chairperson",
};

/** Statuses that mean the pass is still live (blocks a second request). */
export const ACTIVE_PASS_STATUSES: CampPassStatus[] = [
  "PENDING_ADMISSIONS",
  "PENDING_MANAGER",
  "PENDING_CHAIR",
  "APPROVED",
  "OUT",
];

export const PASSES_COLLECTION = "campPasses";
export const REGISTRATIONS_COLLECTION = "campRegistrations";

/** Staff queue for the pass workflow. */
export const PASS_QUEUE_LINK = "/manage/rops-camp/passes";
/** Gate scanner the guard uses. */
export const PASS_GATE_LINK = "/manage/rops-camp/gate";
/** Where a camper/guardian sees their own passes. */
export const PASS_CAMPER_LINK = "/rops-camp/my-registrations";

// ─── Pass codes ───

// Same unambiguous alphabet as the arrival check-in code: no 0/O or 1/I/L, so
// a code survives being read out over the phone at the gate.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12;

export function generatePassCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

/** "ABCDEFGHJKMN" → "ABCD-EFGH-JKMN" for human display. */
export function formatPassCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

/**
 * Reduce scanned/typed/pasted input to the stored form. Accepts the full gate
 * URL from a QR scan (`?pass=...`), a dashed code, or a bare code.
 */
export function normalizePassCode(input: string): string {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const fromParam = url.searchParams.get("pass");
    if (fromParam) {
      return fromParam.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    }
    // A registration arrival QR (`?code=...`) is deliberately NOT accepted
    // here — the gate must not treat an arrival pass as an exit pass.
    if (url.searchParams.get("code")) return "";
  } catch {
    // not a URL — treat as a raw code
  }
  return trimmed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** True when the scanned payload is an arrival check-in QR, not an exit pass. */
export function looksLikeArrivalQr(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return !!url.searchParams.get("code") && !url.searchParams.get("pass");
  } catch {
    return false;
  }
}

// ─── Serialization ───

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof value === "string") return value;
  return null;
}

/**
 * Shape sent to clients. `passCode` is included only for the surfaces that
 * legitimately render the ticket — callers pass `includeCode: false` for the
 * staff queues so an approver's browser never holds a scannable code.
 */
export function serializeCampPass(
  id: string,
  data: FirebaseFirestore.DocumentData,
  { includeCode = false }: { includeCode?: boolean } = {}
) {
  return {
    id,
    campId: data.campId,
    registrationId: data.registrationId,
    camperName: data.camperName,
    camperFirstName: data.camperFirstName ?? null,
    camperPhone: data.camperPhone ?? null,
    contactEmail: data.contactEmail ?? null,
    reason: data.reason,
    destination: data.destination ?? null,
    escortName: data.escortName ?? null,
    escortPhone: data.escortPhone ?? null,
    expectedReturnAt: toIso(data.expectedReturnAt),
    status: data.status as CampPassStatus,
    requestSource: data.requestSource ?? "ADMISSIONS",
    requestedByUid: data.requestedByUid ?? null,
    requestedByName: data.requestedByName ?? "",

    admissionsName: data.admissionsName ?? null,
    admissionsDecidedAt: toIso(data.admissionsDecidedAt),
    admissionsComments: data.admissionsComments ?? null,
    managerName: data.managerName ?? null,
    managerDecidedAt: toIso(data.managerDecidedAt),
    managerComments: data.managerComments ?? null,
    chairName: data.chairName ?? null,
    chairDecidedAt: toIso(data.chairDecidedAt),
    chairComments: data.chairComments ?? null,
    rejectedStage: (data.rejectedStage ?? null) as CampPassStage | null,

    passCode: includeCode ? (data.passCode ?? null) : null,
    passIssuedAt: toIso(data.passIssuedAt),
    passEmailSentAt: toIso(data.passEmailSentAt),
    passEmailSentTo: data.passEmailSentTo ?? null,
    passEmailCount: data.passEmailCount ?? 0,

    checkedOutAt: toIso(data.checkedOutAt),
    checkedOutByName: data.checkedOutByName ?? null,
    checkedInAt: toIso(data.checkedInAt),
    checkedInByName: data.checkedInByName ?? null,
    returnedLate: data.returnedLate ?? false,

    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export type SerializedCampPass = ReturnType<typeof serializeCampPass>;

/** True when a pass is out and already past its expected return time. */
export function isOverdue(
  pass: Pick<SerializedCampPass, "status" | "expectedReturnAt">,
  now: Date = new Date()
): boolean {
  if (pass.status !== "OUT" || !pass.expectedReturnAt) return false;
  return new Date(pass.expectedReturnAt).getTime() < now.getTime();
}

// ─── Creation ───

interface CreateCampPassInput {
  campId: string;
  registrationId: string;
  camperName: string;
  camperFirstName: string;
  camperPhone: string | null;
  contactEmail: string | null;
  reason: string;
  destination: string | null;
  escortName: string | null;
  escortPhone: string | null;
  expectedReturnAt: Date;
  requestSource: "CAMPER" | "ADMISSIONS";
  requestedByUid: string | null;
  requestedByName: string;
  /**
   * Stage the request opens at. A request logged by the admissions desk has
   * already been seen by admissions, so it opens at the Camp Manager; one
   * submitted online by a camper/guardian starts at Admissions.
   */
  openAtStage: CampPassStage;
}

export async function createCampPass(input: CreateCampPassInput): Promise<string> {
  const now = new Date();
  const status = PASS_STAGE_STATUS[input.openAtStage];
  const initialHistory: CampPassStatusHistoryEntry = {
    status,
    changedBy: input.requestedByUid ?? "",
    changedByName: input.requestedByName,
    changedAt: now,
    comments: null,
  };

  // The admissions desk logging a walk-up request IS the admissions sign-off,
  // so stamp that stage rather than leaving a hole in the audit trail.
  const admissionsStamped = input.openAtStage !== "ADMISSIONS";

  const ref = await adminDb.collection(PASSES_COLLECTION).add({
    campId: input.campId,
    registrationId: input.registrationId,
    camperName: input.camperName,
    camperFirstName: input.camperFirstName,
    camperPhone: input.camperPhone,
    contactEmail: input.contactEmail,
    reason: input.reason,
    destination: input.destination,
    escortName: input.escortName,
    escortPhone: input.escortPhone,
    expectedReturnAt: input.expectedReturnAt,
    status,
    requestSource: input.requestSource,
    requestedByUid: input.requestedByUid,
    requestedByName: input.requestedByName,

    admissionsId: admissionsStamped ? input.requestedByUid : null,
    admissionsName: admissionsStamped ? input.requestedByName : null,
    admissionsDecidedAt: admissionsStamped ? now : null,
    admissionsComments: null,

    managerId: null,
    managerName: null,
    managerDecidedAt: null,
    managerComments: null,

    chairId: null,
    chairName: null,
    chairDecidedAt: null,
    chairComments: null,

    rejectedStage: null,

    passCode: null,
    passIssuedAt: null,
    passEmailSentAt: null,
    passEmailSentTo: null,
    passEmailCount: 0,

    checkedOutAt: null,
    checkedOutBy: null,
    checkedOutByName: null,
    checkedInAt: null,
    checkedInBy: null,
    checkedInByName: null,
    returnedLate: false,

    statusHistory: [initialHistory],
    createdAt: now,
    updatedAt: now,
  });

  return ref.id;
}

/** True when the camper already has a pass in flight. */
export async function findActivePass(
  registrationId: string
): Promise<{ id: string; status: CampPassStatus } | null> {
  const snap = await adminDb
    .collection(PASSES_COLLECTION)
    .where("registrationId", "==", registrationId)
    .where("status", "in", ACTIVE_PASS_STATUSES)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, status: snap.docs[0].data().status };
}

// ─── Gate scanning ───

export type ScanAction = "CHECK_OUT" | "CHECK_IN";

export type ScanRefusal =
  | "NOT_FOUND"
  | "NOT_APPROVED"
  | "ALREADY_USED"
  | "REJECTED"
  | "CANCELLED"
  | "STATE_CHANGED";

export type ScanResult =
  | {
      ok: true;
      action: ScanAction;
      passId: string;
      pass: FirebaseFirestore.DocumentData;
      late: boolean;
    }
  | { ok: false; refusal: ScanRefusal; message: string; httpStatus: number };

const REFUSAL_MESSAGES: Record<CampPassStatus, { refusal: ScanRefusal; message: string }> = {
  PENDING_ADMISSIONS: {
    refusal: "NOT_APPROVED",
    message: "This pass is still waiting for Admissions. Do not let the camper out.",
  },
  PENDING_MANAGER: {
    refusal: "NOT_APPROVED",
    message: "This pass is still waiting for the Camp Manager. Do not let the camper out.",
  },
  PENDING_CHAIR: {
    refusal: "NOT_APPROVED",
    message: "This pass is still waiting for the Chairperson. Do not let the camper out.",
  },
  APPROVED: { refusal: "STATE_CHANGED", message: "" },
  OUT: { refusal: "STATE_CHANGED", message: "" },
  RETURNED: {
    refusal: "ALREADY_USED",
    message:
      "This pass has already been used to sign out and sign back in. It is no longer valid.",
  },
  REJECTED: {
    refusal: "REJECTED",
    message: "This pass was rejected. The camper may not leave camp.",
  },
  CANCELLED: {
    refusal: "CANCELLED",
    message: "This pass was cancelled. The camper may not leave camp.",
  },
};

/**
 * The one-scan-out / one-scan-in state machine, applied atomically.
 *
 * Resolves the code, verifies the pass is in exactly the state the scan
 * expects, and moves it on — all inside a single Firestore transaction, so two
 * guards scanning the same QR at the same moment can't both succeed. The
 * camper's registration is flipped in the same transaction, keeping the "who
 * is off-site right now" register consistent with the pass itself.
 *
 * `expect` comes from the guard's confirmation tap. If the pass moved on since
 * the preview was rendered, the scan is refused rather than silently applying
 * the other transition.
 */
export async function scanCampPass(
  code: string,
  actor: { uid: string; name: string },
  expect?: ScanAction
): Promise<ScanResult> {
  const normalized = normalizePassCode(code);
  if (!normalized) {
    return {
      ok: false,
      refusal: "NOT_FOUND",
      message: "That code isn't an exit pass.",
      httpStatus: 404,
    };
  }

  const query = adminDb
    .collection(PASSES_COLLECTION)
    .where("passCode", "==", normalized)
    .limit(1);

  return adminDb.runTransaction<ScanResult>(async (tx) => {
    // Firestore requires every read before any write, so the pass and the
    // camper's registration are both read up front.
    const snap = await tx.get(query);
    if (snap.empty) {
      return {
        ok: false,
        refusal: "NOT_FOUND",
        message: "No exit pass matches that code.",
        httpStatus: 404,
      };
    }

    const doc = snap.docs[0];
    const pass = doc.data();
    const status = pass.status as CampPassStatus;
    const now = new Date();

    const regRef = adminDb
      .collection(REGISTRATIONS_COLLECTION)
      .doc(pass.registrationId as string);
    const regSnap = await tx.get(regRef);

    const action: ScanAction | null =
      status === "APPROVED" ? "CHECK_OUT" : status === "OUT" ? "CHECK_IN" : null;

    if (!action) {
      const refusal = REFUSAL_MESSAGES[status] ?? {
        refusal: "NOT_APPROVED" as ScanRefusal,
        message: "This pass is not valid for scanning.",
      };
      return {
        ok: false,
        refusal: refusal.refusal,
        message: refusal.message,
        httpStatus: 409,
      };
    }

    if (expect && expect !== action) {
      return {
        ok: false,
        refusal: "STATE_CHANGED",
        message:
          action === "CHECK_IN"
            ? "This pass has already been scanned out. Scan again to check the camper back in."
            : "This pass hasn't been scanned out yet.",
        httpStatus: 409,
      };
    }

    const expectedReturn = pass.expectedReturnAt?.toDate?.() ?? null;
    const late =
      action === "CHECK_IN" && !!expectedReturn && now.getTime() > expectedReturn.getTime();

    const newStatus: CampPassStatus = action === "CHECK_OUT" ? "OUT" : "RETURNED";
    const historyEntry: CampPassStatusHistoryEntry = {
      status: newStatus,
      changedBy: actor.uid,
      changedByName: actor.name,
      changedAt: now,
      comments: null,
    };

    tx.update(doc.ref, {
      status: newStatus,
      ...(action === "CHECK_OUT"
        ? { checkedOutAt: now, checkedOutBy: actor.uid, checkedOutByName: actor.name }
        : {
            checkedInAt: now,
            checkedInBy: actor.uid,
            checkedInByName: actor.name,
            returnedLate: late,
          }),
      statusHistory: FieldValue.arrayUnion(historyEntry),
      updatedAt: now,
    });

    // Mirror the off-site flag onto the registration so the camp register
    // shows who is out without reading every pass. Skipped if the registration
    // has since been deleted — the scan itself still stands on the pass.
    if (regSnap.exists) {
      tx.update(
        regRef,
        action === "CHECK_OUT"
          ? { onPass: true, activePassId: doc.id, updatedAt: now }
          : { onPass: false, activePassId: null, updatedAt: now }
      );
    }

    return { ok: true, action, passId: doc.id, pass, late };
  });
}

// ─── Notifications ───

interface Recipient {
  id: string;
  name: string;
  email: string | null;
}

/**
 * Everyone who can sign off a given stage. Admissions and the gate are
 * department-scoped features, so this defers to the shared feature-permission
 * resolver rather than hardcoding roles.
 */
async function getStageApprovers(stage: CampPassStage): Promise<Recipient[]> {
  return getFeatureRecipients(PASS_STAGE_FEATURE[stage]);
}

/** Tell the people who own the next stage that a pass is waiting on them. */
export async function notifyStageApprovers(params: {
  passId: string;
  stage: CampPassStage;
  camperName: string;
  reason: string;
  expectedReturnAt: Date;
  actorName: string;
}): Promise<void> {
  const { passId, stage, camperName, reason, expectedReturnAt, actorName } = params;
  const approvers = await getStageApprovers(stage);
  if (approvers.length === 0) {
    console.warn(
      `[camp-passes] No ${PASS_STAGE_LABEL[stage]} recipients found for pass ${passId}; nobody was notified.`
    );
    return;
  }

  const returnLabel = expectedReturnAt.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const message =
    stage === "ADMISSIONS"
      ? `${camperName} has requested permission to leave camp. Reason: ${reason}. Expected back: ${returnLabel}.`
      : `${actorName} cleared ${camperName}'s request to leave camp. Reason: ${reason}. Expected back: ${returnLabel}.`;
  const title =
    stage === "CHAIR"
      ? "Exit Pass Awaiting Your Approval"
      : `Exit Pass Awaiting ${PASS_STAGE_LABEL[stage]}`;

  for (const approver of approvers) {
    await createNotificationWithEmail({
      userId: approver.id,
      title,
      message,
      type: "announcement",
      link: PASS_QUEUE_LINK,
      metadata: { campPassId: passId },
      recipientEmail: approver.email || undefined,
      email: {
        subject: `Camp exit pass — ${camperName} (${PASS_STAGE_LABEL[stage]} sign-off)`,
        text: `${message}\n\n${
          stage === "CHAIR"
            ? "Your approval issues the QR gate pass, so nobody leaves camp until you sign off."
            : "Review it in the ROPs Camp exit-pass queue."
        }`,
      },
    }).catch(console.error);
  }
}

/** Keep the requester (and the desk) in the loop on a decision. */
export async function notifyPassRequester(params: {
  passId: string;
  requestedByUid: string | null;
  camperName: string;
  stage: CampPassStage;
  decision: "APPROVED" | "REJECTED";
  comments: string | null;
  /** Only true on the Chairperson's approval — the pass ticket now exists. */
  issued?: boolean;
}): Promise<void> {
  const { passId, requestedByUid, camperName, stage, decision, comments, issued } = params;
  if (!requestedByUid) return;

  const message =
    decision === "REJECTED"
      ? `${PASS_STAGE_LABEL[stage]} declined the request for ${camperName} to leave camp.${
          comments ? ` Reason: ${comments}` : ""
        }`
      : issued
        ? `The Chairperson approved ${camperName}'s exit pass. The QR gate pass has been emailed and is also on the registration page.`
        : `${PASS_STAGE_LABEL[stage]} cleared ${camperName}'s request to leave camp. It now goes to the ${
            PASS_STAGE_LABEL[stage === "ADMISSIONS" ? "MANAGER" : "CHAIR"]
          }.`;

  await createNotificationWithEmail({
    userId: requestedByUid,
    title: decision === "REJECTED" ? "Exit Pass Declined" : "Exit Pass Update",
    message,
    type: "announcement",
    link: PASS_CAMPER_LINK,
    metadata: { campPassId: passId },
  }).catch(console.error);
}

/** Gate scan happened — let the camp manager and admissions know. */
export async function notifyPassScan(params: {
  passId: string;
  camperName: string;
  action: ScanAction;
  guardName: string;
  late: boolean;
  expectedReturnAt: Date | null;
}): Promise<void> {
  const { passId, camperName, action, guardName, late, expectedReturnAt } = params;

  const [managers, admissions] = await Promise.all([
    getStageApprovers("MANAGER"),
    getStageApprovers("ADMISSIONS"),
  ]);
  const recipients = new Map<string, Recipient>();
  for (const r of [...managers, ...admissions]) recipients.set(r.id, r);
  if (recipients.size === 0) return;

  const returnLabel = expectedReturnAt
    ? expectedReturnAt.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const title =
    action === "CHECK_OUT"
      ? "Camper Signed Out of Camp"
      : late
        ? "Camper Signed Back In — Late"
        : "Camper Signed Back In";
  const message =
    action === "CHECK_OUT"
      ? `${camperName} was scanned out of camp by ${guardName}.${
          returnLabel ? ` Expected back ${returnLabel}.` : ""
        }`
      : `${camperName} was scanned back into camp by ${guardName}.${
          late && returnLabel ? ` This is later than the expected ${returnLabel}.` : ""
        } The pass is now spent.`;

  for (const recipient of Array.from(recipients.values())) {
    await createNotificationWithEmail({
      userId: recipient.id,
      title,
      message,
      type: "announcement",
      link: PASS_QUEUE_LINK,
      metadata: { campPassId: passId },
      // Only the late-return case is worth an email; routine gate traffic
      // stays in-app so the camp team's inboxes survive camp week.
      ...(late && action === "CHECK_IN"
        ? {
            recipientEmail: recipient.email || undefined,
            email: {
              subject: `Late return: ${camperName} back at camp`,
              text: message,
            },
          }
        : {}),
    }).catch(console.error);
  }
}
