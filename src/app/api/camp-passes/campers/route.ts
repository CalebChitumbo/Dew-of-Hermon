import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { DEFAULT_CAMP_ID } from "@/lib/camps";
import { REGISTRATIONS_COLLECTION } from "@/lib/camp-passes";
import { getPassCaller, canSeeQueue } from "../_auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/camp-passes/campers?campId=
 *
 * The camper picker for logging a walk-up exit request. Deliberately minimal:
 * the admissions desk needs a name, arrival state, and whether the camper is
 * already out — not the medical notes and guardian PII that
 * /api/camp-registrations returns to camp admins.
 */
export async function GET(request: Request) {
  try {
    const caller = await getPassCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!canSeeQueue(caller)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const campId = searchParams.get("campId") || DEFAULT_CAMP_ID;

    const snap = await adminDb
      .collection(REGISTRATIONS_COLLECTION)
      .where("campId", "==", campId)
      .get();

    const campers = snap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim(),
          gender: data.gender ?? null,
          churchOrSchool: data.churchOrSchool ?? null,
          phone: data.phone ?? null,
          checkedIn: data.checkedIn ?? false,
          onPass: data.onPass ?? false,
          hasEmail: !!(data.parentEmail ?? data.email),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ campers });
  } catch (error) {
    console.error("GET /api/camp-passes/campers error:", error);
    return NextResponse.json({ error: "Failed to load campers" }, { status: 500 });
  }
}
