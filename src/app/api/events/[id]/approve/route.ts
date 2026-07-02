import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import { notifyApproversOfPendingEvent } from "@/lib/event-helpers";
import {
  getStakeholderBlockers,
  cancelAllStakeholderRequests,
} from "@/lib/event-stakeholders";
import { getSessionCaller as getCaller } from "@/lib/server-auth";
import { transitionIfStatus } from "@/lib/workflow-transitions";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";

export const dynamic = "force-dynamic";

const EVENTS_LEAD_STAGES = ["PENDING_DISPATCH", "PENDING_STAKEHOLDERS"];

// ─── PATCH /api/events/[id]/approve ───
// Events Lead action. Body: { action: "APPROVE" | "REJECT" | "REQUEST_CHANGES", comments? }
// APPROVE requires all flagged stakeholders confirmed, then advances the event
// to PENDING_VICE_CHAIR (it no longer publishes the event).

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

    const canApprove = await serverCheckFeatureAccess(
      "approve_events",
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );
    if (!canApprove) {
      return NextResponse.json(
        { error: "Forbidden: Events Lead or Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, comments } = body;

    if (!["APPROVE", "REJECT", "REQUEST_CHANGES"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be APPROVE, REJECT, or REQUEST_CHANGES" },
        { status: 400 }
      );
    }

    // The Events Lead route only governs the Events-Lead stage. Once an event
    // has advanced to the Vice Chair or Chair tier, only that tier may act on
    // it (through /tier-approve) — including reject and request-changes.
    // The status guard + write happens inside a transaction so two concurrent
    // approvers can't double-apply.

    if (action === "APPROVE") {
      // Every flagged stakeholder must be confirmed/approved first.
      const blockers = await getStakeholderBlockers(eventId);
      if (blockers.length > 0) {
        return NextResponse.json(
          {
            error: `Cannot approve yet: ${blockers.join(" ")}`,
            blockers,
          },
          { status: 409 }
        );
      }

      const txn = await transitionIfStatus({
        collection: "events",
        id: eventId,
        expectedStatus: EVENTS_LEAD_STAGES,
        newStatus: "PENDING_VICE_CHAIR",
        actor: { uid: caller.uid, name: caller.name },
        statusField: "approvalStatus",
        historyField: null,
        patch: { approvalComments: comments || null },
      });
      if (!txn.ok) {
        return NextResponse.json({ error: txn.error }, { status: txn.httpStatus });
      }
      const eventData = txn.current;

      // Notify the Vice Chairperson queue.
      notifyApproversOfPendingEvent(eventData.title, "VICE_CHAIR").catch(
        console.error
      );

      // Notify event creator that it passed coordinator review.
      const creatorId = eventData.createdBy;
      if (creatorId) {
        const creatorDoc = await adminDb.collection("users").doc(creatorId).get();
        if (creatorDoc.exists) {
          await createNotificationWithEmail({
            userId: creatorId,
            title: "Event Passed Coordinator Review",
            message: `Your event "${eventData.title}" has passed Events Lead review and is now awaiting Vice Chairperson approval.`,
            type: "event",
            link: "/calendar",
            recipientEmail: creatorDoc.data()?.email,
            email: {
              subject: `Event Update: ${eventData.title}`,
              text: `Your event "${eventData.title}" has passed Events Lead review and is awaiting Vice Chairperson approval.`,
            },
          }).catch(console.error);
        }
      }

      return NextResponse.json({ success: true, approvalStatus: "PENDING_VICE_CHAIR" });
    }

    if (action === "REJECT") {
      const txn = await transitionIfStatus({
        collection: "events",
        id: eventId,
        expectedStatus: EVENTS_LEAD_STAGES,
        newStatus: "REJECTED",
        actor: { uid: caller.uid, name: caller.name },
        statusField: "approvalStatus",
        historyField: null,
        patch: { approvalComments: comments || null },
      });
      if (!txn.ok) {
        return NextResponse.json({ error: txn.error }, { status: txn.httpStatus });
      }
      const eventData = txn.current;

      await cancelAllStakeholderRequests(
        eventId,
        { uid: caller.uid, name: caller.name },
        comments || "Parent event was rejected."
      );

      const creatorId = eventData.createdBy;
      if (creatorId) {
        const creatorDoc = await adminDb.collection("users").doc(creatorId).get();
        if (creatorDoc.exists) {
          await createNotificationWithEmail({
            userId: creatorId,
            title: "Event Not Approved",
            message: `Your event "${eventData.title}" was not approved.${comments ? ` Reason: ${comments}` : ""}`,
            type: "event",
            link: "/manage/events/new",
            recipientEmail: creatorDoc.data()?.email,
            email: {
              subject: `Event Not Approved: ${eventData.title}`,
              text: `Your event "${eventData.title}" was not approved.${comments ? `\n\nReason: ${comments}` : ""}`,
            },
          }).catch(console.error);
        }
      }

      return NextResponse.json({ success: true, approvalStatus: "REJECTED" });
    }

    // REQUEST_CHANGES
    const txn = await transitionIfStatus({
      collection: "events",
      id: eventId,
      expectedStatus: EVENTS_LEAD_STAGES,
      newStatus: "CHANGES_REQUESTED",
      actor: { uid: caller.uid, name: caller.name },
      statusField: "approvalStatus",
      historyField: null,
      patch: { approvalComments: comments || null },
    });
    if (!txn.ok) {
      return NextResponse.json({ error: txn.error }, { status: txn.httpStatus });
    }
    const eventData = txn.current;

    const creatorId = eventData.createdBy;
    if (creatorId) {
      const creatorDoc = await adminDb.collection("users").doc(creatorId).get();
      if (creatorDoc.exists) {
        await createNotificationWithEmail({
          userId: creatorId,
          title: "Changes Requested for Your Event",
          message: `Changes have been requested for "${eventData.title}".${comments ? ` Notes: ${comments}` : ""}`,
          type: "event",
          link: "/manage/events/new",
          recipientEmail: creatorDoc.data()?.email,
          email: {
            subject: `Changes Requested: ${eventData.title}`,
            text: `The Events & Fellowship team has requested changes to your event "${eventData.title}".${comments ? `\n\nNotes: ${comments}` : ""}`,
          },
        }).catch(console.error);
      }
    }

    return NextResponse.json({ success: true, approvalStatus: "CHANGES_REQUESTED" });
  } catch (error) {
    console.error("PATCH /api/events/[id]/approve error:", error);
    return NextResponse.json(
      { error: "Failed to process approval action" },
      { status: 500 }
    );
  }
}
