import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionCaller as getCaller } from "@/lib/server-auth";

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
    const doc = await adminDb.collection("budgetRequests").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data = doc.data()!;

    return NextResponse.json({
      request: {
        id: doc.id,
        eventId: data.eventId,
        eventTitle: data.eventTitle,
        eventStartDate: toIsoOrNull(data.eventStartDate),
        requestedAmount: data.requestedAmount ?? 0,
        currency: data.currency ?? "",
        purpose: data.purpose ?? "",
        requestedBy: data.requestedBy ?? null,
        requestedByName: data.requestedByName ?? null,
        status: data.status,
        approvedAmount: data.approvedAmount ?? null,
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
    });
  } catch (error) {
    console.error("GET /api/budget-requests/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget request" },
      { status: 500 }
    );
  }
}
