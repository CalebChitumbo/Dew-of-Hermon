import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { format, parseISO } from "date-fns";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail, validateEmailConfig } from "@/lib/email";
import { escapeHtml } from "@/lib/notifications";
import {
  getCamp,
  CAMP_CONTACTS,
  CAMP_PAYMENT_NUMBER,
  buildCampPaymentReference,
} from "@/lib/camps";

/**
 * Registration-details + QR check-in pass email.
 *
 * Every camp registration gets a `checkInCode` — a short secret code encoded
 * into a QR image. The email carries the QR inline (as a CID attachment, so
 * it renders without "load remote images" prompts) plus the registration
 * summary, payment instructions, and a link that lets the registrant create
 * an account and claim the registration for tracking.
 */

// Unambiguous alphabet: no 0/O, 1/I/L so codes survive being read out loud
// or typed from paper.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12;

export function generateCheckInCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

/** "ABCDEFGHJKMN" -> "ABCD-EFGH-JKMN" for human display. */
export function formatCheckInCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

/** Accepts pasted/typed/scanned input and reduces it to the stored form. */
export function normalizeCheckInCode(input: string): string {
  const trimmed = input.trim();
  // Allow pasting the full check-in URL from a QR scan.
  try {
    const url = new URL(trimmed);
    const fromParam = url.searchParams.get("code");
    if (fromParam) {
      return fromParam.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    }
  } catch {
    // not a URL — treat as a raw code
  }
  return trimmed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL || "https://dew-of-hermon-xy9h.vercel.app"
  );
}

interface SendResult {
  queued: boolean;
  to?: string;
  reason?: string;
}

/**
 * Sends the registration-details + QR email for one registration and stamps
 * tracking fields (`qrEmailSentAt/To/Count`) on the document. Backfills
 * `checkInCode` (and `claimToken` for legacy rows) when missing.
 *
 * Never throws for per-registration problems — returns `{queued: false,
 * reason}` so callers (including the public POST) can treat email delivery
 * as best-effort.
 */
export async function sendCampRegistrationEmail(
  registrationId: string,
  data: FirebaseFirestore.DocumentData
): Promise<SendResult> {
  const configError = validateEmailConfig();
  if (configError) {
    console.warn(
      `Skipping camp registration email for ${registrationId}: ${configError}`
    );
    return { queued: false, reason: configError };
  }

  const recipient: string | null = data.parentEmail ?? data.email ?? null;
  if (!recipient) {
    return { queued: false, reason: "No email address on the registration" };
  }

  const camp = getCamp(data.campId);
  if (!camp) {
    return { queued: false, reason: `Unknown camp "${data.campId}"` };
  }

  try {
    const ref = adminDb.collection("campRegistrations").doc(registrationId);

    // Backfill secrets for registrations created before this feature.
    const backfill: Record<string, unknown> = {};
    let checkInCode: string = data.checkInCode;
    if (!checkInCode) {
      checkInCode = generateCheckInCode();
      backfill.checkInCode = checkInCode;
    }
    let claimToken: string = data.claimToken;
    if (!claimToken) {
      claimToken = randomBytes(24).toString("hex");
      backfill.claimToken = claimToken;
    }
    if (Object.keys(backfill).length > 0) {
      await ref.update({ ...backfill, updatedAt: new Date() });
    }

    const appUrl = getAppUrl();
    const checkInUrl = `${appUrl}/manage/rops-camp/check-in?code=${checkInCode}`;
    const trackUrl = `${appUrl}/rops-camp/track?rid=${encodeURIComponent(
      registrationId
    )}&token=${encodeURIComponent(claimToken)}&email=${encodeURIComponent(
      recipient
    )}`;

    const qrPng = await QRCode.toBuffer(checkInUrl, {
      type: "png",
      width: 480,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#16110D", light: "#FFFFFF" },
    });

    const { subject, text, html } = buildEmailContent({
      data,
      camp,
      registrationId,
      checkInCode,
      trackUrl,
    });

    const { id: mailId } = await sendEmail({
      to: recipient,
      subject,
      text,
      html,
      attachments: [
        {
          filename: "rops-checkin-pass.png",
          content: qrPng.toString("base64"),
          encoding: "base64",
          contentType: "image/png",
          cid: "rops-checkin-qr",
        },
      ],
    });

    await ref.update({
      qrEmailSentAt: new Date(),
      qrEmailSentTo: recipient,
      qrEmailCount: ((data.qrEmailCount as number | undefined) ?? 0) + 1,
      qrEmailMailId: mailId,
      updatedAt: new Date(),
    });

    return { queued: true, to: recipient };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `Failed to queue camp registration email for ${registrationId}:`,
      err
    );
    return { queued: false, reason: message };
  }
}

function buildEmailContent({
  data,
  camp,
  registrationId,
  checkInCode,
  trackUrl,
}: {
  data: FirebaseFirestore.DocumentData;
  camp: NonNullable<ReturnType<typeof getCamp>>;
  registrationId: string;
  checkInCode: string;
  trackUrl: string;
}) {
  const camperName = `${data.firstName} ${data.lastName}`.trim();
  const greetName: string =
    (data.parentName as string | null)?.trim().split(/\s+/)[0] ||
    (data.firstName as string);
  const reference = buildCampPaymentReference(registrationId);
  const isPaid = data.paymentStatus === "PAID";
  const fee = `${camp.currency} ${camp.fee.toLocaleString()}`;
  const dates = `${format(parseISO(camp.startDate), "d MMMM")} – ${format(
    parseISO(camp.endDate),
    "d MMMM yyyy"
  )}`;
  const displayCode = formatCheckInCode(checkInCode);

  const subject = `${camp.name} — ${camperName}'s registration & check-in pass`;

  const contactLines = CAMP_CONTACTS.map(
    (c) => `${c.name} (${c.role}) — ${c.phone}`
  );

  const text = [
    `Hi ${greetName},`,
    ``,
    `${camperName}'s place at ${camp.name} has been reserved. Here are the details:`,
    ``,
    `Camper: ${camperName}`,
    `Camp: ${camp.name}`,
    `Dates: ${dates}`,
    ...(camp.venue ? [`Venue: ${camp.venue}`] : []),
    `Camp fee: ${fee}`,
    `Payment reference: ${reference}`,
    `Payment status: ${isPaid ? "PAID — thank you!" : "Awaiting payment"}`,
    ``,
    ...(isPaid
      ? []
      : [
          `HOW TO PAY`,
          `Send ${fee} by mobile money to ${CAMP_PAYMENT_NUMBER} and include the reference ${reference}. Then send your proof of payment (POP) to the same number so we can confirm ${camperName}'s slot.`,
          ``,
        ]),
    `YOUR CHECK-IN PASS`,
    `The attached QR code is ${camperName}'s check-in pass for camp. Save this email (or the image) and show it at the camp gate — our team will scan it to confirm the registration and check ${camperName} in.`,
    `If the QR can't be scanned, give the team this code instead: ${displayCode}`,
    ``,
    `TRACK YOUR REGISTRATION`,
    `Create a free account (or sign in) with this email address to see ${camperName}'s payment status any time:`,
    trackUrl,
    ``,
    `Questions? Contact:`,
    ...contactLines,
    ``,
    `Dew of Hermon Youth Ministry · Tabernacle of David Assembly`,
  ].join("\n");

  const detailRow = (label: string, value: string, highlight = false) => `
    <tr>
      <td style="padding:7px 0; color:#8a7a68; font-size:13px; vertical-align:top; width:44%;">${label}</td>
      <td style="padding:7px 0; color:${highlight ? "#D14A1F" : "#16110D"}; font-size:13px; font-weight:600; text-align:right;">${value}</td>
    </tr>`;

  const html = `
  <div style="margin:0; padding:0; background-color:#F4EEE3;">
    <div style="max-width:600px; margin:0 auto; padding:24px 16px; font-family:Georgia, 'Times New Roman', serif; color:#16110D;">

      <!-- Header -->
      <div style="background-color:#16110D; border-radius:6px 6px 0 0; padding:28px 32px; text-align:center;">
        <div style="color:#D14A1F; font-size:11px; letter-spacing:3px; text-transform:uppercase; font-family:Arial, sans-serif;">Registration received</div>
        <div style="color:#F4EEE3; font-size:28px; font-style:italic; margin-top:8px;">${escapeHtml(camp.name)}</div>
        <div style="color:#b7a894; font-size:12px; margin-top:6px; font-family:Arial, sans-serif;">${escapeHtml(dates)}${camp.venue ? ` · ${escapeHtml(camp.venue)}` : ""}</div>
      </div>

      <!-- Body card -->
      <div style="background-color:#FDFBF6; border:1px solid #e5dcc9; border-top:none; padding:32px;">
        <p style="font-size:15px; line-height:1.6; margin:0 0 18px;">
          Hi ${escapeHtml(greetName)},
        </p>
        <p style="font-size:15px; line-height:1.6; margin:0 0 24px;">
          <strong>${escapeHtml(camperName)}</strong>&rsquo;s place at ${escapeHtml(camp.name)} has been reserved.
          ${
            isPaid
              ? "Payment has been received — the slot is confirmed. See you at camp!"
              : "Please complete payment within <strong>7 days</strong> to confirm the slot."
          }
        </p>

        <!-- Details -->
        <div style="background-color:#F4EEE3; border:1px solid #e5dcc9; border-radius:6px; padding:18px 22px; margin-bottom:24px;">
          <div style="color:#D14A1F; font-size:10px; letter-spacing:2.5px; text-transform:uppercase; font-family:Arial, sans-serif; margin-bottom:8px;">Registration details</div>
          <table style="width:100%; border-collapse:collapse; font-family:Arial, sans-serif;">
            ${detailRow("Camper", escapeHtml(camperName))}
            ${detailRow("Camp fee", escapeHtml(fee))}
            ${detailRow("Payment reference", escapeHtml(reference))}
            ${detailRow(
              "Payment status",
              isPaid ? "Paid ✓" : "Awaiting payment",
              !isPaid
            )}
          </table>
        </div>

        ${
          isPaid
            ? ""
            : `
        <!-- Payment instructions -->
        <div style="border:1px solid rgba(209,74,31,0.35); border-radius:6px; padding:18px 22px; margin-bottom:24px;">
          <div style="color:#D14A1F; font-size:10px; letter-spacing:2.5px; text-transform:uppercase; font-family:Arial, sans-serif; margin-bottom:8px;">How to pay</div>
          <p style="font-size:13px; line-height:1.7; margin:0; font-family:Arial, sans-serif; color:#2A211A;">
            Send <strong>${escapeHtml(fee)}</strong> by mobile money to
            <strong>${escapeHtml(CAMP_PAYMENT_NUMBER)}</strong> using reference
            <strong>${escapeHtml(reference)}</strong>, then send your proof of payment (POP)
            to the same number so we can match it to ${escapeHtml(camperName)}&rsquo;s registration.
          </p>
        </div>`
        }

        <!-- QR pass -->
        <div style="background-color:#16110D; border-radius:6px; padding:26px 22px; text-align:center; margin-bottom:24px;">
          <div style="color:#D14A1F; font-size:10px; letter-spacing:2.5px; text-transform:uppercase; font-family:Arial, sans-serif; margin-bottom:14px;">Check-in pass · show at the camp gate</div>
          <img src="cid:rops-checkin-qr" alt="Check-in QR code for ${escapeHtml(camperName)}" width="200" height="200" style="display:block; margin:0 auto; border-radius:6px; background:#ffffff; padding:8px;" />
          <div style="color:#F4EEE3; font-family:'Courier New', monospace; font-size:16px; letter-spacing:2px; margin-top:14px;">${escapeHtml(displayCode)}</div>
          <div style="color:#b7a894; font-size:11px; font-family:Arial, sans-serif; margin-top:8px; line-height:1.6;">
            Our team scans this when ${escapeHtml(camperName)} arrives at camp.<br/>
            Can&rsquo;t scan? Give them the code above instead.
          </div>
        </div>

        <!-- Track CTA -->
        <div style="text-align:center; margin-bottom:8px;">
          <a href="${trackUrl}" style="display:inline-block; background-color:#D14A1F; color:#F4EEE3; text-decoration:none; padding:13px 30px; border-radius:999px; font-size:12px; letter-spacing:2px; text-transform:uppercase; font-family:Arial, sans-serif;">Track this registration</a>
          <p style="font-size:12px; color:#8a7a68; font-family:Arial, sans-serif; line-height:1.6; margin:14px auto 0; max-width:420px;">
            Create a free account (or sign in) using <strong>this email address</strong> and
            the registration will be linked automatically, so you can check the payment
            status any time.
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color:#16110D; border-radius:0 0 6px 6px; padding:22px 32px; text-align:center;">
        <div style="color:#D14A1F; font-size:10px; letter-spacing:2.5px; text-transform:uppercase; font-family:Arial, sans-serif; margin-bottom:10px;">Questions?</div>
        ${CAMP_CONTACTS.map(
          (c) =>
            `<div style="color:#F4EEE3; font-size:12px; font-family:Arial, sans-serif; margin-bottom:4px;">${escapeHtml(c.name)} <span style="color:#b7a894;">· ${escapeHtml(c.role)} · ${escapeHtml(c.phone)}</span></div>`
        ).join("")}
        <div style="color:#8a7a68; font-size:10px; font-family:Arial, sans-serif; margin-top:12px;">
          Dew of Hermon Youth Ministry · Tabernacle of David Assembly
        </div>
      </div>
    </div>
  </div>`;

  return { subject, text, html };
}
