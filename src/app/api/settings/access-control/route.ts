import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionCaller as getCallerRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

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
    const { pagePermissions, featureMinRoles, departmentAccessRules } = body;

    if (!pagePermissions || typeof pagePermissions !== "object") {
      return NextResponse.json(
        { error: "Invalid pagePermissions data" },
        { status: 400 }
      );
    }

    // Validate: ensure SUPER_ADMIN always has "edit" on every page
    for (const pageKey of Object.keys(pagePermissions)) {
      pagePermissions[pageKey].SUPER_ADMIN = "edit";
    }

    // Validate feature min roles if provided
    if (featureMinRoles && typeof featureMinRoles === "object") {
      // Ensure manage_settings stays SUPER_ADMIN
      featureMinRoles.manage_settings = "SUPER_ADMIN";
    }

    // Validate department access rules if provided
    if (departmentAccessRules && !Array.isArray(departmentAccessRules)) {
      return NextResponse.json(
        { error: "Invalid departmentAccessRules data" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      pagePermissions,
      updatedAt: new Date(),
      updatedBy: caller.uid,
    };

    if (featureMinRoles) {
      updateData.featureMinRoles = featureMinRoles;
    }

    if (departmentAccessRules) {
      updateData.departmentAccessRules = departmentAccessRules;
    }

    const docRef = adminDb.collection("settings").doc("accessControl");
    await docRef.set(updateData, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save access control:", error);
    return NextResponse.json(
      { error: "Failed to save access control settings" },
      { status: 500 }
    );
  }
}
