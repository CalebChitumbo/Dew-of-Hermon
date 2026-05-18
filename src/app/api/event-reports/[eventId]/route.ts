import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  getCallerFromSession,
  serializeReport,
  effectiveEndDate,
  sanitizeQuestionnaire,
  validateForSubmit,
  readEventForReport,
} from "@/lib/event-reports-helpers";
import { notifyChairpersonsOfReportSubmission } from "@/lib/event-helpers";
import { UserRole } from "@/types";

export const dynamic = "force-dynamic";

const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN"];

// ─── GET /api/event-reports/[eventId] ───
// Returns the report for the event, or 404 if not yet created.
// Access: initiator OR ADMIN/SUPER_ADMIN.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const caller = await getCallerFromSession();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reportRef = adminDb.collection("eventReports").doc(eventId);
    const reportDoc = await reportRef.get();

    if (!reportDoc.exists) {
      return NextResponse.json({ report: null }, { status: 200 });
    }

    const data = reportDoc.data()!;
    const isInitiator = data.initiatorId === caller.uid;
    const isAdmin = ADMIN_ROLES.includes(caller.role);
    if (!isInitiator && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      report: serializeReport(reportDoc.id, data),
    });
  } catch (error) {
    console.error("GET /api/event-reports/[eventId] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch event report" },
      { status: 500 }
    );
  }
}

// ─── PUT /api/event-reports/[eventId] ───
// Body: { action: "SAVE_DRAFT" | "SUBMIT", payload: <questionnaire fields> }
// Auth: caller must equal event.createdBy (or ADMIN+ acting on behalf).
// Validation: event endDate (or startDate fallback) must be in the past.

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const caller = await getCallerFromSession();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const action = body?.action;
    if (action !== "SAVE_DRAFT" && action !== "SUBMIT") {
      return NextResponse.json(
        { error: "Invalid action. Must be SAVE_DRAFT or SUBMIT" },
        { status: 400 }
      );
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const event = readEventForReport(eventDoc);

    const isInitiator = event.createdBy === caller.uid;
    const isAdmin = ADMIN_ROLES.includes(caller.role);
    if (!isInitiator && !isAdmin) {
      return NextResponse.json(
        { error: "Only the event initiator can submit this report" },
        { status: 403 }
      );
    }

    const effectiveEnd = effectiveEndDate(eventDoc.data());
    const now = new Date();
    if (!effectiveEnd || effectiveEnd > now) {
      return NextResponse.json(
        {
          error:
            "Reports become available once the event has ended. Please submit after the event's end date.",
        },
        { status: 400 }
      );
    }

    const sanitized = sanitizeQuestionnaire(body.payload);
    if (!sanitized.ok) {
      return NextResponse.json({ error: sanitized.error }, { status: 400 });
    }

    if (action === "SUBMIT") {
      const validationError = validateForSubmit(sanitized.value);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }

    const reportRef = adminDb.collection("eventReports").doc(eventId);
    const reportDoc = await reportRef.get();
    const existing = reportDoc.exists ? reportDoc.data()! : null;

    if (existing) {
      if (existing.status === "REVIEWED") {
        return NextResponse.json(
          {
            error:
              "This report has already been reviewed. Contact the Chairperson to reopen it.",
          },
          { status: 400 }
        );
      }
      if (existing.status === "SUBMITTED" && action === "SUBMIT") {
        return NextResponse.json(
          { error: "Report is already submitted and pending review." },
          { status: 400 }
        );
      }
    }

    const newStatus: "DRAFT" | "SUBMITTED" =
      action === "SUBMIT" ? "SUBMITTED" : "DRAFT";

    const payload = sanitized.value;
    const baseUpdate = {
      // Always-fresh denormalized event metadata
      eventId,
      eventTitle: event.title,
      eventStartDate: event.startDate
        ? Timestamp.fromDate(event.startDate)
        : null,
      eventEndDate: event.endDate ? Timestamp.fromDate(event.endDate) : null,
      eventType: event.type,
      createdByDepartmentId: event.createdByDepartmentId,
      // Questionnaire
      attendanceCount: payload.attendanceCount,
      objectivesMetRating: payload.objectivesMetRating,
      highlights: payload.highlights,
      challenges: payload.challenges,
      lessonsLearned: payload.lessonsLearned,
      recommendations: payload.recommendations,
      finances: payload.finances,
      mediaLink: payload.mediaLink,
      additionalComments: payload.additionalComments,
      // Workflow
      status: newStatus,
      submittedAt:
        newStatus === "SUBMITTED"
          ? Timestamp.fromDate(now)
          : existing?.submittedAt ?? null,
      updatedAt: Timestamp.fromDate(now),
    };

    if (!existing) {
      await reportRef.set({
        ...baseUpdate,
        initiatorId: event.createdBy,
        initiatorName: caller.name,
        initiatorEmail: caller.email,
        reviewedBy: null,
        reviewedByName: null,
        reviewedAt: null,
        reviewComments: null,
        createdAt: Timestamp.fromDate(now),
      });
    } else {
      // If transitioning out of CHANGES_REQUESTED via SUBMIT, clear stale review state
      const reviewReset =
        action === "SUBMIT" && existing.status === "CHANGES_REQUESTED"
          ? {
              reviewedBy: null,
              reviewedByName: null,
              reviewedAt: null,
              reviewComments: null,
            }
          : {};
      await reportRef.update({
        ...baseUpdate,
        ...reviewReset,
      });
    }

    if (action === "SUBMIT") {
      notifyChairpersonsOfReportSubmission(
        eventId,
        event.title,
        caller.name
      ).catch(console.error);
    }

    const fresh = await reportRef.get();
    return NextResponse.json({
      report: serializeReport(fresh.id, fresh.data()),
      action,
    });
  } catch (error) {
    console.error("PUT /api/event-reports/[eventId] error:", error);
    return NextResponse.json(
      { error: "Failed to save event report" },
      { status: 500 }
    );
  }
}
