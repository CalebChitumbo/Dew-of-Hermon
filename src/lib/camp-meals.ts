import type { CampMealSitting, CampMealSlot } from "@/types";

/**
 * ROPs Camp meal cards.
 *
 * Replaces the pen-and-paper meal register. Every camper carries the same
 * `checkInCode` they were issued at registration — printed on a badge handed
 * out at arrival, so a camper without a phone is never a special case — and
 * the serving line scans it once per sitting.
 *
 * Two rules make the whole thing safe:
 *
 *  1. A scan document's id is derived, not generated:
 *     `${campId}_${date}_${slot}_${registrationId}`. Writes use create(),
 *     so a second scan of the same camper at the same sitting collides
 *     instead of double-serving. That holds whether the collision comes from
 *     two serving lines at once or from an offline scan replayed on sync.
 *  2. Sittings are derived from the static plan below, never stored. Every
 *     device — including one that has been offline for an hour — agrees on
 *     what the sittings are without talking to the server.
 *
 * NOTE: kept free of firebase-admin imports so the scanner page can use the
 * same sitting maths the API does.
 */

// ─── Feature key (configurable in Settings → Access Control) ───

export const MEAL_FEATURE_SERVE = "serve_camp_meals";

export const MEALS_COLLECTION = "campMealScans";
export const REGISTRATIONS_COLLECTION = "campRegistrations";

/** The serving line scanner. */
export const MEAL_SCANNER_LINK = "/manage/rops-camp/meals";

// ─── Meal plan ───

export const MEAL_SLOT_LABEL: Record<CampMealSlot, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
};

/**
 * Local serving windows, used only to auto-select the sitting at the line.
 * They are deliberately generous — a late queue must never silently start
 * ticking the next sitting — and the server can always override the pick.
 */
const MEAL_SLOT_WINDOW: Record<CampMealSlot, { opensAt: string; closesAt: string }> = {
  BREAKFAST: { opensAt: "05:30", closesAt: "10:59" },
  LUNCH: { opensAt: "11:00", closesAt: "16:29" },
  DINNER: { opensAt: "16:30", closesAt: "23:59" },
};

/** Slot order for sorting a day's sittings. */
const SLOT_ORDER: CampMealSlot[] = ["BREAKFAST", "LUNCH", "DINNER"];

/**
 * Which meals are actually served on each camp day. Campers arrive Thursday
 * afternoon (supper only) and leave Monday after breakfast, so the plan is
 * not a plain 3-per-day grid.
 */
const CAMP_MEAL_PLAN: Record<string, Array<{ date: string; slots: CampMealSlot[] }>> = {
  "rops-x-2026": [
    // Thursday — campers arrive through the afternoon.
    { date: "2026-08-27", slots: ["DINNER"] },
    // Friday, Saturday, Sunday — full days.
    { date: "2026-08-28", slots: ["BREAKFAST", "LUNCH", "DINNER"] },
    { date: "2026-08-29", slots: ["BREAKFAST", "LUNCH", "DINNER"] },
    { date: "2026-08-30", slots: ["BREAKFAST", "LUNCH", "DINNER"] },
    // Monday — breakfast, then departure.
    { date: "2026-08-31", slots: ["BREAKFAST"] },
  ],
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Weekday name for a yyyy-MM-dd string, without timezone drift. */
function weekdayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  // Constructed as UTC and read as UTC — a date-only value must not be
  // shifted by the reader's timezone.
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function buildSittingId(
  campId: string,
  date: string,
  slot: CampMealSlot
): string {
  return `${campId}_${date}_${slot}`;
}

/** The scan document id. Deterministic — this is what blocks double-serving. */
export function buildMealScanId(
  sittingId: string,
  registrationId: string
): string {
  return `${sittingId}_${registrationId}`;
}

/** Every sitting for a camp, in serving order. */
export function getCampSittings(campId: string): CampMealSitting[] {
  const plan = CAMP_MEAL_PLAN[campId];
  if (!plan) return [];

  const sittings: CampMealSitting[] = [];
  for (const day of plan) {
    const ordered = SLOT_ORDER.filter((slot) => day.slots.includes(slot));
    for (const slot of ordered) {
      sittings.push({
        id: buildSittingId(campId, day.date, slot),
        campId,
        date: day.date,
        slot,
        label: `${weekdayOf(day.date)} ${MEAL_SLOT_LABEL[slot].toLowerCase()}`,
        ...MEAL_SLOT_WINDOW[slot],
      });
    }
  }
  return sittings;
}

/** Resolve a sitting id back to its sitting, or null if it isn't in the plan. */
export function getSitting(sittingId: string): CampMealSitting | null {
  // The camp id itself may contain underscores, so match against the built
  // ids rather than splitting the string.
  for (const campId of Object.keys(CAMP_MEAL_PLAN)) {
    if (!sittingId.startsWith(`${campId}_`)) continue;
    const found = getCampSittings(campId).find((s) => s.id === sittingId);
    if (found) return found;
  }
  return null;
}

/** True when `sittingId` is a real sitting of `campId`. */
export function sittingBelongsToCamp(sittingId: string, campId: string): boolean {
  const sitting = getSitting(sittingId);
  return !!sitting && sitting.campId === campId;
}

/** Local yyyy-MM-dd for a Date — the device's own day, not UTC's. */
function localDateString(now: Date): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * The sitting to pre-select at the serving line, from the device's local
 * clock. Called on the client so it reflects Zambian time regardless of what
 * timezone the server happens to run in.
 *
 * Falls back to the nearest upcoming sitting (or the last one, once camp is
 * over) so the picker is never empty mid-camp.
 */
export function resolveCurrentSitting(
  campId: string,
  now: Date
): CampMealSitting | null {
  const sittings = getCampSittings(campId);
  if (sittings.length === 0) return null;

  const today = localDateString(now);
  const minutes = now.getHours() * 60 + now.getMinutes();

  const live = sittings.find(
    (s) =>
      s.date === today &&
      minutes >= minutesOfDay(s.opensAt) &&
      minutes <= minutesOfDay(s.closesAt)
  );
  if (live) return live;

  const upcoming = sittings.find(
    (s) => s.date > today || (s.date === today && minutes < minutesOfDay(s.opensAt))
  );
  return upcoming ?? sittings[sittings.length - 1];
}

// ─── Codes ───

/**
 * Reduce a scanned/typed/pasted payload to a stored check-in code.
 *
 * Accepts the arrival QR URL (`?code=...`), a dashed code, or a bare code —
 * the same shapes the gate check-in accepts, because it is the same badge.
 * An exit-pass QR (`?pass=...`) is deliberately rejected: an approved pass to
 * leave camp is not a meal card, and quietly accepting it would tick the
 * wrong camper off the register.
 */
export function normalizeMealCode(input: string): string {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    if (url.searchParams.get("pass")) return "";
    const fromParam = url.searchParams.get("code");
    if (fromParam) {
      return fromParam.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    }
  } catch {
    // not a URL — treat as a raw code
  }
  return trimmed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** True when the payload is an exit-pass QR rather than a camper's badge. */
export function looksLikeExitPassQr(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return !!url.searchParams.get("pass") && !url.searchParams.get("code");
  } catch {
    return false;
  }
}

/** "ABCDEFGHJKMN" → "ABCD-EFGH-JKMN" for human display. */
export function formatMealCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}
