import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import type { LatreouCycle, Song } from "./types";
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
  drawSubHeading,
  drawParagraph,
  drawLabelValue,
  type Cursor,
} from "@/lib/pdf-helpers";

function formatDateOrDash(iso: string): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "EEEE, d MMMM yyyy");
  } catch {
    return iso;
  }
}

function formatShortDate(iso: string): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "EEE, d MMM yyyy");
  } catch {
    return iso;
  }
}

function drawCover(doc: jsPDF, cur: Cursor, cycle: LatreouCycle): void {
  cur.y = PAGE_MARGIN + 80;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  doc.setTextColor(...HEADING_COLOR);
  doc.text("LATREOU", PAGE_MARGIN, cur.y);
  cur.y += 18;

  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(2);
  doc.line(PAGE_MARGIN, cur.y, PAGE_MARGIN + 120, cur.y);
  cur.y += 32;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(13);
  doc.setTextColor(...SUBHEADING_COLOR);
  doc.text("Worship Cycle Plan", PAGE_MARGIN, cur.y);
  cur.y += 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...BODY_COLOR);
  const cycleName = cycle.cycleName || "Untitled cycle";
  const nameLines = doc.splitTextToSize(cycleName, cur.contentWidth) as string[];
  for (const line of nameLines) {
    doc.text(line, PAGE_MARGIN, cur.y);
    cur.y += 26;
  }
  cur.y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...SUBHEADING_COLOR);
  doc.text(
    `Prepared by ${cycle.preparedBy || "—"}`,
    PAGE_MARGIN,
    cur.y
  );
  cur.y += 16;
  doc.text(
    `Generated ${format(new Date(), "d MMMM yyyy")}`,
    PAGE_MARGIN,
    cur.y
  );
}

function drawSongTable(
  doc: jsPDF,
  cur: Cursor,
  title: string,
  songs: Song[]
): void {
  drawSubHeading(doc, cur, title);

  if (songs.length === 0) {
    drawParagraph(doc, cur, "No songs added.", { italic: true, color: SUBHEADING_COLOR });
    cur.y += 4;
    return;
  }

  autoTable(doc, {
    startY: cur.y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [["#", "Song", "Leader", "Listen"]],
    body: songs.map((s, i) => [
      String(i + 1),
      s.title || "—",
      s.leader || "—",
      s.youtubeLink ? "▶ YouTube" : "—",
    ]),
    headStyles: {
      fillColor: HEADING_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    bodyStyles: {
      textColor: BODY_COLOR,
      fontSize: 10,
    },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: {
      0: { cellWidth: 28, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 110 },
      3: { cellWidth: 80 },
    },
    didDrawCell: (data) => {
      if (
        data.section === "body" &&
        data.column.index === 3 &&
        songs[data.row.index]?.youtubeLink
      ) {
        const link = songs[data.row.index].youtubeLink;
        const { x, y, width, height } = data.cell;
        void width;
        doc.setTextColor(...LINK_COLOR);
        doc.textWithLink("▶ YouTube", x + 4, y + height / 2 + 3, { url: link });
        doc.setTextColor(...BODY_COLOR);
      }
    },
  });

  // @ts-expect-error autoTable adds lastAutoTable to the doc instance
  cur.y = (doc.lastAutoTable?.finalY ?? cur.y) + 16;
}

function drawSundaySection(
  doc: jsPDF,
  cur: Cursor,
  title: string,
  date: string,
  session1: Song[],
  session2: Song[],
  specialItem: { title: string; responsible: string; link: string }
): void {
  drawSectionHeading(doc, cur, title);
  drawParagraph(doc, cur, formatDateOrDash(date), {
    italic: true,
    color: SUBHEADING_COLOR,
  });
  cur.y += 6;

  drawSongTable(doc, cur, "Session 1", session1);
  drawSongTable(doc, cur, "Session 2", session2);

  drawSubHeading(doc, cur, "Special Song");
  if (!specialItem.title && !specialItem.responsible) {
    drawParagraph(doc, cur, "None.", { italic: true, color: SUBHEADING_COLOR });
  } else {
    drawParagraph(
      doc,
      cur,
      `${specialItem.title || "—"} — led by ${specialItem.responsible || "—"}`
    );
    if (specialItem.link) {
      const lineHeight = 11 * 1.35;
      ensureRoom(doc, cur, lineHeight);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...LINK_COLOR);
      doc.textWithLink("▶ Listen", PAGE_MARGIN, cur.y, { url: specialItem.link });
      doc.setTextColor(...BODY_COLOR);
      cur.y += lineHeight;
    }
  }
  cur.y += 12;
}

function drawUniforms(doc: jsPDF, cur: Cursor, cycle: LatreouCycle): void {
  drawSectionHeading(doc, cur, "Uniforms");

  drawSubHeading(doc, cur, "First Sunday");
  drawLabelValue(doc, cur, "Gents", cycle.uniforms.firstSundayGents);
  drawLabelValue(doc, cur, "Ladies", cycle.uniforms.firstSundayLadies);

  drawSubHeading(doc, cur, "Second Sunday");
  drawLabelValue(doc, cur, "Gents", cycle.uniforms.secondSundayGents);
  drawLabelValue(doc, cur, "Ladies", cycle.uniforms.secondSundayLadies);

  if (cycle.uniforms.notes.trim()) {
    drawSubHeading(doc, cur, "Notes");
    drawParagraph(doc, cur, cycle.uniforms.notes);
  }
  cur.y += 8;
}

function drawRehearsals(doc: jsPDF, cur: Cursor, cycle: LatreouCycle): void {
  drawSectionHeading(doc, cur, "Rehearsal Schedule");

  if (cycle.rehearsals.length === 0) {
    drawParagraph(doc, cur, "No rehearsals scheduled.", {
      italic: true,
      color: SUBHEADING_COLOR,
    });
    cur.y += 12;
    return;
  }

  autoTable(doc, {
    startY: cur.y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [["Date", "Time", "Location", "Coordinator", "Focus"]],
    body: cycle.rehearsals.map((r) => [
      formatShortDate(r.date),
      r.time || "—",
      r.location || "—",
      r.coordinator || "—",
      r.focus || "—",
    ]),
    headStyles: {
      fillColor: HEADING_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    bodyStyles: { textColor: BODY_COLOR, fontSize: 10 },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 50 },
      2: { cellWidth: 80 },
      3: { cellWidth: 80 },
      4: { cellWidth: "auto" },
    },
  });

  // @ts-expect-error autoTable adds lastAutoTable to the doc instance
  cur.y = (doc.lastAutoTable?.finalY ?? cur.y) + 16;
}

function drawScripture(doc: jsPDF, cur: Cursor, cycle: LatreouCycle): void {
  drawSectionHeading(doc, cur, "Anchor Scripture");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...HEADING_COLOR);
  ensureRoom(doc, cur, 20);
  doc.text(cycle.scripture.reference || "—", PAGE_MARGIN, cur.y);
  cur.y += 18;

  drawParagraph(doc, cur, cycle.scripture.text, { italic: true });
  cur.y += 8;
}

function drawPrayer(doc: jsPDF, cur: Cursor, cycle: LatreouCycle): void {
  drawSectionHeading(doc, cur, "Prayer Direction");
  drawParagraph(doc, cur, cycle.prayerDirection);
  cur.y += 8;
}

export function buildLatreouPdf(cycle: LatreouCycle): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const cur = makeCursor(doc);

  drawCover(doc, cur, cycle);

  doc.addPage();
  cur.y = PAGE_MARGIN;
  drawSundaySection(
    doc,
    cur,
    "First Sunday",
    cycle.firstSunday.date,
    cycle.firstSunday.session1,
    cycle.firstSunday.session2,
    cycle.firstSunday.specialItem
  );

  drawSundaySection(
    doc,
    cur,
    "Second Sunday",
    cycle.secondSunday.date,
    cycle.secondSunday.session1,
    cycle.secondSunday.session2,
    cycle.secondSunday.specialItem
  );

  drawUniforms(doc, cur, cycle);
  drawRehearsals(doc, cur, cycle);
  drawScripture(doc, cur, cycle);
  drawPrayer(doc, cur, cycle);

  doc.save(`latreou-${slugify(cycle.cycleName, "latreou-cycle")}.pdf`);
}
