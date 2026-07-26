import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  PASSES_COLLECTION,
  looksLikeArrivalQr,
  notifyPassScan,
  scanCampPass,
  serializeCampPass,
  type ScanAction,
} from "@/lib/camp-passes";
import { getPassCaller } from "../_auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/camp-passes/scan
 * Body: { code: string, expect?: "CHECK_OUT" | "CHECK_IN" }
 *
 * The gate action. `scanCampPass` resolves the code, verifies the pass is in
 * exactly the expected state, and moves it on inside one transaction — so the
 * same QR can be scanned out once and back in once, and never again. Two guards
 * scanning simultaneously cannot both succeed.
 */
export async function POST(request: Request) {
  try {
    const caller = await getPassCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!caller.can.gate) {
      return NextResponse.json(
        { error: "You don't have permission to scan passes at the gate." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawCode = typeof body.code === "string" ? body.code : "";
    const expect =
      body.expect === "CHECK_OUT" || body.expect === "CHECK_IN"
        ? (body.expect as ScanAction)
        : undefined;

    if (!rawCode.trim()) {
      return NextResponse.json({ error: "Missing pass code" }, { status: 400 });
    }
    if (looksLikeArrivalQr(rawCode)) {
      return NextResponse.json(
        {
          error:
            "That's an arrival check-in pass, not an exit pass. Use the camp check-in page for arrivals.",
        },
        { status: 400 }
      );
    }

    const result = await scanCampPass(
      rawCode,
      { uid: caller.uid, name: caller.name || "Gate" },
      expect
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, refusal: result.refusal },
        { status: result.httpStatus }
      );
    }

    notifyPassScan({
      passId: result.passId,
      camperName: (result.pass.camperName as string) || "A camper",
      action: result.action,
      guardName: caller.name || "the gate team",
      late: result.late,
      expectedReturnAt: result.pass.expectedReturnAt?.toDate?.() ?? null,
    }).catch(console.error);

    const updated = await adminDb
      .collection(PASSES_COLLECTION)
      .doc(result.passId)
      .get();

    return NextResponse.json({
      success: true,
      action: result.action,
      late: result.late,
      pass: serializeCampPass(updated.id, updated.data()!),
    });
  } catch (error) {
    console.error("POST /api/camp-passes/scan error:", error);
    return NextResponse.json({ error: "Failed to record the scan" }, { status: 500 });
  }
}
