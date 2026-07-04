import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionCaller as getCaller } from "@/lib/server-auth";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import { notifyEventsLeadOfMediaDecision } from "@/lib/media-helpers";
import { transitionIfStatus } from "@/lib/workflow-transitions";

export const dynamic = "force-dynamic";

type Action = "CONFIRM" | "DECLINE";

// ─── PATCH /api/media-requests/[id]/confirm ───
// Body: { action, soundUserId?, soundUserName?, publicityUserId?, publicityUserName?,
//         coverageUserId?, coverageUserName?, comments? }

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
      "manage_media",
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Forbidden: Media coordinator or Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = (await request.json()) as {
      action: Action;
      soundUserId?: string;
      soundUserName?: string;
      publicityUserId?: string;
      publicityUserName?: string;
      coverageUserId?: string;
      coverageUserName?: string;
      comments?: string;
    };
    const { action } = body;

    if (action !== "CONFIRM" && action !== "DECLINE") {
      return NextResponse.json(
        { error: "Invalid action. Must be CONFIRM or DECLINE" },
        { status: 400 }
      );
    }

    const trimmedComments =
      typeof body.comments === "string" && body.comments.trim()
        ? body.comments.trim()
        : null;
    if (action === "DECLINE" && !trimmedComments) {
      return NextResponse.json(
        { error: "Comments are required for DECLINE" },
        { status: 400 }
      );
    }

    const now = new Date();
    let patch: Record<string, unknown>;
    let newStatus: "CONFIRMED" | "DECLINED";

    if (action === "CONFIRM") {
      if (
        !body.soundUserId ||
        !body.publicityUserId ||
        !body.coverageUserId
      ) {
        return NextResponse.json(
          { error: "Sound, Publicity, and Coverage must all be assigned to confirm" },
          { status: 400 }
        );
      }
      newStatus = "CONFIRMED";
      patch = {
        soundUserId: body.soundUserId,
        soundUserName: body.soundUserName || null,
        publicityUserId: body.publicityUserId,
        publicityUserName: body.publicityUserName || null,
        coverageUserId: body.coverageUserId,
        coverageUserName: body.coverageUserName || null,
        coordinatorNotes: trimmedComments,
        confirmedBy: caller.uid,
        confirmedByName: caller.name,
        confirmedAt: now,
      };
    } else {
      newStatus = "DECLINED";
      patch = {
        coordinatorNotes: trimmedComments,
        confirmedBy: caller.uid,
        confirmedByName: caller.name,
        confirmedAt: now,
      };
    }

    // Atomically guard the PENDING_MEDIA → CONFIRMED/DECLINED transition so a
    // double-submit (or two coordinators) can't both pass the status check and
    // double-notify the Events Lead.
    const result = await transitionIfStatus({
      collection: "mediaRequests",
      id,
      expectedStatus: "PENDING_MEDIA",
      newStatus,
      actor: { uid: caller.uid, name: caller.name },
      comments: trimmedComments,
      patch,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.httpStatus }
      );
    }
    const current = result.current;

    // Look up event creator for notifications
    let creatorId: string | null = null;
    try {
      const eventDoc = await adminDb.collection("events").doc(current.eventId).get();
      if (eventDoc.exists) creatorId = eventDoc.data()?.createdBy || null;
    } catch (err) {
      console.error("Failed to load event creator:", err);
    }

    notifyEventsLeadOfMediaDecision({
      eventId: current.eventId,
      eventTitle: current.eventTitle,
      eventCreatorId: creatorId,
      decision: newStatus,
      comments: trimmedComments,
    }).catch(console.error);

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error("PATCH /api/media-requests/[id]/confirm error:", error);
    return NextResponse.json(
      { error: "Failed to record media decision" },
      { status: 500 }
    );
  }
}
