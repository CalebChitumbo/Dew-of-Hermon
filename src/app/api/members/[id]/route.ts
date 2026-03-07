import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { canManageMembers, canDeleteMembers, canChangeUserRoles, getAssignableRoles } from "@/lib/permissions";

export const dynamic = "force-dynamic";
import { UserRole } from "@/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const doc = await adminDb.collection("users").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const data = doc.data()!;
    const user = {
      id: doc.id,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      role: data.role,
      departmentIds: data.departmentIds || [],
      leadsDepartmentIds: data.leadsDepartmentIds || [],
      profileImage: data.profileImage || null,
      isActive: data.isActive ?? true,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error fetching member:", error);
    return NextResponse.json(
      { error: "Failed to fetch member" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, role, departmentIds, leadsDepartmentIds, isActive, callerRole } = body;

    if (!callerRole || !canManageMembers(callerRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Check if the caller is trying to change the role
    const existingDoc = await adminDb.collection("users").doc(id).get();
    if (!existingDoc.exists) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const existingData = existingDoc.data()!;

    if (role && role !== existingData.role) {
      if (!canChangeUserRoles(callerRole)) {
        return NextResponse.json(
          { error: "You do not have permission to change user roles" },
          { status: 403 }
        );
      }
      // Enforce hierarchy: caller can only assign roles at or below their own level
      const assignable = getAssignableRoles(callerRole);
      if (!assignable.includes(role)) {
        return NextResponse.json(
          { error: "You cannot assign a role higher than your own" },
          { status: 403 }
        );
      }
      // Prevent changing the role of someone with a higher role than the caller
      if (!assignable.includes(existingData.role)) {
        return NextResponse.json(
          { error: "You cannot modify the role of someone with a higher role than yours" },
          { status: 403 }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone || null;
    if (role !== undefined) updateData.role = role;
    if (departmentIds !== undefined) updateData.departmentIds = departmentIds;
    if (leadsDepartmentIds !== undefined) updateData.leadsDepartmentIds = leadsDepartmentIds;
    if (isActive !== undefined) updateData.isActive = isActive;

    await adminDb.collection("users").doc(id).update(updateData);

    // Update Firebase Auth profile if name or email changed
    const authUpdate: Record<string, string> = {};
    if (name !== undefined) authUpdate.displayName = name;
    if (email !== undefined) authUpdate.email = email;
    if (Object.keys(authUpdate).length > 0) {
      await adminAuth.updateUser(id, authUpdate);
    }

    // If deactivating, disable the Firebase Auth account
    if (isActive === false) {
      await adminAuth.updateUser(id, { disabled: true });
    } else if (isActive === true) {
      await adminAuth.updateUser(id, { disabled: false });
    }

    const updatedDoc = await adminDb.collection("users").doc(id).get();
    const updatedData = updatedDoc.data()!;

    return NextResponse.json({
      user: {
        id: updatedDoc.id,
        name: updatedData.name,
        email: updatedData.email,
        phone: updatedData.phone || null,
        role: updatedData.role,
        departmentIds: updatedData.departmentIds || [],
        leadsDepartmentIds: updatedData.leadsDepartmentIds || [],
        profileImage: updatedData.profileImage || null,
        isActive: updatedData.isActive ?? true,
        createdAt: updatedData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error("Error updating member:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update member";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const callerRole = searchParams.get("callerRole") as UserRole | null;

    if (!callerRole || !canDeleteMembers(callerRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const doc = await adminDb.collection("users").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(id);
    } catch (authError) {
      console.warn("Could not delete auth user (may not exist):", authError);
    }

    // Delete Firestore document
    await adminDb.collection("users").doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting member:", error);
    return NextResponse.json(
      { error: "Failed to delete member" },
      { status: 500 }
    );
  }
}
