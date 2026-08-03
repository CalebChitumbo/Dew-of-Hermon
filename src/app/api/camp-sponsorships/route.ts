import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getCallerToken } from "@/lib/server-auth";
import { getCamp, DEFAULT_CAMP_ID } from "@/lib/camps";
import {
  getCallerWithDepartments,
  callerCanManageCampRegistrations,
} from "../camp-registrations/_auth";
import { serializeSponsorship } from "./_serialize";
import type { CampSponsorshipPledgeType } from "@/types";

export const dynamic = "force-dynamic";

const VALID_PLEDGE_TYPES: CampSponsorshipPledgeType[] = ["SLOTS", "AMOUNT"];

// Sanity ceilings so a typo can't create an absurd pledge.
const MAX_SLOTS = 500;
const MAX_AMOUNT = 1_000_000;

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalEmail(value: unknown): string | null {
  const trimmed = optionalString(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

/**
 * If the caller presented a valid credential, returns { uid, email } for
 * stamping onto a new pledge. Returns null when they did not —
 * anonymous pledges are allowed, sponsors are often not app users.
 */
async function getOptionalSubmitter(): Promise<
  { uid: string; email: string | null } | null
> {
  const token = await getCallerToken();
  return token ? { uid: token.uid, email: token.email } : null;
}

// GET: List sponsorship pledges (camp managers only). Optional ?campId filter.
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

    // Filter by campId only and sort in memory to avoid requiring a composite
    // Firestore index — sponsor counts are small.
    const snapshot = await adminDb
      .collection("campSponsorships")
      .where("campId", "==", campId)
      .get();

    const sponsorships = snapshot.docs
      .map((doc) => serializeSponsorship(doc.id, doc.data()))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return NextResponse.json({ sponsorships });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching camp sponsorships:", message, error);
    return NextResponse.json(
      { error: `Failed to fetch sponsorships: ${message}` },
      { status: 500 }
    );
  }
}

// POST: Public submission of a sponsorship pledge.
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const campId: string = (body.campId || DEFAULT_CAMP_ID).toString();
    const camp = getCamp(campId);
    if (!camp) {
      return NextResponse.json({ error: "Unknown camp" }, { status: 400 });
    }

    const sponsorName = optionalString(body.sponsorName);
    if (!sponsorName) {
      return NextResponse.json(
        { error: "Missing required field: sponsorName" },
        { status: 400 }
      );
    }
    const phone = optionalString(body.phone);
    if (!phone) {
      return NextResponse.json(
        { error: "Missing required field: phone" },
        { status: 400 }
      );
    }

    const pledgeType = body.pledgeType as CampSponsorshipPledgeType;
    if (!VALID_PLEDGE_TYPES.includes(pledgeType)) {
      return NextResponse.json({ error: "Invalid pledge type" }, { status: 400 });
    }

    // Slots and amount are always derived from each other via the camp fee so
    // the register can reason in either unit regardless of how the sponsor
    // expressed the pledge.
    let slotsPledged: number;
    let amountPledged: number;
    if (pledgeType === "SLOTS") {
      const slots = Number(body.slotsPledged);
      if (!Number.isInteger(slots) || slots < 1 || slots > MAX_SLOTS) {
        return NextResponse.json(
          { error: `Number of youth must be a whole number between 1 and ${MAX_SLOTS}` },
          { status: 400 }
        );
      }
      slotsPledged = slots;
      amountPledged = slots * camp.fee;
    } else {
      const amount = Number(body.amountPledged);
      if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
        return NextResponse.json({ error: "Invalid pledge amount" }, { status: 400 });
      }
      if (amount < camp.fee) {
        return NextResponse.json(
          {
            error: `The minimum pledge is ${camp.currency} ${camp.fee} — the fee that sends one youth to camp`,
          },
          { status: 400 }
        );
      }
      amountPledged = amount;
      slotsPledged = Math.floor(amount / camp.fee);
    }

    const submitter = await getOptionalSubmitter();

    const now = new Date();
    const ref = adminDb.collection("campSponsorships").doc();

    const sponsorshipData = {
      campId,
      sponsorName,
      organization: optionalString(body.organization),
      phone,
      email: optionalEmail(body.email),
      pledgeType,
      slotsPledged,
      amountPledged,
      slotsAssigned: 0,
      notes: optionalString(body.notes),
      paymentStatus: "UNPAID",
      amountReceived: null,
      paymentReference: null,
      paymentNotes: null,
      paymentMarkedBy: null,
      paymentMarkedByName: null,
      paymentMarkedAt: null,
      submittedByUid: submitter?.uid ?? null,
      submittedByEmail: submitter?.email?.toLowerCase() ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(sponsorshipData);

    return NextResponse.json(
      {
        sponsorship: serializeSponsorship(ref.id, sponsorshipData),
        camp: { id: camp.id, name: camp.name, fee: camp.fee, currency: camp.currency },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating camp sponsorship:", error);
    return NextResponse.json(
      { error: "Failed to submit sponsorship pledge" },
      { status: 500 }
    );
  }
}
