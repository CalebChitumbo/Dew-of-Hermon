import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getCamp } from "@/lib/camps";
import {
  getCallerWithDepartments,
  callerCanManageCampRegistrations,
} from "../../camp-registrations/_auth";
import type { CampSponsorshipPaymentStatus } from "@/types";

export const dynamic = "force-dynamic";

const VALID_PAYMENT_STATUSES: CampSponsorshipPaymentStatus[] = [
  "UNPAID",
  "PARTIAL",
  "PAID",
];

const MAX_SLOTS = 500;

export async function PATCH(
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

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.paymentStatus !== undefined) {
      if (!VALID_PAYMENT_STATUSES.includes(body.paymentStatus)) {
        return NextResponse.json({ error: "Invalid payment status" }, { status: 400 });
      }
      updates.paymentStatus = body.paymentStatus;
      updates.paymentMarkedBy = caller.uid;
      updates.paymentMarkedByName = caller.name;
      updates.paymentMarkedAt = new Date();
    }
    if (body.amountReceived !== undefined) {
      if (body.amountReceived === null) {
        updates.amountReceived = null;
      } else {
        const amount = Number(body.amountReceived);
        if (!Number.isFinite(amount) || amount < 0) {
          return NextResponse.json(
            { error: "Invalid amount received" },
            { status: 400 }
          );
        }
        updates.amountReceived = amount;
      }
    }
    if (body.paymentReference !== undefined) {
      updates.paymentReference =
        typeof body.paymentReference === "string" && body.paymentReference.trim()
          ? body.paymentReference.trim()
          : null;
    }
    if (body.paymentNotes !== undefined) {
      updates.paymentNotes =
        typeof body.paymentNotes === "string" && body.paymentNotes.trim()
          ? body.paymentNotes.trim()
          : null;
    }

    let slotsPledged: number | null = null;
    if (body.slotsPledged !== undefined) {
      const slots = Number(body.slotsPledged);
      if (!Number.isInteger(slots) || slots < 1 || slots > MAX_SLOTS) {
        return NextResponse.json(
          { error: `Number of youth must be a whole number between 1 and ${MAX_SLOTS}` },
          { status: 400 }
        );
      }
      slotsPledged = slots;
    }

    const ref = adminDb.collection("campSponsorships").doc(id);

    // Shrinking a pledge must never drop it below the slots already consumed
    // by assigned campers, so the check and the write happen in one
    // transaction against the live slotsAssigned count.
    const failure = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { status: 404, error: "Sponsorship not found" };
      const data = snap.data()!;

      if (slotsPledged !== null) {
        const assigned = (data.slotsAssigned as number) ?? 0;
        if (slotsPledged < assigned) {
          return {
            status: 409,
            error: `This pledge already has ${assigned} camper(s) assigned — unassign them first or keep at least ${assigned} slot(s)`,
          };
        }
        updates.slotsPledged = slotsPledged;
        // Keep the money value in step for pledges expressed as youth counts.
        const camp = getCamp(data.campId as string);
        if (data.pledgeType === "SLOTS" && camp) {
          updates.amountPledged = slotsPledged * camp.fee;
        }
      }

      tx.update(ref, updates);
      return null;
    });

    if (failure) {
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating camp sponsorship:", error);
    return NextResponse.json(
      { error: "Failed to update sponsorship" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCallerWithDepartments();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (caller.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only the Chairperson (Super Admin) can delete sponsorship pledges" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const ref = adminDb.collection("campSponsorships").doc(id);

    // Deleting a pledge releases every camper assigned to it, atomically, so
    // no registration is left pointing at a pledge that no longer exists.
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;

      const assignedSnap = await tx.get(
        adminDb.collection("campRegistrations").where("sponsorshipId", "==", id)
      );

      const now = new Date();
      for (const regDoc of assignedSnap.docs) {
        tx.update(regDoc.ref, {
          sponsorshipId: null,
          sponsorName: null,
          sponsorshipAssignedBy: null,
          sponsorshipAssignedByName: null,
          sponsorshipAssignedAt: null,
          updatedAt: now,
        });
      }
      tx.delete(ref);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting camp sponsorship:", error);
    return NextResponse.json(
      { error: "Failed to delete sponsorship" },
      { status: 500 }
    );
  }
}
