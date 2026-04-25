import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
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
      departmentIds: (data.departmentIds || []) as string[],
      leadsDepartmentIds: (data.leadsDepartmentIds || []) as string[],
    };
  } catch {
    return null;
  }
}

// PATCH /api/members/[id]/institution
// Body: { institutionId: string | null, isStudent?: boolean }
//
// Lets the Campus Ministry coordinator (or anyone with manage_members access)
// fix the campus assignment of a registered student so the register stops
// showing "Unknown".
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Either a Campus Ministry lead or anyone with full member-management access
    // can patch a student's campus.
    const [canManageMembers, canCampusMinistry] = await Promise.all([
      serverCheckFeatureAccess(
        "manage_members",
        caller.role,
        caller.departmentIds,
        caller.leadsDepartmentIds
      ),
      serverCheckFeatureAccess(
        "manage_devotionals",
        caller.role,
        caller.departmentIds,
        caller.leadsDepartmentIds
      ),
    ]);

    if (!canManageMembers && !canCampusMinistry) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only the Campus Ministry coordinator or admins can update a student's campus",
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const docRef = adminDb.collection("users").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const body = await request.json();
    const institutionId: string | null =
      body.institutionId === undefined || body.institutionId === ""
        ? null
        : String(body.institutionId);

    // If we're assigning an institution, also flip isStudent to true (so the
    // student shows up in the register going forward). Allow callers to override.
    const updates: Record<string, unknown> = {
      institutionId,
      updatedAt: new Date(),
    };
    if (typeof body.isStudent === "boolean") {
      updates.isStudent = body.isStudent;
    } else if (institutionId) {
      updates.isStudent = true;
    }

    await docRef.update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/members/[id]/institution error:", error);
    return NextResponse.json(
      { error: "Failed to update institution" },
      { status: 500 }
    );
  }
}
