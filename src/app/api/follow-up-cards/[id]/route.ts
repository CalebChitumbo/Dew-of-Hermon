import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import { UserRole, FollowUpStatus } from "@/types";

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
      departmentIds: (data.departmentIds || []) as string[],
      leadsDepartmentIds: (data.leadsDepartmentIds || []) as string[],
    };
  } catch {
    return null;
  }
}

// Status progression order
const STATUS_ORDER: FollowUpStatus[] = [
  "NEW_CONTACT",
  "ASSIGNED",
  "CONTACTED",
  "FIRST_VISIT",
  "REGULAR_ATTENDEE",
  "MEMBER",
];

function isValidTransition(
  currentStatus: FollowUpStatus,
  newStatus: FollowUpStatus
): boolean {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const newIndex = STATUS_ORDER.indexOf(newStatus);
  // Can only move forward or stay at the same status
  return newIndex >= currentIndex;
}

// ─── GET /api/follow-up-cards/[id] ───

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const doc = await adminDb.collection("followUpCards").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Follow-up card not found" },
        { status: 404 }
      );
    }

    const data = doc.data()!;
    return NextResponse.json({
      card: {
        id: doc.id,
        name: data.name,
        phone: data.phone || "",
        source: data.source,
        sourceDetail: data.sourceDetail || "",
        status: data.status,
        reason: data.reason || null,
        notes: data.notes || "",
        dateOfContact: data.dateOfContact?.toDate?.()?.toISOString() || null,
        assigneeId: data.assigneeId || null,
        assigneeName: data.assigneeName || null,
        createdBy: data.createdBy || "",
        createdByName: data.createdByName || "",
        statusHistory: (data.statusHistory || []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (h: any) => ({
            status: h.status,
            changedBy: h.changedBy,
            changedAt: h.changedAt?.toDate?.()?.toISOString() || null,
          })
        ),
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("GET /api/follow-up-cards/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch follow-up card" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/follow-up-cards/[id] ───
// Body: { status?, assigneeId?, assigneeName?, notes? }

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Determine the caller's level of access
    const [canManage, canViewAssigned] = await Promise.all([
      serverCheckFeatureAccess(
        "manage_follow_ups",
        caller.role,
        caller.departmentIds,
        caller.leadsDepartmentIds
      ),
      serverCheckFeatureAccess(
        "view_assigned_follow_ups",
        caller.role,
        caller.departmentIds,
        caller.leadsDepartmentIds
      ),
    ]);

    if (!canManage && !canViewAssigned) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to update follow-up cards" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const doc = await adminDb.collection("followUpCards").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Follow-up card not found" },
        { status: 404 }
      );
    }

    const currentData = doc.data()!;

    // Assignee-only viewers (e.g. Youth Leaders) may only edit cards assigned to them
    if (!canManage && currentData.assigneeId !== caller.uid) {
      return NextResponse.json(
        { error: "Forbidden: You can only update cards assigned to you" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, assigneeId, assigneeName, notes } = body;

    // Assignee-only viewers cannot reassign cards
    if (!canManage && assigneeId !== undefined && assigneeId !== caller.uid) {
      return NextResponse.json(
        { error: "Forbidden: You cannot reassign this card" },
        { status: 403 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    const statusLabels: Record<FollowUpStatus, string> = {
      NEW_CONTACT: "New Contact",
      ASSIGNED: "Assigned",
      CONTACTED: "Contacted",
      FIRST_VISIT: "First Visit",
      REGULAR_ATTENDEE: "Regular Attendee",
      MEMBER: "Member",
    };

    // Validate explicit status transition
    if (status && status !== currentData.status) {
      if (!isValidTransition(currentData.status, status)) {
        return NextResponse.json(
          {
            error: `Invalid status transition: cannot go from ${currentData.status} to ${status}. Status can only move forward.`,
          },
          { status: 400 }
        );
      }

      updates.status = status;
      updates.statusHistory = [
        ...(currentData.statusHistory || []),
        {
          status,
          changedBy: caller.uid,
          changedAt: new Date(),
        },
      ];

      // Notify the card creator about status change
      if (currentData.createdBy && currentData.createdBy !== caller.uid) {
        createNotificationWithEmail({
          userId: currentData.createdBy,
          title: "Follow-Up Status Updated",
          message: `${currentData.name} has been moved to "${statusLabels[status as FollowUpStatus]}" by ${caller.name}.`,
          type: "announcement",
          link: "/department/discipleship",
        }).catch(console.error);
      }
    }

    if (assigneeId !== undefined) {
      const newAssigneeId: string | null = assigneeId || null;
      updates.assigneeId = newAssigneeId;
      updates.assigneeName = assigneeName || null;

      const previousAssigneeId: string | null = currentData.assigneeId || null;
      const isFirstAssignment =
        newAssigneeId && newAssigneeId !== previousAssigneeId;

      // When the card is first assigned (or reassigned) and we haven't already
      // moved past the ASSIGNED stage, advance the status to ASSIGNED so it
      // shows up in the assignee's queue and out of the "new" pipeline column.
      if (
        isFirstAssignment &&
        currentData.status === "NEW_CONTACT" &&
        !updates.status
      ) {
        updates.status = "ASSIGNED" as FollowUpStatus;
        updates.statusHistory = [
          ...(currentData.statusHistory || []),
          {
            status: "ASSIGNED" as FollowUpStatus,
            changedBy: caller.uid,
            changedAt: new Date(),
          },
        ];
      }

      // Notify the assignee
      if (newAssigneeId && newAssigneeId !== caller.uid) {
        createNotificationWithEmail({
          userId: newAssigneeId,
          title: "Follow-Up Card Assigned",
          message: `You have been assigned to follow up with ${currentData.name}.`,
          type: "assignment",
          link: "/department/discipleship",
        }).catch(console.error);
      }
    }

    if (notes !== undefined) {
      updates.notes = notes;
    }

    await adminDb.collection("followUpCards").doc(id).update(updates);

    // Return flag when status reaches MEMBER
    const reachedMember =
      status === "MEMBER" && currentData.status !== "MEMBER";

    return NextResponse.json({
      success: true,
      reachedMember,
      memberRegistrationLink: reachedMember
        ? `/manage/members/new?prefillName=${encodeURIComponent(currentData.name)}&prefillPhone=${encodeURIComponent(currentData.phone || "")}`
        : null,
    });
  } catch (error) {
    console.error("PATCH /api/follow-up-cards/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update follow-up card" },
      { status: 500 }
    );
  }
}
