import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { generateOrderNumber } from "@/lib/fundraising-menu";
import {
  FUNDRAISING_ORDERS_COLLECTION,
  OrderValidationError,
  generateUniqueOrderNumber,
  loadMenuConfig,
  validateOrderPayload,
} from "@/lib/fundraising-orders";

export const dynamic = "force-dynamic";

/**
 * Public order submission. No authentication required: anyone with the
 * order page URL can place an order. The server recomputes the total from
 * the loaded menu prices so a tampered client total is ignored. The braai
 * event referenced by `braaiEventId` must exist and be non-archived.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const menu = await loadMenuConfig(adminDb);

    const validated = validateOrderPayload(body, menu);

    // Confirm the braai event exists, is non-archived, and is upcoming.
    const braaiRef = adminDb.collection("braaiEvents").doc(validated.braaiEventId);
    const braaiSnap = await braaiRef.get();
    if (!braaiSnap.exists) {
      return NextResponse.json(
        { error: "That braai isn't available for orders." },
        { status: 404 }
      );
    }
    const braaiData = braaiSnap.data()!;
    if (braaiData.isArchived) {
      return NextResponse.json(
        { error: "That braai is no longer accepting orders." },
        { status: 410 }
      );
    }
    const eventDate: Date | null = braaiData.eventDate?.toDate?.() ?? null;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (eventDate && eventDate.getTime() < startOfToday.getTime()) {
      return NextResponse.json(
        { error: "That braai has already happened." },
        { status: 410 }
      );
    }

    const orderNumber = await generateUniqueOrderNumber(
      adminDb,
      generateOrderNumber
    );

    const now = new Date();
    const doc = {
      orderNumber,
      braaiEventId: validated.braaiEventId,
      braaiEventTitle: (braaiData.title as string) || "Fundraising Braai",
      braaiEventDate: eventDate || null,
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
      preparationUpdatedBy: null,
      preparationUpdatedByName: null,
      submittedBy: "buyer" as const,
      submittedByUserId: null,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await adminDb.collection(FUNDRAISING_ORDERS_COLLECTION).add(doc);

    return NextResponse.json(
      {
        order: {
          id: ref.id,
          orderNumber,
          total: validated.total,
          currency: menu.currency,
          items: validated.items,
          customerName: validated.customerName,
          customerPhone: validated.customerPhone,
          pickupTime: validated.pickupTime,
          customPickupTime: validated.customPickupTime,
          braaiEventTitle: doc.braaiEventTitle,
          braaiEventDate: eventDate ? eventDate.toISOString() : null,
          momoNumber: menu.momoNumber,
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
    console.error("Error submitting public order:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to place order", details: message },
      { status: 500 }
    );
  }
}
