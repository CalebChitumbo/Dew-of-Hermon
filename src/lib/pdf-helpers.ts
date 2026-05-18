import jsPDF from "jspdf";

export const PAGE_MARGIN = 56;
export const HEADING_COLOR: [number, number, number] = [91, 58, 41];
export const SUBHEADING_COLOR: [number, number, number] = [125, 90, 60];
export const BODY_COLOR: [number, number, number] = [62, 37, 24];
export const ACCENT: [number, number, number] = [200, 150, 62];
export const LINK_COLOR: [number, number, number] = [44, 110, 175];
export const ALT_ROW: [number, number, number] = [255, 248, 240];

export function slugify(s: string, fallback = "document"): string {
  return (
    (s || fallback)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || fallback
  );
}

export type Cursor = {
  y: number;
  pageHeight: number;
  pageWidth: number;
  contentWidth: number;
};

export function makeCursor(doc: jsPDF): Cursor {
  return {
    y: PAGE_MARGIN,
    pageHeight: doc.internal.pageSize.getHeight(),
    pageWidth: doc.internal.pageSize.getWidth(),
    contentWidth: doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2,
  };
}

export function ensureRoom(doc: jsPDF, cur: Cursor, needed: number): void {
  if (cur.y + needed > cur.pageHeight - PAGE_MARGIN) {
    doc.addPage();
    cur.y = PAGE_MARGIN;
  }
}

export function drawSectionHeading(
  doc: jsPDF,
  cur: Cursor,
  text: string
): void {
  ensureRoom(doc, cur, 36);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...HEADING_COLOR);
  doc.text(text.toUpperCase(), PAGE_MARGIN, cur.y);
  cur.y += 6;
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1.2);
  doc.line(PAGE_MARGIN, cur.y, PAGE_MARGIN + 60, cur.y);
  cur.y += 18;
}

export function drawSubHeading(doc: jsPDF, cur: Cursor, text: string): void {
  ensureRoom(doc, cur, 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...SUBHEADING_COLOR);
  doc.text(text, PAGE_MARGIN, cur.y);
  cur.y += 14;
}

export function drawParagraph(
  doc: jsPDF,
  cur: Cursor,
  text: string,
  opts: {
    italic?: boolean;
    size?: number;
    color?: [number, number, number];
  } = {}
): void {
  if (!text) {
    drawParagraph(doc, cur, "—", opts);
    return;
  }
  const size = opts.size ?? 11;
  doc.setFont("helvetica", opts.italic ? "italic" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...(opts.color ?? BODY_COLOR));
  const lines = doc.splitTextToSize(text, cur.contentWidth) as string[];
  const lineHeight = size * 1.35;
  for (const line of lines) {
    ensureRoom(doc, cur, lineHeight);
    doc.text(line, PAGE_MARGIN, cur.y);
    cur.y += lineHeight;
  }
}

export function drawLabelValue(
  doc: jsPDF,
  cur: Cursor,
  label: string,
  value: string
): void {
  drawSubHeading(doc, cur, label);
  drawParagraph(doc, cur, value || "—");
  cur.y += 4;
}
