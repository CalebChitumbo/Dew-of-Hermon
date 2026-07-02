import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { createDepartmentRoleSkeletons } from "@/lib/event-helpers";
import { getSessionCaller as getCaller } from "@/lib/server-auth";
import { hasMinRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/[id]/department-roles/generate
 *
 * Idempotently creates the department-role skeletons for an event. Useful
 * when the auto-create on approval silently skipped departments because of
 * a name mismatch or a missing department, leaving the role board empty.
 * Returns the existing count without re-creating if any role already exists.
 *
 * Access: ADMIN+ on an event that has been APPROVED.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasMinRole(caller.role, "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const eventDoc = await adminDb.collection("events").doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const eventData = eventDoc.data()!;
    if (eventData.approvalStatus !== "APPROVED") {
      return NextResponse.json(
        {
          error:
            "Event must be approved before department roles can be generated",
        },
        { status: 400 }
      );
    }

    const existing = await adminDb
      .collection("eventDepartmentRoles")
      .where("eventId", "==", eventId)
      .limit(1)
      .get();
    if (!existing.empty) {
      return NextResponse.json({
        created: 0,
        alreadyExisted: true,
        missingDepartments: [] as string[],
      });
    }

    const result = await createDepartmentRoleSkeletons(eventId);
    return NextResponse.json({ ...result, alreadyExisted: false });
  } catch (error) {
    console.error("POST /api/events/[id]/department-roles/generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate department roles" },
      { status: 500 }
    );
  }
}
