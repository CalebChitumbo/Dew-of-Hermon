"use client";

import jsPDF from "jspdf";
import QRCode from "qrcode";
import { formatMealCode } from "@/lib/camp-meals";
import { slugify } from "@/lib/pdf-helpers";

/**
 * Printable camper badges — the physical half of the meal card system.
 *
 * The badge, not the phone, is the credential. It carries the same
 * `checkInCode` issued at registration, so one printed card works at the
 * arrival gate and at every serving line, and a camper who owns no phone is
 * never a special case at the front of a meal queue.
 *
 * Deliberately NOT printed: allergies, medical notes, and contact details.
 * Those belong on the server's screen at the moment of serving, not on a card
 * hanging around a teenager's neck all week.
 */

const BADGES_PER_ROW = 2;
const ROWS_PER_PAGE = 4;
const PER_PAGE = BADGES_PER_ROW * ROWS_PER_PAGE;

// A4 in mm, laid out as 2 × 4 cards with a 10mm page margin.
const PAGE_W = 210;
const MARGIN = 10;
const GUTTER_X = 10;
const GUTTER_Y = 5;
const CARD_W = (PAGE_W - MARGIN * 2 - GUTTER_X) / BADGES_PER_ROW; // 90mm
const CARD_H = 65;

const CLAY: [number, number, number] = [91, 58, 41];
const MUTED: [number, number, number] = [140, 115, 95];
const GOLD: [number, number, number] = [200, 150, 62];

export interface BadgeCamper {
  id: string;
  firstName: string;
  lastName: string;
  churchOrSchool: string | null;
  checkInCode: string | null;
}

/** Fit a name to the card by stepping the font down before truncating. */
function fitText(doc: jsPDF, text: string, maxWidth: number, start: number): number {
  let size = start;
  while (size > 9 && doc.getStringUnitWidth(text) * size > maxWidth) {
    size -= 1;
  }
  return size;
}

function drawBadge(
  doc: jsPDF,
  camper: BadgeCamper,
  qrDataUrl: string | null,
  campName: string,
  x: number,
  y: number
): void {
  // Cut outline
  doc.setDrawColor(215, 205, 195);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, CARD_W, CARD_H, 2, 2);

  // Gold header rule
  doc.setFillColor(...GOLD);
  doc.rect(x, y, CARD_W, 1.5, "F");

  const padX = x + 5;
  let cursorY = y + 9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...GOLD);
  doc.text(campName.toUpperCase(), padX, cursorY);

  // Name — the thing a server reads across a serving table
  cursorY += 8;
  const name = `${camper.firstName} ${camper.lastName}`.trim();
  const textWidth = CARD_W - 10 - 30; // leave room for the QR block
  doc.setFont("helvetica", "bold");
  const nameSize = fitText(doc, name, textWidth, 15);
  doc.setFontSize(nameSize);
  doc.setTextColor(...CLAY);
  doc.text(name, padX, cursorY, { maxWidth: textWidth });

  if (camper.churchOrSchool) {
    cursorY += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(camper.churchOrSchool, padX, cursorY, { maxWidth: textWidth });
  }

  // QR block, bottom-right
  const qrSize = 28;
  const qrX = x + CARD_W - qrSize - 5;
  const qrY = y + CARD_H - qrSize - 10;
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  }

  // Code, bottom-left — the fallback when a badge is too creased to scan
  if (camper.checkInCode) {
    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...CLAY);
    doc.text(formatMealCode(camper.checkInCode), padX, y + CARD_H - 14);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...MUTED);
  doc.text("Meal & gate pass — keep this on you", padX, y + CARD_H - 7, {
    maxWidth: CARD_W - qrSize - 12,
  });
}

/**
 * Build the badge sheet. `appUrl` should be the deployed origin so the QR
 * resolves the same way the registration email's does.
 *
 * Campers without a code are skipped rather than printed blank — a badge that
 * can't be scanned is worse than no badge, because it looks valid in the queue.
 */
export async function buildCampBadgesPdf(
  campers: BadgeCamper[],
  campName: string,
  appUrl: string
): Promise<jsPDF> {
  const withCodes = campers.filter((c) => !!c.checkInCode);
  if (withCodes.length === 0) {
    throw new Error("None of these campers have a badge code yet.");
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
    const col = slot % BADGES_PER_ROW;
    const row = Math.floor(slot / BADGES_PER_ROW);
    const x = MARGIN + col * (CARD_W + GUTTER_X);
    const y = MARGIN + row * (CARD_H + GUTTER_Y);
    drawBadge(doc, camper, qrCodes[i], campName, x, y);
  });

  return doc;
}

/** Build the badge sheet and hand it to the browser as a download. */
export async function downloadCampBadges(
  campers: BadgeCamper[],
  campName: string,
  appUrl: string
): Promise<void> {
  const doc = await buildCampBadgesPdf(campers, campName, appUrl);
  doc.save(`${slugify(campName, "camp")}-badges.pdf`);
}
