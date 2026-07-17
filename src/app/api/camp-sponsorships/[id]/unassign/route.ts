import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  getCallerWithDepartments,
  callerCanManageCampRegistrations,
} from "../../../camp-registrations/_auth";

export const dynamic = "force-dynamic";

// POST: Remove a camper from this sponsorship pledge, releasing the slot back
// to the pledge. Body: { registrationId }.
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

    const failure = await adminDb.runTransaction(async (tx) => {
      const [sponsorshipSnap, registrationSnap] = await Promise.all([
        tx.get(sponsorshipRef),
        tx.get(registrationRef),
      ]);

      if (!registrationSnap.exists) {
        return { status: 404, error: "Registration not found" };
      }
      const registration = registrationSnap.data()!;
      if (registration.sponsorshipId !== id) {
        return {
          status: 409,
          error: "This camper is not assigned to this sponsorship",
        };
      }

      const now = new Date();
      // The pledge doc may have been deleted out from under the assignment;
      // still clear the camper so the register never shows a dangling link.
      if (sponsorshipSnap.exists) {
        const assigned = (sponsorshipSnap.data()?.slotsAssigned as number) ?? 0;
        tx.update(sponsorshipRef, {
          slotsAssigned: Math.max(0, assigned - 1),
          updatedAt: now,
        });
      }
      tx.update(registrationRef, {
        sponsorshipId: null,
        sponsorName: null,
        sponsorshipAssignedBy: null,
        sponsorshipAssignedByName: null,
        sponsorshipAssignedAt: null,
        updatedAt: now,
      });
      return null;
    });

    if (failure) {
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing camper from sponsorship:", error);
    return NextResponse.json(
      { error: "Failed to remove camper from sponsorship" },
      { status: 500 }
    );
  }
}
