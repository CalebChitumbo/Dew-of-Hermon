import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { hasMinRole } from "@/lib/permissions";
import { getSessionCaller as getCaller } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

// POST /api/departments - Create a new department
export async function POST(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller || !hasMinRole(caller.role, "ADMIN")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, icon } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Get max order
    const deptSnapshot = await adminDb
      .collection("departments")
      .orderBy("order", "desc")
      .limit(1)
      .get();
    const maxOrder = deptSnapshot.empty ? 0 : deptSnapshot.docs[0].data().order || 0;

    const ref = await adminDb.collection("departments").add({
      name: name.trim(),
      description: description?.trim() || null,
      icon: icon || "📁",
      order: maxOrder + 1,
      createdAt: new Date(),
    });

    return NextResponse.json({
      department: { id: ref.id, name: name.trim(), description, icon: icon || "📁", order: maxOrder + 1 },
    });
  } catch (error) {
    console.error("POST /api/departments error:", error);
    return NextResponse.json({ error: "Failed to create department" }, { status: 500 });
  }
}

// PATCH /api/departments - Update department or assign lead
export async function PATCH(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller || !hasMinRole(caller.role, "ADMIN")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { departmentId, action, userId, name, description, icon } = body;

    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 });
    }

    // Assign a department lead
    if (action === "assignLead") {
      if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
      }

      const userDoc = await adminDb.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const userData = userDoc.data()!;
      const currentLeadsDepts = userData.leadsDepartmentIds || [];

      if (!currentLeadsDepts.includes(departmentId)) {
        await adminDb.collection("users").doc(userId).update({
          leadsDepartmentIds: [...currentLeadsDepts, departmentId],
          // Upgrade to DEPARTMENT_LEAD if currently a lower role
          ...(userData.role === "MEMBER" || userData.role === "YOUTH_LEADER"
            ? { role: "DEPARTMENT_LEAD" }
            : {}),
          updatedAt: new Date(),
        });
      }

      // Also ensure the user is a member of the department
      const currentDepts = userData.departmentIds || [];
      if (!currentDepts.includes(departmentId)) {
        await adminDb.collection("users").doc(userId).update({
          departmentIds: [...currentDepts, departmentId],
        });
      }

      return NextResponse.json({ success: true });
    }

    // Remove a department lead
    if (action === "removeLead") {
      if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
      }

      const userDoc = await adminDb.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const userData = userDoc.data()!;
      const updatedLeads = (userData.leadsDepartmentIds || []).filter(
        (id: string) => id !== departmentId
      );

      await adminDb.collection("users").doc(userId).update({
        leadsDepartmentIds: updatedLeads,
        updatedAt: new Date(),
      });

      return NextResponse.json({ success: true });
    }

    // Update department info
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (icon !== undefined) updateData.icon = icon;

    if (Object.keys(updateData).length > 0) {
      await adminDb.collection("departments").doc(departmentId).update(updateData);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/departments error:", error);
    return NextResponse.json({ error: "Failed to update department" }, { status: 500 });
  }
}

// DELETE /api/departments?departmentId=... - Delete a department.
// Restricted to the Chairperson (SUPER_ADMIN), consistent with the app's
// destructive-delete policy. Also strips the department id from every user's
// departmentIds / leadsDepartmentIds so no dangling references remain.
export async function DELETE(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller || caller.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only the Chairperson can delete departments" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const departmentId =
      searchParams.get("departmentId") || searchParams.get("id");
    if (!departmentId) {
      return NextResponse.json(
        { error: "departmentId is required" },
        { status: 400 }
      );
    }

    const deptRef = adminDb.collection("departments").doc(departmentId);
    const deptDoc = await deptRef.get();
    if (!deptDoc.exists) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // Remove the department from any users that still reference it.
    let referencesCleaned = 0;
    for (const field of ["departmentIds", "leadsDepartmentIds"] as const) {
      const usersSnap = await adminDb
        .collection("users")
        .where(field, "array-contains", departmentId)
        .get();
      for (let i = 0; i < usersSnap.docs.length; i += 400) {
        const batch = adminDb.batch();
        for (const userDoc of usersSnap.docs.slice(i, i + 400)) {
          batch.update(userDoc.ref, {
            [field]: FieldValue.arrayRemove(departmentId),
          });
          referencesCleaned++;
        }
        await batch.commit();
      }
    }

    await deptRef.delete();

    return NextResponse.json({ success: true, referencesCleaned });
  } catch (error) {
    console.error("DELETE /api/departments error:", error);
    return NextResponse.json({ error: "Failed to delete department" }, { status: 500 });
  }
}
