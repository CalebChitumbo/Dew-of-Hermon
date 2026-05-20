import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { generateOrderNumber } from "@/lib/fundraising-menu";
import {
  FUNDRAISING_ORDERS_COLLECTION,
  OrderValidationError,
  filterToEnabled,
  generateUniqueOrderNumber,
  loadMenuConfig,
  serializeOrder,
  validateOrderPayload,
} from "@/lib/fundraising-orders";
import { canManageFundraisingOrders, getCaller } from "../../../_auth";

export const dynamic = "force-dynamic";

/** List orders for a single braai event. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const snap = await adminDb
      .collection(FUNDRAISING_ORDERS_COLLECTION)
      .where("braaiEventId", "==", id)
      .get();

    const orders = snap.docs.map((d) => serializeOrder(d));
    // Newest first for the management view.
    orders.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    return NextResponse.json({
      orders: orders.map((o) => ({
        ...o,
        braaiEventDate: o.braaiEventDate?.toISOString() ?? null,
        paidAt: o.paidAt?.toISOString() ?? null,
        preparationUpdatedAt: o.preparationUpdatedAt.toISOString(),
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error listing braai orders:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load orders", details: message },
      { status: 500 }
    );
  }
}

/**
 * Create an order on behalf of a buyer (entered by a signed-in Fundraising
 * member at the counter). Same shape as the public endpoint, but the order
 * is stamped with `submittedBy: "member"` so we can tell self-serve orders
 * apart from internally-entered ones.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const rawBody = await request.json().catch(() => null);
    // Force braaiEventId to the route param so a member can't accidentally
    // submit to a different event.
    const body =
      rawBody && typeof rawBody === "object"
        ? { ...(rawBody as Record<string, unknown>), braaiEventId: id }
        : { braaiEventId: id };

    const menu = filterToEnabled(await loadMenuConfig(adminDb));
    const validated = validateOrderPayload(body, menu);

    const braaiRef = adminDb.collection("braaiEvents").doc(id);
    const braaiSnap = await braaiRef.get();
    if (!braaiSnap.exists) {
      return NextResponse.json({ error: "Braai not found" }, { status: 404 });
    }
    const braaiData = braaiSnap.data()!;
    if (braaiData.isArchived) {
      return NextResponse.json(
        { error: "That braai is archived" },
        { status: 410 }
      );
    }

    const callerDoc = await adminDb.collection("users").doc(caller.uid).get();
    const callerName =
      (callerDoc.data()?.name as string) || "Fundraising Member";

    const orderNumber = await generateUniqueOrderNumber(
      adminDb,
      generateOrderNumber
    );

    const eventDate: Date | null = braaiData.eventDate?.toDate?.() ?? null;
    const now = new Date();
    const doc = {
      orderNumber,
      braaiEventId: id,
      braaiEventTitle: (braaiData.title as string) || "Fundraising Braai",
      braaiEventDate: eventDate,
      customerName: validated.customerName,
      customerPhone: validated.customerPhone,
      pickupTime: validated.pickupTime,
      customPickupTime: validated.customPickupTime,
      notes: validated.notes,
      items: validated.items,
      total: validated.total,
      currency: menu.currency,
      paymentStatus: "UNPAID" as const,
      paymentMethod: null,
      paidAt: null,
      paidBy: null,
      paidByName: null,
      preparationStatus: "PENDING" as const,
      preparationUpdatedAt: now,
      preparationUpdatedBy: caller.uid,
      preparationUpdatedByName: callerName,
      submittedBy: "member" as const,
      submittedByUserId: caller.uid,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await adminDb.collection(FUNDRAISING_ORDERS_COLLECTION).add(doc);
    const saved = await ref.get();
    const serialized = serializeOrder(saved);

    return NextResponse.json(
      {
        order: {
          ...serialized,
          braaiEventDate: serialized.braaiEventDate?.toISOString() ?? null,
          paidAt: serialized.paidAt?.toISOString() ?? null,
          preparationUpdatedAt:
            serialized.preparationUpdatedAt.toISOString(),
          createdAt: serialized.createdAt.toISOString(),
          updatedAt: serialized.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json(
        { error: error.message, field: error.field },
        { status: 400 }
      );
    }
    console.error("Error creating order on behalf:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create order", details: message },
      { status: 500 }
    );
  }
}
