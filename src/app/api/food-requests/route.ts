import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { UserRole, FoodRequestStatus } from "@/types";

export const dynamic = "force-dynamic";

async function getCaller(): Promise<{ uid: string; role: UserRole } | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) return null;
    const decoded = await adminAuth.verifySessionCookie(session.value);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    return { uid: decoded.uid, role: userDoc.data()!.role as UserRole };
  } catch {
    return null;
  }
}

function toIsoOrNull(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "object" && val !== null && "toDate" in val) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

// ─── GET /api/food-requests?status=PENDING_FOOD ───

export async function GET(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") as FoodRequestStatus | null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = adminDb.collection("foodRequests");
    if (statusParam) {
      q = q.where("status", "==", statusParam);
    }
    const snap = await q.get();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requests = snap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        eventId: data.eventId,
        eventTitle: data.eventTitle,
        eventStartDate: toIsoOrNull(data.eventStartDate),
        needsDescription: data.needsDescription ?? "",
        status: data.status,
        headcount: data.headcount ?? null,
        menuPlan: data.menuPlan ?? null,
        coordinatorNotes: data.coordinatorNotes ?? null,
        budgetRequestId: data.budgetRequestId ?? null,
        confirmedByName: data.confirmedByName ?? null,
        confirmedAt: toIsoOrNull(data.confirmedAt),
        createdAt: toIsoOrNull(data.createdAt),
        updatedAt: toIsoOrNull(data.updatedAt),
      };
    });

    // Sort in JS to avoid composite-index requirement on status + createdAt.
    requests.sort(
      (a: { createdAt: string | null }, b: { createdAt: string | null }) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
    );

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("GET /api/food-requests error:", error);
    return NextResponse.json(
      { error: "Failed to fetch food requests" },
      { status: 500 }
    );
  }
}
