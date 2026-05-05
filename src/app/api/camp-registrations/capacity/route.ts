import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getCamp, DEFAULT_CAMP_ID } from "@/lib/camps";

export const dynamic = "force-dynamic";

// Public endpoint — returns the live registration count for a camp so the
// public registration page can show "X / Y spots" without exposing data.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const campId = url.searchParams.get("campId") || DEFAULT_CAMP_ID;
    const camp = getCamp(campId);
    if (!camp) {
      return NextResponse.json({ error: "Unknown camp" }, { status: 404 });
    }

    const snap = await adminDb
      .collection("campRegistrations")
      .where("campId", "==", campId)
      .count()
      .get();

    return NextResponse.json({
      campId,
      capacity: camp.capacity,
      registered: snap.data().count,
    });
  } catch (error) {
    console.error("Error fetching capacity:", error);
    return NextResponse.json(
      { error: "Failed to fetch capacity" },
      { status: 500 }
    );
  }
}
