import { NextResponse } from "next/server";
import type { DocumentData, Query } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  PASSES_COLLECTION,
  REGISTRATIONS_COLLECTION,
  createCampPass,
  findActivePass,
  notifyStageApprovers,
  serializeCampPass,
} from "@/lib/camp-passes";
import {
  getPassCaller,
  canSeeQueue,
  callerOwnsRegistration,
  getOwnedRegistrationIds,
} from "./_auth";
import type { CampPassStage, CampPassStatus } from "@/types";

export const dynamic = "force-dynamic";

const MAX_REASON_LENGTH = 500;
const MAX_FIELD_LENGTH = 120;
/** A pass is for a trip out and back, not an open-ended absence. */
const MAX_RETURN_WINDOW_DAYS = 14;

function trimmedOrNull(value: unknown, max = MAX_FIELD_LENGTH): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

async function getPassesForRegistrations(registrationIds: string[]) {
  const results: { id: string; data: FirebaseFirestore.DocumentData }[] = [];
  // Firestore 'in' caps at 30 values, so page through the caller's campers.
  for (let i = 0; i < registrationIds.length; i += 30) {
    const chunk = registrationIds.slice(i, i + 30);
    const snap = await adminDb
      .collection(PASSES_COLLECTION)
      .where("registrationId", "in", chunk)
      .get();
    snap.docs.forEach((doc) => results.push({ id: doc.id, data: doc.data() }));
  }
  return results;
}

// ─── GET /api/camp-passes?scope=queue|mine&campId=&status= ───

export async function GET(request: Request) {
  try {
    const caller = await getPassCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") === "mine" ? "mine" : "queue";
    const campId = searchParams.get("campId");
    const statusFilter = searchParams.get("status") as CampPassStatus | null;

    let rows: { id: string; data: FirebaseFirestore.DocumentData }[];
    let includeCode = false;

    if (scope === "mine") {
      // A camper/guardian sees their own campers' passes — and, for a live
      // pass, the scannable code itself so the ticket renders in-app.
      const owned = await getOwnedRegistrationIds(caller);
      rows = owned.length > 0 ? await getPassesForRegistrations(owned) : [];
      includeCode = true;
    } else {
      if (!canSeeQueue(caller)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
      let query: Query<DocumentData> = adminDb.collection(PASSES_COLLECTION);
      if (campId) query = query.where("campId", "==", campId);
      // Sorting happens in JS below to avoid a where + orderBy composite index;
      // camp-week volumes are small.
      const snap = await query.get();
      rows = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    }

    const passes = rows
      .map(({ id, data }) => {
        const pass = serializeCampPass(id, data, { includeCode });
        // Never hand back a code for a pass that can't be scanned any more —
        // a spent or rejected pass should not render as a live ticket.
        if (
          includeCode &&
          pass.status !== "APPROVED" &&
          pass.status !== "OUT"
        ) {
          pass.passCode = null;
        }
        return pass;
      })
      .filter((pass) => (campId ? pass.campId === campId : true))
      .filter((pass) => (statusFilter ? pass.status === statusFilter : true))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return NextResponse.json({
      passes,
      can: scope === "queue" ? caller.can : undefined,
    });
  } catch (error) {
    console.error("GET /api/camp-passes error:", error);
    return NextResponse.json({ error: "Failed to load exit passes" }, { status: 500 });
  }
}

// ─── POST /api/camp-passes ───
// Body: { registrationId, reason, expectedReturnAt, destination?, escortName?, escortPhone? }

export async function POST(request: Request) {
  try {
    const caller = await getPassCaller();
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const registrationId = trimmedOrNull(body.registrationId);
    const reason = trimmedOrNull(body.reason, MAX_REASON_LENGTH);
    const destination = trimmedOrNull(body.destination);
    const escortName = trimmedOrNull(body.escortName);
    const escortPhone = trimmedOrNull(body.escortPhone, 40);

    if (!registrationId) {
      return NextResponse.json({ error: "registrationId is required" }, { status: 400 });
    }
    if (!reason || reason.length < 3) {
      return NextResponse.json(
        { error: "Please give a reason for leaving camp." },
        { status: 400 }
      );
    }

    const expectedReturnAt = new Date(String(body.expectedReturnAt ?? ""));
    if (Number.isNaN(expectedReturnAt.getTime())) {
      return NextResponse.json(
        { error: "A valid expected return date and time is required." },
        { status: 400 }
      );
    }
    const now = new Date();
    if (expectedReturnAt.getTime() <= now.getTime()) {
      return NextResponse.json(
        { error: "The expected return time must be in the future." },
        { status: 400 }
      );
    }
    const maxReturn = new Date(
      now.getTime() + MAX_RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    if (expectedReturnAt.getTime() > maxReturn.getTime()) {
      return NextResponse.json(
        {
          error: `The expected return time must be within ${MAX_RETURN_WINDOW_DAYS} days. For a longer absence, speak to the camp team.`,
        },
        { status: 400 }
      );
    }

    const regRef = adminDb.collection(REGISTRATIONS_COLLECTION).doc(registrationId);
    const regDoc = await regRef.get();
    if (!regDoc.exists) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }
    const reg = regDoc.data()!;

    // Two legitimate ways in: the admissions desk logging a walk-up request,
    // or the camper/guardian who owns the registration asking online.
    const ownsRegistration = callerOwnsRegistration(caller, reg);
    if (!caller.can.admissions && !ownsRegistration) {
      return NextResponse.json(
        {
          error:
            "You can only request a pass for a camper you registered. Ask the admissions desk for anyone else.",
        },
        { status: 403 }
      );
    }

    // A desk request has already been seen by admissions, so it opens at the
    // Camp Manager; an online request still needs the admissions sign-off.
    const asDesk = caller.can.admissions;
    const openAtStage: CampPassStage = asDesk ? "MANAGER" : "ADMISSIONS";

    const existing = await findActivePass(registrationId);
    if (existing) {
      return NextResponse.json(
        {
          error:
            existing.status === "OUT"
              ? "This camper is currently signed out of camp on an active pass."
              : "This camper already has an exit pass in progress. Cancel it before requesting another.",
          passId: existing.id,
        },
        { status: 409 }
      );
    }

    const camperName = `${reg.firstName ?? ""} ${reg.lastName ?? ""}`.trim();
    const passId = await createCampPass({
      campId: reg.campId,
      registrationId,
      camperName,
      camperFirstName: reg.firstName ?? camperName,
      camperPhone: reg.phone ?? null,
      contactEmail: reg.parentEmail ?? reg.email ?? caller.email ?? null,
      reason,
      destination,
      escortName,
      escortPhone,
      expectedReturnAt,
      requestSource: asDesk ? "ADMISSIONS" : "CAMPER",
      requestedByUid: caller.uid,
      requestedByName: caller.name || caller.email || "Camp team",
      openAtStage,
    });

    notifyStageApprovers({
      passId,
      stage: openAtStage,
      camperName,
      reason,
      expectedReturnAt,
      actorName: caller.name || "The admissions desk",
    }).catch(console.error);

    return NextResponse.json(
      {
        id: passId,
        status: openAtStage === "MANAGER" ? "PENDING_MANAGER" : "PENDING_ADMISSIONS",
        // The gate should not be admitting a camper who never arrived — worth
        // surfacing to whoever logged the request.
        warning:
          reg.checkedIn === true
            ? null
            : "This camper is not marked as checked in to camp yet.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/camp-passes error:", error);
    return NextResponse.json(
      { error: "Failed to create the exit pass request" },
      { status: 500 }
    );
  }
}
