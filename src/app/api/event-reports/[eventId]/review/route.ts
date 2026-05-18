import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { createNotificationWithEmail } from "@/lib/notifications";
import {
  getCallerFromSession,
  serializeReport,
} from "@/lib/event-reports-helpers";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";

export const dynamic = "force-dynamic";

// ─── PATCH /api/event-reports/[eventId]/review ───
// Body: { action: "REVIEWED" | "REQUEST_CHANGES", comments?: string }
// Auth: review_event_reports feature (defaults to SUPER_ADMIN only).

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const caller = await getCallerFromSession();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canReview = await serverCheckFeatureAccess(
      "review_event_reports",
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );
    if (!canReview) {
      return NextResponse.json(
        { error: "Forbidden: Chairperson access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body?.action;
    const comments: string | null =
      typeof body?.comments === "string" && body.comments.trim()
        ? body.comments.trim()
        : null;

    if (action !== "REVIEWED" && action !== "REQUEST_CHANGES") {
      return NextResponse.json(
        { error: "Invalid action. Must be REVIEWED or REQUEST_CHANGES" },
        { status: 400 }
      );
    }
    if (action === "REQUEST_CHANGES" && !comments) {
      return NextResponse.json(
        { error: "Comments are required when requesting changes" },
        { status: 400 }
      );
    }

    const reportRef = adminDb.collection("eventReports").doc(eventId);
    const reportDoc = await reportRef.get();
    if (!reportDoc.exists) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const existing = reportDoc.data()!;
    if (existing.status !== "SUBMITTED") {
      return NextResponse.json(
        {
          error: `Report is not awaiting review (current status: ${existing.status}).`,
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const newStatus = action === "REVIEWED" ? "REVIEWED" : "CHANGES_REQUESTED";

    await reportRef.update({
      status: newStatus,
      reviewedBy: caller.uid,
      reviewedByName: caller.name,
      reviewedAt: Timestamp.fromDate(now),
      reviewComments: comments,
      updatedAt: Timestamp.fromDate(now),
    });

    // Notify the initiator
    const initiatorId: string | undefined = existing.initiatorId;
    if (initiatorId) {
      const initiatorDoc = await adminDb
        .collection("users")
        .doc(initiatorId)
        .get();
      const eventTitle = existing.eventTitle || "your event";
      const linkToEdit = `/manage/events/reports/${eventId}`;

      if (action === "REVIEWED") {
        createNotificationWithEmail({
          userId: initiatorId,
          title: "Event Report Reviewed",
          message: `Your report for "${eventTitle}" has been marked as reviewed by the Chairperson.${
            comments ? ` Notes: ${comments}` : ""
          }`,
          type: "event",
          link: linkToEdit,
          recipientEmail: initiatorDoc.data()?.email,
          email: {
            subject: `Event Report Reviewed: ${eventTitle}`,
            text: `Your post-event report for "${eventTitle}" has been marked as reviewed.${
              comments ? `\n\nNotes from the Chairperson:\n${comments}` : ""
            }`,
          },
        }).catch(console.error);
      } else {
        createNotificationWithEmail({
          userId: initiatorId,
          title: "Changes Requested on Event Report",
          message: `The Chairperson has requested changes on your report for "${eventTitle}".${
            comments ? ` Notes: ${comments}` : ""
          }`,
          type: "event",
          link: linkToEdit,
          recipientEmail: initiatorDoc.data()?.email,
          email: {
            subject: `Changes Requested: ${eventTitle} Report`,
            text: `The Chairperson has requested changes on your post-event report for "${eventTitle}".${
              comments ? `\n\nNotes:\n${comments}` : ""
            }\n\nPlease update your report and resubmit.`,
          },
        }).catch(console.error);
      }
    }

    const fresh = await reportRef.get();
    return NextResponse.json({
      report: serializeReport(fresh.id, fresh.data()),
      status: newStatus,
    });
  } catch (error) {
    console.error("PATCH /api/event-reports/[eventId]/review error:", error);
    return NextResponse.json(
      { error: "Failed to record review action" },
      { status: 500 }
    );
  }
}
