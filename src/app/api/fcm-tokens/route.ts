import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/fcm-tokens — Save an FCM token for the authenticated user.
 * Body: { token: string; userId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { token, userId } = await request.json();

    if (!token || !userId) {
      return NextResponse.json(
        { error: "token and userId are required" },
        { status: 400 }
      );
    }

    // Verify the session cookie to ensure the caller owns this userId
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.uid !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Store token as a sub-collection doc keyed by a hash of the token
    // to make upserts idempotent (same device won't create duplicates).
    const tokenId = Buffer.from(token).toString("base64url").slice(0, 40);

    await adminDb
      .collection("users")
      .doc(userId)
      .collection("fcmTokens")
      .doc(tokenId)
      .set({
        token,
        createdAt: new Date(),
        userAgent: request.headers.get("user-agent") || null,
      });

    // Also mark that the user has push enabled on their profile
    await adminDb.collection("users").doc(userId).update({
      pushEnabled: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FCM token save error:", error);
    return NextResponse.json(
      { error: "Failed to save token" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fcm-tokens — Remove an FCM token (e.g. on sign-out or opt-out).
 * Body: { token: string; userId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { token, userId } = await request.json();

    if (!token || !userId) {
      return NextResponse.json(
        { error: "token and userId are required" },
        { status: 400 }
      );
    }

    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.uid !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tokenId = Buffer.from(token).toString("base64url").slice(0, 40);

    await adminDb
      .collection("users")
      .doc(userId)
      .collection("fcmTokens")
      .doc(tokenId)
      .delete();

    // Check if user has any remaining tokens
    const remaining = await adminDb
      .collection("users")
      .doc(userId)
      .collection("fcmTokens")
      .limit(1)
      .get();

    if (remaining.empty) {
      await adminDb.collection("users").doc(userId).update({
        pushEnabled: false,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FCM token delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete token" },
      { status: 500 }
    );
  }
}
