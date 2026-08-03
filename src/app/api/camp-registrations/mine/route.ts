import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getCallerToken } from "@/lib/server-auth";
import { serializeRegistration } from "../_serialize";

export const dynamic = "force-dynamic";

export async function GET() {
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
    const emailVerified = caller.emailVerified;

    const userDoc = await adminDb.collection("users").doc(uid).get();
    const profileEmail = (userDoc.exists
      ? (userDoc.data()?.email as string | undefined)
      : undefined) ?? null;

    // Only match registrations by email when Firebase has verified the caller
    // owns that address. Firebase email/password sign-up accepts an arbitrary,
    // unverified email, so trusting it would let an attacker enumerate another
    // person's registrations (and minors' medical PII) by signing up as their
    // email. Unverified callers still see registrations they submitted while
    // signed in (matched by uid below) and can link others via the claim flow.
    const emails = emailVerified
      ? Array.from(
          new Set(
            [tokenEmail, profileEmail]
              .filter((e): e is string => !!e && e.length > 0)
              .map((e) => e.toLowerCase())
          )
        )
      : [];

    const collected = new Map<string, FirebaseFirestore.DocumentData>();

    const byUidSnap = await adminDb
      .collection("campRegistrations")
      .where("submittedByUid", "==", uid)
      .get();
    byUidSnap.docs.forEach((doc) => collected.set(doc.id, doc.data()));

    for (const email of emails) {
      for (const field of ["parentEmail", "email"] as const) {
        const byEmailSnap = await adminDb
          .collection("campRegistrations")
          .where(field, "==", email)
          .get();
        byEmailSnap.docs.forEach((doc) => {
          if (!collected.has(doc.id)) collected.set(doc.id, doc.data());
        });
      }
    }

    const registrations = Array.from(collected.entries())
      .map(([id, data]) => serializeRegistration(id, data))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return NextResponse.json({ registrations });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching user's camp registrations:", message, error);
    return NextResponse.json(
      { error: `Failed to fetch registrations: ${message}` },
      { status: 500 }
    );
  }
}
