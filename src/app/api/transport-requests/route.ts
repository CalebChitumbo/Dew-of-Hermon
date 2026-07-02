import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionCaller as getCaller } from "@/lib/server-auth";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import {
  createTransportRequest,
  notifyTransportCoordinators,
} from "@/lib/transport-helpers";
import type { TransportRequestStatus } from "@/types";

export const dynamic = "force-dynamic";

function toIsoOrNull(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "object" && val !== null && "toDate" in val) {
    const d = (val as { toDate: () => Date }).toDate();
    return d.toISOString();
  }
  return null;
}

// ─── GET /api/transport-requests?status=&scope=mine|treasurer ───

export async function GET(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") as
      | TransportRequestStatus
      | null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = adminDb.collection("transportRequests");
    if (statusParam) {
      q = q.where("status", "==", statusParam);
    }
    // Avoid combining .where() + .orderBy() on different fields — that would
    // require a composite index. Sort in JS after fetching instead; the
    // pending queues are small enough that this is fine.
    const snap = await q.get();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requests = snap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        eventId: data.eventId,
        eventTitle: data.eventTitle,
        eventStartDate: toIsoOrNull(data.eventStartDate),
        needsDescription: data.needsDescription || "",
        status: data.status,
        vehicleType: data.vehicleType ?? null,
        vehicleCount: data.vehicleCount ?? null,
        estimatedCost: data.estimatedCost ?? null,
        currency: data.currency ?? null,
        pickupLocation: data.pickupLocation ?? null,
        dropoffLocation: data.dropoffLocation ?? null,
        pickupTime: toIsoOrNull(data.pickupTime),
        returnTime: toIsoOrNull(data.returnTime),
        coordinatorNotes: data.coordinatorNotes ?? null,
        routedBy: data.routedBy ?? null,
        routedByName: data.routedByName ?? null,
        routedAt: toIsoOrNull(data.routedAt),
        filledBy: data.filledBy ?? null,
        filledByName: data.filledByName ?? null,
        filledAt: toIsoOrNull(data.filledAt),
        treasurerId: data.treasurerId ?? null,
        treasurerName: data.treasurerName ?? null,
        treasurerDecidedAt: toIsoOrNull(data.treasurerDecidedAt),
        treasurerComments: data.treasurerComments ?? null,
        createdAt: toIsoOrNull(data.createdAt),
        updatedAt: toIsoOrNull(data.updatedAt),
      };
    });

    // Newest first
    requests.sort((a: { createdAt: string | null }, b: { createdAt: string | null }) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
    );

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("GET /api/transport-requests error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transport requests" },
      { status: 500 }
    );
  }
}

// ─── POST /api/transport-requests ───
// Body: { eventId }
// Called by Events Coordinator (or Admin) to route a pending event's
// transport need to the Transport Coordinator.

export async function POST(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Same gate as event approval — routing transport is part of the
    // approval workflow.
    const canRoute = await serverCheckFeatureAccess(
      "approve_events",
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );
    if (!canRoute) {
      return NextResponse.json(
        { error: "Forbidden: Events & Fellowship Manager or Admin access required" },
        { status: 403 }
      );
    }

    const { eventId } = await request.json();
    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid eventId" },
        { status: 400 }
      );
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const event = eventDoc.data()!;

    if (!event.transportRequired) {
      return NextResponse.json(
        { error: "This event is not flagged as requiring transport." },
        { status: 400 }
      );
    }
    if (event.transportRequestId) {
      return NextResponse.json(
        { error: "A transport request has already been created for this event." },
        { status: 409 }
      );
    }

    const eventStartDate: Date =
      event.startDate?.toDate?.() ?? new Date(event.startDate);

    const requestId = await createTransportRequest({
      eventId,
      eventTitle: event.title,
      eventStartDate,
      needsDescription: event.transportNeeds || "(no description provided)",
      routedBy: caller.uid,
      routedByName: caller.name,
    });

    notifyTransportCoordinators(requestId, event.title).catch(console.error);

    return NextResponse.json({ id: requestId, status: "PENDING_DETAILS" }, { status: 201 });
  } catch (error) {
    console.error("POST /api/transport-requests error:", error);
    return NextResponse.json(
      { error: "Failed to create transport request" },
      { status: 500 }
    );
  }
}
