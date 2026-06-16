import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { email, password, name, dateOfBirth, lifeGroup, isStudent, institutionId } =
      await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create Firebase Auth user
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    // If student, auto-add Campus Ministry department so they appear in the
    // student register on first sign-in.
    const departmentIds: string[] = [];
    if (isStudent) {
      const campusDeptSnapshot = await adminDb
        .collection("departments")
        .where("name", "==", "Campus Ministry")
        .limit(1)
        .get();
      if (!campusDeptSnapshot.empty) {
        departmentIds.push(campusDeptSnapshot.docs[0].id);
      }
    }

    const now = new Date();
    await adminDb.collection("users").doc(userRecord.uid).set({
      name,
      email,
      phone: null,
      role: "MEMBER",
      departmentIds,
      leadsDepartmentIds: [],
      profileImage: null,
      isActive: true,
      lifeGroup: lifeGroup || null,
      isStudent: !!isStudent,
      institutionId: isStudent ? institutionId || null : null,
      dateOfBirth: dateOfBirth || null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      user: {
        id: userRecord.uid,
        name,
        email,
        role: "MEMBER",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
