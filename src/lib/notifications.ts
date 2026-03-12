import { adminDb } from "@/lib/firebase-admin";
import { sendEmail, validateEmailConfig } from "@/lib/email";

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: "reminder" | "assignment" | "event" | "announcement";
  link?: string | null;
  email?: {
    subject: string;
    text: string;
    html?: string;
  };
}

/**
 * Creates an in-app notification and, when possible, also sends an email
 * to the user's address on file. If no explicit email content is provided,
 * a default email is generated from the notification title/message.
 *
 * This guarantees every notification also results in an email — matching
 * the "Trigger Email from Firestore" extension flow.
 */
export async function createNotificationWithEmail({
  userId,
  title,
  message,
  type,
  link = null,
  email,
}: CreateNotificationParams) {
  // 1. Create the in-app notification
  const notificationRef = await adminDb.collection("notifications").add({
    userId,
    title,
    message,
    type,
    isRead: false,
    link,
    createdAt: new Date(),
  });

  // 2. Attempt to send an email to the user
  const configError = validateEmailConfig();
  if (configError) {
    console.warn(
      `Skipping email for notification ${notificationRef.id}: ${configError}`
    );
    return { notificationId: notificationRef.id, emailSent: false };
  }

  // Look up the user's email address
  let userEmail: string | null = null;
  try {
    const userDoc = await adminDb.collection("users").doc(userId).get();
    userEmail = userDoc.data()?.email || null;
  } catch (err) {
    console.error(`Failed to fetch user ${userId} for email:`, err);
  }

  if (!userEmail) {
    console.warn(
      `No email address for user ${userId}, skipping email for notification ${notificationRef.id}`
    );
    return { notificationId: notificationRef.id, emailSent: false };
  }

  // Build email content — use explicit email params or fall back to defaults
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

  try {
    await sendEmail({
      to: userEmail,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    });
    return { notificationId: notificationRef.id, emailSent: true };
  } catch (err) {
    console.error(
      `Email failed for notification ${notificationRef.id} to ${userEmail}:`,
      err
    );
    return { notificationId: notificationRef.id, emailSent: false };
  }
}
