import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import {
  createDepartmentRoleSkeletons,
  notifyTargetedMembers,
  notifyDepartmentManagers,
} from "@/lib/event-helpers";
import { cancelTransportRequestForEvent } from "@/lib/transport-helpers";
import { cancelBudgetRequestForEvent } from "@/lib/budget-helpers";
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
// Body: { action: "APPROVE" | "REJECT" | "REQUEST_CHANGES", comments?: string }

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
        { error: "Forbidden: Events & Fellowship Manager or Admin access required" },
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

    if (action === "APPROVE") {
      // Block approval when transport is required but not yet approved.
      if (eventData.transportRequired) {
        const reqId = eventData.transportRequestId;
        if (!reqId) {
          return NextResponse.json(
            {
              error:
                "This event needs transport. Notify the Transport Coordinator before approving.",
            },
            { status: 409 }
          );
        }
        const reqDoc = await adminDb
          .collection("transportRequests")
          .doc(reqId)
          .get();
        const reqStatus = reqDoc.exists ? reqDoc.data()?.status : null;
        if (reqStatus !== "APPROVED") {
          return NextResponse.json(
            {
              error: `Transport request is not yet treasurer-approved (current status: ${reqStatus ?? "missing"}).`,
            },
            { status: 409 }
          );
        }
      }

      // Block approval when the event requested funds but the treasurer
      // hasn't decided yet. Once decided (APPROVED or REJECTED), the events
      // coordinator can proceed and weigh the outcome themselves.
      if (eventData.budgetRequested) {
        const reqId = eventData.budgetRequestId;
        if (!reqId) {
          return NextResponse.json(
            {
              error:
                "This event has a pending budget request but no request was created. Please contact an administrator.",
            },
            { status: 409 }
          );
        }
        const reqDoc = await adminDb
          .collection("budgetRequests")
          .doc(reqId)
          .get();
        const reqStatus = reqDoc.exists ? reqDoc.data()?.status : null;
        if (reqStatus === "PENDING_TREASURER") {
          return NextResponse.json(
            { error: "Budget request is still awaiting the treasurer's review." },
            { status: 409 }
          );
        }
      }

      await eventRef.update({
        approvalStatus: "APPROVED",
        approvedBy: caller.uid,
        approvedAt: now,
        approvalComments: comments || null,
        updatedAt: now,
      });

      // Auto-create department role skeletons
      createDepartmentRoleSkeletons(eventId).catch(console.error);

      // Notify department managers
      notifyDepartmentManagers(eventId, eventData.title).catch(console.error);

      // Notify targeted members about the new event
      notifyTargetedMembers(
        eventId,
        eventData.title,
        eventData.lifeGroupTarget || null
      ).catch(console.error);

      // Notify event creator
      const creatorId = eventData.createdBy;
      if (creatorId) {
        const creatorDoc = await adminDb.collection("users").doc(creatorId).get();
        if (creatorDoc.exists) {
          await createNotificationWithEmail({
            userId: creatorId,
            title: "Event Approved",
            message: `Your event "${eventData.title}" has been approved and is now visible on the calendar.`,
            type: "event",
            link: "/calendar",
            recipientEmail: creatorDoc.data()?.email,
            email: {
              subject: `Event Approved: ${eventData.title}`,
              text: `Great news! Your event "${eventData.title}" has been approved and will appear on the calendar.`,
            },
          }).catch(console.error);
        }
      }

      return NextResponse.json({ success: true, approvalStatus: "APPROVED" });
    }

    if (action === "REJECT") {
      await eventRef.update({
        approvalStatus: "REJECTED",
        approvalComments: comments || null,
        updatedAt: now,
      });

      // Cascade-cancel any linked transport request
      if (eventData.transportRequired && eventData.transportRequestId) {
        cancelTransportRequestForEvent(
          eventId,
          { uid: caller.uid, name: caller.name },
          comments || "Parent event was rejected."
        ).catch(console.error);
      }

      // Cascade-cancel any linked budget request
      if (eventData.budgetRequested && eventData.budgetRequestId) {
        cancelBudgetRequestForEvent(
          eventId,
          { uid: caller.uid, name: caller.name },
          comments || "Parent event was rejected."
        ).catch(console.error);
      }

      // Notify event creator
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

    // Notify event creator
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
