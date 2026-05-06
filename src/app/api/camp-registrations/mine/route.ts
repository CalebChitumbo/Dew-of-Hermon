import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { serializeRegistration } from "../_serialize";

export const dynamic = "force-dynamic";

export async function GET() {
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

    const userDoc = await adminDb.collection("users").doc(uid).get();
    const profileEmail = (userDoc.exists
      ? (userDoc.data()?.email as string | undefined)
      : undefined) ?? null;

    const emails = Array.from(
      new Set(
        [tokenEmail, profileEmail].filter(
          (e): e is string => !!e && e.length > 0
        )
      )
    );

    const collected = new Map<string, FirebaseFirestore.DocumentData>();

    const byUidSnap = await adminDb
      .collection("campRegistrations")
      .where("submittedByUid", "==", uid)
      .get();
    byUidSnap.docs.forEach((doc) => collected.set(doc.id, doc.data()));

    for (const email of emails) {
      const byEmailSnap = await adminDb
        .collection("campRegistrations")
        .where("parentEmail", "==", email)
        .get();
      byEmailSnap.docs.forEach((doc) => {
        if (!collected.has(doc.id)) collected.set(doc.id, doc.data());
      });
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
