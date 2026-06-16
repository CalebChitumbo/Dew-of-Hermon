import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import {
  PAGE_MARGIN,
  HEADING_COLOR,
  SUBHEADING_COLOR,
  BODY_COLOR,
  ACCENT,
  ALT_ROW,
  slugify,
  makeCursor,
} from "@/lib/pdf-helpers";
import { MONTH_NAMES, ordinal } from "@/lib/birthdays";

export interface BirthdayPdfRow {
  name: string;
  /** 1-31 */
  day: number;
  /** 1-12 */
  month: number;
  ageTurning: number | null;
  lifeGroup: string | null;
  phone: string | null;
}

/**
 * Build and download a PDF of birthdays for a month (the "Cake Sunday" list),
 * or the whole year when `monthLabel` is "All Birthdays".
 */
export function buildBirthdayListPdf(
  rows: BirthdayPdfRow[],
  monthLabel: string
): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const cur = makeCursor(doc);

  // ── Title ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...HEADING_COLOR);
  doc.text("BIRTHDAYS", PAGE_MARGIN, cur.y + 10);
  cur.y += 22;

  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(2);
  doc.line(PAGE_MARGIN, cur.y, PAGE_MARGIN + 100, cur.y);
  cur.y += 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...BODY_COLOR);
  doc.text(monthLabel, PAGE_MARGIN, cur.y);
  cur.y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...SUBHEADING_COLOR);
  doc.text(
    `${rows.length} ${rows.length === 1 ? "birthday" : "birthdays"}  ·  Generated ${format(new Date(), "d MMM yyyy")}`,
    PAGE_MARGIN,
    cur.y
  );
  cur.y += 18;

  // ── Table ──
  const showMonth = monthLabel === "All Birthdays";
  const head = [["Date", "Name", "Turns", "Life Group", "Phone"]];

  const body = rows.map((r) => [
    showMonth
      ? `${ordinal(r.day)} ${MONTH_NAMES[r.month - 1].slice(0, 3)}`
      : ordinal(r.day),
    r.name || "—",
    r.ageTurning !== null ? String(r.ageTurning) : "—",
    r.lifeGroup || "—",
    r.phone || "—",
  ]);

  autoTable(doc, {
    startY: cur.y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head,
    body: body.length > 0 ? body : [["—", "No birthdays for this period", "—", "—", "—"]],
    headStyles: {
      fillColor: HEADING_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    bodyStyles: { textColor: BODY_COLOR, fontSize: 11 },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: {
      0: { cellWidth: 70 },
      2: { cellWidth: 50, halign: "center" },
      3: { cellWidth: 90 },
    },
  });

  const slug = slugify(monthLabel, "birthdays");
  doc.save(`birthdays-${slug}.pdf`);
}
