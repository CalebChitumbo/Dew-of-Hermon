import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getCamp, DEFAULT_CAMP_ID } from "@/lib/camps";
import { slugify } from "@/lib/pdf-helpers";
import { buildCampRegistrationsWorkbook } from "@/lib/camp-export";
import {
  getCallerWithDepartments,
  callerCanManageCampRegistrations,
} from "../_auth";
import { serializeRegistration } from "../_serialize";

export const dynamic = "force-dynamic";

/**
 * GET: the full camper register for a camp as an .xlsx download.
 *
 * Same gate as the registrations list — this carries minors' medical notes and
 * guardian contact details, so it is manage-tier only, never the read-only
 * status tier.
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
    const campId = url.searchParams.get("campId") || DEFAULT_CAMP_ID;
    const camp = getCamp(campId);
    if (!camp) {
      return NextResponse.json({ error: "Unknown camp" }, { status: 400 });
    }

    const snapshot = await adminDb
      .collection("campRegistrations")
      .where("campId", "==", campId)
      .get();

    // Oldest first: row 1 is the first camper who registered, which is the
    // order the office reads the register in. (The dashboard table shows
    // newest first — that's a screen convenience, not the register's order.)
    const registrations = snapshot.docs
      .map((doc) => serializeRegistration(doc.id, doc.data()))
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));

    const exportedAt = new Date();
    const workbook = await buildCampRegistrationsWorkbook(
      registrations,
      camp,
      caller.name,
      exportedAt
    );

    const filename = `${slugify(camp.name, "camp")}-campers-${
      exportedAt.toISOString().slice(0, 10)
    }.xlsx`;

    return new NextResponse(new Uint8Array(workbook), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(workbook.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error exporting camp registrations:", message, error);
    return NextResponse.json(
      { error: `Failed to export registrations: ${message}` },
      { status: 500 }
    );
  }
}
