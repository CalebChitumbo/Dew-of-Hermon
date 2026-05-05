import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import type { CampPaymentStatus, UserRole } from "@/types";

export const dynamic = "force-dynamic";

const VALID_PAYMENT_STATUSES: CampPaymentStatus[] = ["UNPAID", "PAID", "REFUNDED"];

async function getCallerRole(): Promise<{ uid: string; name: string; role: UserRole } | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) return null;

    const decoded = await adminAuth.verifySessionCookie(session.value);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;

    const data = userDoc.data()!;
    return {
      uid: decoded.uid,
      name: data.name || decoded.email || "Admin",
      role: data.role as UserRole,
    };
  } catch {
    return null;
  }
}

function isAdminRole(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCallerRole();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!isAdminRole(caller.role)) {
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
    const caller = await getCallerRole();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!isAdminRole(caller.role)) {
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
