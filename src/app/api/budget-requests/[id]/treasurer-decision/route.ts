import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import { notifyEventsLeadOfBudgetDecision } from "@/lib/budget-helpers";
import { getSessionCaller as getCaller } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

type Action = "APPROVE" | "REJECT";

// ─── PATCH /api/budget-requests/[id]/treasurer-decision ───
// Body: { action: "APPROVE" | "REJECT", approvedAmount?: number, comments?: string }

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
      "approve_accounts",
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Forbidden: Treasurer (Finance lead) or Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = (await request.json()) as {
      action: Action;
      approvedAmount?: number;
      comments?: string;
    };
    const { action, approvedAmount, comments } = body;

    if (action !== "APPROVE" && action !== "REJECT") {
      return NextResponse.json(
        { error: "Invalid action. Must be APPROVE or REJECT" },
        { status: 400 }
      );
    }

    const trimmedComments =
      typeof comments === "string" && comments.trim() ? comments.trim() : null;
    if (action === "REJECT" && !trimmedComments) {
      return NextResponse.json(
        { error: "Comments are required for REJECT" },
        { status: 400 }
      );
    }

    const requestRef = adminDb.collection("budgetRequests").doc(id);
    const now = new Date();
    const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

    // Read, status-guard, and write atomically so two concurrent treasurers
    // can't both pass the PENDING_TREASURER check and double-apply.
    const txn = await adminDb.runTransaction(async (tx) => {
      const requestDoc = await tx.get(requestRef);
      if (!requestDoc.exists) {
        return { error: "Not found", httpStatus: 404 } as const;
      }
      const current = requestDoc.data()!;
      if (current.status !== "PENDING_TREASURER") {
        return {
          error: `Cannot decide on request in status ${current.status}; must be PENDING_TREASURER`,
          httpStatus: 409,
        } as const;
      }

      const requestedAmount: number = current.requestedAmount ?? 0;

      let finalApprovedAmount: number | null = null;
      if (action === "APPROVE") {
        const candidate = Number(approvedAmount ?? requestedAmount);
        if (!Number.isFinite(candidate) || candidate < 0) {
          return {
            error: "approvedAmount must be a non-negative number",
            httpStatus: 400,
          } as const;
        }
        if (candidate > requestedAmount) {
          return {
            error: `approvedAmount (${candidate}) cannot exceed requestedAmount (${requestedAmount})`,
            httpStatus: 400,
          } as const;
        }
        finalApprovedAmount = candidate;
      }

      tx.update(requestRef, {
        approvedAmount: finalApprovedAmount,
        treasurerId: caller.uid,
        treasurerName: caller.name,
        treasurerDecidedAt: now,
        treasurerComments: trimmedComments,
        status: newStatus,
        updatedAt: now,
        statusHistory: FieldValue.arrayUnion({
          status: newStatus,
          changedBy: caller.uid,
          changedByName: caller.name,
          changedAt: now,
          comments: trimmedComments,
        }),
      });

      return { current, finalApprovedAmount } as const;
    });

    if ("error" in txn) {
      return NextResponse.json({ error: txn.error }, { status: txn.httpStatus });
    }

    const { current, finalApprovedAmount } = txn;
    const requestedAmount: number = current.requestedAmount ?? 0;
    const currency: string = current.currency ?? "";

    // Look up event creator for notifications
    let creatorId: string | null = null;
    try {
      const eventDoc = await adminDb
        .collection("events")
        .doc(current.eventId)
        .get();
      if (eventDoc.exists) {
        creatorId = eventDoc.data()?.createdBy || null;
      }
    } catch (err) {
      console.error("Failed to load event creator:", err);
    }

    notifyEventsLeadOfBudgetDecision({
      requestId: id,
      eventId: current.eventId,
      eventTitle: current.eventTitle,
      eventCreatorId: creatorId,
      decision: newStatus,
      approvedAmount: finalApprovedAmount,
      currency,
      requestedAmount,
      comments: trimmedComments,
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      status: newStatus,
      approvedAmount: finalApprovedAmount,
    });
  } catch (error) {
    console.error(
      "PATCH /api/budget-requests/[id]/treasurer-decision error:",
      error
    );
    return NextResponse.json(
      { error: "Failed to record treasurer decision" },
      { status: 500 }
    );
  }
}
