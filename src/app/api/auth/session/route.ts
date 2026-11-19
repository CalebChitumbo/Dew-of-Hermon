import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { clearSessionCookies, setSessionCookies } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/session — create or renew the server session cookie from a
 * Firebase ID token. The client calls this whenever the user is still signed
 * in to Firebase but the 7-day session cookie is missing or close to expiry,
 * so cookie-authenticated API routes keep working (the installed web app
 * keeps users signed in to Firebase far longer than 7 days).
 *
 * Unlike /api/auth/login this never creates a user profile; it only renews
 * the session of an existing, active user.
 */
export async function POST(request: Request) {
  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  let uid: string;
  try {
    // checkRevoked: don't renew a session for a disabled/signed-out account.
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      // No profile yet — the full sign-in flow (/api/auth/login) creates it.
      return NextResponse.json({ error: "No user profile" }, { status: 404 });
    }
    if (userDoc.data()?.isActive === false) {
      await clearSessionCookies();
      return NextResponse.json(
        { error: "Your account has been deactivated. Please contact an admin." },
        { status: 403 }
      );
    }

    await setSessionCookies(idToken);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session renewal failed:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await clearSessionCookies();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
