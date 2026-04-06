import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FeaturePermissions, PagePermissions, UserRole } from "@/types";

export const dynamic = "force-dynamic";

async function getCallerRole(): Promise<{ uid: string; role: UserRole } | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) return null;

    const decoded = await adminAuth.verifySessionCookie(session.value);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;

    const data = userDoc.data()!;
    return { uid: decoded.uid, role: data.role as UserRole };
  } catch {
    return null;
  }
}

/** GET - Fetch access control config */
export async function GET() {
  try {
    const caller = await getCallerRole();
    if (!caller) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (caller.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only the Chairperson can manage access control" },
        { status: 403 }
      );
    }

    const docRef = adminDb.collection("settings").doc("accessControl");
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: docSnap.data() });
  } catch (error) {
    console.error("Failed to fetch access control:", error);
    return NextResponse.json(
      { error: "Failed to fetch access control settings" },
      { status: 500 }
    );
  }
}

/** PUT - Save access control config */
export async function PUT(request: Request) {
  try {
    const caller = await getCallerRole();
    if (!caller) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (caller.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only the Chairperson can manage access control" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { pagePermissions, featurePermissions } = body as {
      pagePermissions?: PagePermissions;
      featurePermissions?: FeaturePermissions;
    };

    if (
      pagePermissions !== undefined &&
      (typeof pagePermissions !== "object" || pagePermissions === null)
    ) {
      return NextResponse.json(
        { error: "Invalid pagePermissions data" },
        { status: 400 }
      );
    }

    if (
      featurePermissions !== undefined &&
      (typeof featurePermissions !== "object" || featurePermissions === null)
    ) {
      return NextResponse.json(
        { error: "Invalid featurePermissions data" },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: caller.uid,
    };

    if (pagePermissions) {
      // Ensure SUPER_ADMIN always has "edit" on every page
      for (const pageKey of Object.keys(pagePermissions)) {
        pagePermissions[pageKey].SUPER_ADMIN = "edit";
      }
      update.pagePermissions = pagePermissions;
    }

    if (featurePermissions) {
      // Ensure SUPER_ADMIN minRole is never set above ADMIN (SUPER_ADMIN always has access)
      for (const featureKey of Object.keys(featurePermissions)) {
        const fp = featurePermissions[featureKey];
        if (fp.minRole === "SUPER_ADMIN") {
          fp.minRole = "ADMIN";
        }
      }
      update.featurePermissions = featurePermissions;
    }

    const docRef = adminDb.collection("settings").doc("accessControl");
    await docRef.set(update, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save access control:", error);
    return NextResponse.json(
      { error: "Failed to save access control settings" },
      { status: 500 }
    );
  }
}
