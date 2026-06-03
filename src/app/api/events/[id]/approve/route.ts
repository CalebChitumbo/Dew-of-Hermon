import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import { notifyApproversOfPendingEvent } from "@/lib/event-helpers";
import {
  getStakeholderBlockers,
  cancelAllStakeholderRequests,
} from "@/lib/event-stakeholders";
import { UserRole } from "@/types";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";

export const dynamic = "force-dynamic";

// ─── Helper: Get caller info from session cookie ───

async function getCaller(): Promise<{
  uid: string;
  role: UserRole;
  name: string;
  departmentIds: string[];
  leadsDepartmentIds: string[];
} | null> {
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

    const eventRef = adminDb.collection("events").doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eventData = eventDoc.data()!;
    const body = await request.json();
    const { action, comments } = body;

    if (!["APPROVE", "REJECT", "REQUEST_CHANGES"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be APPROVE, REJECT, or REQUEST_CHANGES" },
        { status: 400 }
      );
    }

    const now = new Date();
    const status = eventData.approvalStatus;

    // The Events Lead route only governs the Events-Lead stage. Once an event
    // has advanced to the Vice Chair or Chair tier, only that tier may act on
    // it (through /tier-approve) — including reject and request-changes.
    if (status !== "PENDING_DISPATCH" && status !== "PENDING_STAKEHOLDERS") {
      return NextResponse.json(
        {
          error: `This event has moved past the Events Lead stage (current status: ${status}). Only the current approver can act on it.`,
        },
        { status: 409 }
      );
    }

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

      await eventRef.update({
        approvalStatus: "PENDING_VICE_CHAIR",
        approvalComments: comments || null,
        updatedAt: now,
      });

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
      await eventRef.update({
        approvalStatus: "REJECTED",
        approvalComments: comments || null,
        updatedAt: now,
      });

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
    await eventRef.update({
      approvalStatus: "CHANGES_REQUESTED",
      approvalComments: comments || null,
      updatedAt: now,
    });

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
