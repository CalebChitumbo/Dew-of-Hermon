import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { filterToEnabled, loadMenuConfig } from "@/lib/fundraising-orders";

export const dynamic = "force-dynamic";

/**
 * Public menu config (items, prices, MoMo number, currency, campaign name).
 * Only enabled items are returned so buyers never see something the
 * Fundraising lead has temporarily hidden from sale.
 */
export async function GET() {
  try {
    const menu = await loadMenuConfig(adminDb);
    return NextResponse.json(filterToEnabled(menu));
  } catch (error) {
    console.error("Error loading public menu:", error);
    return NextResponse.json(
      { error: "Failed to load menu" },
      { status: 500 }
    );
  }
}
