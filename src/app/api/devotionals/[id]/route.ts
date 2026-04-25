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
      name: data.name || "",
      departmentIds: (data.departmentIds || []) as string[],
      leadsDepartmentIds: (data.leadsDepartmentIds || []) as string[],
    };
  } catch {
    return null;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canManage = await serverCheckFeatureAccess(
      "manage_devotionals",
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );
    if (!canManage) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const docRef = adminDb.collection("devotionals").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Devotional not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.content !== undefined) updates.content = String(body.content).trim();
    if (body.weekStartDate !== undefined)
      updates.weekStartDate = String(body.weekStartDate);
    if (body.scriptureReference !== undefined)
      updates.scriptureReference = body.scriptureReference
        ? String(body.scriptureReference).trim()
        : null;

    await docRef.update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/devotionals/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update devotional" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canManage = await serverCheckFeatureAccess(
      "manage_devotionals",
      caller.role,
      caller.departmentIds,
      caller.leadsDepartmentIds
    );
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await adminDb.collection("devotionals").doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/devotionals/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete devotional" },
      { status: 500 }
    );
  }
}
