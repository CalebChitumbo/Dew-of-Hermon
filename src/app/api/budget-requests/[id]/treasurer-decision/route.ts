import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import {
  transitionBudgetRequest,
  notifyEventsLeadOfBudgetDecision,
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
    const requestDoc = await requestRef.get();
    if (!requestDoc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const current = requestDoc.data()!;
    if (current.status !== "PENDING_TREASURER") {
      return NextResponse.json(
        {
          error: `Cannot decide on request in status ${current.status}; must be PENDING_TREASURER`,
        },
        { status: 409 }
      );
    }

    const requestedAmount: number = current.requestedAmount ?? 0;
    const currency: string = current.currency ?? "";

    let finalApprovedAmount: number | null = null;
    if (action === "APPROVE") {
      const candidate = Number(approvedAmount ?? requestedAmount);
      if (!Number.isFinite(candidate) || candidate < 0) {
        return NextResponse.json(
          { error: "approvedAmount must be a non-negative number" },
          { status: 400 }
        );
      }
      if (candidate > requestedAmount) {
        return NextResponse.json(
          {
            error: `approvedAmount (${candidate}) cannot exceed requestedAmount (${requestedAmount})`,
          },
          { status: 400 }
        );
      }
      finalApprovedAmount = candidate;
    }

    const now = new Date();
    const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

    await transitionBudgetRequest(
      id,
      newStatus,
      { uid: caller.uid, name: caller.name },
      trimmedComments,
      {
        approvedAmount: finalApprovedAmount,
        treasurerId: caller.uid,
        treasurerName: caller.name,
        treasurerDecidedAt: now,
        treasurerComments: trimmedComments,
      }
    );

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
