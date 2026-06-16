import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { serverHasFeatureMinRole } from "@/lib/feature-permissions-server";
import { parseDOB, getAgeTurning, isBirthdayOn } from "@/lib/birthdays";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

async function getCaller(): Promise<{ uid: string; role: UserRole } | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) return null;
    const decoded = await adminAuth.verifySessionCookie(session.value);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    return { uid: decoded.uid, role: userDoc.data()!.role as UserRole };
  } catch {
    return null;
  }
}

/**
 * Birthday directory for the management page. Defaults to the current calendar
 * month (the "Cake Sunday" list). Pass `?month=1..12` for another month or
 * `?scope=all` for every member with a birthday on file.
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!(await serverHasFeatureMinRole("manage_birthdays", caller.role))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope");
    const now = new Date();
    const year = now.getFullYear();
    const monthParam = searchParams.get("month");
    const month = monthParam ? Number(monthParam) : now.getMonth() + 1;
    const filterByMonth = scope !== "all" && month >= 1 && month <= 12;

    // Which members have already been wished this calendar year.
    const wishesSnap = await adminDb
      .collection("birthdayWishes")
      .where("year", "==", year)
      .get();
    const wished = new Map<string, boolean>();
    wishesSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.userId) wished.set(data.userId, true);
    });

    const usersSnap = await adminDb
      .collection("users")
      .where("isActive", "==", true)
      .get();

    const birthdays = usersSnap.docs
      .map((doc) => {
        const data = doc.data();
        const parsed = parseDOB(data.dateOfBirth);
        return {
          id: doc.id,
          name: (data.name as string) || "",
          email: (data.email as string | null) || null,
          phone: (data.phone as string | null) || null,
          lifeGroup: (data.lifeGroup as string | null) || null,
          dateOfBirth: (data.dateOfBirth as string | null) || null,
          parsed,
        };
      })
      .filter((u) => u.parsed !== null)
      .filter((u) => (filterByMonth ? u.parsed!.month === month : true))
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        lifeGroup: u.lifeGroup,
        dateOfBirth: u.dateOfBirth,
        month: u.parsed!.month,
        day: u.parsed!.day,
        ageTurning: getAgeTurning(u.dateOfBirth, now),
        isToday: isBirthdayOn(u.dateOfBirth, now),
        wished: wished.get(u.id) || false,
      }))
      .sort((a, b) =>
        a.month !== b.month
          ? a.month - b.month
          : a.day !== b.day
            ? a.day - b.day
            : a.name.localeCompare(b.name)
      );

    return NextResponse.json({
      birthdays,
      month: filterByMonth ? month : null,
      year,
    });
  } catch (error) {
    console.error("Error fetching birthdays:", error);
    return NextResponse.json(
      { error: "Failed to fetch birthdays" },
      { status: 500 }
    );
  }
}
