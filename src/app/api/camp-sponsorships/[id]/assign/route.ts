import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  getCallerWithDepartments,
  callerCanManageCampRegistrations,
} from "../../../camp-registrations/_auth";

export const dynamic = "force-dynamic";

// POST: Assign a registered camper to this sponsorship pledge, consuming one
// of its slots. Body: { registrationId }.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCallerWithDepartments();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!(await callerCanManageCampRegistrations(caller))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const registrationId =
      typeof body.registrationId === "string" ? body.registrationId.trim() : "";
    if (!registrationId) {
      return NextResponse.json(
        { error: "Missing required field: registrationId" },
        { status: 400 }
      );
    }

    const sponsorshipRef = adminDb.collection("campSponsorships").doc(id);
    const registrationRef = adminDb
      .collection("campRegistrations")
      .doc(registrationId);

    // Slot consumption and the camper link are written in one transaction so
    // two admins assigning concurrently can't oversubscribe a pledge or
    // double-sponsor a camper.
    const failure = await adminDb.runTransaction(async (tx) => {
      const [sponsorshipSnap, registrationSnap] = await Promise.all([
        tx.get(sponsorshipRef),
        tx.get(registrationRef),
      ]);

      if (!sponsorshipSnap.exists) {
        return { status: 404, error: "Sponsorship not found" };
      }
      if (!registrationSnap.exists) {
        return { status: 404, error: "Registration not found" };
      }

      const sponsorship = sponsorshipSnap.data()!;
      const registration = registrationSnap.data()!;

      if (registration.campId !== sponsorship.campId) {
        return {
          status: 400,
          error: "Registration and sponsorship belong to different camps",
        };
      }
      if (registration.sponsorshipId) {
        return {
          status: 409,
          error: "This camper is already assigned to a sponsorship",
        };
      }

      const pledged = (sponsorship.slotsPledged as number) ?? 0;
      const assigned = (sponsorship.slotsAssigned as number) ?? 0;
      if (assigned >= pledged) {
        return {
          status: 409,
          error: "No sponsorship slots left on this pledge — all slots are allocated",
        };
      }

      const now = new Date();
      tx.update(sponsorshipRef, {
        slotsAssigned: assigned + 1,
        updatedAt: now,
      });
      tx.update(registrationRef, {
        sponsorshipId: id,
        sponsorName: sponsorship.sponsorName ?? null,
        sponsorshipAssignedBy: caller.uid,
        sponsorshipAssignedByName: caller.name,
        sponsorshipAssignedAt: now,
        updatedAt: now,
      });
      return null;
    });

    if (failure) {
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error assigning camper to sponsorship:", error);
    return NextResponse.json(
      { error: "Failed to assign camper to sponsorship" },
      { status: 500 }
    );
  }
}
