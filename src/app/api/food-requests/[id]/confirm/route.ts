import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionCaller as getCaller } from "@/lib/server-auth";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import { notifyEventsLeadOfFoodDecision } from "@/lib/food-helpers";
import {
  createBudgetRequest,
  notifyTreasurersOfBudgetRequest,
} from "@/lib/budget-helpers";
import { transitionIfStatus } from "@/lib/workflow-transitions";

export const dynamic = "force-dynamic";

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

    const now = new Date();
    const newStatus = action === "CONFIRM" ? "CONFIRMED" : "DECLINED";

    // Validate the optional budget payload up front (before any write) so a
    // bad request is rejected without side effects.
    let validatedBudget: RaiseBudget | null = null;
    if (action === "CONFIRM" && body.raiseBudget) {
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
      validatedBudget = { amount, currency, purpose };
    }

    const patch: Record<string, unknown> = {
      coordinatorNotes: trimmedComments,
      confirmedBy: caller.uid,
      confirmedByName: caller.name,
      confirmedAt: now,
    };
    if (action === "CONFIRM") {
      patch.headcount =
        body.headcount !== undefined && Number.isFinite(Number(body.headcount))
          ? Number(body.headcount)
          : null;
      patch.menuPlan =
        typeof body.menuPlan === "string" && body.menuPlan.trim()
          ? body.menuPlan.trim()
          : null;
    }

    // Atomically guard the PENDING_FOOD → CONFIRMED/DECLINED transition. This is
    // what stops a double-submit from raising two duplicate catering funds
    // requests to Finance: only the caller that wins the transition proceeds to
    // create the budget request below.
    const result = await transitionIfStatus({
      collection: "foodRequests",
      id,
      expectedStatus: "PENDING_FOOD",
      newStatus,
      actor: { uid: caller.uid, name: caller.name },
      comments: trimmedComments,
      patch,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.httpStatus }
      );
    }
    const current = result.current;

    // Raise the catering funds request exactly once, after we've won the
    // transition and confirmed one wasn't already raised.
    if (validatedBudget && !current.budgetRequestId) {
      const budgetRequestId = await createBudgetRequest({
        eventId: current.eventId,
        eventTitle: current.eventTitle,
        eventStartDate: toDate(current.eventStartDate),
        requestedAmount: validatedBudget.amount,
        currency: validatedBudget.currency,
        purpose: validatedBudget.purpose,
        requestedBy: caller.uid,
        requestedByName: caller.name,
        writeEventFk: false,
      });
      await adminDb
        .collection("foodRequests")
        .doc(id)
        .update({ budgetRequestId, updatedAt: new Date() });
      notifyTreasurersOfBudgetRequest(
        budgetRequestId,
        current.eventTitle,
        validatedBudget.amount,
        validatedBudget.currency
      ).catch(console.error);
    }

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
