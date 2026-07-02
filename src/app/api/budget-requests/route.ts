import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionCaller as getCaller } from "@/lib/server-auth";
import type { BudgetRequestStatus } from "@/types";

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

// ─── GET /api/budget-requests?status=PENDING_TREASURER ───

export async function GET(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") as BudgetRequestStatus | null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = adminDb.collection("budgetRequests");
    if (statusParam) {
      q = q.where("status", "==", statusParam);
    }
    // Sort in JS to avoid composite-index requirement on status + createdAt.
    const snap = await q.get();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requests = snap.docs.map((doc: any) => {
      const data = doc.data();
      return {
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
        createdAt: toIsoOrNull(data.createdAt),
        updatedAt: toIsoOrNull(data.updatedAt),
      };
    });

    requests.sort((a: { createdAt: string | null }, b: { createdAt: string | null }) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
    );

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("GET /api/budget-requests error:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget requests" },
      { status: 500 }
    );
  }
}
