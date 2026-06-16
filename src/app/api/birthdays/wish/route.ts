import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { serverHasFeatureMinRole } from "@/lib/feature-permissions-server";
import { createNotificationWithEmail } from "@/lib/notifications";
import { sendPushToUser } from "@/lib/push";
import { isBirthdayOn } from "@/lib/birthdays";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

async function getCaller(): Promise<{ uid: string; role: UserRole; name: string } | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) return null;
    const decoded = await adminAuth.verifySessionCookie(session.value);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    const data = userDoc.data()!;
    return { uid: decoded.uid, role: data.role as UserRole, name: data.name || "A leader" };
  } catch {
    return null;
  }
}

/**
 * Send a birthday wish to a member. The celebrant always receives a personal
 * wish (in-app notification + push + email). When `broadcast` is true, an
 * in-app notification (+ push) also goes to every other active member so the
 * whole youth can celebrate them — no email blast.
 */
export async function POST(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!(await serverHasFeatureMinRole("manage_birthdays", caller.role))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { userId, broadcast = true } = await request.json();
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const celebrantDoc = await adminDb.collection("users").doc(userId).get();
    if (!celebrantDoc.exists) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    const celebrant = celebrantDoc.data()!;
    const fullName = (celebrant.name as string) || "friend";
    const firstName = fullName.split(" ")[0] || fullName;

    const appName = process.env.NEXT_PUBLIC_APP_NAME || "Potter's Wheel";
    const now = new Date();
    const year = now.getFullYear();

    // ── Personal wish to the celebrant ──
    const wishMessage = `Happy Birthday, ${firstName}! 🎂 From all of us at ${appName}, we're wishing you a blessed and joyful day. May this new year of your life overflow with God's grace and favour. 🎉`;

    await createNotificationWithEmail({
      userId,
      recipientEmail: (celebrant.email as string) || undefined,
      title: `Happy Birthday, ${firstName}! 🎂`,
      message: wishMessage,
      type: "birthday",
      link: "/dashboard",
      email: {
        subject: `Happy Birthday, ${firstName}! 🎂`,
        text: `${wishMessage}\n\nWith love,\nThe ${appName} family`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; text-align: center;">
            <div style="font-size: 56px; line-height: 1;">🎂</div>
            <h2 style="color: #5C4033; margin: 12px 0 4px;">Happy Birthday, ${firstName}!</h2>
            <p style="color: #3E2518; font-size: 15px; line-height: 1.6;">
              From all of us at ${appName}, we're wishing you a blessed and joyful day.
              May this new year of your life overflow with God's grace and favour. 🎉
            </p>
            <p style="margin-top: 24px; color: #888;">With love,<br/>The ${appName} family</p>
          </div>
        `,
      },
    });

    // ── Optional broadcast to the whole youth (in-app + push, no email) ──
    let broadcastCount = 0;
    if (broadcast) {
      const activeUsersSnap = await adminDb
        .collection("users")
        .where("isActive", "==", true)
        .get();

      const recipientIds = activeUsersSnap.docs
        .map((d) => d.id)
        .filter((id) => id !== userId);

      const broadcastTitle = `🎂 It's ${fullName}'s birthday!`;
      const broadcastBody = `Today we celebrate ${firstName}. Wish them a happy birthday! 🎉`;

      // Notification docs are created in batches (Firestore caps a batch at 500).
      for (let i = 0; i < recipientIds.length; i += 450) {
        const chunk = recipientIds.slice(i, i + 450);
        const batch = adminDb.batch();
        for (const rid of chunk) {
          const ref = adminDb.collection("notifications").doc();
          batch.set(ref, {
            userId: rid,
            title: broadcastTitle,
            message: broadcastBody,
            type: "birthday",
            isRead: false,
            link: "/dashboard",
            emailStatus: "skipped",
            emailDocId: null,
            emailError: null,
            createdAt: new Date(),
          });
        }
        await batch.commit();
        broadcastCount += chunk.length;
      }

      // Push is best-effort and must never block the response.
      Promise.allSettled(
        recipientIds.map((rid) =>
          sendPushToUser(rid, {
            title: broadcastTitle,
            body: broadcastBody,
            link: "/dashboard",
            tag: `birthday-${userId}-${year}`,
          })
        )
      ).catch(() => {});
    }

    // ── Record the wish (idempotent per member per year) ──
    await adminDb
      .collection("birthdayWishes")
      .doc(`${userId}_${year}`)
      .set({
        userId,
        userName: fullName,
        year,
        sentBy: caller.uid,
        sentByName: caller.name,
        sentAt: new Date(),
        broadcast: !!broadcast,
        // Stored for reference; the celebration is keyed on month/day, not exact match.
        onBirthday: isBirthdayOn(celebrant.dateOfBirth, now),
      });

    return NextResponse.json({
      success: true,
      broadcastCount,
    });
  } catch (error) {
    console.error("Error sending birthday wish:", error);
    const message = error instanceof Error ? error.message : "Failed to send wish";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
