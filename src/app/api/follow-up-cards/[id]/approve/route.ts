import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import { serverCheckFeatureAccess } from "@/lib/feature-permissions-server";
import { FollowUpStatus, UserRole } from "@/types";

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

async function getDeptIdByName(name: string): Promise<string | null> {
  const snap = await adminDb
    .collection("departments")
    .where("name", "==", name)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

// POST /api/follow-up-cards/[id]/approve
// Body: { action: "APPROVE" | "REJECT", reason?: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canApprove = await serverCheckFeatureAccess(
      "approve_follow_up",
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );

    if (!canApprove) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only the department lead can approve follow-up submissions",
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const docRef = adminDb.collection("followUpCards").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Follow-up card not found" },
        { status: 404 }
      );
    }

    const card = doc.data()!;
    if (card.status !== "PENDING_LEAD_APPROVAL") {
      return NextResponse.json(
        {
          error: `Cannot approve a card whose current status is ${card.status}`,
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const action = body.action as "APPROVE" | "REJECT" | undefined;
    if (action !== "APPROVE" && action !== "REJECT") {
      return NextResponse.json(
        { error: "Body must include action: 'APPROVE' or 'REJECT'" },
        { status: 400 }
      );
    }

    const now = new Date();
    const newStatus: FollowUpStatus =
      action === "APPROVE" ? "NEW_CONTACT" : "REJECTED";

    await docRef.update({
      status: newStatus,
      approvedBy: caller.uid,
      approvedByName: caller.name,
      approvedAt: now,
      rejectionReason: action === "REJECT" ? body.reason || null : null,
      statusHistory: [
        ...(card.statusHistory || []),
        {
          status: newStatus,
          changedBy: caller.uid,
          changedAt: now,
        },
      ],
      updatedAt: now,
    });

    const sourceLabel =
      card.source === "CAMPUS_MINISTRY" ? "Campus Ministry" : "Life Groups";

    // Notify the original submitter
    if (card.createdBy && card.createdBy !== caller.uid) {
      const submitterTitle =
        action === "APPROVE"
          ? "Follow-Up Approved"
          : "Follow-Up Submission Rejected";
      const submitterMsg =
        action === "APPROVE"
          ? `${caller.name} approved the follow-up you submitted for ${card.name}. It is now with the discipleship team.`
          : `${caller.name} declined the follow-up you submitted for ${card.name}.${
              body.reason ? ` Reason: ${body.reason}` : ""
            }`;

      createNotificationWithEmail({
        userId: card.createdBy,
        title: submitterTitle,
        message: submitterMsg,
        type: "announcement",
        link: "/department/campus-ministry",
      }).catch(console.error);
    }

    // On approval, notify the discipleship team that a new card is in their queue.
    if (action === "APPROVE") {
      const discipleshipDeptId = await getDeptIdByName("Discipleship & Follow-Up");
      if (discipleshipDeptId) {
        const discipleshipMembers = await adminDb
          .collection("users")
          .where("departmentIds", "array-contains", discipleshipDeptId)
          .where("isActive", "==", true)
          .get();

        for (const memberDoc of discipleshipMembers.docs) {
          createNotificationWithEmail({
            userId: memberDoc.id,
            title: "New Follow-Up Contact",
            message: `${card.name} (from ${sourceLabel}) was approved by ${caller.name} and is ready for follow-up.`,
            type: "announcement",
            link: "/department/discipleship",
            recipientEmail: memberDoc.data().email,
            email: {
              subject: `New Follow-Up Contact: ${card.name}`,
              text: `A follow-up card for "${card.name}" (${sourceLabel}) has been approved and is in the discipleship pipeline.`,
            },
          }).catch(console.error);
        }
      }
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error("POST /api/follow-up-cards/[id]/approve error:", error);
    return NextResponse.json(
      { error: "Failed to update approval status" },
      { status: 500 }
    );
  }
}
