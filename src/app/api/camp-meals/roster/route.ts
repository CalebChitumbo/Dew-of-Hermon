import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  MEALS_COLLECTION,
  REGISTRATIONS_COLLECTION,
  getCampSittings,
  getSitting,
} from "@/lib/camp-meals";
import { getCamp, DEFAULT_CAMP_ID } from "@/lib/camps";
import { getMealCaller } from "../_auth";
import { serializeCamperForLine, serializeMealScan } from "../_serialize";

export const dynamic = "force-dynamic";

/**
 * GET /api/camp-meals/roster?campId=...&sittingId=...
 *
 * Everything the serving line needs for one sitting, in one request: the full
 * camper roster (badge codes included) and who has already been served.
 *
 * The scanner loads this once when a sitting is opened and then works from
 * memory, which is what makes it usable on a venue network that comes and
 * goes — a scan is validated and shown locally, and only the write is
 * queued. Badge codes are only ever a meal tick, and this is behind the
 * serve permission.
 */
export async function GET(request: Request) {
  try {
    const caller = await getMealCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!caller.can.serve && !caller.can.campAdmin) {
      return NextResponse.json(
        { error: "You don't have permission to see the meal register." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const campId = url.searchParams.get("campId") || DEFAULT_CAMP_ID;
    const sittingId = url.searchParams.get("sittingId");

    const camp = getCamp(campId);
    if (!camp) {
      return NextResponse.json({ error: "Unknown camp" }, { status: 400 });
    }

    const sitting = sittingId ? getSitting(sittingId) : null;
    if (sittingId && (!sitting || sitting.campId !== campId)) {
      return NextResponse.json(
        { error: "Unknown meal sitting for this camp" },
        { status: 400 }
      );
    }

    const [regSnap, scanSnap] = await Promise.all([
      adminDb
        .collection(REGISTRATIONS_COLLECTION)
        .where("campId", "==", campId)
        .get(),
      sitting
        ? adminDb
            .collection(MEALS_COLLECTION)
            .where("sittingId", "==", sitting.id)
            .get()
        : Promise.resolve(null),
    ]);

    const campers = regSnap.docs
      .map((doc) => serializeCamperForLine(doc.id, doc.data()))
      .sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      );

    const scans =
      scanSnap?.docs.map((doc) => serializeMealScan(doc.id, doc.data())) ?? [];

    return NextResponse.json({
      camp: { id: camp.id, name: camp.name },
      sitting,
      sittings: getCampSittings(campId),
      campers,
      scans,
    });
  } catch (error) {
    console.error("GET /api/camp-meals/roster error:", error);
    return NextResponse.json(
      { error: "Failed to load the meal roster" },
      { status: 500 }
    );
  }
}
