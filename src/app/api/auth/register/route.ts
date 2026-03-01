import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

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

    // Create Firestore user document
    await adminDb.collection("users").doc(userRecord.uid).set({
      name,
      email,
      phone: null,
      role: "MEMBER",
      departmentIds: [],
      leadsDepartmentIds: [],
      profileImage: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
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
