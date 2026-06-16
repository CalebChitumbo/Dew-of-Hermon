import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import { DepartmentJoinRequestStatus, UserRole } from "@/types";

export const dynamic = "force-dynamic";

const QUEUE_LINK = "/manage/department-requests";

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
      name: (data.name as string) || "",
      email: (data.email as string) || null,
      departmentIds: (data.departmentIds || []) as string[],
      leadsDepartmentIds: (data.leadsDepartmentIds || []) as string[],
    };
  } catch {
    return null;
  }
}

const ACTIVE_STATUSES: DepartmentJoinRequestStatus[] = [
  "PENDING_MANAGER",
  "PENDING_CHAIR",
];

// POST /api/department-join-requests
// Body: { departmentId: string, message?: string }
// A member requests to join a department. Routes to the department's
// manager(s) for a recommendation, or straight to the Chairperson when the
// department has no manager assigned.
export async function POST(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const departmentId = (body.departmentId as string | undefined)?.trim();
    const message = (body.message as string | undefined)?.trim() || null;

    if (!departmentId) {
      return NextResponse.json(
        { error: "departmentId is required" },
        { status: 400 }
      );
    }

    const deptDoc = await adminDb
      .collection("departments")
      .doc(departmentId)
      .get();
    if (!deptDoc.exists) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }
    const departmentName = (deptDoc.data()!.name as string) || "Department";

    // Already a member?
    if (caller.departmentIds.includes(departmentId)) {
      return NextResponse.json(
        { error: "You are already a member of this department" },
        { status: 400 }
      );
    }

    // Already has an open request for this department?
    const existing = await adminDb
      .collection("departmentJoinRequests")
      .where("userId", "==", caller.uid)
      .where("departmentId", "==", departmentId)
      .get();
    const hasOpen = existing.docs.some((d) =>
      ACTIVE_STATUSES.includes(d.data().status as DepartmentJoinRequestStatus)
    );
    if (hasOpen) {
      return NextResponse.json(
        { error: "You already have a pending request for this department" },
        { status: 400 }
      );
    }

    // Find the department's active managers (leads).
    const leadsSnap = await adminDb
      .collection("users")
      .where("leadsDepartmentIds", "array-contains", departmentId)
      .get();
    const managers = leadsSnap.docs.filter(
      (d) => d.data().isActive !== false && d.id !== caller.uid
    );
    const hasManager = managers.length > 0;

    const now = new Date();
    const status: DepartmentJoinRequestStatus = hasManager
      ? "PENDING_MANAGER"
      : "PENDING_CHAIR";
    const initialComment = hasManager
      ? message
      : message
        ? `${message} (No department manager assigned — routed to the Chairperson.)`
        : "No department manager assigned — routed to the Chairperson.";

    const ref = await adminDb.collection("departmentJoinRequests").add({
      departmentId,
      departmentName,
      userId: caller.uid,
      userName: caller.name,
      userEmail: caller.email,
      message,
      status,
      managerId: null,
      managerName: null,
      managerDecidedAt: null,
      managerComments: null,
      chairId: null,
      chairName: null,
      chairDecidedAt: null,
      chairComments: null,
      statusHistory: [
        {
          status,
          changedBy: caller.uid,
          changedByName: caller.name,
          changedAt: now,
          comments: initialComment,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    // Notify the right approvers.
    if (hasManager) {
      for (const managerDoc of managers) {
        createNotificationWithEmail({
          userId: managerDoc.id,
          title: "New Department Join Request",
          message: `${caller.name} has requested to join ${departmentName}. Review and recommend their request.`,
          type: "announcement",
          link: QUEUE_LINK,
          recipientEmail: managerDoc.data().email,
          email: {
            subject: `Join request for ${departmentName}`,
            text: `${caller.name} has requested to join ${departmentName}.${
              message ? `\n\nTheir note: "${message}"` : ""
            }\n\nReview and recommend the request in the Join Requests queue.`,
          },
        }).catch(console.error);
      }
    } else {
      const chairsSnap = await adminDb
        .collection("users")
        .where("role", "==", "SUPER_ADMIN")
        .get();
      for (const chairDoc of chairsSnap.docs) {
        if (chairDoc.data().isActive === false) continue;
        createNotificationWithEmail({
          userId: chairDoc.id,
          title: "New Department Join Request",
          message: `${caller.name} has requested to join ${departmentName}, which has no manager assigned. It awaits your final approval.`,
          type: "announcement",
          link: QUEUE_LINK,
          recipientEmail: chairDoc.data().email,
          email: {
            subject: `Join request for ${departmentName}`,
            text: `${caller.name} has requested to join ${departmentName}. This department has no manager assigned, so the request has come straight to you for final approval.`,
          },
        }).catch(console.error);
      }
    }

    return NextResponse.json({ success: true, id: ref.id, status });
  } catch (error) {
    console.error("POST /api/department-join-requests error:", error);
    return NextResponse.json(
      { error: "Failed to submit join request" },
      { status: 500 }
    );
  }
}
