import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { transitionIfStatus } from "@/lib/workflow-transitions";
import {
  PASSES_COLLECTION,
  PASS_STAGE_LABEL,
  PASS_STAGE_NEXT_STATUS,
  PASS_STAGE_STATUS,
  generatePassCode,
  notifyPassRequester,
  notifyStageApprovers,
  serializeCampPass,
} from "@/lib/camp-passes";
import { sendCampPassEmail } from "@/lib/camp-pass-email";
import { getPassCaller, canActOnStage } from "../../_auth";
import type { CampPassStage, CampPassStatus } from "@/types";

export const dynamic = "force-dynamic";

type Action = "APPROVE" | "REJECT" | "CANCEL";

/** Which stage a pass is waiting on, given its status. */
const STAGE_BY_STATUS: Partial<Record<CampPassStatus, CampPassStage>> = {
  PENDING_ADMISSIONS: "ADMISSIONS",
  PENDING_MANAGER: "MANAGER",
  PENDING_CHAIR: "CHAIR",
};

/** Per-stage decision fields, so one handler covers all three sign-offs. */
const STAGE_FIELDS: Record<
  CampPassStage,
  { id: string; name: string; decidedAt: string; comments: string }
> = {
  ADMISSIONS: {
    id: "admissionsId",
    name: "admissionsName",
    decidedAt: "admissionsDecidedAt",
    comments: "admissionsComments",
  },
  MANAGER: {
    id: "managerId",
    name: "managerName",
    decidedAt: "managerDecidedAt",
    comments: "managerComments",
  },
  CHAIR: {
    id: "chairId",
    name: "chairName",
    decidedAt: "chairDecidedAt",
    comments: "chairComments",
  },
};

// ─── PATCH /api/camp-passes/[id]/decision ───
// Body: { action: "APPROVE" | "REJECT" | "CANCEL", comments?: string }
//
// One endpoint for all three sign-offs: the pass's current status determines
// which stage is being actioned, and the caller must hold that stage's
// permission. The Chairperson's APPROVE is the only one that mints a passCode
// and emails the QR ticket — nothing scannable exists before that point.

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getPassCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action as Action | undefined;
    const comments =
      typeof body.comments === "string" && body.comments.trim()
        ? body.comments.trim().slice(0, 500)
        : null;

    if (!action || !["APPROVE", "REJECT", "CANCEL"].includes(action)) {
      return NextResponse.json(
        { error: "action must be APPROVE, REJECT, or CANCEL" },
        { status: 400 }
      );
    }
    if (action === "REJECT" && !comments) {
      return NextResponse.json(
        { error: "Please say why the request is being declined." },
        { status: 400 }
      );
    }

    const ref = adminDb.collection(PASSES_COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Exit pass not found" }, { status: 404 });
    }
    const pass = doc.data()!;
    const status = pass.status as CampPassStatus;

    // ── Cancel ────────────────────────────────────────────────────────────
    if (action === "CANCEL") {
      const isRequester = pass.requestedByUid === caller.uid;
      const isStaff = caller.can.admissions || caller.can.manager || caller.can.chair;
      if (!isRequester && !isStaff) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
      if (status === "OUT") {
        return NextResponse.json(
          {
            error:
              "The camper is currently signed out on this pass. They must be scanned back in at the gate first.",
          },
          { status: 409 }
        );
      }

      const cancelled = await transitionIfStatus({
        collection: PASSES_COLLECTION,
        id,
        expectedStatus: [
          "PENDING_ADMISSIONS",
          "PENDING_MANAGER",
          "PENDING_CHAIR",
          "APPROVED",
        ],
        newStatus: "CANCELLED",
        actor: { uid: caller.uid, name: caller.name },
        comments,
        // Void the code so a ticket already in someone's inbox stops working.
        patch: { passCode: null },
      });
      if (!cancelled.ok) {
        return NextResponse.json(
          { error: cancelled.error },
          { status: cancelled.httpStatus }
        );
      }

      const updated = await ref.get();
      return NextResponse.json({
        success: true,
        pass: serializeCampPass(updated.id, updated.data()!),
      });
    }

    // ── Stage sign-off ────────────────────────────────────────────────────
    const stage = STAGE_BY_STATUS[status];
    if (!stage) {
      return NextResponse.json(
        {
          error: `This pass is not awaiting a decision (status: ${status}).`,
        },
        { status: 409 }
      );
    }
    if (!canActOnStage(caller, stage)) {
      return NextResponse.json(
        {
          error: `Only ${PASS_STAGE_LABEL[stage]} can action this pass at its current stage.`,
        },
        { status: 403 }
      );
    }

    const now = new Date();
    const fields = STAGE_FIELDS[stage];
    const approving = action === "APPROVE";
    const newStatus: CampPassStatus = approving
      ? PASS_STAGE_NEXT_STATUS[stage]
      : "REJECTED";

    // The Chairperson's approval is where the pass becomes real.
    const issuesPass = approving && stage === "CHAIR";
    const passCode = issuesPass ? generatePassCode() : null;

    const txn = await transitionIfStatus({
      collection: PASSES_COLLECTION,
      id,
      expectedStatus: PASS_STAGE_STATUS[stage],
      newStatus,
      actor: { uid: caller.uid, name: caller.name },
      comments,
      patch: {
        [fields.id]: caller.uid,
        [fields.name]: caller.name,
        [fields.decidedAt]: now,
        [fields.comments]: comments,
        ...(approving ? {} : { rejectedStage: stage }),
        ...(issuesPass ? { passCode, passIssuedAt: now } : {}),
      },
    });
    if (!txn.ok) {
      return NextResponse.json({ error: txn.error }, { status: txn.httpStatus });
    }

    const camperName = (pass.camperName as string) || "The camper";
    const expectedReturnAt: Date = pass.expectedReturnAt?.toDate?.() ?? new Date();

    if (approving && !issuesPass) {
      // Hand it to the next desk in the chain.
      const nextStage: CampPassStage = stage === "ADMISSIONS" ? "MANAGER" : "CHAIR";
      notifyStageApprovers({
        passId: id,
        stage: nextStage,
        camperName,
        reason: (pass.reason as string) || "",
        expectedReturnAt,
        actorName: caller.name || PASS_STAGE_LABEL[stage],
      }).catch(console.error);
    }

    let emailQueued = false;
    let emailReason: string | null = null;
    if (issuesPass) {
      // Send the ticket to the address on the registration. Email is
      // best-effort — the pass is also rendered in-app for the camper.
      const fresh = await ref.get();
      const result = await sendCampPassEmail(id, fresh.data()!);
      emailQueued = result.queued;
      emailReason = result.reason ?? null;
    }

    notifyPassRequester({
      passId: id,
      requestedByUid: (pass.requestedByUid as string | null) ?? null,
      camperName,
      stage,
      decision: approving ? "APPROVED" : "REJECTED",
      comments,
      issued: issuesPass,
    }).catch(console.error);

    const updated = await ref.get();
    return NextResponse.json({
      success: true,
      status: newStatus,
      issued: issuesPass,
      emailQueued,
      emailReason,
      pass: serializeCampPass(updated.id, updated.data()!),
    });
  } catch (error) {
    console.error("PATCH /api/camp-passes/[id]/decision error:", error);
    return NextResponse.json(
      { error: "Failed to record the decision" },
      { status: 500 }
    );
  }
}
