import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  getCallerWithDepartments,
  callerCanManageCampRegistrations,
} from "../../_auth";
import { serializeRegistration } from "../../_serialize";

export const dynamic = "force-dynamic";

/**
 * Admin: mark a camper as checked in to camp (or undo it).
 * Body: { checkedIn: boolean }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCallerWithDepartments();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!(await callerCanManageCampRegistrations(caller))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (typeof body.checkedIn !== "boolean") {
      return NextResponse.json(
        { error: "checkedIn must be a boolean" },
        { status: 400 }
      );
    }

    const ref = adminDb.collection("campRegistrations").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const now = new Date();
    const updates = body.checkedIn
      ? {
          checkedIn: true,
          checkedInAt: now,
          checkedInBy: caller.uid,
          checkedInByName: caller.name,
          updatedAt: now,
        }
      : {
          checkedIn: false,
          checkedInAt: null,
          checkedInBy: null,
          checkedInByName: null,
          updatedAt: now,
        };

    await ref.update(updates);

    const updated = await ref.get();
    return NextResponse.json({
      success: true,
      registration: serializeRegistration(updated.id, updated.data()!),
    });
  } catch (error) {
    console.error("Error updating camp check-in:", error);
    return NextResponse.json(
      { error: "Failed to update check-in" },
      { status: 500 }
    );
  }
}
