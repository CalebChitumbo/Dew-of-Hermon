import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import {
  transitionMediaRequest,
  notifyEventsLeadOfMediaDecision,
} from "@/lib/media-helpers";
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

    const requestRef = adminDb.collection("mediaRequests").doc(id);
    const requestDoc = await requestRef.get();
    if (!requestDoc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const current = requestDoc.data()!;
    if (current.status !== "PENDING_MEDIA") {
      return NextResponse.json(
        {
          error: `Cannot act on request in status ${current.status}; must be PENDING_MEDIA`,
        },
        { status: 409 }
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

    await transitionMediaRequest(
      id,
      newStatus,
      { uid: caller.uid, name: caller.name },
      trimmedComments,
      patch
    );

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
