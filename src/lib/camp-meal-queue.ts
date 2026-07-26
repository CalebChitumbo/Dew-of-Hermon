"use client";

import { buildMealScanId } from "@/lib/camp-meals";

/**
 * Offline scan queue for the meal serving line.
 *
 * Camp runs at a venue whose network comes and goes, and a queue of eighty
 * hungry teenagers cannot wait on a round trip. So the scanner validates
 * against a cached roster and shows its answer immediately, while the write
 * goes into this queue and is flushed whenever there's signal.
 *
 * Replay is safe because the server keys each scan on
 * `${sittingId}_${registrationId}` and creates rather than sets — flushing the
 * same item twice cannot serve a camper twice. That means this queue never
 * has to reason about what already landed; it just retries until each item
 * comes back either created or already-served.
 */

const QUEUE_KEY = "rops-meal-queue-v1";
const ROSTER_KEY_PREFIX = "rops-meal-roster-v1:";

export interface QueuedMealScan {
  /** Same key the server derives — makes the queue self-deduplicating. */
  key: string;
  sittingId: string;
  registrationId: string;
  code: string;
  camperName: string;
  /** When the camper was actually served, not when the write succeeded. */
  servedAt: string;
  /**
   * Whether the device had no connectivity at the moment of the scan. Every
   * scan goes through this queue, so this — not the mere fact of being
   * queued — is what marks a scan as genuinely taken offline.
   */
  offline: boolean;
  attempts: number;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode). The in-memory state still
    // works for this session — losing the cache is survivable, losing the
    // scan is not, so we never throw from here.
  }
}

export function loadQueue(): QueuedMealScan[] {
  return readJson<QueuedMealScan[]>(QUEUE_KEY, []);
}

export function saveQueue(queue: QueuedMealScan[]): void {
  writeJson(QUEUE_KEY, queue);
}

/**
 * Add a scan to the queue, ignoring it if the same camper/sitting is already
 * waiting — a double tap at the line must not become two pending writes.
 */
export function enqueueScan(
  queue: QueuedMealScan[],
  item: Omit<QueuedMealScan, "key" | "attempts">
): QueuedMealScan[] {
  const key = buildMealScanId(item.sittingId, item.registrationId);
  if (queue.some((q) => q.key === key)) return queue;
  const next = [...queue, { ...item, key, attempts: 0 }];
  saveQueue(next);
  return next;
}

export function removeFromQueue(
  queue: QueuedMealScan[],
  key: string
): QueuedMealScan[] {
  const next = queue.filter((q) => q.key !== key);
  saveQueue(next);
  return next;
}

// ─── Roster cache ───

export interface CachedCamper {
  id: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  churchOrSchool: string | null;
  checkInCode: string | null;
  paymentStatus: string;
  sponsorshipId: string | null;
  sponsorName: string | null;
  dietaryPreference: string | null;
  allergies: string | null;
  checkedIn: boolean;
  onPass: boolean;
}

export interface CachedRoster {
  sittingId: string;
  campers: CachedCamper[];
  /** Registration ids already served at this sitting. */
  servedIds: string[];
  cachedAt: string;
}

export function loadRoster(sittingId: string): CachedRoster | null {
  return readJson<CachedRoster | null>(
    `${ROSTER_KEY_PREFIX}${sittingId}`,
    null
  );
}

export function saveRoster(roster: CachedRoster): void {
  writeJson(`${ROSTER_KEY_PREFIX}${roster.sittingId}`, roster);
}
