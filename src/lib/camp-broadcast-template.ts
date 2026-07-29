import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { CAMP_CONTACTS, CAMP_PAYMENT_NUMBER, buildCampPaymentReference } from "@/lib/camps";
import type { CampBroadcastAudience, CampDefinition } from "@/types";

/**
 * The announcement-email template engine.
 *
 * Camp admins type one message with `{{placeholders}}` and every registered
 * camper receives their own copy with their own name, payment reference and
 * details filled in. This module is deliberately isomorphic — no Firestore, no
 * Admin SDK — so the compose screen renders exactly the same HTML the mail
 * server will send, rather than an approximation of it.
 *
 * Server-side sending lives in `@/lib/camp-broadcast`.
 */

/** `{{firstName}}`, `{{ firstName }}` — whitespace inside the braces is fine. */
const TOKEN_PATTERN_SOURCE = "\\{\\{\\s*([a-zA-Z0-9_]+)\\s*\\}\\}";

export type BroadcastTokenGroup = "Camper" | "Camp" | "Payment" | "Links";

export interface BroadcastToken {
  /** Bare name, without braces. */
  token: string;
  label: string;
  /** What it fills in, shown under the insert chip. */
  hint: string;
  group: BroadcastTokenGroup;
  /** Rendered as a clickable link (not plain text) in the HTML email. */
  isUrl?: boolean;
}

export const BROADCAST_TOKENS: BroadcastToken[] = [
  {
    token: "greetingName",
    label: "Greeting name",
    hint: "The parent's first name when the email goes to them, otherwise the camper's",
    group: "Camper",
  },
  { token: "firstName", label: "First name", hint: "Camper's first name", group: "Camper" },
  { token: "lastName", label: "Last name", hint: "Camper's surname", group: "Camper" },
  { token: "fullName", label: "Full name", hint: "Camper's full name", group: "Camper" },
  {
    token: "parentName",
    label: "Parent / guardian",
    hint: "Parent or guardian's name on the registration",
    group: "Camper",
  },
  { token: "phone", label: "Phone", hint: "Camper's phone number", group: "Camper" },
  {
    token: "churchOrSchool",
    label: "Church / school",
    hint: "What the camper wrote as their church or school",
    group: "Camper",
  },
  { token: "tshirtSize", label: "T-shirt size", hint: "e.g. M, L, XL", group: "Camper" },
  {
    token: "dropoff",
    label: "Drop-off point",
    hint: "Church or camp site, as chosen at registration",
    group: "Camper",
  },
  {
    token: "dietary",
    label: "Dietary note",
    hint: "Dietary preference on the registration",
    group: "Camper",
  },
  { token: "campName", label: "Camp name", hint: "e.g. ROPs X Camp 2026", group: "Camp" },
  { token: "campDates", label: "Camp dates", hint: "e.g. 27 August – 31 August 2026", group: "Camp" },
  { token: "campStartDate", label: "Start date", hint: "e.g. 27 August 2026", group: "Camp" },
  { token: "campEndDate", label: "End date", hint: "e.g. 31 August 2026", group: "Camp" },
  { token: "campVenue", label: "Venue", hint: "Where camp is being held", group: "Camp" },
  {
    token: "daysToCamp",
    label: "Days to camp",
    hint: "Counted from the day the email is sent — good for countdowns",
    group: "Camp",
  },
  { token: "campFee", label: "Camp fee", hint: "e.g. ZMW 400", group: "Payment" },
  {
    token: "paymentStatus",
    label: "Payment status",
    hint: "Paid / Awaiting payment / Refunded",
    group: "Payment",
  },
  {
    token: "amountDue",
    label: "Amount still due",
    hint: "Fee less anything already received — ZMW 0 once paid",
    group: "Payment",
  },
  {
    token: "paymentReference",
    label: "Payment reference",
    hint: "The camper's unique mobile-money reference",
    group: "Payment",
  },
  {
    token: "paymentNumber",
    label: "Payment number",
    hint: "Mobile money number payments go to",
    group: "Payment",
  },
  {
    token: "checkInCode",
    label: "Check-in code",
    hint: "The code behind the camper's QR gate pass",
    group: "Links",
  },
  {
    token: "trackUrl",
    label: "Tracking link",
    hint: "Personal link to this camper's registration and payment status",
    group: "Links",
    isUrl: true,
  },
];

const TOKENS_BY_NAME = new Map(BROADCAST_TOKENS.map((t) => [t.token, t]));

export const BROADCAST_TOKEN_GROUPS: BroadcastTokenGroup[] = [
  "Camper",
  "Camp",
  "Payment",
  "Links",
];

// ─── Audiences ───

export const BROADCAST_AUDIENCES: {
  value: CampBroadcastAudience;
  label: string;
  description: string;
}[] = [
  { value: "ALL", label: "Everyone registered", description: "Every camper signed up for this camp" },
  { value: "UNPAID", label: "Not yet paid", description: "Campers whose payment is still outstanding" },
  { value: "PAID", label: "Paid up", description: "Campers whose payment has been received" },
  { value: "SPONSORED", label: "Sponsored", description: "Campers assigned to a sponsorship pledge" },
  { value: "UNSPONSORED", label: "Not sponsored", description: "Campers paying their own way" },
  { value: "CHECKED_IN", label: "Checked in at camp", description: "Campers already through the gate" },
  { value: "NOT_CHECKED_IN", label: "Not yet at camp", description: "Campers who haven't checked in yet" },
  { value: "SELECTED", label: "Hand-picked campers", description: "Only the campers you tick" },
];

/** The registration fields an audience filter looks at. */
export interface BroadcastAudienceRow {
  paymentStatus?: string | null;
  sponsorshipId?: string | null;
  checkedIn?: boolean | null;
}

/** Shared by the compose screen's live count and the send endpoint, so the
 *  number on the button is the number of emails that go out. */
export function matchesBroadcastAudience(
  row: BroadcastAudienceRow,
  audience: CampBroadcastAudience
): boolean {
  switch (audience) {
    case "PAID":
      return row.paymentStatus === "PAID";
    case "UNPAID":
      return row.paymentStatus === "UNPAID";
    case "SPONSORED":
      return !!row.sponsorshipId;
    case "UNSPONSORED":
      return !row.sponsorshipId;
    case "CHECKED_IN":
      return !!row.checkedIn;
    case "NOT_CHECKED_IN":
      return !row.checkedIn;
    case "ALL":
    case "SELECTED":
    default:
      return true;
  }
}

/** Who a camper's copy is addressed to — the parent's inbox when there is one,
 *  otherwise the camper's. Mirrors the registration/QR email rule exactly. */
export function broadcastRecipient(row: {
  parentEmail?: string | null;
  email?: string | null;
}): string | null {
  return clean(row.parentEmail) ?? clean(row.email) ?? null;
}

// ─── Token discovery & validation ───

/** Every distinct `{{token}}` used in the text, in the order they appear. */
export function findBroadcastTokens(template: string): string[] {
  const seen: string[] = [];
  const pattern = new RegExp(TOKEN_PATTERN_SOURCE, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(template)) !== null) {
    if (!seen.includes(match[1])) seen.push(match[1]);
  }
  return seen;
}

/**
 * Tokens the engine can't fill in. The compose screen and the send endpoint
 * both refuse to send while this is non-empty — a typo'd `{{frstName}}` would
 * otherwise reach campers verbatim.
 */
export function findUnknownBroadcastTokens(template: string): string[] {
  return findBroadcastTokens(template).filter((t) => !TOKENS_BY_NAME.has(t));
}

// ─── Values ───

/** The registration fields the engine reads. Firestore data and the API's
 *  serialized rows both satisfy this, so one builder serves both sides. */
export interface BroadcastCamper {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  churchOrSchool?: string | null;
  tshirtSize?: string | null;
  dropoffLocation?: string | null;
  dietaryPreference?: string | null;
  paymentStatus?: string | null;
  paymentAmount?: number | null;
  checkInCode?: string | null;
}

export interface BroadcastContext {
  registrationId: string;
  camper: BroadcastCamper;
  camp: CampDefinition;
  /** Address this copy is addressed to — decides who `{{greetingName}}` greets. */
  recipient: string | null;
  /** Personal tracking link; the compose preview passes a generic one. */
  trackUrl: string;
  /** Defaults to now — injected so `{{daysToCamp}}` is testable. */
  now?: Date;
}

/** Shown wherever the registration left an optional field blank. */
const BLANK = "—";

function clean(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

function firstWord(value: string | null | undefined): string | null {
  return clean(value)?.split(/\s+/)[0] ?? null;
}

/** "ABCDEFGHJKMN" -> "ABCD-EFGH-JKMN", mirroring the QR pass email. */
function formatCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

export function formatCampDates(camp: CampDefinition): string {
  return `${format(parseISO(camp.startDate), "d MMMM")} – ${format(
    parseISO(camp.endDate),
    "d MMMM yyyy"
  )}`;
}

export function buildBroadcastValues(ctx: BroadcastContext): Record<string, string> {
  const { camper, camp, recipient, trackUrl } = ctx;
  const now = ctx.now ?? new Date();

  const firstName = clean(camper.firstName) ?? BLANK;
  const lastName = clean(camper.lastName) ?? "";
  const fullName = `${clean(camper.firstName) ?? ""} ${lastName}`.trim() || BLANK;

  // The email lands in the parent's inbox whenever a parent address exists, so
  // greet whoever will actually open it.
  const parentEmail = clean(camper.parentEmail)?.toLowerCase() ?? null;
  const goesToParent =
    !!parentEmail && !!recipient && recipient.trim().toLowerCase() === parentEmail;
  const greetingName =
    (goesToParent ? firstWord(camper.parentName) : null) ??
    firstWord(camper.firstName) ??
    "friend";

  const fee = camp.fee;
  const isPaid = camper.paymentStatus === "PAID";
  const received = isPaid ? fee : camper.paymentAmount ?? 0;
  const due = Math.max(0, fee - received);
  const money = (amount: number) => `${camp.currency} ${amount.toLocaleString()}`;

  const daysToCamp = differenceInCalendarDays(parseISO(camp.startDate), now);

  const dropoff =
    camper.dropoffLocation === "CHURCH"
      ? "Church"
      : camper.dropoffLocation === "CAMPSITE"
      ? "Camp site"
      : BLANK;

  const paymentStatus = isPaid
    ? "Paid"
    : camper.paymentStatus === "REFUNDED"
    ? "Refunded"
    : "Awaiting payment";

  return {
    greetingName,
    firstName,
    lastName: lastName || BLANK,
    fullName,
    parentName: clean(camper.parentName) ?? "Parent/Guardian",
    phone: clean(camper.phone) ?? BLANK,
    churchOrSchool: clean(camper.churchOrSchool) ?? BLANK,
    tshirtSize: clean(camper.tshirtSize) ?? BLANK,
    dropoff,
    dietary: clean(camper.dietaryPreference) ?? BLANK,
    campName: camp.name,
    campDates: formatCampDates(camp),
    campStartDate: format(parseISO(camp.startDate), "d MMMM yyyy"),
    campEndDate: format(parseISO(camp.endDate), "d MMMM yyyy"),
    campVenue: camp.venue ?? BLANK,
    daysToCamp: daysToCamp > 0 ? String(daysToCamp) : "0",
    campFee: money(fee),
    paymentStatus,
    amountDue: money(due),
    paymentReference: buildCampPaymentReference(ctx.registrationId),
    paymentNumber: CAMP_PAYMENT_NUMBER,
    checkInCode: camper.checkInCode ? formatCode(camper.checkInCode) : BLANK,
    trackUrl,
  };
}

// ─── Rendering ───

/** Escape user-controlled values before interpolating them into email HTML.
 *  Duplicated from `@/lib/notifications` on purpose — that module pulls in the
 *  Admin SDK and this one has to run in the browser too. */
export function escapeBroadcastHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Substitutes tokens into the plain-text copy. Unknown tokens are left as
 *  typed so a slip is visible rather than silently blanked. */
export function renderBroadcastText(
  template: string,
  values: Record<string, string>
): string {
  const pattern = new RegExp(TOKEN_PATTERN_SOURCE, "g");
  return template.replace(pattern, (whole, name: string) => values[name] ?? whole);
}

const LINK_STYLE = "color:#D14A1F; text-decoration:underline;";

/** Turns bare URLs the admin typed into links. Runs on already-escaped text,
 *  so `&amp;` inside a query string is fine — browsers decode it back. */
function autolink(escaped: string): string {
  return escaped.replace(
    /https?:\/\/[^\s<]+[^\s<.,;:!?)]/g,
    (url) => `<a href="${url}" style="${LINK_STYLE}">${url}</a>`
  );
}

/**
 * Renders the typed body to HTML: tokens substituted, everything the admin
 * typed escaped, blank lines becoming paragraphs and `-` lines becoming
 * bullets. That covers how announcements are actually written without asking a
 * camp coordinator to learn a rich-text editor.
 */
export function renderBroadcastHtmlBody(
  template: string,
  values: Record<string, string>
): string {
  const pattern = new RegExp(TOKEN_PATTERN_SOURCE, "g");

  // Escape the literal text and the substituted values separately: a camper
  // called "Mercy & Co" must not be able to inject markup, and neither must
  // anything typed into the composer.
  let cursor = 0;
  let out = "";
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(template)) !== null) {
    out += autolink(escapeBroadcastHtml(template.slice(cursor, match.index)));
    const name = match[1];
    const value = values[name];
    if (value === undefined) {
      out += escapeBroadcastHtml(match[0]);
    } else if (TOKENS_BY_NAME.get(name)?.isUrl) {
      const href = escapeBroadcastHtml(value);
      out += `<a href="${href}" style="${LINK_STYLE}">${href}</a>`;
    } else {
      out += escapeBroadcastHtml(value);
    }
    cursor = match.index + match[0].length;
  }
  out += autolink(escapeBroadcastHtml(template.slice(cursor)));

  return blocksToHtml(out);
}

const paragraphStyle = (marginBottom: number) =>
  `font-size:15px; line-height:1.65; margin:0 0 ${marginBottom}px; color:#2A211A; font-family:Georgia, 'Times New Roman', serif;`;
const UL_STYLE = "margin:0 0 16px; padding-left:20px;";
const LI_STYLE =
  "font-size:15px; line-height:1.65; margin:0 0 6px; color:#2A211A; font-family:Georgia, 'Times New Roman', serif;";

const isBulletLine = (line: string) => /^[-*•]\s+/.test(line);

/**
 * Lays typed text out as email HTML. Blank lines start a new paragraph and
 * runs of `-` lines become a bullet list — including when they follow a lead-in
 * line in the same paragraph, which is how people actually type a list.
 */
function blocksToHtml(escaped: string): string {
  return escaped
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) return "";

      // Split the block into alternating runs of prose and bullets.
      const runs: { bullets: boolean; lines: string[] }[] = [];
      for (const line of lines) {
        const bullets = isBulletLine(line);
        const current = runs[runs.length - 1];
        if (current && current.bullets === bullets) current.lines.push(line);
        else runs.push({ bullets, lines: [line] });
      }

      return runs
        .map((run, i) => {
          if (run.bullets) {
            const items = run.lines
              .map(
                (line) =>
                  `<li style="${LI_STYLE}">${line.replace(/^[-*•]\s+/, "")}</li>`
              )
              .join("");
            return `<ul style="${UL_STYLE}">${items}</ul>`;
          }
          // A lead-in sentence sits tight against the list it introduces.
          const leadsIntoList = runs[i + 1]?.bullets ?? false;
          return `<p style="${paragraphStyle(leadsIntoList ? 8 : 16)}">${run.lines.join(
            "<br/>"
          )}</p>`;
        })
        .join("");
    })
    .filter(Boolean)
    .join("");
}

// ─── The email itself ───

export interface BroadcastComposition {
  subject: string;
  body: string;
  /** Optional call-to-action button — typically a form the camper must fill in. */
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  /** Where camper replies should land. Shown in the email as a nudge to reply. */
  replyTo?: string | null;
}

/**
 * Builds one camper's copy of an announcement: personalized subject, plain-text
 * alternative, and the branded HTML that matches the registration and exit-pass
 * emails.
 */
export function buildBroadcastEmail(
  ctx: BroadcastContext,
  composition: BroadcastComposition
): { subject: string; text: string; html: string } {
  const values = buildBroadcastValues(ctx);
  const { camp } = ctx;

  const subject = renderBroadcastText(composition.subject, values).trim();
  const bodyText = renderBroadcastText(composition.body, values);
  const ctaLabel = clean(composition.ctaLabel);
  const ctaUrl = clean(composition.ctaUrl);
  const replyTo = clean(composition.replyTo);
  const hasCta = !!ctaLabel && !!ctaUrl;

  const text = [
    bodyText.trim(),
    ...(hasCta ? ["", `${ctaLabel}: ${ctaUrl}`] : []),
    ...(replyTo ? ["", `Need to reply? Just reply to this email (${replyTo}).`] : []),
    "",
    "—",
    `${camp.name} · ${formatCampDates(camp)}${camp.venue ? ` · ${camp.venue}` : ""}`,
    "",
    "Questions? Contact:",
    ...CAMP_CONTACTS.map((c) => `${c.name} (${c.role}) — ${c.phone}`),
    "",
    "Dew of Hermon Youth Ministry · Tabernacle of David Assembly",
  ].join("\n");

  const htmlBody = renderBroadcastHtmlBody(composition.body, values);

  const html = `
  <div style="margin:0; padding:0; background-color:#F4EEE3;">
    <div style="max-width:600px; margin:0 auto; padding:24px 16px; font-family:Georgia, 'Times New Roman', serif; color:#16110D;">

      <!-- Header -->
      <div style="background-color:#16110D; border-radius:6px 6px 0 0; padding:28px 32px; text-align:center;">
        <div style="color:#D14A1F; font-size:11px; letter-spacing:3px; text-transform:uppercase; font-family:Arial, sans-serif;">Camp announcement</div>
        <div style="color:#F4EEE3; font-size:28px; font-style:italic; margin-top:8px;">${escapeBroadcastHtml(camp.name)}</div>
        <div style="color:#b7a894; font-size:12px; margin-top:6px; font-family:Arial, sans-serif;">${escapeBroadcastHtml(
          formatCampDates(camp)
        )}${camp.venue ? ` · ${escapeBroadcastHtml(camp.venue)}` : ""}</div>
      </div>

      <!-- Body card -->
      <div style="background-color:#FDFBF6; border:1px solid #e5dcc9; border-top:none; padding:32px;">
        ${htmlBody}
        ${
          hasCta
            ? `
        <div style="text-align:center; margin:26px 0 8px;">
          <a href="${escapeBroadcastHtml(ctaUrl!)}" style="display:inline-block; background-color:#D14A1F; color:#F4EEE3; text-decoration:none; padding:13px 30px; border-radius:999px; font-size:12px; letter-spacing:2px; text-transform:uppercase; font-family:Arial, sans-serif;">${escapeBroadcastHtml(
              ctaLabel!
            )}</a>
        </div>`
            : ""
        }
        ${
          replyTo
            ? `
        <p style="font-size:12px; color:#8a7a68; font-family:Arial, sans-serif; line-height:1.6; margin:22px 0 0; text-align:center;">
          Need to send something back? Just hit reply — your answer reaches the camp team directly.
        </p>`
            : ""
        }
      </div>

      <!-- Footer -->
      <div style="background-color:#16110D; border-radius:0 0 6px 6px; padding:22px 32px; text-align:center;">
        <div style="color:#D14A1F; font-size:10px; letter-spacing:2.5px; text-transform:uppercase; font-family:Arial, sans-serif; margin-bottom:10px;">Questions?</div>
        ${CAMP_CONTACTS.map(
          (c) =>
            `<div style="color:#F4EEE3; font-size:12px; font-family:Arial, sans-serif; margin-bottom:4px;">${escapeBroadcastHtml(
              c.name
            )} <span style="color:#b7a894;">· ${escapeBroadcastHtml(c.role)} · ${escapeBroadcastHtml(
              c.phone
            )}</span></div>`
        ).join("")}
        <div style="color:#8a7a68; font-size:10px; font-family:Arial, sans-serif; margin-top:12px;">
          Dew of Hermon Youth Ministry · Tabernacle of David Assembly
        </div>
      </div>
    </div>
  </div>`;

  return { subject, text, html };
}
