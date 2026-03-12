import { adminDb } from "@/lib/firebase-admin";

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Validates that the email configuration is ready for sending.
 * With the Firebase "Trigger Email from Firestore" extension,
 * we only need Firestore (adminDb) to be configured, plus EMAIL_FROM.
 * Returns null if valid, or an error message string if not.
 */
export function validateEmailConfig(): string | null {
  if (!process.env.EMAIL_FROM) {
    return "EMAIL_FROM environment variable is not set. Emails cannot be sent.";
  }
  return null;
}

/**
 * Sends an email by writing a document to the Firestore `mail` collection.
 * The Firebase "Trigger Email from Firestore" extension picks up these
 * documents and delivers the email via the configured SMTP transport
 * (e.g. Gmail SMTP — no custom domain required).
 *
 * @see https://extensions.dev/extensions/firebase/firestore-send-email
 */
export async function sendEmail({ to, subject, text, html }: SendEmailParams) {
  const from = process.env.EMAIL_FROM;

  if (!from) {
    throw new Error(
      "EMAIL_FROM is not configured. Please set it in your environment variables."
    );
  }

  if (!to) {
    throw new Error("Recipient email address is required");
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    throw new Error(`Invalid recipient email address format: "${to}"`);
  }

  try {
    const mailRef = await adminDb.collection("mail").add({
      from,
      to: [to],
      message: {
        subject,
        text,
        html: html || text.replace(/\n/g, "<br/>"),
      },
      createdAt: new Date(),
    });

    console.log(`Email queued successfully for ${to}, doc: ${mailRef.id}`);
    return { id: mailRef.id };
  } catch (err) {
    console.error(`Email queue failed for ${to}:`, err);
    throw new Error(
      `Failed to queue email for ${to}: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }
}
