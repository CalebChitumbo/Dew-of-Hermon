import ExcelJS from "exceljs";
import type { CampDefinition } from "@/types";
import type { serializeRegistration } from "@/app/api/camp-registrations/_serialize";

/**
 * The camper register as a real .xlsx workbook.
 *
 * Every field the registration form captures, one camper per row, plus a
 * Summary sheet with the counts the camp office keeps re-deriving by hand
 * (gender split, age bands, t-shirt sizes, allergies, payment totals).
 *
 * Two deliberate choices about cell types, because both bite in Excel:
 *
 *  - Phone numbers are written as TEXT. Zambian numbers lead with a zero and
 *    Excel silently eats it on a numeric cell, turning 0977… into 977….
 *  - Dates are written as raw Excel serial numbers with a date format, not as
 *    JS Dates. ExcelJS converts a Date using the *server's* timezone offset,
 *    so a date-of-birth exported from a machine west of UTC can land on the
 *    previous day. Computing the serial ourselves is timezone-proof, and the
 *    cells still sort, filter and pivot as dates.
 *
 * Timestamps are rendered in CAT (UTC+2) — Zambia has no DST, so a fixed
 * offset is exact — and their headers say so.
 */

type RegistrationRecord = ReturnType<typeof serializeRegistration>;

/** Zambia is UTC+2 all year round. */
const CAT_OFFSET_MINUTES = 120;

/** Days between the Excel epoch (1899-12-30) and the Unix epoch. */
const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const MS_PER_DAY = 86_400_000;

const DATE_FORMAT = "dd/mm/yyyy";
const DATE_TIME_FORMAT = "dd/mm/yyyy hh:mm";
const TEXT_FORMAT = "@";

// Brand colours, matching the PDF helpers (ARGB, as ExcelJS wants them).
const CLAY = "FF5B3A29";
const GOLD = "FFC8963E";
const CREAM = "FFFFF8F0";
const WHITE = "FFFFFFFF";

/** Cell kinds the column table can ask for. */
type ColumnKind = "text" | "number" | "money" | "date" | "datetime" | "bool";

interface ExportColumn {
  header: string;
  width: number;
  kind: ColumnKind;
  /** Long free text — gets wrapped and top-aligned instead of one long line. */
  wrap?: boolean;
  value: (row: RegistrationRecord, index: number) => unknown;
}

/**
 * Excel serial for a wall-clock instant. `offsetMinutes` shifts the UTC
 * instant to the timezone the reader should see it in.
 */
function toExcelSerial(date: Date, offsetMinutes: number): number {
  return (
    EXCEL_EPOCH_OFFSET_DAYS +
    (date.getTime() + offsetMinutes * 60_000) / MS_PER_DAY
  );
}

/** Serial for a plain yyyy-mm-dd date string — a whole number, no time part. */
function dateOnlySerial(iso: string | null | undefined): number | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso ?? "").trim());
  if (!parts) return null;
  const [, y, m, d] = parts;
  const utc = Date.UTC(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(utc)) return null;
  return EXCEL_EPOCH_OFFSET_DAYS + utc / MS_PER_DAY;
}

/** Serial for an ISO timestamp, rendered in CAT. */
function timestampSerial(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return toExcelSerial(date, CAT_OFFSET_MINUTES);
}

/**
 * Whole years old on `onDate`. Camps group campers by age, so the useful
 * number is their age at the start of camp, not their age when the sheet
 * happened to be exported.
 */
export function ageOn(
  dateOfBirth: string | null | undefined,
  onDate: string
): number | null {
  const dob = /^(\d{4})-(\d{2})-(\d{2})/.exec((dateOfBirth ?? "").trim());
  const on = /^(\d{4})-(\d{2})-(\d{2})/.exec(onDate);
  if (!dob || !on) return null;
  let age = Number(on[1]) - Number(dob[1]);
  const beforeBirthday =
    Number(on[2]) < Number(dob[2]) ||
    (Number(on[2]) === Number(dob[2]) && Number(on[3]) < Number(dob[3]));
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** Age bands the camp office actually plans around (dorms, sessions). */
const AGE_BANDS: { label: string; min: number; max: number }[] = [
  { label: "Under 13", min: 0, max: 12 },
  { label: "13–15", min: 13, max: 15 },
  { label: "16–18", min: 16, max: 18 },
  { label: "19–24", min: 19, max: 24 },
  { label: "25 and over", min: 25, max: 129 },
];

function yesNo(value: unknown): string {
  return value ? "Yes" : "No";
}

function titleCase(value: string | null): string | null {
  if (!value) return null;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/**
 * The register's columns, in reading order: who they are, how to reach them,
 * the medical facts, the camp logistics, then the office's own tracking.
 */
const COLUMNS: ExportColumn[] = [
  { header: "#", width: 5, kind: "number", value: (_r, i) => i + 1 },
  { header: "First name", width: 16, kind: "text", value: (r) => r.firstName },
  { header: "Last name", width: 16, kind: "text", value: (r) => r.lastName },
  {
    header: "Date of birth",
    width: 13,
    kind: "date",
    value: (r) => dateOnlySerial(r.dateOfBirth),
  },
  // Filled in per-camp by buildCampRegistrationsWorkbook.
  { header: "Age at camp start", width: 9, kind: "number", value: () => null },
  { header: "Gender", width: 9, kind: "text", value: (r) => titleCase(r.gender) },
  { header: "Phone", width: 15, kind: "text", value: (r) => r.phone },
  { header: "Email", width: 26, kind: "text", value: (r) => r.email },
  {
    header: "Church / school",
    width: 26,
    kind: "text",
    value: (r) => r.churchOrSchool || null,
  },
  { header: "Address", width: 30, kind: "text", wrap: true, value: (r) => r.address },

  {
    header: "Parent / guardian",
    width: 22,
    kind: "text",
    value: (r) => r.parentName,
  },
  {
    header: "Guardian relationship",
    width: 16,
    kind: "text",
    value: (r) => r.parentRelationship,
  },
  {
    header: "Guardian phone",
    width: 15,
    kind: "text",
    value: (r) => r.parentAltPhone,
  },
  {
    header: "Guardian email",
    width: 26,
    kind: "text",
    value: (r) => r.parentEmail,
  },

  {
    header: "Emergency contact",
    width: 22,
    kind: "text",
    value: (r) => r.emergencyContactName,
  },
  {
    header: "Emergency phone",
    width: 15,
    kind: "text",
    value: (r) => r.emergencyContactPhone,
  },
  {
    header: "Emergency relationship",
    width: 16,
    kind: "text",
    value: (r) => r.emergencyContactRelationship,
  },

  {
    header: "Allergies",
    width: 30,
    kind: "text",
    wrap: true,
    value: (r) => r.allergies,
  },
  {
    header: "Medications",
    width: 30,
    kind: "text",
    wrap: true,
    value: (r) => r.medications,
  },
  {
    header: "Medical notes",
    width: 34,
    kind: "text",
    wrap: true,
    value: (r) => r.medicalNotes,
  },
  {
    header: "Dietary preference",
    width: 20,
    kind: "text",
    value: (r) => r.dietaryPreference,
  },
  { header: "T-shirt size", width: 10, kind: "text", value: (r) => r.tshirtSize },
  {
    header: "Drop-off",
    width: 11,
    kind: "text",
    value: (r) => titleCase(r.dropoffLocation),
  },
  { header: "Notes", width: 34, kind: "text", wrap: true, value: (r) => r.notes },
  { header: "Consent given", width: 12, kind: "bool", value: (r) => r.consentGiven },

  {
    header: "Payment status",
    width: 13,
    kind: "text",
    value: (r) => titleCase(r.paymentStatus),
  },
  {
    header: "Amount paid",
    width: 12,
    kind: "money",
    value: (r) => r.paymentAmount,
  },
  {
    header: "Payment reference",
    width: 18,
    kind: "text",
    value: (r) => r.paymentReference,
  },
  {
    header: "Payment notes",
    width: 26,
    kind: "text",
    wrap: true,
    value: (r) => r.paymentNotes,
  },
  {
    header: "Payment marked by",
    width: 20,
    kind: "text",
    value: (r) => r.paymentMarkedByName,
  },
  {
    header: "Payment marked at (CAT)",
    width: 18,
    kind: "datetime",
    value: (r) => timestampSerial(r.paymentMarkedAt),
  },

  { header: "Sponsor", width: 22, kind: "text", value: (r) => r.sponsorName },
  {
    header: "Sponsorship assigned by",
    width: 20,
    kind: "text",
    value: (r) => r.sponsorshipAssignedByName,
  },
  {
    header: "Sponsorship assigned at (CAT)",
    width: 18,
    kind: "datetime",
    value: (r) => timestampSerial(r.sponsorshipAssignedAt),
  },

  { header: "Checked in", width: 11, kind: "bool", value: (r) => r.checkedIn },
  {
    header: "Checked in at (CAT)",
    width: 18,
    kind: "datetime",
    value: (r) => timestampSerial(r.checkedInAt),
  },
  {
    header: "Checked in by",
    width: 20,
    kind: "text",
    value: (r) => r.checkedInByName,
  },
  { header: "Out on pass", width: 11, kind: "bool", value: (r) => r.onPass },
  { header: "Check-in code", width: 14, kind: "text", value: (r) => r.checkInCode },

  {
    header: "QR emails sent",
    width: 12,
    kind: "number",
    value: (r) => r.qrEmailCount,
  },
  {
    header: "QR email sent at (CAT)",
    width: 18,
    kind: "datetime",
    value: (r) => timestampSerial(r.qrEmailSentAt),
  },
  {
    header: "QR email sent to",
    width: 26,
    kind: "text",
    value: (r) => r.qrEmailSentTo,
  },

  {
    header: "Registered by",
    width: 13,
    kind: "text",
    value: (r) =>
      r.registrantType === "self"
        ? "Self"
        : r.registrantType === "other"
          ? "Someone else"
          : null,
  },
  {
    header: "Submitted by (account)",
    width: 26,
    kind: "text",
    value: (r) => r.submittedByEmail,
  },
  {
    header: "Registered at (CAT)",
    width: 18,
    kind: "datetime",
    value: (r) => timestampSerial(r.createdAt),
  },
  {
    header: "Last updated (CAT)",
    width: 18,
    kind: "datetime",
    value: (r) => timestampSerial(r.updatedAt),
  },
  { header: "Registration ID", width: 22, kind: "text", value: (r) => r.id },
];

const AGE_COLUMN_INDEX = COLUMNS.findIndex(
  (c) => c.header === "Age at camp start"
);

function numberFormatFor(kind: ColumnKind, currency: string): string | undefined {
  switch (kind) {
    case "date":
      return DATE_FORMAT;
    case "datetime":
      return DATE_TIME_FORMAT;
    case "money":
      return `#,##0.00 "${currency}"`;
    case "text":
      return TEXT_FORMAT;
    default:
      return undefined;
  }
}

function styleHeaderRow(row: ExcelJS.Row): void {
  row.height = 30;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CLAY } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: GOLD } } };
  });
}

/** Blank cells read better than the string "null" or a stray dash. */
function cellValue(raw: unknown, kind: ColumnKind): ExcelJS.CellValue {
  if (kind === "bool") return yesNo(raw);
  if (raw === null || raw === undefined || raw === "") return null;
  return raw as ExcelJS.CellValue;
}

function addCamperSheet(
  workbook: ExcelJS.Workbook,
  registrations: RegistrationRecord[],
  camp: CampDefinition
): void {
  const sheet = workbook.addWorksheet("Campers", {
    views: [{ state: "frozen", xSplit: 3, ySplit: 1 }],
  });

  sheet.columns = COLUMNS.map((col) => ({
    header: col.header,
    width: col.width,
    style: { numFmt: numberFormatFor(col.kind, camp.currency) },
  }));

  styleHeaderRow(sheet.getRow(1));

  registrations.forEach((registration, index) => {
    const values = COLUMNS.map((col, colIndex) =>
      cellValue(
        colIndex === AGE_COLUMN_INDEX
          ? ageOn(registration.dateOfBirth, camp.startDate)
          : col.value(registration, index),
        col.kind
      )
    );

    const row = sheet.addRow(values);
    row.alignment = { vertical: "top" };
    // Banding — 40-odd columns are hard to track across without it.
    if (index % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: CREAM },
        };
      });
    }
    COLUMNS.forEach((col, colIndex) => {
      if (col.wrap) {
        row.getCell(colIndex + 1).alignment = {
          vertical: "top",
          wrapText: true,
        };
      }
    });
  });

  // Autofilter over the header, so the office can slice the register in place.
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNS.length },
  };
}

/** One "label / value" line on the Summary sheet. */
function addSummaryRow(
  sheet: ExcelJS.Worksheet,
  label: string,
  value: ExcelJS.CellValue,
  opts: { numFmt?: string } = {}
): ExcelJS.Row {
  const row = sheet.addRow([label, value]);
  row.getCell(1).font = { color: { argb: CLAY } };
  row.getCell(2).font = { bold: true };
  if (opts.numFmt) row.getCell(2).numFmt = opts.numFmt;
  return row;
}

function addSummaryHeading(sheet: ExcelJS.Worksheet, text: string): void {
  sheet.addRow([]);
  const row = sheet.addRow([text.toUpperCase()]);
  row.getCell(1).font = { bold: true, size: 11, color: { argb: WHITE } };
  row.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: CLAY },
  };
  row.getCell(2).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: CLAY },
  };
}

/** Counts per key, biggest first, so the long tail sinks to the bottom. */
function tally(values: (string | null)[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value?.trim() || "Not given";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
}

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  registrations: RegistrationRecord[],
  camp: CampDefinition,
  exportedBy: string,
  exportedAt: Date
): void {
  const sheet = workbook.addWorksheet("Summary");
  // Widths set directly — assigning `columns` would reserve row 1 as a header
  // row, and this sheet leads with its title instead.
  sheet.getColumn(1).width = 40;
  sheet.getColumn(2).width = 22;

  const title = sheet.addRow([camp.name]);
  title.getCell(1).font = { bold: true, size: 16, color: { argb: CLAY } };
  sheet.addRow(["Camper register — summary"]).getCell(1).font = {
    italic: true,
    color: { argb: CLAY },
  };

  const paid = registrations.filter((r) => r.paymentStatus === "PAID");
  const unpaid = registrations.filter((r) => r.paymentStatus === "UNPAID");
  const refunded = registrations.filter((r) => r.paymentStatus === "REFUNDED");
  // Mirrors the dashboard: a paid camper with no amount recorded counts as
  // the standard camp fee.
  const revenue = paid.reduce((sum, r) => sum + (r.paymentAmount ?? camp.fee), 0);
  const recorded = paid.reduce((sum, r) => sum + (r.paymentAmount ?? 0), 0);

  addSummaryHeading(sheet, "Camp");
  addSummaryRow(sheet, "Dates", `${camp.startDate} to ${camp.endDate}`);
  if (camp.venue) addSummaryRow(sheet, "Venue", camp.venue);
  addSummaryRow(sheet, `Camp fee (${camp.currency})`, camp.fee, {
    numFmt: "#,##0.00",
  });
  addSummaryRow(sheet, "Planned capacity", camp.capacity);
  addSummaryRow(sheet, "Exported by", exportedBy);
  addSummaryRow(
    sheet,
    "Exported at (CAT)",
    toExcelSerial(exportedAt, CAT_OFFSET_MINUTES),
    { numFmt: DATE_TIME_FORMAT }
  );

  addSummaryHeading(sheet, "Registrations");
  addSummaryRow(sheet, "Total registered", registrations.length);
  addSummaryRow(
    sheet,
    "Spots left",
    Math.max(0, camp.capacity - registrations.length)
  );
  addSummaryRow(sheet, "Checked in", registrations.filter((r) => r.checkedIn).length);
  addSummaryRow(sheet, "Currently out on pass", registrations.filter((r) => r.onPass).length);
  addSummaryRow(sheet, "Sponsored", registrations.filter((r) => r.sponsorshipId).length);
  addSummaryRow(sheet, "Consent given", registrations.filter((r) => r.consentGiven).length);
  addSummaryRow(
    sheet,
    "QR pass emailed",
    registrations.filter((r) => r.qrEmailSentAt).length
  );

  addSummaryHeading(sheet, "Payments");
  addSummaryRow(sheet, "Paid", paid.length);
  addSummaryRow(sheet, "Unpaid", unpaid.length);
  addSummaryRow(sheet, "Refunded", refunded.length);
  addSummaryRow(sheet, `Amounts recorded (${camp.currency})`, recorded, {
    numFmt: "#,##0.00",
  });
  addSummaryRow(sheet, `Expected total (${camp.currency})`, revenue, {
    numFmt: "#,##0.00",
  });
  sheet.addRow([
    "Expected total counts the standard fee for a paid camper with no amount recorded.",
  ]).getCell(1).font = { italic: true, size: 9, color: { argb: CLAY } };

  addSummaryHeading(sheet, "Gender");
  for (const [label, count] of tally(registrations.map((r) => titleCase(r.gender)))) {
    addSummaryRow(sheet, label, count);
  }

  addSummaryHeading(sheet, "Age at camp start");
  const ages = registrations.map((r) => ageOn(r.dateOfBirth, camp.startDate));
  for (const band of AGE_BANDS) {
    const count = ages.filter(
      (age) => age !== null && age >= band.min && age <= band.max
    ).length;
    if (count > 0) addSummaryRow(sheet, band.label, count);
  }
  const unknownAge = ages.filter((age) => age === null).length;
  if (unknownAge > 0) addSummaryRow(sheet, "Date of birth not usable", unknownAge);

  addSummaryHeading(sheet, "T-shirt sizes");
  for (const [label, count] of tally(registrations.map((r) => r.tshirtSize))) {
    addSummaryRow(sheet, label, count);
  }

  addSummaryHeading(sheet, "Care needs");
  addSummaryRow(sheet, "With allergies", registrations.filter((r) => r.allergies).length);
  addSummaryRow(sheet, "On medication", registrations.filter((r) => r.medications).length);
  addSummaryRow(sheet, "With medical notes", registrations.filter((r) => r.medicalNotes).length);
  addSummaryRow(
    sheet,
    "With dietary preference",
    registrations.filter((r) => r.dietaryPreference).length
  );

  addSummaryHeading(sheet, "Church / school");
  for (const [label, count] of tally(registrations.map((r) => r.churchOrSchool))) {
    addSummaryRow(sheet, label, count);
  }
}

/**
 * Build the camper register workbook. `registrations` should already be in the
 * order the sheet is meant to read in — the route sorts oldest-first so row 1
 * is the first camper who registered.
 */
export async function buildCampRegistrationsWorkbook(
  registrations: RegistrationRecord[],
  camp: CampDefinition,
  exportedBy: string,
  exportedAt: Date = new Date()
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Dew of Hermon Youth Ministry";
  workbook.created = exportedAt;

  addCamperSheet(workbook, registrations, camp);
  addSummarySheet(workbook, registrations, camp, exportedBy, exportedAt);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
