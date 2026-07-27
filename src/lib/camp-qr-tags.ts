"use client";

import jsPDF from "jspdf";
import QRCode from "qrcode";
import { formatMealCode } from "@/lib/camp-meals";
import { slugify } from "@/lib/pdf-helpers";

/**
 * Printable camper QR tags — the physical half of the meal card system.
 *
 * One sheet, every registered camper, one tag each. The tags are cut out and
 * stuck onto the name tags / IDs the camp already issues, so a camper ends up
 * carrying a single card that is their ID, their gate pass and their meal card
 * at once. Nothing here depends on a camper owning a phone.
 *
 * Each tag carries the ministry and camp name, the QR, and the code in text.
 * The camper's own name is printed ABOVE the cut line, not on the tag: eighty
 * gold tags are otherwise indistinguishable, and whoever is assembling the IDs
 * has to know which tag belongs to whom. It gets trimmed away with the offcut.
 *
 * Deliberately NOT printed anywhere: allergies, medical notes, contact
 * details. Those belong on the server's screen at the moment of serving, not
 * on a card a teenager wears all week.
 */

const MINISTRY_NAME = "DEW OF HERMON YOUTH MINISTRY";

// A4 in mm, laid out as a 4 × 5 grid = 20 tags per sheet (80 campers = 4
// sheets). Each row is a 5mm name guide sitting above a 45 × 48mm tag.
const PAGE_W = 210;
const MARGIN = 10;
const COLS = 4;
const ROWS = 5;
const PER_PAGE = COLS * ROWS;

const TAG_W = 45;
const TAG_H = 48;
const GUIDE_H = 5;
const GUTTER_X = (PAGE_W - MARGIN * 2 - TAG_W * COLS) / (COLS - 1);
const ROW_PITCH = GUIDE_H + TAG_H + 2;

// The QR is the whole point of the tag, so it gets the space. 30mm scans
// reliably off a phone at arm's length, which is the distance across a
// serving table.
const QR_SIZE = 30;

const CLAY: [number, number, number] = [91, 58, 41];
const MUTED: [number, number, number] = [140, 115, 95];
const GOLD: [number, number, number] = [200, 150, 62];
const GUIDE: [number, number, number] = [170, 170, 170];

export interface QrTagCamper {
  id: string;
  firstName: string;
  lastName: string;
  checkInCode: string | null;
}

/** Step the font down until the text fits, rather than letting it overrun. */
function fitFontSize(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  start: number,
  min = 4
): number {
  let size = start;
  while (size > min && doc.getStringUnitWidth(text) * size > maxWidth) {
    size -= 0.25;
  }
  return size;
}

function drawCentered(
  doc: jsPDF,
  text: string,
  centerX: number,
  y: number,
  maxWidth: number,
  startSize: number
): void {
  doc.setFontSize(fitFontSize(doc, text, maxWidth, startSize));
  doc.text(text, centerX, y, { align: "center" });
}

function drawTag(
  doc: jsPDF,
  camper: QrTagCamper,
  qrDataUrl: string | null,
  campName: string,
  x: number,
  guideY: number
): void {
  const centerX = x + TAG_W / 2;
  const tagY = guideY + GUIDE_H;

  // Assembly guide — sits above the cut line and is discarded with the offcut.
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GUIDE);
  drawCentered(
    doc,
    `${camper.firstName} ${camper.lastName}`.trim(),
    centerX,
    guideY + 3.5,
    TAG_W,
    7
  );

  // Cut line
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, tagY, TAG_W, TAG_H, 1.5, 1.5);

  // Ministry, then camp
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GOLD);
  drawCentered(doc, MINISTRY_NAME, centerX, tagY + 5, TAG_W - 4, 4.6);

  doc.setTextColor(...CLAY);
  drawCentered(doc, campName, centerX, tagY + 9.5, TAG_W - 4, 7.5);

  // QR
  if (qrDataUrl) {
    doc.addImage(
      qrDataUrl,
      "PNG",
      centerX - QR_SIZE / 2,
      tagY + 11.5,
      QR_SIZE,
      QR_SIZE
    );
  }

  // The typed-code fallback, for a tag too creased or scuffed to scan.
  if (camper.checkInCode) {
    doc.setFont("courier", "bold");
    doc.setTextColor(...MUTED);
    drawCentered(
      doc,
      formatMealCode(camper.checkInCode),
      centerX,
      tagY + TAG_H - 3,
      TAG_W - 3,
      7
    );
  }
}

/**
 * Build the QR tag sheet. `appUrl` should be the deployed origin so the QR
 * resolves the same way the registration email's does.
 *
 * Campers without a code are skipped rather than printed blank — a tag that
 * can't be scanned is worse than no tag, because it looks valid in the queue.
 */
export async function buildCampQrTagsPdf(
  campers: QrTagCamper[],
  campName: string,
  appUrl: string
): Promise<jsPDF> {
  const withCodes = campers.filter((c) => !!c.checkInCode);
  if (withCodes.length === 0) {
    throw new Error("None of these campers have a QR code yet.");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Render every QR up front — addImage is synchronous, toDataURL is not.
  const qrCodes = await Promise.all(
    withCodes.map((c) =>
      QRCode.toDataURL(
        `${appUrl}/manage/rops-camp/check-in?code=${c.checkInCode}`,
        {
          width: 320,
          margin: 0,
          errorCorrectionLevel: "M",
          color: { dark: "#16110D", light: "#FFFFFF" },
        }
      ).catch(() => null)
    )
  );

  withCodes.forEach((camper, i) => {
    if (i > 0 && i % PER_PAGE === 0) doc.addPage();
    const slot = i % PER_PAGE;
    const col = slot % COLS;
    const row = Math.floor(slot / COLS);
    const x = MARGIN + col * (TAG_W + GUTTER_X);
    const guideY = MARGIN + row * ROW_PITCH;
    drawTag(doc, camper, qrCodes[i], campName, x, guideY);
  });

  return doc;
}

/** Build the QR tag sheet and hand it to the browser as a download. */
export async function downloadCampQrTags(
  campers: QrTagCamper[],
  campName: string,
  appUrl: string
): Promise<void> {
  const doc = await buildCampQrTagsPdf(campers, campName, appUrl);
  doc.save(`${slugify(campName, "camp")}-qr-tags.pdf`);
}
