import { adminDb } from "@/lib/firebase-admin";
import type { EmailDeliveryStatus } from "@/types";

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Validates that the email configuration is ready for sending.
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
 * documents and delivers the email via the configured SMTP transport.
 *
 * Returns the mail document ID so callers can track delivery status.
 */
export async function sendEmail({ to, subject, text, html }: SendEmailParams) {
  if (!process.env.EMAIL_FROM) {
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

/**
 * Check the delivery status of an email by reading the mail document.
 * The Firebase extension updates the doc with a `delivery` field:
 *   delivery.state: "SUCCESS" | "ERROR" | "PROCESSING"
 *   delivery.error: string (if failed)
 *   delivery.attempts: number
 */
export async function checkEmailDeliveryStatus(
  mailDocId: string
): Promise<{ status: EmailDeliveryStatus; error?: string }> {
  try {
    const mailDoc = await adminDb.collection("mail").doc(mailDocId).get();

    if (!mailDoc.exists) {
      return { status: "failed", error: "Mail document not found" };
    }

    const data = mailDoc.data();
    const delivery = data?.delivery;

    if (!delivery) {
      // Extension hasn't processed it yet
      return { status: "queued" };
    }

    switch (delivery.state) {
      case "SUCCESS":
        return { status: "delivered" };
      case "ERROR":
        return {
          status: "failed",
          error: delivery.error || "Unknown delivery error",
        };
      case "PROCESSING":
        return { status: "queued" };
      default:
        return { status: "queued" };
    }
  } catch (err) {
    console.error(`Failed to check delivery status for ${mailDocId}:`, err);
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "Status check failed",
    };
  }
}

/**
 * Retry sending an email by reading the original mail doc's recipient/message
 * and creating a new mail document for the extension to pick up.
 */
export async function retryEmail(
  originalMailDocId: string
): Promise<{ newMailDocId: string }> {
  const originalDoc = await adminDb
    .collection("mail")
    .doc(originalMailDocId)
    .get();

  if (!originalDoc.exists) {
    throw new Error(`Original mail doc ${originalMailDocId} not found`);
  }

  const data = originalDoc.data()!;

  const newMailRef = await adminDb.collection("mail").add({
    to: data.to,
    message: data.message,
    createdAt: new Date(),
    retryOf: originalMailDocId,
  });

  console.log(
    `Retry email queued: ${newMailRef.id} (retry of ${originalMailDocId})`
  );
  return { newMailDocId: newMailRef.id };
}
