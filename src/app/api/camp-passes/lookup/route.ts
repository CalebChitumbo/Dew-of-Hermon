import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getCamp } from "@/lib/camps";
import {
  PASSES_COLLECTION,
  REGISTRATIONS_COLLECTION,
  looksLikeArrivalQr,
  normalizePassCode,
  serializeCampPass,
} from "@/lib/camp-passes";
import { getPassCaller } from "../_auth";
import type { CampPassStatus } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Read-only verdict for a scanned exit pass, for the gate screen.
 *
 * This never changes anything — the guard sees who the pass belongs to and what
 * the next scan would do, then confirms. The actual state change happens in
 * POST /api/camp-passes/scan, which re-checks the state atomically.
 */

interface Verdict {
  valid: boolean;
  nextAction: "CHECK_OUT" | "CHECK_IN" | null;
  headline: string;
  message: string;
}

function verdictFor(status: CampPassStatus, camperFirstName: string): Verdict {
  switch (status) {
    case "APPROVED":
      return {
        valid: true,
        nextAction: "CHECK_OUT",
        headline: "Valid — sign out",
        message: `Approved by all three sign-offs. Scanning now signs ${camperFirstName} out of camp.`,
      };
    case "OUT":
      return {
        valid: true,
        nextAction: "CHECK_IN",
        headline: "Valid — sign back in",
        message: `${camperFirstName} is currently out of camp. Scanning now signs them back in and spends the pass.`,
      };
    case "RETURNED":
      return {
        valid: false,
        nextAction: null,
        headline: "Already used",
        message:
          "This pass has already been used to sign out and sign back in. It is no longer valid — a new approval is needed.",
      };
    case "REJECTED":
      return {
        valid: false,
        nextAction: null,
        headline: "Rejected",
        message: "This request was declined. The camper may not leave camp.",
      };
    case "CANCELLED":
      return {
        valid: false,
        nextAction: null,
        headline: "Cancelled",
        message: "This pass was cancelled. The camper may not leave camp.",
      };
    case "PENDING_ADMISSIONS":
      return {
        valid: false,
        nextAction: null,
        headline: "Not approved",
        message: "Still waiting for Admissions. Do not let the camper out.",
      };
    case "PENDING_MANAGER":
      return {
        valid: false,
        nextAction: null,
        headline: "Not approved",
        message: "Still waiting for the Camp Manager. Do not let the camper out.",
      };
    case "PENDING_CHAIR":
      return {
        valid: false,
        nextAction: null,
        headline: "Not approved",
        message: "Still waiting for the Chairperson. Do not let the camper out.",
      };
    default:
      return {
        valid: false,
        nextAction: null,
        headline: "Not valid",
        message: "This pass cannot be scanned.",
      };
  }
}

export async function GET(request: Request) {
  try {
    const caller = await getPassCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!caller.can.gate && !caller.can.campAdmin) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const raw = searchParams.get("code") ?? searchParams.get("pass") ?? "";

    if (looksLikeArrivalQr(raw)) {
      return NextResponse.json(
        {
          error:
            "That's an arrival check-in pass, not an exit pass. Use the camp check-in page for arrivals.",
        },
        { status: 400 }
      );
    }

    const code = normalizePassCode(raw);
    if (!code) {
      return NextResponse.json({ error: "Missing pass code" }, { status: 400 });
    }

    const snap = await adminDb
      .collection(PASSES_COLLECTION)
      .where("passCode", "==", code)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json(
        {
          error:
            "No exit pass matches that code. It may have been cancelled, or it isn't a camp pass.",
        },
        { status: 404 }
      );
    }

    const doc = snap.docs[0];
    const data = doc.data();
    const pass = serializeCampPass(doc.id, data);
    const camp = getCamp(pass.campId);

    // The camper's arrival state matters at the gate: a camper who was never
    // checked in shouldn't be walking out on a pass.
    let registration: {
      firstName: string;
      lastName: string;
      gender: string | null;
      phone: string | null;
      churchOrSchool: string | null;
      parentName: string | null;
      parentAltPhone: string | null;
      emergencyContactName: string | null;
      emergencyContactPhone: string | null;
      checkedIn: boolean;
    } | null = null;
    const regDoc = await adminDb
      .collection(REGISTRATIONS_COLLECTION)
      .doc(pass.registrationId)
      .get();
    if (regDoc.exists) {
      const reg = regDoc.data()!;
      registration = {
        firstName: reg.firstName ?? "",
        lastName: reg.lastName ?? "",
        gender: reg.gender ?? null,
        phone: reg.phone ?? null,
        churchOrSchool: reg.churchOrSchool ?? null,
        parentName: reg.parentName ?? null,
        parentAltPhone: reg.parentAltPhone ?? null,
        emergencyContactName: reg.emergencyContactName ?? null,
        emergencyContactPhone: reg.emergencyContactPhone ?? null,
        checkedIn: reg.checkedIn ?? false,
      };
    }

    return NextResponse.json({
      pass,
      registration,
      camp: camp ? { id: camp.id, name: camp.name } : null,
      verdict: verdictFor(pass.status, pass.camperFirstName || "the camper"),
    });
  } catch (error) {
    console.error("GET /api/camp-passes/lookup error:", error);
    return NextResponse.json({ error: "Failed to look up the pass" }, { status: 500 });
  }
}
