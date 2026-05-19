import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { loadMenuConfig } from "@/lib/fundraising-orders";

export const dynamic = "force-dynamic";

/**
 * Public menu config (items, prices, MoMo number, currency, campaign name).
 * Consumed by the order page and the printed receipt.
 */
export async function GET() {
  try {
    const menu = await loadMenuConfig(adminDb);
    return NextResponse.json(menu);
  } catch (error) {
    console.error("Error loading public menu:", error);
    return NextResponse.json(
      { error: "Failed to load menu" },
      { status: 500 }
    );
  }
}
