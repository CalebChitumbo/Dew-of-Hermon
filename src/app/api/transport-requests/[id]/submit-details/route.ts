import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionCaller as getCaller } from "@/lib/server-auth";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import {
  transitionTransportRequest,
  notifyTreasurers,
} from "@/lib/transport-helpers";
import type { TransportRequestStatus } from "@/types";

export const dynamic = "force-dynamic";

function parseDateOrNull(val: unknown): Date | null {
  if (!val || typeof val !== "string") return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

const ALLOWED_PRIOR_STATUSES: TransportRequestStatus[] = [
  "PENDING_DETAILS",
];

// ─── PATCH /api/transport-requests/[id]/submit-details ───
// Body: { vehicleType, vehicleCount, estimatedCost, currency,
//         pickupLocation, dropoffLocation, pickupTime, returnTime, coordinatorNotes }

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await serverCheckFeatureAccess(
      "manage_transport_logistics",
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Forbidden: Transport & Logistics lead or Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const {
      vehicleType,
      vehicleCount,
      estimatedCost,
      currency,
      pickupLocation,
      dropoffLocation,
      pickupTime,
      returnTime,
      coordinatorNotes,
    } = body;

    // Validate required cost fields
    if (typeof vehicleType !== "string" || !vehicleType.trim()) {
      return NextResponse.json(
        { error: "vehicleType is required" },
        { status: 400 }
      );
    }
    const vCount = Number(vehicleCount);
    if (!Number.isFinite(vCount) || vCount < 1) {
      return NextResponse.json(
        { error: "vehicleCount must be a positive number" },
        { status: 400 }
      );
    }
    const cost = Number(estimatedCost);
    if (!Number.isFinite(cost) || cost < 0) {
      return NextResponse.json(
        { error: "estimatedCost must be a non-negative number" },
        { status: 400 }
      );
    }
    if (typeof currency !== "string" || !currency.trim()) {
      return NextResponse.json(
        { error: "currency is required" },
        { status: 400 }
      );
    }

    const requestRef = adminDb.collection("transportRequests").doc(id);
    const requestDoc = await requestRef.get();
    if (!requestDoc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const current = requestDoc.data()!;
    if (
      !ALLOWED_PRIOR_STATUSES.includes(current.status as TransportRequestStatus)
    ) {
      return NextResponse.json(
        {
          error: `Cannot submit details when request is in status ${current.status}`,
        },
        { status: 409 }
      );
    }

    const now = new Date();
    await transitionTransportRequest(
      id,
      "PENDING_TREASURER",
      { uid: caller.uid, name: caller.name },
      coordinatorNotes && typeof coordinatorNotes === "string"
        ? coordinatorNotes.trim() || null
        : null,
      {
        vehicleType: vehicleType.trim(),
        vehicleCount: vCount,
        estimatedCost: cost,
        currency: currency.trim(),
        pickupLocation:
          typeof pickupLocation === "string" && pickupLocation.trim()
            ? pickupLocation.trim()
            : null,
        dropoffLocation:
          typeof dropoffLocation === "string" && dropoffLocation.trim()
            ? dropoffLocation.trim()
            : null,
        pickupTime: parseDateOrNull(pickupTime),
        returnTime: parseDateOrNull(returnTime),
        coordinatorNotes:
          typeof coordinatorNotes === "string" && coordinatorNotes.trim()
            ? coordinatorNotes.trim()
            : null,
        filledBy: caller.uid,
        filledByName: caller.name,
        filledAt: now,
      }
    );

    notifyTreasurers(id, current.eventTitle, cost, currency.trim()).catch(
      console.error
    );

    return NextResponse.json({ success: true, status: "PENDING_TREASURER" });
  } catch (error) {
    console.error(
      "PATCH /api/transport-requests/[id]/submit-details error:",
      error
    );
    return NextResponse.json(
      { error: "Failed to submit transport details" },
      { status: 500 }
    );
  }
}
