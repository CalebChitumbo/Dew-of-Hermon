import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import {
  createDepartmentRoleSkeletons,
  notifyTargetedMembers,
  notifyDepartmentManagers,
  notifyApproversOfPendingEvent,
} from "@/lib/event-helpers";
import { cancelAllStakeholderRequests } from "@/lib/event-stakeholders";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import { UserRole } from "@/types";

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

    if (action === "REJECT" || action === "REQUEST_CHANGES") {
      const newStatus = action === "REJECT" ? "REJECTED" : "CHANGES_REQUESTED";
      await eventRef.update({
        approvalStatus: newStatus,
        approvalComments: comments || null,
        updatedAt: now,
      });
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
      await eventRef.update({
        approvalStatus: "PENDING_CHAIR",
        viceChairApprovedBy: caller.uid,
        viceChairApprovedAt: now,
        approvalComments: comments || null,
        updatedAt: now,
      });
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
    await eventRef.update({
      approvalStatus: "APPROVED",
      chairApprovedBy: caller.uid,
      chairApprovedAt: now,
      approvedBy: caller.uid,
      approvedAt: now,
      approvalComments: comments || null,
      updatedAt: now,
    });

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
