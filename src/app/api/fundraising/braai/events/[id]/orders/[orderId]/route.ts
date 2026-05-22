import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  FUNDRAISING_ORDERS_COLLECTION,
  serializeOrder,
} from "@/lib/fundraising-orders";
import type {
  FundraisingPaymentMethod,
  FundraisingPaymentStatus,
  FundraisingPreparationStatus,
} from "@/types";
import {
  canManageFundraisingOrders,
  getCaller,
} from "../../../../_auth";

export const dynamic = "force-dynamic";

const PAYMENT_STATUSES: FundraisingPaymentStatus[] = ["UNPAID", "PAID"];
const PAYMENT_METHODS: FundraisingPaymentMethod[] = ["momo", "cash"];
const PREP_STATUSES: FundraisingPreparationStatus[] = [
  "PENDING",
  "IN_PREP",
  "READY",
  "COLLECTED",
];

interface PatchBody {
  paymentStatus?: FundraisingPaymentStatus;
  paymentMethod?: FundraisingPaymentMethod | null;
  preparationStatus?: FundraisingPreparationStatus;
  isArchived?: boolean;
}

/** Update an order's payment status, prep status, or archive flag. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const caller = await getCaller(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canManageFundraisingOrders(caller))) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id, orderId } = await params;
    const body = (await request.json().catch(() => ({}))) as PatchBody;
    const ref = adminDb
      .collection(FUNDRAISING_ORDERS_COLLECTION)
      .doc(orderId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const existing = snap.data()!;
    if (existing.braaiEventId !== id) {
      return NextResponse.json(
        { error: "Order does not belong to this braai" },
        { status: 400 }
      );
    }

    const callerDoc = await adminDb.collection("users").doc(caller.uid).get();
    const callerName =
      (callerDoc.data()?.name as string) || "Fundraising Member";
    const now = new Date();

    const updates: Record<string, unknown> = { updatedAt: now };

    if (body.paymentStatus !== undefined) {
      if (!PAYMENT_STATUSES.includes(body.paymentStatus)) {
        return NextResponse.json(
          { error: "Invalid payment status" },
          { status: 400 }
        );
      }
      updates.paymentStatus = body.paymentStatus;
      if (body.paymentStatus === "PAID") {
        if (body.paymentMethod && !PAYMENT_METHODS.includes(body.paymentMethod)) {
          return NextResponse.json(
            { error: "Invalid payment method" },
            { status: 400 }
          );
        }
        updates.paymentMethod =
          body.paymentMethod ?? existing.paymentMethod ?? null;
        updates.paidAt = now;
        updates.paidBy = caller.uid;
        updates.paidByName = callerName;
      } else {
        updates.paymentMethod = null;
        updates.paidAt = null;
        updates.paidBy = null;
        updates.paidByName = null;
      }
    } else if (body.paymentMethod !== undefined) {
      // Allow updating just the method (e.g. switch momo → cash) when already paid.
      if (
        body.paymentMethod !== null &&
        !PAYMENT_METHODS.includes(body.paymentMethod)
      ) {
        return NextResponse.json(
          { error: "Invalid payment method" },
          { status: 400 }
        );
      }
      updates.paymentMethod = body.paymentMethod;
    }

    if (body.preparationStatus !== undefined) {
      if (!PREP_STATUSES.includes(body.preparationStatus)) {
        return NextResponse.json(
          { error: "Invalid preparation status" },
          { status: 400 }
        );
      }
      updates.preparationStatus = body.preparationStatus;
      updates.preparationUpdatedAt = now;
      updates.preparationUpdatedBy = caller.uid;
      updates.preparationUpdatedByName = callerName;
    }

    if (body.isArchived !== undefined) {
      updates.isArchived = Boolean(body.isArchived);
    }

    if (Object.keys(updates).length === 1) {
      // Only `updatedAt` was set — no actual change requested.
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    await ref.update(updates);
    const updated = await ref.get();
    const order = serializeOrder(updated);

    return NextResponse.json({
      order: {
        ...order,
        braaiEventDate: order.braaiEventDate?.toISOString() ?? null,
        paidAt: order.paidAt?.toISOString() ?? null,
        preparationUpdatedAt: order.preparationUpdatedAt.toISOString(),
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error updating order:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update order", details: message },
      { status: 500 }
    );
  }
}

/** Hard-delete an order. Reserved for the Chairperson (SUPER_ADMIN). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const caller = await getCaller(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (caller.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only the Chairperson (Super Admin) can delete braai orders" },
        { status: 403 }
      );
    }

    const { id, orderId } = await params;
    const ref = adminDb
      .collection(FUNDRAISING_ORDERS_COLLECTION)
      .doc(orderId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (snap.data()?.braaiEventId !== id) {
      return NextResponse.json(
        { error: "Order does not belong to this braai" },
        { status: 400 }
      );
    }

    await ref.delete();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting order:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete order", details: message },
      { status: 500 }
    );
  }
}
