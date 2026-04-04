import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { UserRole } from "@/types";

export const dynamic = "force-dynamic";

async function getCaller(): Promise<{
  uid: string;
  role: UserRole;
} | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) return null;

    const decoded = await adminAuth.verifySessionCookie(session.value);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;

    const data = userDoc.data()!;
    return { uid: decoded.uid, role: data.role as UserRole };
  } catch {
    return null;
  }
}

const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  DEPARTMENT_LEAD: 3,
  YOUTH_LEADER: 2,
  MEMBER: 1,
};

function hasMinRole(role: string, required: string): boolean {
  return (ROLE_HIERARCHY[role] || 0) >= (ROLE_HIERARCHY[required] || 0);
}

// ─── GET /api/events/[id]/assignable-members ───
// Returns all active users that can be assigned to roles on this event.
// Access: DEPARTMENT_LEAD+

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // params is required by Next.js route signature even if unused here
  await params;

  const { searchParams } = new URL(request.url);
  const departmentId = searchParams.get("departmentId");

  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(caller.role, "DEPARTMENT_LEAD")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all users and filter/sort in application code to avoid
    // composite index dependencies and handle missing isActive fields.
    const snap = await adminDb.collection("users").get();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const users = snap.docs
      .map((doc: any) => {
        const u = doc.data();
        return {
          id: doc.id,
          name: u.name || "",
          email: u.email || "",
          phone: u.phone || null,
          role: u.role,
          departmentIds: u.departmentIds || [],
          leadsDepartmentIds: u.leadsDepartmentIds || [],
          profileImage: u.profileImage || null,
          isActive: u.isActive ?? true,
          lifeGroup: u.lifeGroup || null,
          isStudent: u.isStudent || false,
          institutionId: u.institutionId || null,
          createdAt: u.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: u.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        };
      })
      .filter((u) => u.isActive !== false)
      .filter((u) => !departmentId || u.departmentIds.includes(departmentId))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET /api/events/[id]/assignable-members error:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignable members" },
      { status: 500 }
    );
  }
}
