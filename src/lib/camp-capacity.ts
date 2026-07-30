import type {
  DocumentReference,
  DocumentSnapshot,
} from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getCamp } from "@/lib/camps";

/**
 * Registration capacity for a camp.
 *
 * The static catalog in `@/lib/camps` carries the capacity the camp was
 * planned with. Camp admins can raise (or lower) that live from the manage
 * page without a deploy — the override lives in `campSettings/{campId}` and,
 * when present, wins over the catalog value.
 *
 * Server-only: everything here goes through the Admin SDK. Clients read and
 * write the capacity through /api/camp-registrations/capacity.
 */

/** Smallest capacity an admin may set. */
export const MIN_CAMP_CAPACITY = 1;
/** Guard-rail against a fat-fingered cap that would effectively be no cap. */
export const MAX_CAMP_CAPACITY = 5000;

/** The `campSettings` document holding admin overrides for a camp. */
export function campSettingsRef(campId: string): DocumentReference {
  return adminDb.collection("campSettings").doc(campId);
}

/** Capacity the camp was defined with in the static catalog. */
export function defaultCampCapacity(campId: string): number | null {
  return getCamp(campId)?.capacity ?? null;
}

/**
 * Pull the override out of an already-read settings snapshot. Kept separate
 * from `getCampCapacity` so the registration transaction can read the
 * settings doc with `tx.get` — reading it inside the transaction is what
 * makes a concurrent capacity change conflict and retry instead of being
 * silently ignored.
 */
export function capacityFromSnapshot(
  campId: string,
  snap: DocumentSnapshot | undefined
): number {
  const fallback = defaultCampCapacity(campId) ?? 0;
  if (!snap?.exists) return fallback;
  const raw = snap.data()?.capacity;
  return isValidCapacity(raw) ? raw : fallback;
}

/** True for a whole number inside the allowed capacity range. */
export function isValidCapacity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_CAMP_CAPACITY &&
    value <= MAX_CAMP_CAPACITY
  );
}

/** Effective capacity for a camp: the admin override, else the catalog value. */
export async function getCampCapacity(campId: string): Promise<number> {
  const snap = await campSettingsRef(campId).get();
  return capacityFromSnapshot(campId, snap);
}

export interface CampCapacitySettings {
  /** Capacity in force right now. */
  capacity: number;
  /** Capacity from the static catalog. */
  defaultCapacity: number | null;
  /** True when an admin has overridden the catalog value. */
  isOverridden: boolean;
  updatedAt: Date | null;
  updatedByName: string | null;
}

/** Effective capacity plus who last changed it, for the manage UI. */
export async function getCampCapacitySettings(
  campId: string
): Promise<CampCapacitySettings> {
  const snap = await campSettingsRef(campId).get();
  const defaultCapacity = defaultCampCapacity(campId);
  const data = snap.exists ? snap.data() : undefined;
  const overridden = isValidCapacity(data?.capacity);
  return {
    capacity: capacityFromSnapshot(campId, snap),
    defaultCapacity,
    isOverridden: overridden,
    updatedAt: overridden ? data?.updatedAt?.toDate?.() ?? null : null,
    updatedByName: overridden
      ? (data?.updatedByName as string | undefined) ?? null
      : null,
  };
}
