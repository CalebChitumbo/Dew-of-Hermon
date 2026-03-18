import { getMessaging } from "firebase-admin/messaging";
import { adminDb } from "@/lib/firebase-admin";

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  link?: string;
  /** Optional tag to collapse duplicate notifications on the device */
  tag?: string;
}

/**
 * Send a push notification to all registered devices for a given user.
 * Automatically cleans up stale/invalid tokens.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  // Fetch the user's FCM tokens
  const tokensSnapshot = await adminDb
    .collection("users")
    .doc(userId)
    .collection("fcmTokens")
    .get();

  if (tokensSnapshot.empty) {
    return { sent: 0, failed: 0 };
  }

  const tokens = tokensSnapshot.docs.map((doc) => doc.data().token as string);
  const messaging = getMessaging();

  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
      ...(payload.icon ? { icon: payload.icon } : {}),
    },
    data: {
      ...(payload.link ? { link: payload.link } : {}),
      ...(payload.tag ? { notificationId: payload.tag } : {}),
    },
    webpush: {
      fcmOptions: {
        link: payload.link || "/notifications",
      },
    },
  };

  // Send to each token individually so we can identify stale tokens
  let sent = 0;
  let failed = 0;
  const staleTokenIds: string[] = [];

  await Promise.all(
    tokensSnapshot.docs.map(async (tokenDoc) => {
      const token = tokenDoc.data().token as string;
      try {
        await messaging.send({ ...message, token });
        sent++;
      } catch (error: unknown) {
        failed++;
        const code =
          error && typeof error === "object" && "code" in error
            ? (error as { code: string }).code
            : "";
        // Remove tokens that are no longer valid
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          staleTokenIds.push(tokenDoc.id);
        } else {
          console.error(
            `FCM send failed for user ${userId}, token ${token.slice(0, 10)}...:`,
            error
          );
        }
      }
    })
  );

  // Clean up stale tokens
  if (staleTokenIds.length > 0) {
    const batch = adminDb.batch();
    for (const id of staleTokenIds) {
      batch.delete(
        adminDb.collection("users").doc(userId).collection("fcmTokens").doc(id)
      );
    }
    await batch.commit();
  }

  return { sent, failed };
}

/**
 * Send push notifications to multiple users at once.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ totalSent: number; totalFailed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  await Promise.all(
    userIds.map(async (userId) => {
      const { sent, failed } = await sendPushToUser(userId, payload);
      totalSent += sent;
      totalFailed += failed;
    })
  );

  return { totalSent, totalFailed };
}
