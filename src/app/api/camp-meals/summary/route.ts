import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  MEALS_COLLECTION,
  REGISTRATIONS_COLLECTION,
  getCampSittings,
} from "@/lib/camp-meals";
import { getCamp, DEFAULT_CAMP_ID } from "@/lib/camps";
import { getMealCaller } from "../_auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/camp-meals/summary?campId=...
 *
 * Per-sitting head counts for the camp manager and the kitchen: how many were
 * served, how many of those were unpaid, and how many campers are on site but
 * haven't come through yet. The last number is the one the old paper register
 * could never give you before the meal was over.
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
    const camp = getCamp(campId);
    if (!camp) {
      return NextResponse.json({ error: "Unknown camp" }, { status: 400 });
    }

    const [regSnap, scanSnap] = await Promise.all([
      adminDb
        .collection(REGISTRATIONS_COLLECTION)
        .where("campId", "==", campId)
        .get(),
      adminDb.collection(MEALS_COLLECTION).where("campId", "==", campId).get(),
    ]);

    // On site = checked in at the gate and not currently out on an exit pass.
    // That is the population the kitchen actually has to feed.
    const onSiteIds = new Set<string>();
    regSnap.docs.forEach((doc) => {
      const d = doc.data();
      if (d.checkedIn === true && d.onPass !== true) onSiteIds.add(doc.id);
    });

    const counts = new Map<
      string,
      { served: number; flagged: number; servedOnSite: Set<string> }
    >();
    scanSnap.docs.forEach((doc) => {
      const d = doc.data();
      const entry =
        counts.get(d.sittingId) ??
        { served: 0, flagged: 0, servedOnSite: new Set<string>() };
      entry.served += 1;
      if (d.paymentFlagged === true) entry.flagged += 1;
      if (onSiteIds.has(d.registrationId)) entry.servedOnSite.add(d.registrationId);
      counts.set(d.sittingId, entry);
    });

    const sittings = getCampSittings(campId).map((sitting) => {
      const entry =
        counts.get(sitting.id) ??
        { served: 0, flagged: 0, servedOnSite: new Set<string>() };
      return {
        ...sitting,
        served: entry.served,
        flagged: entry.flagged,
        /**
         * Checked-in campers who haven't come through this sitting yet.
         * Counted against the on-site set rather than by subtraction, since a
         * camper can be served without having been gate-checked-in and a plain
         * subtraction would then under-report the queue still to come.
         */
        outstanding: onSiteIds.size - entry.servedOnSite.size,
      };
    });

    return NextResponse.json({
      camp: { id: camp.id, name: camp.name },
      registered: regSnap.size,
      onSite: onSiteIds.size,
      sittings,
    });
  } catch (error) {
    console.error("GET /api/camp-meals/summary error:", error);
    return NextResponse.json(
      { error: "Failed to load the meal summary" },
      { status: 500 }
    );
  }
}
