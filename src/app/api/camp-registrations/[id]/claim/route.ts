import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getCallerToken } from "@/lib/server-auth";

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
    const caller = await getCallerToken();
    if (!caller) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    const uid = caller.uid;
    const tokenEmail = caller.email;

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
