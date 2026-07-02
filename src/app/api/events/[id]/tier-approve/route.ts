import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import {
  createDepartmentRoleSkeletons,
  notifyTargetedMembers,
  notifyDepartmentManagers,
  notifyApproversOfPendingEvent,
} from "@/lib/event-helpers";
import { cancelAllStakeholderRequests } from "@/lib/event-stakeholders";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import { getSessionCaller as getCaller } from "@/lib/server-auth";
import { transitionIfStatus } from "@/lib/workflow-transitions";

export const dynamic = "force-dynamic";

async function notifyCreator(
  eventData: FirebaseFirestore.DocumentData,
  title: string,
  message: string,
  link: string
) {
  const creatorId = eventData.createdBy;
  if (!creatorId) return;
  const creatorDoc = await adminDb.collection("users").doc(creatorId).get();
  if (!creatorDoc.exists) return;
  await createNotificationWithEmail({
    userId: creatorId,
    title,
    message,
    type: "event",
    link,
    recipientEmail: creatorDoc.data()?.email,
    email: { subject: `${title}: ${eventData.title}`, text: message },
  }).catch(console.error);
}

// ─── PATCH /api/events/[id]/tier-approve ───
// Vice Chairperson (PENDING_VICE_CHAIR) and Chairperson (PENDING_CHAIR) action.
// Body: { action: "APPROVE" | "REJECT" | "REQUEST_CHANGES", comments? }

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const eventData = eventDoc.data()!;
    const status = eventData.approvalStatus;

    const body = await request.json();
    const { action, comments } = body;
    if (!["APPROVE", "REJECT", "REQUEST_CHANGES"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be APPROVE, REJECT, or REQUEST_CHANGES" },
        { status: 400 }
      );
    }

    // Determine which tier the caller is acting on, based on the event's status.
    let tier: "VICE_CHAIR" | "CHAIR";
    if (status === "PENDING_VICE_CHAIR") {
      tier = "VICE_CHAIR";
    } else if (status === "PENDING_CHAIR") {
      tier = "CHAIR";
    } else {
      return NextResponse.json(
        {
          error: `This event is not awaiting executive approval (current status: ${status}).`,
        },
        { status: 409 }
      );
    }

    const featureKey =
      tier === "VICE_CHAIR" ? "vice_chair_approve_events" : "chair_approve_events";
    const allowed = await serverCheckFeatureAccess(
      featureKey,
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            tier === "VICE_CHAIR"
              ? "Forbidden: Vice Chairperson access required"
              : "Forbidden: Chairperson access required",
        },
        { status: 403 }
      );
    }

    const now = new Date();

    // The pre-read above only chose the tier + permission check; the actual
    // status guard + write happens atomically so two concurrent approvers
    // can't double-apply a transition.
    const expectedStatus =
      tier === "VICE_CHAIR" ? "PENDING_VICE_CHAIR" : "PENDING_CHAIR";

    if (action === "REJECT" || action === "REQUEST_CHANGES") {
      const newStatus = action === "REJECT" ? "REJECTED" : "CHANGES_REQUESTED";
      const txn = await transitionIfStatus({
        collection: "events",
        id: eventId,
        expectedStatus,
        newStatus,
        actor: { uid: caller.uid, name: caller.name },
        statusField: "approvalStatus",
        historyField: null,
        patch: { approvalComments: comments || null },
      });
      if (!txn.ok) {
        return NextResponse.json({ error: txn.error }, { status: txn.httpStatus });
      }
      if (action === "REJECT") {
        await cancelAllStakeholderRequests(
          eventId,
          { uid: caller.uid, name: caller.name },
          comments || "Event was rejected."
        );
      }
      await notifyCreator(
        eventData,
        action === "REJECT" ? "Event Not Approved" : "Changes Requested for Your Event",
        action === "REJECT"
          ? `Your event "${eventData.title}" was not approved.${comments ? ` Reason: ${comments}` : ""}`
          : `Changes have been requested for "${eventData.title}".${comments ? ` Notes: ${comments}` : ""}`,
        "/manage/events/new"
      );
      return NextResponse.json({ success: true, approvalStatus: newStatus });
    }

    // APPROVE
    if (tier === "VICE_CHAIR") {
      const txn = await transitionIfStatus({
        collection: "events",
        id: eventId,
        expectedStatus,
        newStatus: "PENDING_CHAIR",
        actor: { uid: caller.uid, name: caller.name },
        statusField: "approvalStatus",
        historyField: null,
        patch: {
          viceChairApprovedBy: caller.uid,
          viceChairApprovedAt: now,
          approvalComments: comments || null,
        },
      });
      if (!txn.ok) {
        return NextResponse.json({ error: txn.error }, { status: txn.httpStatus });
      }
      notifyApproversOfPendingEvent(eventData.title, "CHAIR").catch(console.error);
      await notifyCreator(
        eventData,
        "Event Passed Vice Chair Approval",
        `Your event "${eventData.title}" has passed Vice Chairperson approval and is awaiting the Chairperson's final approval.`,
        "/calendar"
      );
      return NextResponse.json({ success: true, approvalStatus: "PENDING_CHAIR" });
    }

    // tier === "CHAIR" → final approval publishes the event.
    const txn = await transitionIfStatus({
      collection: "events",
      id: eventId,
      expectedStatus,
      newStatus: "APPROVED",
      actor: { uid: caller.uid, name: caller.name },
      statusField: "approvalStatus",
      historyField: null,
      patch: {
        chairApprovedBy: caller.uid,
        chairApprovedAt: now,
        approvedBy: caller.uid,
        approvedAt: now,
        approvalComments: comments || null,
      },
    });
    if (!txn.ok) {
      return NextResponse.json({ error: txn.error }, { status: txn.httpStatus });
    }

    // Publish side-effects (only now does the event go live).
    createDepartmentRoleSkeletons(eventId).catch(console.error);
    notifyDepartmentManagers(eventId, eventData.title).catch(console.error);
    notifyTargetedMembers(
      eventId,
      eventData.title,
      eventData.lifeGroupTarget || null
    ).catch(console.error);
    await notifyCreator(
      eventData,
      "Event Approved",
      `Your event "${eventData.title}" has been approved and is now visible on the calendar.`,
      "/calendar"
    );

    return NextResponse.json({ success: true, approvalStatus: "APPROVED" });
  } catch (error) {
    console.error("PATCH /api/events/[id]/tier-approve error:", error);
    return NextResponse.json(
      { error: "Failed to process approval action" },
      { status: 500 }
    );
  }
}
