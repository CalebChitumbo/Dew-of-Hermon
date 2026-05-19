import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FUNDRAISING_MENU_ITEM_KEYS } from "@/lib/fundraising-menu";
import {
  FUNDRAISING_MENU_DOC_PATH,
  loadMenuConfig,
} from "@/lib/fundraising-orders";
import { canPlanBraai, getCaller } from "../braai/_auth";

export const dynamic = "force-dynamic";

/** Read menu config (auth required for the settings page). */
export async function GET(request: NextRequest) {
  try {
    const caller = await getCaller(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const menu = await loadMenuConfig(adminDb);
    return NextResponse.json(menu);
  } catch (error) {
    console.error("Error loading menu config:", error);
    return NextResponse.json(
      { error: "Failed to load menu" },
      { status: 500 }
    );
  }
}

interface PatchBody {
  itemPrices?: Record<string, number | string>;
  momoNumber?: string;
}

/**
 * Update menu prices and/or the MoMo number. Items themselves are
 * hardcoded, so only known keys are accepted in `itemPrices`.
 */
export async function PATCH(request: NextRequest) {
  try {
    const caller = await getCaller(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canPlanBraai(caller))) {
      return NextResponse.json(
        { error: "Only the Fundraising lead can edit menu prices" },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as PatchBody;
    const updates: Record<string, unknown> = {};

    if (body.itemPrices && typeof body.itemPrices === "object") {
      const cleaned: Record<string, number> = {};
      for (const [key, raw] of Object.entries(body.itemPrices)) {
        if (!FUNDRAISING_MENU_ITEM_KEYS.has(key)) {
          return NextResponse.json(
            { error: `Unknown menu item: ${key}` },
            { status: 400 }
          );
        }
        const num = Number(raw);
        if (!Number.isFinite(num) || num < 0 || num > 100000) {
          return NextResponse.json(
            { error: `Price for ${key} must be between 0 and 100000` },
            { status: 400 }
          );
        }
        cleaned[key] = Math.round(num);
      }
      // Merge over existing so prices for items omitted from the payload are
      // preserved.
      const existing = await adminDb.doc(FUNDRAISING_MENU_DOC_PATH).get();
      const prior = (existing.exists ? existing.data()?.itemPrices : null) || {};
      updates.itemPrices = { ...prior, ...cleaned };
    }

    if (body.momoNumber !== undefined) {
      if (typeof body.momoNumber !== "string") {
        return NextResponse.json(
          { error: "Invalid MoMo number" },
          { status: 400 }
        );
      }
      const trimmed = body.momoNumber.trim();
      if (trimmed.length > 60) {
        return NextResponse.json(
          { error: "MoMo number is too long" },
          { status: 400 }
        );
      }
      updates.momoNumber = trimmed;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Provide itemPrices and/or momoNumber to update" },
        { status: 400 }
      );
    }

    const callerDoc = await adminDb.collection("users").doc(caller.uid).get();
    const callerName =
      (callerDoc.data()?.name as string) || "Fundraising Lead";
    updates.updatedAt = new Date();
    updates.updatedBy = caller.uid;
    updates.updatedByName = callerName;

    await adminDb
      .doc(FUNDRAISING_MENU_DOC_PATH)
      .set(updates, { merge: true });

    const menu = await loadMenuConfig(adminDb);
    return NextResponse.json(menu);
  } catch (error) {
    console.error("Error updating menu config:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update menu", details: message },
      { status: 500 }
    );
  }
}
