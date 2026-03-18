import { adminDb } from "@/lib/firebase-admin";
import {
  sendEmail,
  validateEmailConfig,
  checkEmailDeliveryStatus,
  retryEmail,
} from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import type { EmailDeliveryStatus } from "@/types";

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: "reminder" | "assignment" | "event" | "announcement";
  link?: string | null;
  /** Pass the recipient email directly to avoid an extra Firestore lookup */
  recipientEmail?: string;
  email?: {
    subject: string;
    text: string;
    html?: string;
  };
}

/**
 * Creates an in-app notification and sends an email to the user.
 * Tracks email delivery status on the notification document so failures
 * can be detected and retried.
 */
export async function createNotificationWithEmail({
  userId,
  title,
  message,
  type,
  link = null,
  recipientEmail,
  email,
}: CreateNotificationParams) {
  // 1. Create the in-app notification with email tracking fields
  const notificationRef = await adminDb.collection("notifications").add({
    userId,
    title,
    message,
    type,
    isRead: false,
    link,
    emailStatus: "pending" as EmailDeliveryStatus,
    emailDocId: null,
    emailError: null,
    createdAt: new Date(),
  });

  // 2. Send push notification (fire-and-forget; don't block email flow)
  sendPushToUser(userId, {
    title,
    body: message,
    link: link || undefined,
    tag: notificationRef.id,
  }).catch((err) =>
    console.error(`Push failed for notification ${notificationRef.id}:`, err)
  );

  // 3. Check email config
  const configError = validateEmailConfig();
  if (configError) {
    console.warn(
      `Skipping email for notification ${notificationRef.id}: ${configError}`
    );
    await notificationRef.update({
      emailStatus: "skipped" as EmailDeliveryStatus,
      emailError: configError,
    });
    return { notificationId: notificationRef.id, emailSent: false };
  }

  // 4. Resolve recipient email
  let userEmail: string | null = recipientEmail || null;
  if (!userEmail) {
    try {
      const userDoc = await adminDb.collection("users").doc(userId).get();
      userEmail = userDoc.data()?.email || null;
    } catch (err) {
      console.error(`Failed to fetch user ${userId} for email:`, err);
    }
  }

  if (!userEmail) {
    const reason = `No email address on file for user ${userId}`;
    console.warn(
      `${reason}, skipping email for notification ${notificationRef.id}`
    );
    await notificationRef.update({
      emailStatus: "skipped" as EmailDeliveryStatus,
      emailError: reason,
    });
    return { notificationId: notificationRef.id, emailSent: false };
  }

  // 5. Build email content
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://app.potterswheel.com";
  const linkUrl = link ? `${appUrl}${link}` : appUrl;

  const emailSubject = email?.subject || title;
  const emailText = email?.text || `${message}\n\nView details: ${linkUrl}`;
  const emailHtml =
    email?.html ||
    `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #5C4033;">${title}</h2>
      <p>${message}</p>
      <a href="${linkUrl}" style="display: inline-block; padding: 10px 24px; background-color: #14b8a6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">View Details</a>
      <p style="margin-top: 24px; color: #888;">Blessings,<br/>Potter's Wheel Team</p>
    </div>
  `;

  // 6. Send email and track result
  try {
    const { id: mailDocId } = await sendEmail({
      to: userEmail,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    });

    await notificationRef.update({
      emailStatus: "queued" as EmailDeliveryStatus,
      emailDocId: mailDocId,
      emailError: null,
    });

    return { notificationId: notificationRef.id, emailSent: true, mailDocId };
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown email error";
    console.error(
      `Email failed for notification ${notificationRef.id} to ${userEmail}:`,
      err
    );

    await notificationRef.update({
      emailStatus: "failed" as EmailDeliveryStatus,
      emailError: errorMsg,
    });

    return { notificationId: notificationRef.id, emailSent: false };
  }
}

/**
 * Check and update the delivery status of a notification's email.
 * Reads the Firebase extension's delivery state from the mail doc.
 */
export async function syncNotificationEmailStatus(
  notificationId: string
): Promise<{ status: EmailDeliveryStatus; error?: string }> {
  const notifDoc = await adminDb
    .collection("notifications")
    .doc(notificationId)
    .get();

  if (!notifDoc.exists) {
    throw new Error(`Notification ${notificationId} not found`);
  }

  const data = notifDoc.data()!;
  const mailDocId = data.emailDocId;

  if (!mailDocId) {
    return { status: data.emailStatus || "skipped" };
  }

  const { status, error } = await checkEmailDeliveryStatus(mailDocId);

  // Update the notification with the latest status
  await adminDb.collection("notifications").doc(notificationId).update({
    emailStatus: status,
    ...(error ? { emailError: error } : {}),
  });

  return { status, error };
}

/**
 * Retry sending the email for a notification that previously failed.
 * Creates a new mail doc and updates the notification's tracking fields.
 */
export async function retryNotificationEmail(
  notificationId: string
): Promise<{ emailSent: boolean; newMailDocId?: string }> {
  const notifDoc = await adminDb
    .collection("notifications")
    .doc(notificationId)
    .get();

  if (!notifDoc.exists) {
    throw new Error(`Notification ${notificationId} not found`);
  }

  const data = notifDoc.data()!;

  // If the original email was skipped due to missing config/email, try fresh
  if (data.emailStatus === "skipped" || !data.emailDocId) {
    // Re-resolve the user's email and send fresh
    let userEmail: string | null = null;
    try {
      const userDoc = await adminDb.collection("users").doc(data.userId).get();
      userEmail = userDoc.data()?.email || null;
    } catch {
      // fall through
    }

    if (!userEmail) {
      return { emailSent: false };
    }

    const configError = validateEmailConfig();
    if (configError) {
      return { emailSent: false };
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://app.potterswheel.com";
    const linkUrl = data.link ? `${appUrl}${data.link}` : appUrl;

    try {
      const { id: mailDocId } = await sendEmail({
        to: userEmail,
        subject: data.title,
        text: `${data.message}\n\nView details: ${linkUrl}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #5C4033;">${data.title}</h2>
            <p>${data.message}</p>
            <a href="${linkUrl}" style="display: inline-block; padding: 10px 24px; background-color: #14b8a6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">View Details</a>
            <p style="margin-top: 24px; color: #888;">Blessings,<br/>Potter's Wheel Team</p>
          </div>
        `,
      });

      await adminDb.collection("notifications").doc(notificationId).update({
        emailStatus: "queued" as EmailDeliveryStatus,
        emailDocId: mailDocId,
        emailError: null,
      });

      return { emailSent: true, newMailDocId: mailDocId };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Retry failed";
      await adminDb.collection("notifications").doc(notificationId).update({
        emailStatus: "failed" as EmailDeliveryStatus,
        emailError: errorMsg,
      });
      return { emailSent: false };
    }
  }

  // Retry from the original mail document
  try {
    const { newMailDocId } = await retryEmail(data.emailDocId);

    await adminDb.collection("notifications").doc(notificationId).update({
      emailStatus: "queued" as EmailDeliveryStatus,
      emailDocId: newMailDocId,
      emailError: null,
    });

    return { emailSent: true, newMailDocId };
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Retry failed";
    await adminDb.collection("notifications").doc(notificationId).update({
      emailStatus: "failed" as EmailDeliveryStatus,
      emailError: errorMsg,
    });
    return { emailSent: false };
  }
}
