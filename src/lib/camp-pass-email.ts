import QRCode from "qrcode";
import { format } from "date-fns";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail, validateEmailConfig } from "@/lib/email";
import { escapeHtml } from "@/lib/notifications";
import { getCamp, CAMP_CONTACTS } from "@/lib/camps";
import { getAppUrl } from "@/lib/camp-registration-email";
import {
  PASSES_COLLECTION,
  PASS_GATE_LINK,
  formatPassCode,
} from "@/lib/camp-passes";

/**
 * The exit-pass ticket email.
 *
 * Sent only when the Chairperson approves — the QR it carries is the single
 * thing the gate accepts, and it dies after one scan out and one scan back in.
 * Modelled on the registration email (CID-attached QR so it renders without a
 * "load remote images" prompt).
 */

interface SendResult {
  queued: boolean;
  to?: string;
  reason?: string;
}

export async function sendCampPassEmail(
  passId: string,
  data: FirebaseFirestore.DocumentData
): Promise<SendResult> {
  const configError = validateEmailConfig();
  if (configError) {
    console.warn(`Skipping camp pass email for ${passId}: ${configError}`);
    return { queued: false, reason: configError };
  }

  const recipient: string | null = data.contactEmail ?? null;
  if (!recipient) {
    return { queued: false, reason: "No email address on the pass" };
  }
  const passCode: string | null = data.passCode ?? null;
  if (!passCode) {
    return { queued: false, reason: "Pass has not been issued yet" };
  }

  try {
    const appUrl = getAppUrl();
    const gateUrl = `${appUrl}${PASS_GATE_LINK}?pass=${passCode}`;

    const qrPng = await QRCode.toBuffer(gateUrl, {
      type: "png",
      width: 480,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#16110D", light: "#FFFFFF" },
    });

    const { subject, text, html } = buildPassEmail(passId, data, passCode);

    const { id: mailId } = await sendEmail({
      to: recipient,
      subject,
      text,
      html,
      attachments: [
        {
          filename: "rops-exit-pass.png",
          content: qrPng.toString("base64"),
          encoding: "base64",
          contentType: "image/png",
          cid: "rops-exit-pass-qr",
        },
      ],
    });

    await adminDb
      .collection(PASSES_COLLECTION)
      .doc(passId)
      .update({
        passEmailSentAt: new Date(),
        passEmailSentTo: recipient,
        passEmailCount: ((data.passEmailCount as number | undefined) ?? 0) + 1,
        passEmailMailId: mailId,
        updatedAt: new Date(),
      });

    return { queued: true, to: recipient };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Failed to queue camp pass email for ${passId}:`, err);
    return { queued: false, reason: message };
  }
}

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function buildPassEmail(
  passId: string,
  data: FirebaseFirestore.DocumentData,
  passCode: string
) {
  const camperName: string = data.camperName ?? "The camper";
  const camp = getCamp(data.campId);
  const campName = camp?.name ?? "ROPs Camp";
  const displayCode = formatPassCode(passCode);
  const expectedReturn = safeDate(data.expectedReturnAt);
  const returnLabel = expectedReturn
    ? format(expectedReturn, "EEEE d MMMM, HH:mm")
    : "as agreed with the camp team";
  const reason: string = data.reason ?? "";
  const destination: string | null = data.destination ?? null;
  const escortName: string | null = data.escortName ?? null;
  const chairName: string = data.chairName ?? "the Chairperson";
  const reference = passId.toUpperCase().slice(-6);

  const subject = `${campName} — exit pass for ${camperName}`;

  const text = [
    `${camperName}'s request to leave camp has been approved.`,
    ``,
    `Approved by: Admissions → ${data.managerName ?? "Camp Manager"} → ${chairName} (Chairperson)`,
    `Reason: ${reason}`,
    ...(destination ? [`Destination: ${destination}`] : []),
    ...(escortName ? [`Collected by: ${escortName}`] : []),
    `Expected back at camp: ${returnLabel}`,
    `Pass reference: ${reference}`,
    ``,
    `YOUR GATE PASS`,
    `The attached QR code is the exit pass. Show it to the guard at the gate.`,
    `If the QR can't be scanned, give the guard this code instead: ${displayCode}`,
    ``,
    `IMPORTANT — THIS PASS WORKS TWICE, THEN EXPIRES`,
    `Scan 1: the guard scans it as ${camperName} leaves camp.`,
    `Scan 2: the guard scans the same pass as ${camperName} returns.`,
    `After the return scan the pass is permanently void. A copied, forwarded, or`,
    `screenshotted pass will not work a second time — a new approval is needed`,
    `for every trip out of camp.`,
    ``,
    `Questions? Contact:`,
    ...CAMP_CONTACTS.map((c) => `${c.name} (${c.role}) — ${c.phone}`),
    ``,
    `Dew of Hermon Youth Ministry · Tabernacle of David Assembly`,
  ].join("\n");

  const detailRow = (label: string, value: string) => `
    <tr>
      <td style="padding:7px 0; color:#8a7a68; font-size:13px; vertical-align:top; width:42%;">${label}</td>
      <td style="padding:7px 0; color:#16110D; font-size:13px; font-weight:600; text-align:right;">${value}</td>
    </tr>`;

  const html = `
  <div style="margin:0; padding:0; background-color:#F4EEE3;">
    <div style="max-width:600px; margin:0 auto; padding:24px 16px; font-family:Georgia, 'Times New Roman', serif; color:#16110D;">

      <div style="background-color:#16110D; border-radius:6px 6px 0 0; padding:28px 32px; text-align:center;">
        <div style="color:#D14A1F; font-size:11px; letter-spacing:3px; text-transform:uppercase; font-family:Arial, sans-serif;">Exit pass approved</div>
        <div style="color:#F4EEE3; font-size:28px; font-style:italic; margin-top:8px;">${escapeHtml(camperName)}</div>
        <div style="color:#b7a894; font-size:12px; margin-top:6px; font-family:Arial, sans-serif;">${escapeHtml(campName)} · Pass ref ${escapeHtml(reference)}</div>
      </div>

      <div style="background-color:#FDFBF6; border:1px solid #e5dcc9; border-top:none; padding:32px;">
        <p style="font-size:15px; line-height:1.6; margin:0 0 24px;">
          The request for <strong>${escapeHtml(camperName)}</strong> to leave camp has been
          approved by Admissions, the Camp Manager, and the Chairperson
          (${escapeHtml(chairName)}).
        </p>

        <div style="background-color:#F4EEE3; border:1px solid #e5dcc9; border-radius:6px; padding:18px 22px; margin-bottom:24px;">
          <div style="color:#D14A1F; font-size:10px; letter-spacing:2.5px; text-transform:uppercase; font-family:Arial, sans-serif; margin-bottom:8px;">Pass details</div>
          <table style="width:100%; border-collapse:collapse; font-family:Arial, sans-serif;">
            ${detailRow("Camper", escapeHtml(camperName))}
            ${detailRow("Reason", escapeHtml(reason))}
            ${destination ? detailRow("Destination", escapeHtml(destination)) : ""}
            ${escortName ? detailRow("Collected by", escapeHtml(escortName)) : ""}
            ${detailRow("Expected back", escapeHtml(returnLabel))}
          </table>
        </div>

        <div style="background-color:#16110D; border-radius:6px; padding:26px 22px; text-align:center; margin-bottom:24px;">
          <div style="color:#D14A1F; font-size:10px; letter-spacing:2.5px; text-transform:uppercase; font-family:Arial, sans-serif; margin-bottom:14px;">Gate pass · show to the guard</div>
          <img src="cid:rops-exit-pass-qr" alt="Exit pass QR code for ${escapeHtml(camperName)}" width="200" height="200" style="display:block; margin:0 auto; border-radius:6px; background:#ffffff; padding:8px;" />
          <div style="color:#F4EEE3; font-family:'Courier New', monospace; font-size:16px; letter-spacing:2px; margin-top:14px;">${escapeHtml(displayCode)}</div>
          <div style="color:#b7a894; font-size:11px; font-family:Arial, sans-serif; margin-top:8px; line-height:1.6;">
            Can&rsquo;t scan? Give the guard the code above instead.
          </div>
        </div>

        <div style="border:1px solid rgba(209,74,31,0.35); border-radius:6px; padding:18px 22px;">
          <div style="color:#D14A1F; font-size:10px; letter-spacing:2.5px; text-transform:uppercase; font-family:Arial, sans-serif; margin-bottom:8px;">This pass works twice, then expires</div>
          <p style="font-size:13px; line-height:1.7; margin:0; font-family:Arial, sans-serif; color:#2A211A;">
            <strong>Scan 1</strong> — the guard scans it as ${escapeHtml(camperName)} leaves camp.<br/>
            <strong>Scan 2</strong> — the guard scans the same pass on the way back in.<br/>
            After the return scan the pass is permanently void. Copies, forwards, and
            screenshots will not work a second time; every trip out of camp needs a
            fresh approval.
          </p>
        </div>
      </div>

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
