import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

async function getCaller(): Promise<{ uid: string; role: UserRole } | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) return null;
    const decoded = await adminAuth.verifySessionCookie(session.value);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    return {
      uid: decoded.uid,
      role: userDoc.data()!.role as UserRole,
    };
  } catch {
    return null;
  }
}

function toIsoOrNull(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "object" && val !== null && "toDate" in val) {
    const d = (val as { toDate: () => Date }).toDate();
    return d.toISOString();
  }
  return null;
}

interface StatusHistoryDoc {
  status?: string;
  changedBy?: string;
  changedByName?: string;
  changedAt?: unknown;
  comments?: string | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const doc = await adminDb.collection("transportRequests").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data = doc.data()!;

    // Fetch the parent event for richer context (venue, type, creator).
    const eventDoc = await adminDb.collection("events").doc(data.eventId).get();
    const event = eventDoc.exists
      ? {
          id: eventDoc.id,
          title: eventDoc.data()!.title,
          type: eventDoc.data()!.type,
          venue: eventDoc.data()!.venue,
          startDate: toIsoOrNull(eventDoc.data()!.startDate),
          endDate: toIsoOrNull(eventDoc.data()!.endDate),
          approvalStatus: eventDoc.data()!.approvalStatus,
          createdBy: eventDoc.data()!.createdBy,
          description: eventDoc.data()!.description || null,
        }
      : null;

    return NextResponse.json({
      request: {
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
        statusHistory: (data.statusHistory || []).map((h: StatusHistoryDoc) => ({
          status: h.status,
          changedBy: h.changedBy,
          changedByName: h.changedByName,
          changedAt: toIsoOrNull(h.changedAt),
          comments: h.comments ?? null,
        })),
        createdAt: toIsoOrNull(data.createdAt),
        updatedAt: toIsoOrNull(data.updatedAt),
      },
      event,
    });
  } catch (error) {
    console.error("GET /api/transport-requests/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transport request" },
      { status: 500 }
    );
  }
}
