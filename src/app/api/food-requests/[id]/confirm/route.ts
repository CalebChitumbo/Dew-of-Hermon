import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import {
  transitionFoodRequest,
  notifyEventsLeadOfFoodDecision,
} from "@/lib/food-helpers";
import {
  createBudgetRequest,
  notifyTreasurersOfBudgetRequest,
} from "@/lib/budget-helpers";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

async function getCaller() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) return null;
    const decoded = await adminAuth.verifySessionCookie(session.value);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    const data = userDoc.data()!;
    return {
      uid: decoded.uid,
      role: data.role as UserRole,
      name: data.name || "",
      departmentIds: data.departmentIds || [],
      leadsDepartmentIds: data.leadsDepartmentIds || [],
    };
  } catch {
    return null;
  }
}

type Action = "CONFIRM" | "DECLINE";

interface RaiseBudget {
  amount: number;
  currency: string;
  purpose: string;
}

function toDate(val: unknown): Date {
  if (val instanceof Date) return val;
  if (val && typeof val === "object" && "toDate" in val) {
    return (val as { toDate: () => Date }).toDate();
  }
  return new Date();
}

// ─── PATCH /api/food-requests/[id]/confirm ───
// Body: { action, headcount?, menuPlan?, raiseBudget?: {amount,currency,purpose}, comments? }

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
      "confirm_food",
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Forbidden: Food Logistics lead or Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = (await request.json()) as {
      action: Action;
      headcount?: number;
      menuPlan?: string;
      raiseBudget?: RaiseBudget;
      comments?: string;
    };
    const { action } = body;

    if (action !== "CONFIRM" && action !== "DECLINE") {
      return NextResponse.json(
        { error: "Invalid action. Must be CONFIRM or DECLINE" },
        { status: 400 }
      );
    }

    const trimmedComments =
      typeof body.comments === "string" && body.comments.trim()
        ? body.comments.trim()
        : null;
    if (action === "DECLINE" && !trimmedComments) {
      return NextResponse.json(
        { error: "Comments are required for DECLINE" },
        { status: 400 }
      );
    }

    const requestRef = adminDb.collection("foodRequests").doc(id);
    const requestDoc = await requestRef.get();
    if (!requestDoc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const current = requestDoc.data()!;
    if (current.status !== "PENDING_FOOD") {
      return NextResponse.json(
        {
          error: `Cannot act on request in status ${current.status}; must be PENDING_FOOD`,
        },
        { status: 409 }
      );
    }

    const now = new Date();

    if (action === "DECLINE") {
      await transitionFoodRequest(
        id,
        "DECLINED",
        { uid: caller.uid, name: caller.name },
        trimmedComments,
        {
          coordinatorNotes: trimmedComments,
          confirmedBy: caller.uid,
          confirmedByName: caller.name,
          confirmedAt: now,
        }
      );
    } else {
      // Optionally raise a catering funds request to Finance (only once).
      let budgetRequestId: string | null = current.budgetRequestId ?? null;
      if (body.raiseBudget && !budgetRequestId) {
        const amount = Number(body.raiseBudget.amount);
        const currency =
          typeof body.raiseBudget.currency === "string"
            ? body.raiseBudget.currency.trim()
            : "";
        const purpose =
          typeof body.raiseBudget.purpose === "string"
            ? body.raiseBudget.purpose.trim()
            : "";
        if (!Number.isFinite(amount) || amount <= 0 || !currency || !purpose) {
          return NextResponse.json(
            {
              error:
                "raiseBudget requires a positive amount, currency, and purpose",
            },
            { status: 400 }
          );
        }
        budgetRequestId = await createBudgetRequest({
          eventId: current.eventId,
          eventTitle: current.eventTitle,
          eventStartDate: toDate(current.eventStartDate),
          requestedAmount: amount,
          currency,
          purpose,
          requestedBy: caller.uid,
          requestedByName: caller.name,
          writeEventFk: false,
        });
        notifyTreasurersOfBudgetRequest(
          budgetRequestId,
          current.eventTitle,
          amount,
          currency
        ).catch(console.error);
      }

      const headcountValue =
        body.headcount !== undefined && Number.isFinite(Number(body.headcount))
          ? Number(body.headcount)
          : null;
      const menuPlanValue =
        typeof body.menuPlan === "string" && body.menuPlan.trim()
          ? body.menuPlan.trim()
          : null;

      await transitionFoodRequest(
        id,
        "CONFIRMED",
        { uid: caller.uid, name: caller.name },
        trimmedComments,
        {
          headcount: headcountValue,
          menuPlan: menuPlanValue,
          coordinatorNotes: trimmedComments,
          budgetRequestId,
          confirmedBy: caller.uid,
          confirmedByName: caller.name,
          confirmedAt: now,
        }
      );
    }

    const newStatus = action === "CONFIRM" ? "CONFIRMED" : "DECLINED";

    // Look up event creator for notifications
    let creatorId: string | null = null;
    try {
      const eventDoc = await adminDb.collection("events").doc(current.eventId).get();
      if (eventDoc.exists) creatorId = eventDoc.data()?.createdBy || null;
    } catch (err) {
      console.error("Failed to load event creator:", err);
    }

    notifyEventsLeadOfFoodDecision({
      eventId: current.eventId,
      eventTitle: current.eventTitle,
      eventCreatorId: creatorId,
      decision: newStatus,
      comments: trimmedComments,
    }).catch(console.error);

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error("PATCH /api/food-requests/[id]/confirm error:", error);
    return NextResponse.json(
      { error: "Failed to record food decision" },
      { status: 500 }
    );
  }
}
