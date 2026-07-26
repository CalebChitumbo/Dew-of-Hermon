import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { PASSES_COLLECTION, serializeCampPass } from "@/lib/camp-passes";
import { sendCampPassEmail } from "@/lib/camp-pass-email";
import { getPassCaller } from "../../_auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/camp-passes/[id]/resend
 *
 * Re-send the issued ticket email (lost email, wrong phone, printing at the
 * desk). Only for a live pass — a spent, rejected, or cancelled pass has no
 * scannable code left to send.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getPassCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const ref = adminDb.collection(PASSES_COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Exit pass not found" }, { status: 404 });
    }
    const pass = doc.data()!;

    const isRequester = pass.requestedByUid === caller.uid;
    const isStaff =
      caller.can.admissions ||
      caller.can.manager ||
      caller.can.chair ||
      caller.can.campAdmin;
    if (!isRequester && !isStaff) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    if (pass.status !== "APPROVED" && pass.status !== "OUT") {
      return NextResponse.json(
        { error: "Only a live, approved pass can be re-sent." },
        { status: 409 }
      );
    }

    const result = await sendCampPassEmail(id, pass);
    if (!result.queued) {
      return NextResponse.json(
        { error: result.reason || "Could not send the pass email." },
        { status: 400 }
      );
    }

    const updated = await ref.get();
    return NextResponse.json({
      success: true,
      to: result.to,
      pass: serializeCampPass(updated.id, updated.data()!),
    });
  } catch (error) {
    console.error("POST /api/camp-passes/[id]/resend error:", error);
    return NextResponse.json({ error: "Failed to re-send the pass" }, { status: 500 });
  }
}
