import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  MEALS_COLLECTION,
  REGISTRATIONS_COLLECTION,
  buildMealScanId,
  getSitting,
  looksLikeExitPassQr,
  normalizeMealCode,
} from "@/lib/camp-meals";
import { getMealCaller } from "../_auth";
import {
  isPaymentFlagged,
  serializeCamperForLine,
  serializeMealScan,
} from "../_serialize";

export const dynamic = "force-dynamic";

/** Firestore's "document already exists" gRPC status. */
const ALREADY_EXISTS = 6;

/**
 * POST /api/camp-meals/scan
 * Body: { code: string, sittingId: string, servedAt?: string, queuedOffline?: boolean }
 *
 * The serving line action: resolve the badge to a camper and tick them off
 * this sitting.
 *
 * The write is a create() against a deterministic id
 * (`${sittingId}_${registrationId}`), so a second scan of the same camper at
 * the same sitting collides rather than serving twice — whether it comes from
 * a second serving line scanning simultaneously or from an offline scan being
 * replayed on sync. That makes the endpoint idempotent, which is what lets the
 * scanner queue scans on a bad signal and flush them without reconciliation.
 *
 * An unpaid camper is served and flagged, never refused — a food refusal in
 * front of a queue of teenagers is not a decision this endpoint gets to make.
 */
export async function POST(request: Request) {
  try {
    const caller = await getMealCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!caller.can.serve) {
      return NextResponse.json(
        { error: "You don't have permission to serve camp meals." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawCode = typeof body.code === "string" ? body.code : "";
    const sittingId = typeof body.sittingId === "string" ? body.sittingId : "";

    if (!rawCode.trim()) {
      return NextResponse.json({ error: "Missing badge code" }, { status: 400 });
    }
    if (looksLikeExitPassQr(rawCode)) {
      return NextResponse.json(
        {
          error:
            "That's an exit pass, not a meal badge. Scan the camper's camp badge instead.",
        },
        { status: 400 }
      );
    }

    const sitting = getSitting(sittingId);
    if (!sitting) {
      return NextResponse.json(
        { error: "Unknown meal sitting" },
        { status: 400 }
      );
    }

    const code = normalizeMealCode(rawCode);
    if (!code) {
      return NextResponse.json(
        { error: "That QR code isn't a camper badge." },
        { status: 400 }
      );
    }

    const snapshot = await adminDb
      .collection(REGISTRATIONS_COLLECTION)
      .where("checkInCode", "==", code)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "No camper matches that badge" },
        { status: 404 }
      );
    }

    const regDoc = snapshot.docs[0];
    const reg = regDoc.data();

    if (reg.campId !== sitting.campId) {
      return NextResponse.json(
        { error: "That camper is registered for a different camp." },
        { status: 400 }
      );
    }

    const camper = serializeCamperForLine(regDoc.id, reg);
    const camperName = `${camper.firstName} ${camper.lastName}`.trim();
    const scanId = buildMealScanId(sitting.id, regDoc.id);
    const scanRef = adminDb.collection(MEALS_COLLECTION).doc(scanId);

    // An offline scan carries the time it actually happened; reject a
    // client-supplied future time so a wrong device clock can't reorder the
    // register.
    const now = new Date();
    const claimed = typeof body.servedAt === "string" ? new Date(body.servedAt) : null;
    const servedAt =
      claimed && !Number.isNaN(claimed.getTime()) && claimed <= now ? claimed : now;

    try {
      await scanRef.create({
        campId: sitting.campId,
        sittingId: sitting.id,
        date: sitting.date,
        slot: sitting.slot,
        registrationId: regDoc.id,
        camperName,
        camperGender: camper.gender,
        dietaryPreference: camper.dietaryPreference,
        allergies: camper.allergies,
        servedAt,
        servedBy: caller.uid,
        servedByName: caller.name || "Serving line",
        paymentFlagged: isPaymentFlagged(reg),
        queuedOffline: body.queuedOffline === true,
        createdAt: now,
      });
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === ALREADY_EXISTS) {
        // Already ticked off this sitting. Hand back the existing record so
        // the line can see who served them and when, rather than a bare error.
        const existing = await scanRef.get();
        return NextResponse.json(
          {
            error: `${camperName} has already had ${sitting.label.toLowerCase()}.`,
            alreadyServed: true,
            camper,
            sitting,
            scan: existing.exists
              ? serializeMealScan(existing.id, existing.data()!)
              : null,
          },
          { status: 409 }
        );
      }
      throw err;
    }

    const created = await scanRef.get();
    return NextResponse.json({
      success: true,
      camper,
      sitting,
      scan: serializeMealScan(created.id, created.data()!),
    });
  } catch (error) {
    console.error("POST /api/camp-meals/scan error:", error);
    return NextResponse.json(
      { error: "Failed to record the meal" },
      { status: 500 }
    );
  }
}
