import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createDepartmentRoleSkeletons } from "@/lib/event-helpers";
import { UserRole } from "@/types";

export const dynamic = "force-dynamic";

const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 6,
  VICE_CHAIRPERSON: 5,
  ADMIN: 4,
  DEPARTMENT_LEAD: 3,
  YOUTH_LEADER: 2,
  MEMBER: 1,
};

async function getCaller(): Promise<{ uid: string; role: UserRole } | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) return null;
    const decoded = await adminAuth.verifySessionCookie(session.value);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    return {
      uid: decoded.uid,
      role: userDoc.data()!.role as UserRole,
    };
  } catch {
    return null;
  }
}

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
    if ((ROLE_HIERARCHY[caller.role] || 0) < ROLE_HIERARCHY.ADMIN) {
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
