/**
 * Birthday helpers shared by the client (dashboard banner, birthdays page),
 * the server APIs, and the daily cron.
 *
 * Dates of birth are stored on the user document as an ISO `yyyy-mm-dd` string
 * (date only, no time) — the same convention the ROPs camp registration uses.
 * Working from the raw string avoids the timezone shifts you get when you
 * construct a `Date` from a date-only string (which is parsed as UTC midnight).
 */

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export interface ParsedDOB {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
}

/** Parse a stored `yyyy-mm-dd` date of birth. Returns null when absent/invalid. */
export function parseDOB(dob: string | null | undefined): ParsedDOB | null {
  if (!dob || typeof dob !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Whether the given date of birth falls on `refDate` (matching month + day,
 * ignoring the year). People born on 29 February are celebrated on 28 February
 * in non-leap years so their birthday is never silently skipped.
 */
export function isBirthdayOn(
  dob: string | null | undefined,
  refDate: Date = new Date()
): boolean {
  const parsed = parseDOB(dob);
  if (!parsed) return false;

  const refMonth = refDate.getMonth() + 1;
  const refDay = refDate.getDate();

  if (parsed.month === refMonth && parsed.day === refDay) return true;

  // Feb 29 born: celebrate on Feb 28 when this year has no 29th.
  if (
    parsed.month === 2 &&
    parsed.day === 29 &&
    refMonth === 2 &&
    refDay === 28 &&
    !isLeapYear(refDate.getFullYear())
  ) {
    return true;
  }

  return false;
}

/** The age the person turns on their birthday in `refDate`'s year. */
export function getAgeTurning(
  dob: string | null | undefined,
  refDate: Date = new Date()
): number | null {
  const parsed = parseDOB(dob);
  if (!parsed) return null;
  const age = refDate.getFullYear() - parsed.year;
  return age >= 0 && age < 150 ? age : null;
}

/** "1st", "2nd", "3rd", "4th"… */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "14 March" — day + month, no year (used for celebration copy). */
export function formatBirthdayDayMonth(dob: string | null | undefined): string {
  const parsed = parseDOB(dob);
  if (!parsed) return "—";
  return `${parsed.day} ${MONTH_NAMES[parsed.month - 1]}`;
}

/** "14 March 2001" — full date of birth. */
export function formatDOBLong(dob: string | null | undefined): string {
  const parsed = parseDOB(dob);
  if (!parsed) return "—";
  return `${parsed.day} ${MONTH_NAMES[parsed.month - 1]} ${parsed.year}`;
}

/** Sort comparator that orders by month then day (year-agnostic). */
export function compareByMonthDay(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const pa = parseDOB(a);
  const pb = parseDOB(b);
  if (!pa && !pb) return 0;
  if (!pa) return 1;
  if (!pb) return -1;
  if (pa.month !== pb.month) return pa.month - pb.month;
  return pa.day - pb.day;
}
