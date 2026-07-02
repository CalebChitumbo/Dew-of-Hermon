import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getAssignableRoles } from "@/lib/permissions";
import { serverHasFeatureMinRole } from "@/lib/feature-permissions-server";
import { getSessionCaller as getCallerRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const caller = await getCallerRole();
    if (!caller) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!(await serverHasFeatureMinRole("manage_members", caller.role))) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const usersSnapshot = await adminDb.collection("users").orderBy("name").get();
    const users = usersSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        role: data.role,
        departmentIds: data.departmentIds || [],
        leadsDepartmentIds: data.leadsDepartmentIds || [],
        profileImage: data.profileImage || null,
        isActive: data.isActive ?? true,
        lifeGroup: data.lifeGroup || null,
        isStudent: data.isStudent || false,
        institutionId: data.institutionId || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, role, departmentIds, isStudent, institutionId, lifeGroup } = body;

    // Verify the caller's role from their session
    const caller = await getCallerRole();
    if (!caller) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!(await serverHasFeatureMinRole("manage_members", caller.role))) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Enforce hierarchy: caller can only assign roles at or below their own level
    if (role) {
      const assignable = getAssignableRoles(caller.role);
      if (!assignable.includes(role)) {
        return NextResponse.json(
          { error: "You cannot assign a role higher than your own" },
          { status: 403 }
        );
      }
    }

    // Create Firebase Auth user with a temporary password
    const tempPassword = `Welcome${Date.now()}!`;
    const userRecord = await adminAuth.createUser({
      email,
      displayName: name,
      password: tempPassword,
    });

    let userData: {
      name: string;
      email: string;
      phone: string | null;
      role: string;
      departmentIds: string[];
      leadsDepartmentIds: string[];
      profileImage: string | null;
      isActive: boolean;
      lifeGroup: string | null;
      isStudent: boolean;
      institutionId: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    try {
      // If student, auto-add Campus Ministry department
      let finalDepartmentIds = departmentIds || [];
      if (isStudent) {
        // Find Campus Ministry department ID
        const campusDeptSnapshot = await adminDb
          .collection("departments")
          .where("name", "==", "Campus Ministry")
          .limit(1)
          .get();
        if (!campusDeptSnapshot.empty) {
          const campusDeptId = campusDeptSnapshot.docs[0].id;
          if (!finalDepartmentIds.includes(campusDeptId)) {
            finalDepartmentIds = [...finalDepartmentIds, campusDeptId];
          }
        }
      }

      // Create Firestore document
      userData = {
        name,
        email,
        phone: phone || null,
        role: role || "MEMBER",
        departmentIds: finalDepartmentIds,
        leadsDepartmentIds: [],
        profileImage: null,
        isActive: true,
        lifeGroup: lifeGroup || null,
        isStudent: isStudent || false,
        institutionId: isStudent ? (institutionId || null) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await adminDb.collection("users").doc(userRecord.uid).set(userData);
    } catch (profileError) {
      // Don't leave an orphaned Auth account (email consumed, no profile) if
      // the Firestore write fails — roll the Auth user back.
      await adminAuth
        .deleteUser(userRecord.uid)
        .catch((cleanupError) =>
          console.error("Failed to roll back auth user:", cleanupError)
        );
      throw profileError;
    }

    return NextResponse.json(
      {
        user: {
          id: userRecord.uid,
          ...userData,
          createdAt: userData.createdAt.toISOString(),
          updatedAt: userData.updatedAt.toISOString(),
        },
        tempPassword,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating member:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create member";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
