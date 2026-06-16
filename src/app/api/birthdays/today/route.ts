import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { isBirthdayOn, getAgeTurning } from "@/lib/birthdays";

export const dynamic = "force-dynamic";

/**
 * Today's birthdays — readable by any signed-in user so the dashboard can show
 * a celebratory banner to the whole youth. Returns only celebratory fields
 * (name + the age they turn), never contact details.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    try {
      await adminAuth.verifySessionCookie(session.value);
    } catch {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const today = new Date();
    const snapshot = await adminDb
      .collection("users")
      .where("isActive", "==", true)
      .get();

    const birthdays = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: (data.name as string) || "A member",
          dateOfBirth: (data.dateOfBirth as string | null) || null,
        };
      })
      .filter((u) => isBirthdayOn(u.dateOfBirth, today))
      .map((u) => ({
        id: u.id,
        name: u.name,
        ageTurning: getAgeTurning(u.dateOfBirth, today),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ birthdays });
  } catch (error) {
    console.error("Error fetching today's birthdays:", error);
    return NextResponse.json(
      { error: "Failed to fetch birthdays" },
      { status: 500 }
    );
  }
}
