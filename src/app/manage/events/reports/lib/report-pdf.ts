import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { EventReport, EventType } from "@/types";
import {
  PAGE_MARGIN,
  HEADING_COLOR,
  SUBHEADING_COLOR,
  BODY_COLOR,
  ACCENT,
  LINK_COLOR,
  ALT_ROW,
  slugify,
  makeCursor,
  ensureRoom,
  drawSectionHeading,
  drawParagraph,
  type Cursor,
} from "@/lib/pdf-helpers";

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  POTTERS_WHEEL_SERVICE: "Potter's Wheel Service",
  ROPS_CAMP: "ROPS Camp",
  RETREAT: "Retreat",
  MEETING: "Meeting",
  SPECIAL_EVENT: "Special Event",
  OUTREACH: "Outreach",
};

const OBJECTIVES_LABELS: Record<number, string> = {
  1: "Not met",
  2: "Partially met",
  3: "Mostly met",
  4: "Met",
  5: "Exceeded",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted — Awaiting Review",
  REVIEWED: "Reviewed by Chairperson",
  CHANGES_REQUESTED: "Changes Requested",
};

function fmtDate(d: Date | null, withWeekday = false): string {
  if (!d) return "—";
  return format(d, withWeekday ? "EEEE, d MMMM yyyy" : "d MMMM yyyy");
}

function drawCover(doc: jsPDF, cur: Cursor, report: EventReport): void {
  cur.y = PAGE_MARGIN + 70;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...HEADING_COLOR);
  doc.text("POST-EVENT REPORT", PAGE_MARGIN, cur.y);
  cur.y += 12;

  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(2);
  doc.line(PAGE_MARGIN, cur.y, PAGE_MARGIN + 120, cur.y);
  cur.y += 36;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...BODY_COLOR);
  const titleLines = doc.splitTextToSize(
    report.eventTitle || "Untitled event",
    cur.contentWidth
  ) as string[];
  for (const line of titleLines) {
    doc.text(line, PAGE_MARGIN, cur.y);
    cur.y += 26;
  }
  cur.y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...SUBHEADING_COLOR);

  const dateRange =
    report.eventStartDate && report.eventEndDate
      ? `${fmtDate(report.eventStartDate)} → ${fmtDate(report.eventEndDate)}`
      : fmtDate(report.eventStartDate);
  doc.text(dateRange, PAGE_MARGIN, cur.y);
  cur.y += 16;

  doc.text(
    `Event type: ${EVENT_TYPE_LABELS[report.eventType] ?? report.eventType}`,
    PAGE_MARGIN,
    cur.y
  );
  cur.y += 16;

  doc.text(
    `Prepared by ${report.initiatorName || "—"}`,
    PAGE_MARGIN,
    cur.y
  );
  cur.y += 16;

  if (report.submittedAt) {
    doc.text(
      `Submitted ${fmtDate(report.submittedAt)}`,
      PAGE_MARGIN,
      cur.y
    );
    cur.y += 16;
  }

  doc.text(
    `Status: ${STATUS_LABELS[report.status] ?? report.status}`,
    PAGE_MARGIN,
    cur.y
  );
  cur.y += 16;

  doc.text(`Generated ${fmtDate(new Date())}`, PAGE_MARGIN, cur.y);
}

function drawOverview(doc: jsPDF, cur: Cursor, report: EventReport): void {
  drawSectionHeading(doc, cur, "Overview");

  const rows: [string, string][] = [
    ["Attendance", String(report.attendanceCount ?? "—")],
    [
      "Objectives met",
      report.objectivesMetRating
        ? `${report.objectivesMetRating} / 5 — ${OBJECTIVES_LABELS[report.objectivesMetRating]}`
        : "—",
    ],
    [
      "Event dates",
      report.eventStartDate && report.eventEndDate
        ? `${fmtDate(report.eventStartDate, true)} → ${fmtDate(report.eventEndDate, true)}`
        : fmtDate(report.eventStartDate, true),
    ],
    ["Event type", EVENT_TYPE_LABELS[report.eventType] ?? report.eventType],
  ];

  autoTable(doc, {
    startY: cur.y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    body: rows,
    theme: "plain",
    bodyStyles: { textColor: BODY_COLOR, fontSize: 11 },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 160, textColor: SUBHEADING_COLOR },
      1: { cellWidth: "auto" },
    },
  });
  // @ts-expect-error autoTable adds lastAutoTable
  cur.y = (doc.lastAutoTable?.finalY ?? cur.y) + 16;
}

function drawTextSection(
  doc: jsPDF,
  cur: Cursor,
  heading: string,
  text: string
): void {
  drawSectionHeading(doc, cur, heading);
  drawParagraph(doc, cur, text || "—");
  cur.y += 8;
}

function drawFinances(doc: jsPDF, cur: Cursor, report: EventReport): void {
  if (!report.finances) return;
  drawSectionHeading(doc, cur, "Finances");

  const fmtAmount = (n: number | null): string =>
    n === null ? "—" : n.toLocaleString();

  const variance =
    report.finances.budget !== null && report.finances.actualSpend !== null
      ? report.finances.budget - report.finances.actualSpend
      : null;

  autoTable(doc, {
    startY: cur.y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [["Item", "Amount"]],
    body: [
      ["Budget", fmtAmount(report.finances.budget)],
      ["Actual spend", fmtAmount(report.finances.actualSpend)],
      [
        "Variance",
        variance === null
          ? "—"
          : `${variance >= 0 ? "+" : ""}${variance.toLocaleString()}`,
      ],
    ],
    headStyles: {
      fillColor: HEADING_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    bodyStyles: { textColor: BODY_COLOR, fontSize: 11 },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: {
      0: { cellWidth: 160 },
      1: { cellWidth: "auto" },
    },
  });
  // @ts-expect-error autoTable adds lastAutoTable
  cur.y = (doc.lastAutoTable?.finalY ?? cur.y) + 12;

  if (report.finances.notes) {
    drawParagraph(doc, cur, report.finances.notes);
    cur.y += 8;
  }
}

function drawMediaLink(doc: jsPDF, cur: Cursor, report: EventReport): void {
  if (!report.mediaLink) return;
  drawSectionHeading(doc, cur, "Media & Photos");

  const lineHeight = 11 * 1.35;
  ensureRoom(doc, cur, lineHeight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...LINK_COLOR);
  doc.textWithLink(report.mediaLink, PAGE_MARGIN, cur.y, {
    url: report.mediaLink,
  });
  doc.setTextColor(...BODY_COLOR);
  cur.y += lineHeight + 8;
}

function drawReviewBlock(doc: jsPDF, cur: Cursor, report: EventReport): void {
  if (
    report.status !== "REVIEWED" &&
    report.status !== "CHANGES_REQUESTED"
  )
    return;

  drawSectionHeading(
    doc,
    cur,
    report.status === "REVIEWED" ? "Chairperson Review" : "Changes Requested"
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SUBHEADING_COLOR);
  ensureRoom(doc, cur, 16);
  doc.text(
    `Reviewer: ${report.reviewedByName ?? "—"}${
      report.reviewedAt ? `  ·  ${fmtDate(report.reviewedAt)}` : ""
    }`,
    PAGE_MARGIN,
    cur.y
  );
  cur.y += 14;

  drawParagraph(doc, cur, report.reviewComments ?? "—");
  cur.y += 8;
}

export function buildEventReportPdf(report: EventReport): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const cur = makeCursor(doc);

  drawCover(doc, cur, report);

  doc.addPage();
  cur.y = PAGE_MARGIN;

  drawOverview(doc, cur, report);
  drawTextSection(doc, cur, "Highlights — What went well", report.highlights);
  drawTextSection(doc, cur, "Challenges encountered", report.challenges);
  drawTextSection(doc, cur, "Lessons learned", report.lessonsLearned);
  drawTextSection(
    doc,
    cur,
    "Recommendations for next time",
    report.recommendations
  );

  drawFinances(doc, cur, report);
  drawMediaLink(doc, cur, report);

  if (report.additionalComments) {
    drawTextSection(doc, cur, "Additional comments", report.additionalComments);
  }

  drawReviewBlock(doc, cur, report);

  const slug = slugify(report.eventTitle, "event-report");
  const datePart = report.eventStartDate
    ? format(report.eventStartDate, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");
  doc.save(`event-report-${slug}-${datePart}.pdf`);
}
