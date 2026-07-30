import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getCamp, DEFAULT_CAMP_ID } from "@/lib/camps";
import { getCampCapacitySettings } from "@/lib/camp-capacity";
import { getCallerWithDepartments, callerCanViewCampStatus } from "../_auth";

export const dynamic = "force-dynamic";

/**
 * GET — read-only camp registration status for department leads.
 *
 * Deliberately narrower than GET /api/camp-registrations: it returns the
 * headline numbers and a camper list limited to name, church/school, payment
 * status and check-in state. Medical notes, allergies, medications, phone
 * numbers, addresses and parent/emergency contacts are never included — those
 * stay with the people who manage the camp.
 */
export async function GET(request: Request) {
  try {
    const caller = await getCallerWithDepartments();
    if (!caller) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    if (!(await callerCanViewCampStatus(caller))) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const campId = url.searchParams.get("campId") || DEFAULT_CAMP_ID;
    const camp = getCamp(campId);
    if (!camp) {
      return NextResponse.json({ error: "Unknown camp" }, { status: 404 });
    }

    // Same shape as the admin list query: filter on campId alone and sort in
    // memory, so no composite index is needed.
    const [snapshot, capacitySettings] = await Promise.all([
      adminDb.collection("campRegistrations").where("campId", "==", campId).get(),
      getCampCapacitySettings(campId),
    ]);

    const campers = snapshot.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          firstName: (d.firstName as string) ?? "",
          lastName: (d.lastName as string) ?? "",
          churchOrSchool: (d.churchOrSchool as string) ?? "",
          gender: (d.gender as string) ?? null,
          paymentStatus: (d.paymentStatus as string) ?? "UNPAID",
          checkedIn: !!d.checkedIn,
          createdAt:
            (d.createdAt?.toDate?.() as Date | undefined)?.toISOString() ?? null,
        };
      })
      .sort((a, b) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1));

    const paid = campers.filter((c) => c.paymentStatus === "PAID").length;
    const unpaid = campers.filter((c) => c.paymentStatus === "UNPAID").length;
    const refunded = campers.filter((c) => c.paymentStatus === "REFUNDED").length;
    const checkedIn = campers.filter((c) => c.checkedIn).length;

    return NextResponse.json({
      camp: {
        id: camp.id,
        name: camp.name,
        startDate: camp.startDate,
        endDate: camp.endDate,
        venue: camp.venue ?? null,
      },
      capacity: capacitySettings.capacity,
      registered: campers.length,
      spotsLeft: Math.max(0, capacitySettings.capacity - campers.length),
      paid,
      unpaid,
      refunded,
      checkedIn,
      campers,
    });
  } catch (error) {
    console.error("Error fetching camp status:", error);
    return NextResponse.json(
      { error: "Failed to fetch camp status" },
      { status: 500 }
    );
  }
}
