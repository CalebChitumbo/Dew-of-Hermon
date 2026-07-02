import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

export type TransitionResult =
  | { ok: true; current: FirebaseFirestore.DocumentData }
  | { ok: false; error: string; httpStatus: number };

/**
 * Atomically move a workflow document from an expected status to a new one.
 *
 * Reads the doc, verifies its status, and applies the update inside a single
 * transaction so two concurrent approvers can't both pass the status guard
 * and double-apply a decision. Returns the document data as it was BEFORE the
 * transition (for building notifications), or a ready-to-return error.
 */
export async function transitionIfStatus(opts: {
  collection: string;
  id: string;
  /** Status(es) the document must currently be in. */
  expectedStatus: string | string[];
  newStatus: string;
  actor: { uid: string; name: string };
  comments?: string | null;
  /** Extra fields to set alongside the status change. */
  patch?: Record<string, unknown>;
  /**
   * Field that accumulates history entries via arrayUnion. Pass null for
   * documents that don't keep a history array. Defaults to "statusHistory".
   */
  historyField?: string | null;
  /** Field holding the status. Defaults to "status". */
  statusField?: string;
}): Promise<TransitionResult> {
  const {
    collection,
    id,
    expectedStatus,
    newStatus,
    actor,
    comments = null,
    patch = {},
    historyField = "statusHistory",
    statusField = "status",
  } = opts;
  const expected = Array.isArray(expectedStatus)
    ? expectedStatus
    : [expectedStatus];
  const ref = adminDb.collection(collection).doc(id);
  const now = new Date();

  return adminDb.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) {
      return { ok: false, error: "Not found", httpStatus: 404 } as const;
    }
    const current = doc.data()!;
    const status = current[statusField] as string | undefined;
    if (!status || !expected.includes(status)) {
      return {
        ok: false,
        error: `Cannot transition from status ${status}; must be ${expected.join(" or ")}`,
        httpStatus: 409,
      } as const;
    }

    const update: Record<string, unknown> = {
      ...patch,
      [statusField]: newStatus,
      updatedAt: now,
    };
    if (historyField) {
      update[historyField] = FieldValue.arrayUnion({
        status: newStatus,
        changedBy: actor.uid,
        changedByName: actor.name,
        changedAt: now,
        comments,
      });
    }
    tx.update(ref, update);

    return { ok: true, current } as const;
  });
}
