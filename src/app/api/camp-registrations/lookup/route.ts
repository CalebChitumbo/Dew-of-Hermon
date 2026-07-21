import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  getCallerWithDepartments,
  callerCanManageCampRegistrations,
} from "../_auth";
import { serializeRegistration } from "../_serialize";
import { normalizeCheckInCode } from "@/lib/camp-registration-email";
import { getCamp } from "@/lib/camps";

export const dynamic = "force-dynamic";

/**
 * Admin: resolve a scanned/typed check-in code to a registration.
 * GET /api/camp-registrations/lookup?code=ABCD-EFGH-JKMN (dashes optional,
 * full check-in URLs from a QR scan are also accepted).
 */
export async function GET(request: Request) {
  try {
    const caller = await getCallerWithDepartments();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!(await callerCanManageCampRegistrations(caller))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const url = new URL(request.url);
    const raw = url.searchParams.get("code") ?? "";
    const code = normalizeCheckInCode(raw);
    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const snapshot = await adminDb
      .collection("campRegistrations")
      .where("checkInCode", "==", code)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "No registration matches that code" },
        { status: 404 }
      );
    }

    const doc = snapshot.docs[0];
    const registration = serializeRegistration(doc.id, doc.data());
    const camp = getCamp(registration.campId);

    return NextResponse.json({
      registration,
      camp: camp
        ? { id: camp.id, name: camp.name, fee: camp.fee, currency: camp.currency }
        : null,
    });
  } catch (error) {
    console.error("Error looking up camp registration:", error);
    return NextResponse.json(
      { error: "Failed to look up registration" },
      { status: 500 }
    );
  }
}
