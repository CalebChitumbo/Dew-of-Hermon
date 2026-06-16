import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { idToken, isGoogleSignIn, registrationName, dateOfBirth, lifeGroup, isStudent, institutionId } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: "Missing ID token" }, { status: 400 });
    }

    // Verify the Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Get user data from Firestore
    const userDoc = await adminDb.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      // Auto-create user profile if missing (handles Google sign-in,
      // registration, and recovery for users whose profile wasn't created)
      const now = new Date();

      // If student, auto-add Campus Ministry department
      const userDepartmentIds: string[] = [];
      if (isStudent) {
        const campusDeptSnapshot = await adminDb
          .collection("departments")
          .where("name", "==", "Campus Ministry")
          .limit(1)
          .get();
        if (!campusDeptSnapshot.empty) {
          userDepartmentIds.push(campusDeptSnapshot.docs[0].id);
        }
      }

      const newUserData = {
        name: registrationName || decodedToken.name || "User",
        email: decodedToken.email || "",
        phone: null,
        role: "MEMBER",
        departmentIds: userDepartmentIds,
        leadsDepartmentIds: [],
        profileImage: decodedToken.picture || null,
        isActive: true,
        lifeGroup: lifeGroup || null,
        isStudent: isStudent || false,
        institutionId: isStudent ? (institutionId || null) : null,
        dateOfBirth: dateOfBirth || null,
        createdAt: now,
        updatedAt: now,
      };
      await adminDb.collection("users").doc(uid).set(newUserData);

      // Create a Firebase session cookie (valid for 7 days)
      const newUserExpiresIn = 60 * 60 * 24 * 7 * 1000;
      const newUserSessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: newUserExpiresIn });
      const newUserCookieStore = await cookies();
      newUserCookieStore.set("session", newUserSessionCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      return NextResponse.json({
        user: { id: uid, ...newUserData },
      });
    }

    const userData = userDoc.data();

    if (!userData?.isActive) {
      return NextResponse.json(
        { error: "Your account has been deactivated. Please contact an admin." },
        { status: 403 }
      );
    }

    // Create a Firebase session cookie (valid for 7 days)
    const expiresIn = 60 * 60 * 24 * 7 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return NextResponse.json({
      user: {
        id: uid,
        ...userData,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
