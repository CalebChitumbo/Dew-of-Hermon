import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  getCallerWithDepartments,
  callerCanManageCampRegistrations,
} from "../_auth";
import type { CampPaymentStatus } from "@/types";

export const dynamic = "force-dynamic";

const VALID_PAYMENT_STATUSES: CampPaymentStatus[] = ["UNPAID", "PAID", "REFUNDED"];

export async function PATCH(
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
    const body = await request.json();

    const ref = adminDb.collection("campRegistrations").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.paymentStatus !== undefined) {
      if (!VALID_PAYMENT_STATUSES.includes(body.paymentStatus)) {
        return NextResponse.json({ error: "Invalid payment status" }, { status: 400 });
      }
      updates.paymentStatus = body.paymentStatus;
      updates.paymentMarkedBy = caller.uid;
      updates.paymentMarkedByName = caller.name;
      updates.paymentMarkedAt = new Date();
    }
    if (body.paymentAmount !== undefined) {
      updates.paymentAmount =
        body.paymentAmount === null ? null : Number(body.paymentAmount);
    }
    if (body.paymentReference !== undefined) {
      updates.paymentReference =
        typeof body.paymentReference === "string" && body.paymentReference.trim()
          ? body.paymentReference.trim()
          : null;
    }
    if (body.paymentNotes !== undefined) {
      updates.paymentNotes =
        typeof body.paymentNotes === "string" && body.paymentNotes.trim()
          ? body.paymentNotes.trim()
          : null;
    }

    await ref.update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating camp registration:", error);
    return NextResponse.json(
      { error: "Failed to update registration" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
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
    await adminDb.collection("campRegistrations").doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting camp registration:", error);
    return NextResponse.json(
      { error: "Failed to delete registration" },
      { status: 500 }
    );
  }
}
