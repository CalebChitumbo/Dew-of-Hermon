import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import { UserRole, FollowUpSource, FollowUpStatus, FollowUpReason } from "@/types";
import {
  loadFeaturePermissions,
  serverCanReadFollowUps,
  serverCanSubmitFollowUp,
} from "@/lib/feature-permissions-server";

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

// ─── GET /api/follow-up-cards ───
// Query params: status, source, assigneeId

export async function GET(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const featurePerms = await loadFeaturePermissions();
    const hasAccess = await serverCanReadFollowUps(
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds,
      featurePerms
    );

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
    if (assigneeIdParam) {
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

    const featurePerms = await loadFeaturePermissions();
    const canSubmit = await serverCanSubmitFollowUp(
      caller.role,
      caller.departmentIds,
      featurePerms
    );

    if (!canSubmit) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to create follow-up cards" },
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

    const now = new Date();
    const cardData = {
      name,
      phone,
      source,
      sourceDetail,
      status: "NEW_CONTACT" as FollowUpStatus,
      reason: reason || null,
      notes: notes || "",
      dateOfContact: dateOfContact ? new Date(dateOfContact) : now,
      assigneeId: null,
      assigneeName: null,
      createdBy: caller.uid,
      createdByName: caller.name,
      statusHistory: [
        {
          status: "NEW_CONTACT" as FollowUpStatus,
          changedBy: caller.uid,
          changedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection("followUpCards").add(cardData);

    // Notify Discipleship & Follow-Up dept members about the new card
    const discipleshipDeptId = await getDeptIdByName("Discipleship & Follow-Up");
    if (discipleshipDeptId) {
      const discipleshipMembers = await adminDb
        .collection("users")
        .where("departmentIds", "array-contains", discipleshipDeptId)
        .where("isActive", "==", true)
        .get();

      const sourceLabel =
        source === "CAMPUS_MINISTRY" ? "Campus Ministry" : "Life Groups";

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
