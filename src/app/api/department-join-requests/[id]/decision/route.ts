import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import { hasMinRole } from "@/lib/permissions";
import { DepartmentJoinRequestStatus, UserRole } from "@/types";

export const dynamic = "force-dynamic";

const MEMBER_LINK = "/department/join";
const QUEUE_LINK = "/manage/department-requests";

type DecisionAction =
  | "RECOMMEND"
  | "DECLINE"
  | "APPROVE"
  | "REJECT"
  | "CANCEL";

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
      leadsDepartmentIds: (data.leadsDepartmentIds || []) as string[],
    };
  } catch {
    return null;
  }
}

// POST /api/department-join-requests/[id]/decision
// Body: { action: "RECOMMEND" | "DECLINE" | "APPROVE" | "REJECT" | "CANCEL", comments?: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action as DecisionAction | undefined;
    const comments = (body.comments as string | undefined)?.trim() || null;

    if (
      !action ||
      !["RECOMMEND", "DECLINE", "APPROVE", "REJECT", "CANCEL"].includes(action)
    ) {
      return NextResponse.json(
        {
          error:
            "Body must include action: RECOMMEND, DECLINE, APPROVE, REJECT, or CANCEL",
        },
        { status: 400 }
      );
    }

    const { id } = await params;
    const docRef = adminDb.collection("departmentJoinRequests").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Join request not found" },
        { status: 404 }
      );
    }

    const req = doc.data()!;
    const reqStatus = req.status as DepartmentJoinRequestStatus;
    const departmentId = req.departmentId as string;
    const departmentName = (req.departmentName as string) || "the department";
    const requesterId = req.userId as string;
    const requesterName = (req.userName as string) || "The member";

    const leadsThisDept = caller.leadsDepartmentIds.includes(departmentId);
    const isManagerForDept = leadsThisDept || hasMinRole(caller.role, "ADMIN");
    const isChair = caller.role === "SUPER_ADMIN";

    const now = new Date();
    const history = (req.statusHistory || []) as Array<unknown>;

    // ── Manager stage ─────────────────────────────────────────────────────
    if (action === "RECOMMEND" || action === "DECLINE") {
      if (reqStatus !== "PENDING_MANAGER") {
        return NextResponse.json(
          { error: `This request is not awaiting a manager recommendation (status: ${reqStatus}).` },
          { status: 400 }
        );
      }
      if (!isManagerForDept) {
        return NextResponse.json(
          { error: "Only the department manager can recommend or decline this request." },
          { status: 403 }
        );
      }

      const newStatus: DepartmentJoinRequestStatus =
        action === "RECOMMEND" ? "PENDING_CHAIR" : "REJECTED";

      await docRef.update({
        status: newStatus,
        managerId: caller.uid,
        managerName: caller.name,
        managerDecidedAt: now,
        managerComments: comments,
        statusHistory: [
          ...history,
          {
            status: newStatus,
            changedBy: caller.uid,
            changedByName: caller.name,
            changedAt: now,
            comments,
          },
        ],
        updatedAt: now,
      });

      if (action === "RECOMMEND") {
        // Notify the Chairperson(s) that a request awaits final approval.
        const chairsSnap = await adminDb
          .collection("users")
          .where("role", "==", "SUPER_ADMIN")
          .get();
        for (const chairDoc of chairsSnap.docs) {
          if (chairDoc.data().isActive === false) continue;
          createNotificationWithEmail({
            userId: chairDoc.id,
            title: "Join Request Awaiting Your Approval",
            message: `${caller.name} recommended ${requesterName} to join ${departmentName}. It awaits your final approval.`,
            type: "announcement",
            link: QUEUE_LINK,
            recipientEmail: chairDoc.data().email,
            email: {
              subject: `Join request for ${departmentName} — final approval`,
              text: `${caller.name} has recommended ${requesterName} to join ${departmentName}.${
                comments ? `\n\nManager note: "${comments}"` : ""
              }\n\nGive the final decision in the Join Requests queue.`,
            },
          }).catch(console.error);
        }
        // Let the requester know it advanced.
        if (requesterId !== caller.uid) {
          createNotificationWithEmail({
            userId: requesterId,
            title: "Join Request Recommended",
            message: `${caller.name} recommended your request to join ${departmentName}. It's now with the Chairperson for final approval.`,
            type: "announcement",
            link: MEMBER_LINK,
          }).catch(console.error);
        }
      } else if (requesterId !== caller.uid) {
        createNotificationWithEmail({
          userId: requesterId,
          title: "Join Request Declined",
          message: `${caller.name} declined your request to join ${departmentName}.${
            comments ? ` Reason: ${comments}` : ""
          }`,
          type: "announcement",
          link: MEMBER_LINK,
        }).catch(console.error);
      }

      return NextResponse.json({ success: true, status: newStatus });
    }

    // ── Chair stage ───────────────────────────────────────────────────────
    if (action === "APPROVE" || action === "REJECT") {
      if (reqStatus !== "PENDING_CHAIR") {
        return NextResponse.json(
          { error: `This request is not awaiting final approval (status: ${reqStatus}).` },
          { status: 400 }
        );
      }
      if (!isChair) {
        return NextResponse.json(
          { error: "Only the Chairperson can give the final decision." },
          { status: 403 }
        );
      }

      const newStatus: DepartmentJoinRequestStatus =
        action === "APPROVE" ? "APPROVED" : "REJECTED";

      // On approval, add the member to the department and — for a plain member
      // — lift them to Youth Leader, since belonging to a team grants the
      // department-level access that role carries. Higher roles are left as-is.
      let roleUpgraded = false;
      if (action === "APPROVE") {
        const userDoc = await adminDb.collection("users").doc(requesterId).get();
        if (userDoc.exists) {
          const memberData = userDoc.data()!;
          const currentDepts = (memberData.departmentIds || []) as string[];
          const updates: Record<string, unknown> = {};
          if (!currentDepts.includes(departmentId)) {
            updates.departmentIds = [...currentDepts, departmentId];
          }
          if ((memberData.role as UserRole) === "MEMBER") {
            updates.role = "YOUTH_LEADER";
            roleUpgraded = true;
          }
          if (Object.keys(updates).length > 0) {
            updates.updatedAt = now;
            await adminDb.collection("users").doc(requesterId).update(updates);
          }
        }
      }

      await docRef.update({
        status: newStatus,
        chairId: caller.uid,
        chairName: caller.name,
        chairDecidedAt: now,
        chairComments: comments,
        statusHistory: [
          ...history,
          {
            status: newStatus,
            changedBy: caller.uid,
            changedByName: caller.name,
            changedAt: now,
            comments,
          },
        ],
        updatedAt: now,
      });

      // Notify the requester of the final outcome.
      createNotificationWithEmail({
        userId: requesterId,
        title:
          action === "APPROVE"
            ? "Welcome to the Department!"
            : "Join Request Not Approved",
        message:
          action === "APPROVE"
            ? `Your request to join ${departmentName} has been approved by ${caller.name}. You're now part of the team.${
                roleUpgraded
                  ? " You've been upgraded to Youth Leader and now have access to your department's tools."
                  : ""
              }`
            : `Your request to join ${departmentName} was not approved.${
                comments ? ` Reason: ${comments}` : ""
              }`,
        type: "announcement",
        link: MEMBER_LINK,
      }).catch(console.error);

      // On approval, let the manager who recommended it know it's done.
      if (action === "APPROVE" && req.managerId && req.managerId !== caller.uid) {
        createNotificationWithEmail({
          userId: req.managerId as string,
          title: "Join Request Approved",
          message: `The Chairperson approved ${requesterName} to join ${departmentName}.`,
          type: "announcement",
          link: QUEUE_LINK,
        }).catch(console.error);
      }

      return NextResponse.json({ success: true, status: newStatus });
    }

    // ── Requester cancellation ────────────────────────────────────────────
    if (action === "CANCEL") {
      if (requesterId !== caller.uid) {
        return NextResponse.json(
          { error: "You can only cancel your own request." },
          { status: 403 }
        );
      }
      if (reqStatus !== "PENDING_MANAGER" && reqStatus !== "PENDING_CHAIR") {
        return NextResponse.json(
          { error: `This request can no longer be cancelled (status: ${reqStatus}).` },
          { status: 400 }
        );
      }

      await docRef.update({
        status: "CANCELLED" as DepartmentJoinRequestStatus,
        statusHistory: [
          ...history,
          {
            status: "CANCELLED",
            changedBy: caller.uid,
            changedByName: caller.name,
            changedAt: now,
            comments,
          },
        ],
        updatedAt: now,
      });

      return NextResponse.json({ success: true, status: "CANCELLED" });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/department-join-requests/[id]/decision error:", error);
    return NextResponse.json(
      { error: "Failed to update join request" },
      { status: 500 }
    );
  }
}
