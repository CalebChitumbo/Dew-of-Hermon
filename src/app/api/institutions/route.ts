import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { serverHasFeatureMinRole } from "@/lib/feature-permissions-server";
import { getSessionCaller as getCallerRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

// GET: List active institutions (any signed-in user)
export async function GET() {
  try {
    const caller = await getCallerRole();
    if (!caller) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const snapshot = await adminDb
      .collection("institutions")
      .orderBy("order")
      .get();

    const institutions = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        isActive: data.isActive ?? true,
        order: data.order || 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json({ institutions });
  } catch (error) {
    console.error("Error fetching institutions:", error);
    return NextResponse.json(
      { error: "Failed to fetch institutions" },
      { status: 500 }
    );
  }
}

// POST: Create a new institution (ADMIN+ only)
export async function POST(request: Request) {
  try {
    const caller = await getCallerRole();
    if (!caller) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!(await serverHasFeatureMinRole("manage_institutions", caller.role))) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Institution name is required" },
        { status: 400 }
      );
    }

    // Get the next order number
    const lastDoc = await adminDb
      .collection("institutions")
      .orderBy("order", "desc")
      .limit(1)
      .get();
    const nextOrder = lastDoc.empty ? 1 : (lastDoc.docs[0].data().order || 0) + 1;

    const ref = adminDb.collection("institutions").doc();
    const institutionData = {
      name: name.trim(),
      isActive: true,
      order: nextOrder,
      createdAt: new Date(),
    };

    await ref.set(institutionData);

    return NextResponse.json(
      {
        institution: {
          id: ref.id,
          ...institutionData,
          createdAt: institutionData.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating institution:", error);
    return NextResponse.json(
      { error: "Failed to create institution" },
      { status: 500 }
    );
  }
}

// PATCH: Update an institution (ADMIN+ only)
export async function PATCH(request: Request) {
  try {
    const caller = await getCallerRole();
    if (!caller) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!(await serverHasFeatureMinRole("manage_institutions", caller.role))) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Institution ID is required" },
        { status: 400 }
      );
    }

    const ref = adminDb.collection("institutions").doc(id);
    const doc = await ref.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Institution not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (isActive !== undefined) updates.isActive = isActive;

    await ref.update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating institution:", error);
    return NextResponse.json(
      { error: "Failed to update institution" },
      { status: 500 }
    );
  }
}
