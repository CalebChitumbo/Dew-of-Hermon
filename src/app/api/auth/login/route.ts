import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { idToken, isGoogleSignIn } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: "Missing ID token" }, { status: 400 });
    }

    // Verify the Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Get user data from Firestore
    const userDoc = await adminDb.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      // For Google sign-in, auto-create the user profile
      if (isGoogleSignIn) {
        const now = new Date();
        const newUserData = {
          name: decodedToken.name || "User",
          email: decodedToken.email || "",
          phone: null,
          role: "MEMBER",
          departmentIds: [],
          leadsDepartmentIds: [],
          profileImage: decodedToken.picture || null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        await adminDb.collection("users").doc(uid).set(newUserData);

        // Set session cookie
        const cookieStore = await cookies();
        cookieStore.set("session", idToken, {
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

      return NextResponse.json(
        { error: "User profile not found. Please contact an admin." },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    if (!userData?.isActive) {
      return NextResponse.json(
        { error: "Your account has been deactivated. Please contact an admin." },
        { status: 403 }
      );
    }

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set("session", idToken, {
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
