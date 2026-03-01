import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { canManageMembers } from "@/lib/permissions";

export const dynamic = "force-dynamic";
import { UserRole } from "@/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const callerRole = searchParams.get("callerRole") as UserRole | null;

    if (!callerRole || !canManageMembers(callerRole)) {
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
    const { name, email, phone, role, departmentIds, callerRole } = body;

    if (!callerRole || !canManageMembers(callerRole)) {
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

    // Create Firebase Auth user with a temporary password
    const tempPassword = `Welcome${Date.now()}!`;
    const userRecord = await adminAuth.createUser({
      email,
      displayName: name,
      password: tempPassword,
    });

    // Create Firestore document
    const userData = {
      name,
      email,
      phone: phone || null,
      role: role || "MEMBER",
      departmentIds: departmentIds || [],
      leadsDepartmentIds: [],
      profileImage: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await adminDb.collection("users").doc(userRecord.uid).set(userData);

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
