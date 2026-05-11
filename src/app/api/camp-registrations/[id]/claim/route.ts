import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * Links an existing (typically anonymous) camp registration to the currently
 * signed-in user. Authorisation comes from the one-time `claimToken` that was
 * issued when the registration was created — the caller must hold both a
 * valid session cookie and the matching token. Registrations that are
 * already linked to a different user cannot be re-claimed.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    let uid: string;
    let tokenEmail: string | null = null;
    try {
      const decoded = await adminAuth.verifySessionCookie(session.value);
      uid = decoded.uid;
      tokenEmail = decoded.email ?? null;
    } catch {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const providedToken =
      typeof body?.claimToken === "string" ? body.claimToken : "";
    if (!providedToken) {
      return NextResponse.json(
        { error: "Missing claim token" },
        { status: 400 }
      );
    }

    const ref = adminDb.collection("campRegistrations").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      );
    }

    const data = doc.data() as
      | { claimToken?: string; submittedByUid?: string | null }
      | undefined;
    const storedToken = data?.claimToken ?? "";
    if (!storedToken || storedToken !== providedToken) {
      return NextResponse.json(
        { error: "Invalid claim token" },
        { status: 403 }
      );
    }

    if (data?.submittedByUid && data.submittedByUid !== uid) {
      return NextResponse.json(
        { error: "Registration already linked to another account" },
        { status: 409 }
      );
    }

    await ref.update({
      submittedByUid: uid,
      submittedByEmail: tokenEmail?.toLowerCase() ?? null,
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error claiming camp registration:", error);
    return NextResponse.json(
      { error: "Failed to claim registration" },
      { status: 500 }
    );
  }
}
