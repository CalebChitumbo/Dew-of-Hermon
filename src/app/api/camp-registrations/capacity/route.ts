import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getCamp, DEFAULT_CAMP_ID } from "@/lib/camps";
import {
  campSettingsRef,
  getCampCapacitySettings,
  isValidCapacity,
  MAX_CAMP_CAPACITY,
  MIN_CAMP_CAPACITY,
} from "@/lib/camp-capacity";
import {
  getCallerWithDepartments,
  callerCanManageCampRegistrations,
} from "../_auth";

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

    const [snap, settings] = await Promise.all([
      adminDb
        .collection("campRegistrations")
        .where("campId", "==", campId)
        .count()
        .get(),
      getCampCapacitySettings(campId),
    ]);

    return NextResponse.json({
      campId,
      capacity: settings.capacity,
      defaultCapacity: settings.defaultCapacity,
      isOverridden: settings.isOverridden,
      capacityUpdatedAt: settings.updatedAt?.toISOString() ?? null,
      capacityUpdatedByName: settings.updatedByName,
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

/**
 * PUT — change the maximum registration capacity for a camp.
 *
 * Send `{ capacity: number }` to set a cap, or `{ capacity: null }` to drop
 * the override and fall back to the capacity the camp was planned with.
 * Restricted to whoever may manage camp registrations.
 */
export async function PUT(request: Request) {
  try {
    const caller = await getCallerWithDepartments();
    if (!caller) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    if (!(await callerCanManageCampRegistrations(caller))) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const campId: string = (body.campId || DEFAULT_CAMP_ID).toString();
    const camp = getCamp(campId);
    if (!camp) {
      return NextResponse.json({ error: "Unknown camp" }, { status: 404 });
    }

    const now = new Date();

    // Clearing the override: back to the catalog capacity.
    if (body.capacity === null) {
      await campSettingsRef(campId).set(
        {
          campId,
          capacity: null,
          updatedAt: now,
          updatedBy: caller.uid,
          updatedByName: caller.name,
        },
        { merge: true }
      );
      const settings = await getCampCapacitySettings(campId);
      return NextResponse.json({ success: true, ...settings });
    }

    const capacity = Number(body.capacity);
    if (!isValidCapacity(capacity)) {
      return NextResponse.json(
        {
          error: `Capacity must be a whole number between ${MIN_CAMP_CAPACITY} and ${MAX_CAMP_CAPACITY}`,
        },
        { status: 400 }
      );
    }

    // Don't let the cap drop below the campers already registered — that would
    // leave the page reading "92 / 80" and the counter permanently over.
    const countSnap = await adminDb
      .collection("campRegistrations")
      .where("campId", "==", campId)
      .count()
      .get();
    const registered = countSnap.data().count;
    if (capacity < registered) {
      return NextResponse.json(
        {
          error: `${registered} campers are already registered. The maximum can't be set below that — remove registrations first.`,
        },
        { status: 400 }
      );
    }

    await campSettingsRef(campId).set(
      {
        campId,
        capacity,
        updatedAt: now,
        updatedBy: caller.uid,
        updatedByName: caller.name,
      },
      { merge: true }
    );

    const settings = await getCampCapacitySettings(campId);
    return NextResponse.json({ success: true, ...settings, registered });
  } catch (error) {
    console.error("Error updating capacity:", error);
    return NextResponse.json(
      { error: "Failed to update capacity" },
      { status: 500 }
    );
  }
}
