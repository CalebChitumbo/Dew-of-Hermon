import { adminDb } from "@/lib/firebase-admin";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import {
  getCallerToken,
  getSessionCaller,
  type SessionCaller,
} from "@/lib/server-auth";
import { REGISTRATIONS_COLLECTION } from "@/lib/camp-passes";
import {
  PASS_FEATURE_ADMISSIONS,
  PASS_FEATURE_CHAIR,
  PASS_FEATURE_GATE,
  PASS_FEATURE_MANAGER,
} from "@/lib/camp-passes";
import type { CampPassStage } from "@/types";

export interface PassCapabilities {
  /** Can sign off the Admissions stage (and log walk-up requests). */
  admissions: boolean;
  /** Can sign off the Camp Manager stage. */
  manager: boolean;
  /** Can sign off the Chairperson stage — this is what issues the pass. */
  chair: boolean;
  /** Can scan passes at the gate. */
  gate: boolean;
  /** Can see the camp register (existing camp-registration permission). */
  campAdmin: boolean;
}

export interface PassCaller extends SessionCaller {
  can: PassCapabilities;
  /**
   * Email addresses Firebase has confirmed this caller owns. Used to match
   * registrations submitted anonymously with the same address — never trust an
   * unverified email here, since sign-up accepts any address and would
   * otherwise let someone request passes for another family's camper.
   */
  verifiedEmails: string[];
}

/** Emails from the caller's credential, only when Firebase has verified them. */
async function getVerifiedEmails(profileEmail: string | null): Promise<string[]> {
  const token = await getCallerToken();
  if (!token?.emailVerified) return [];
  return Array.from(
    new Set(
      [token.email, profileEmail]
        .filter((e): e is string => !!e)
        .map((e) => e.toLowerCase())
    )
  );
}

/** Resolve the caller plus everything they're allowed to do with passes. */
export async function getPassCaller(): Promise<PassCaller | null> {
  const caller = await getSessionCaller();
  if (!caller) return null;

  const check = (featureKey: string) =>
    serverCheckFeatureAccess(
      featureKey,
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );

  const [admissions, manager, chair, gate, campAdmin, verifiedEmails] =
    await Promise.all([
      check(PASS_FEATURE_ADMISSIONS),
      check(PASS_FEATURE_MANAGER),
      check(PASS_FEATURE_CHAIR),
      check(PASS_FEATURE_GATE),
      check("manage_camp_registrations"),
      getVerifiedEmails(caller.email),
    ]);

  return {
    ...caller,
    can: { admissions, manager, chair, gate, campAdmin },
    verifiedEmails,
  };
}

/**
 * True when this caller is the camper/guardian behind a registration: they
 * either submitted it while signed in, or they hold a Firebase-verified email
 * that matches the one on the registration. Mirrors the ownership rule in
 * /api/camp-registrations/mine, so anything a caller can see there they can
 * also request a pass for.
 */
export function callerOwnsRegistration(
  caller: PassCaller,
  reg: FirebaseFirestore.DocumentData
): boolean {
  if (reg.submittedByUid && reg.submittedByUid === caller.uid) return true;
  if (caller.verifiedEmails.length === 0) return false;
  const onReg = [reg.parentEmail, reg.email]
    .filter((e): e is string => typeof e === "string" && !!e)
    .map((e) => e.toLowerCase());
  return onReg.some((email) => caller.verifiedEmails.includes(email));
}

/** Registration IDs this caller owns, by uid and by verified email. */
export async function getOwnedRegistrationIds(
  caller: PassCaller
): Promise<string[]> {
  const ids = new Set<string>();

  const byUid = await adminDb
    .collection(REGISTRATIONS_COLLECTION)
    .where("submittedByUid", "==", caller.uid)
    .get();
  byUid.docs.forEach((doc) => ids.add(doc.id));

  for (const email of caller.verifiedEmails) {
    for (const field of ["parentEmail", "email"] as const) {
      const snap = await adminDb
        .collection(REGISTRATIONS_COLLECTION)
        .where(field, "==", email)
        .get();
      snap.docs.forEach((doc) => ids.add(doc.id));
    }
  }

  return Array.from(ids);
}

/** True when the caller may act on a specific approval stage. */
export function canActOnStage(caller: PassCaller, stage: CampPassStage): boolean {
  if (stage === "ADMISSIONS") return caller.can.admissions;
  if (stage === "MANAGER") return caller.can.manager;
  return caller.can.chair;
}

/** True when the caller can see the staff queues at all. */
export function canSeeQueue(caller: PassCaller): boolean {
  const { admissions, manager, chair, campAdmin } = caller.can;
  return admissions || manager || chair || campAdmin;
}
