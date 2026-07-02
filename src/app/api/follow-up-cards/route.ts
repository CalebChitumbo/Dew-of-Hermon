import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionCaller as getCaller } from "@/lib/server-auth";
import { createNotificationWithEmail } from "@/lib/notifications";
import {
  serverCheckFeatureAccess,
  getDepartmentIdByName,
} from "@/lib/feature-permissions-server";
import { FollowUpSource, FollowUpStatus, FollowUpReason } from "@/types";

export const dynamic = "force-dynamic";

// ─── GET /api/follow-up-cards ───
// Query params: status, source, assigneeId

export async function GET(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check read permissions: managers see all, assigned-only viewers see their own,
    // submitters can also see (limited via filter below)
    const [canSubmit, canManage, canViewAssigned] = await Promise.all([
      serverCheckFeatureAccess(
        "submit_follow_up",
        caller.role,
        caller.departmentIds,
        caller.leadsDepartmentIds
      ),
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
    const hasAccess = canSubmit || canManage || canViewAssigned;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to follow-up cards" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const sourceParam = searchParams.get("source");
    const assigneeIdParam = searchParams.get("assigneeId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = adminDb.collection("followUpCards");

    if (statusParam) {
      q = q.where("status", "==", statusParam);
    }
    if (sourceParam) {
      q = q.where("source", "==", sourceParam);
    }

    // Non-managers (e.g. Youth Leaders) only see cards assigned to them.
    // This forces an assigneeId filter on their query.
    if (!canManage && canViewAssigned) {
      q = q.where("assigneeId", "==", caller.uid);
    } else if (assigneeIdParam) {
      q = q.where("assigneeId", "==", assigneeIdParam);
    }

    q = q.orderBy("createdAt", "desc");

    const snapshot = await q.get();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cards = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
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
        submittedByRole: data.submittedByRole || null,
        approvedBy: data.approvedBy || null,
        approvedByName: data.approvedByName || null,
        approvedAt: data.approvedAt?.toDate?.()?.toISOString() || null,
        rejectionReason: data.rejectionReason || null,
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
      };
    });

    return NextResponse.json({ cards });
  } catch (error) {
    console.error("GET /api/follow-up-cards error:", error);
    return NextResponse.json(
      { error: "Failed to fetch follow-up cards" },
      { status: 500 }
    );
  }
}

// ─── POST /api/follow-up-cards ───
// Body: { name, phone, source, sourceDetail, reason?, notes?, dateOfContact }

export async function POST(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canSubmit = await serverCheckFeatureAccess(
      "submit_follow_up",
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );

    if (!canSubmit) {
      return NextResponse.json(
        { error: "Forbidden: Only Campus Ministry or Life Groups members can create follow-up cards" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, phone, source, sourceDetail, reason, notes, dateOfContact } = body;

    if (!name || !phone || !source || !sourceDetail) {
      return NextResponse.json(
        { error: "Missing required fields: name, phone, source, sourceDetail" },
        { status: 400 }
      );
    }

    const validSources: FollowUpSource[] = ["CAMPUS_MINISTRY", "LIFE_GROUPS"];
    if (!validSources.includes(source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${validSources.join(", ")}` },
        { status: 400 }
      );
    }

    const validReasons: FollowUpReason[] = [
      "NEW_VISITOR",
      "RETURNING_AFTER_ABSENCE",
      "NEEDS_PASTORAL_SUPPORT",
      "OTHER",
    ];
    if (reason && !validReasons.includes(reason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${validReasons.join(", ")}` },
        { status: 400 }
      );
    }

    const sourceDeptName =
      source === "CAMPUS_MINISTRY" ? "Campus Ministry" : "Life Groups";
    const sourceLabel = sourceDeptName;

    // Submitters at or below YOUTH_LEADER must have their cards approved by a
    // department lead before the card moves into the discipleship pipeline.
    const requiresApproval =
      caller.role === "YOUTH_LEADER" || caller.role === "MEMBER";

    const initialStatus: FollowUpStatus = requiresApproval
      ? "PENDING_LEAD_APPROVAL"
      : "NEW_CONTACT";

    const now = new Date();
    const cardData = {
      name,
      phone,
      source,
      sourceDetail,
      status: initialStatus,
      reason: reason || null,
      notes: notes || "",
      dateOfContact: dateOfContact ? new Date(dateOfContact) : now,
      assigneeId: null,
      assigneeName: null,
      createdBy: caller.uid,
      createdByName: caller.name,
      submittedByRole: caller.role,
      approvedBy: null,
      approvedByName: null,
      approvedAt: null,
      rejectionReason: null,
      statusHistory: [
        {
          status: initialStatus,
          changedBy: caller.uid,
          changedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection("followUpCards").add(cardData);

    if (requiresApproval) {
      // Notify the department leads of the source dept so they can approve the
      // submission before it hits the discipleship pipeline.
      const sourceDeptId = await getDepartmentIdByName(sourceDeptName);
      if (sourceDeptId) {
        const leadsSnap = await adminDb
          .collection("users")
          .where("leadsDepartmentIds", "array-contains", sourceDeptId)
          .where("isActive", "==", true)
          .get();

        for (const leadDoc of leadsSnap.docs) {
          createNotificationWithEmail({
            userId: leadDoc.id,
            title: "Follow-Up Pending Your Approval",
            message: `${caller.name} submitted a follow-up for ${name}. Review and approve to send it to the discipleship team.`,
            type: "announcement",
            link: "/department/campus-ministry?tab=approvals",
            recipientEmail: leadDoc.data().email,
            email: {
              subject: `Follow-Up Pending Approval: ${name}`,
              text: `${caller.name} (${caller.role}) submitted a follow-up card for "${name}" via ${sourceLabel}. Please review and approve it before it reaches the discipleship team.`,
            },
          }).catch(console.error);
        }
      }
    } else {
      // Notify Discipleship & Follow-Up dept members about the new card
      const discipleshipDeptId = await getDepartmentIdByName("Discipleship & Follow-Up");
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
            message: `${name} has been added from ${sourceLabel} by ${caller.name}.`,
            type: "announcement",
            link: "/department/discipleship",
            recipientEmail: memberDoc.data().email,
            email: {
              subject: `New Follow-Up Contact: ${name}`,
              text: `A new follow-up contact "${name}" has been submitted from ${sourceLabel}. Please review and follow up.`,
            },
          }).catch(console.error);
        }
      }
    }

    return NextResponse.json(
      {
        id: docRef.id,
        ...cardData,
        dateOfContact: cardData.dateOfContact.toISOString(),
        statusHistory: cardData.statusHistory.map((h) => ({
          ...h,
          changedAt: h.changedAt.toISOString(),
        })),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/follow-up-cards error:", error);
    return NextResponse.json(
      { error: "Failed to create follow-up card" },
      { status: 500 }
    );
  }
}
