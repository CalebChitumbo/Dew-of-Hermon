import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { MEALS_COLLECTION, buildMealScanId, getSitting } from "@/lib/camp-meals";
import { getMealCaller } from "../_auth";
import { serializeMealScan } from "../_serialize";

export const dynamic = "force-dynamic";

/**
 * POST /api/camp-meals/undo
 * Body: { sittingId: string, registrationId: string }
 *
 * Reverses a mis-scan (wrong camper, wrong sitting) by deleting the scan
 * document, which frees the deterministic id for a correct scan. Anyone who
 * can serve can undo — mis-scans happen at the line, and a server who has to
 * find a manager to fix one will just stop scanning.
 */
export async function POST(request: Request) {
  try {
    const caller = await getMealCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!caller.can.serve) {
      return NextResponse.json(
        { error: "You don't have permission to change the meal register." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const sittingId = typeof body.sittingId === "string" ? body.sittingId : "";
    const registrationId =
      typeof body.registrationId === "string" ? body.registrationId : "";

    if (!registrationId) {
      return NextResponse.json({ error: "Missing camper" }, { status: 400 });
    }
    const sitting = getSitting(sittingId);
    if (!sitting) {
      return NextResponse.json({ error: "Unknown meal sitting" }, { status: 400 });
    }

    const scanRef = adminDb
      .collection(MEALS_COLLECTION)
      .doc(buildMealScanId(sitting.id, registrationId));
    const existing = await scanRef.get();

    if (!existing.exists) {
      // Nothing to undo — treat as success so a retried undo is harmless.
      return NextResponse.json({ success: true, removed: null });
    }

    const removed = serializeMealScan(existing.id, existing.data()!);
    await scanRef.delete();

    return NextResponse.json({ success: true, removed });
  } catch (error) {
    console.error("POST /api/camp-meals/undo error:", error);
    return NextResponse.json(
      { error: "Failed to undo the meal scan" },
      { status: 500 }
    );
  }
}
