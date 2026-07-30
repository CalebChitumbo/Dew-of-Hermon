import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getCamp, DEFAULT_CAMP_ID } from "@/lib/camps";
import { campSettingsRef, capacityFromSnapshot } from "@/lib/camp-capacity";
import {
  getCallerWithDepartments,
  callerCanManageCampRegistrations,
} from "./_auth";
import { serializeRegistration } from "./_serialize";
import {
  generateCheckInCode,
  sendCampRegistrationEmail,
} from "@/lib/camp-registration-email";
import type {
  CampDropoffLocation,
  CampGender,
  CampPaymentStatus,
  CampTShirtSize,
} from "@/types";

type RegistrantType = "self" | "other";

const VALID_REGISTRANT_TYPES: RegistrantType[] = ["self", "other"];

export const dynamic = "force-dynamic";

const VALID_GENDERS: CampGender[] = ["MALE", "FEMALE"];
const VALID_TSHIRT_SIZES: CampTShirtSize[] = ["XS", "S", "M", "L", "XL", "XXL"];
const VALID_DROPOFF: CampDropoffLocation[] = ["CHURCH", "CAMPSITE"];

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalEmail(value: unknown): string | null {
  const trimmed = optionalString(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

/**
 * If a session cookie is present and valid, returns { uid, email } for
 * stamping onto a new registration. Returns null on no cookie or invalid
 * cookie — anonymous submission is still allowed.
 */
async function getOptionalSubmitter(): Promise<
  { uid: string; email: string | null } | null
> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    if (!session?.value) return null;
    const decoded = await adminAuth.verifySessionCookie(session.value);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}

// GET: List camp registrations (ADMIN+ only). Optional ?campId filter.
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
    // Firestore index. Camp capacity is small (tens of rows), so this is fine.
    const snapshot = await adminDb
      .collection("campRegistrations")
      .where("campId", "==", campId)
      .get();

    const registrations = snapshot.docs
      .map((doc) => serializeRegistration(doc.id, doc.data()))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return NextResponse.json({ registrations });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching camp registrations:", message, error);
    return NextResponse.json(
      { error: `Failed to fetch registrations: ${message}` },
      { status: 500 }
    );
  }
}

// POST: Public submission of a camp registration.
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const campId: string = (body.campId || DEFAULT_CAMP_ID).toString();
    const camp = getCamp(campId);
    if (!camp) {
      return NextResponse.json({ error: "Unknown camp" }, { status: 400 });
    }

    const required = [
      "firstName",
      "lastName",
      "dateOfBirth",
      "gender",
      "phone",
      "emergencyContactName",
      "emergencyContactPhone",
    ];
    for (const key of required) {
      if (!body[key] || typeof body[key] !== "string" || !body[key].trim()) {
        return NextResponse.json(
          { error: `Missing required field: ${key}` },
          { status: 400 }
        );
      }
    }

    const gender = body.gender as CampGender;
    if (!VALID_GENDERS.includes(gender)) {
      return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
    }

    let tshirtSize: CampTShirtSize | null = null;
    if (body.tshirtSize) {
      if (!VALID_TSHIRT_SIZES.includes(body.tshirtSize as CampTShirtSize)) {
        return NextResponse.json({ error: "Invalid t-shirt size" }, { status: 400 });
      }
      tshirtSize = body.tshirtSize as CampTShirtSize;
    }

    let dropoffLocation: CampDropoffLocation | null = null;
    if (body.dropoffLocation) {
      const upper = String(body.dropoffLocation).toUpperCase();
      if (!VALID_DROPOFF.includes(upper as CampDropoffLocation)) {
        return NextResponse.json({ error: "Invalid drop-off location" }, { status: 400 });
      }
      dropoffLocation = upper as CampDropoffLocation;
    }

    let registrantType: RegistrantType | null = null;
    if (body.registrantType) {
      if (!VALID_REGISTRANT_TYPES.includes(body.registrantType as RegistrantType)) {
        return NextResponse.json(
          { error: "Invalid registrant type" },
          { status: 400 }
        );
      }
      registrantType = body.registrantType as RegistrantType;
    }

    if (!body.consentGiven) {
      return NextResponse.json(
        { error: "Consent is required" },
        { status: 400 }
      );
    }

    const submitter = await getOptionalSubmitter();

    const now = new Date();
    const ref = adminDb.collection("campRegistrations").doc();
    const claimToken = randomBytes(24).toString("hex");

    const registrationData = {
      campId,
      registrantType,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      dateOfBirth: body.dateOfBirth.trim(),
      gender,
      phone: body.phone.trim(),
      email: optionalEmail(body.email),
      churchOrSchool: optionalString(body.churchOrSchool) ?? "",
      emergencyContactName: body.emergencyContactName.trim(),
      emergencyContactPhone: body.emergencyContactPhone.trim(),
      emergencyContactRelationship: optionalString(body.emergencyContactRelationship),
      medicalNotes: optionalString(body.medicalNotes),
      allergies: optionalString(body.allergies),
      medications: optionalString(body.medications),
      tshirtSize,
      dietaryPreference: optionalString(body.dietaryPreference),
      parentName: optionalString(body.parentName),
      parentRelationship: optionalString(body.parentRelationship),
      parentAltPhone: optionalString(body.parentAltPhone),
      parentEmail: optionalEmail(body.parentEmail),
      address: optionalString(body.address),
      dropoffLocation,
      notes: optionalString(body.notes),
      consentGiven: !!body.consentGiven,
      submittedByUid: submitter?.uid ?? null,
      submittedByEmail: submitter?.email?.toLowerCase() ?? null,
      claimToken,
      checkInCode: generateCheckInCode(),
      checkedIn: false,
      checkedInAt: null,
      checkedInBy: null,
      checkedInByName: null,
      qrEmailSentAt: null,
      qrEmailSentTo: null,
      qrEmailCount: 0,
      paymentStatus: "UNPAID" as CampPaymentStatus,
      paymentAmount: null,
      paymentReference: null,
      paymentNotes: null,
      paymentMarkedBy: null,
      paymentMarkedByName: null,
      paymentMarkedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    // Capacity check + create atomically. A count() aggregation read does NOT
    // make the transaction serialize (Firestore has no predicate/phantom
    // locking), so two submissions racing near the cap could both pass a
    // count() check and overbook. Instead we read/write a concrete counter
    // document — reading a real doc is what makes concurrent transactions
    // conflict and retry. The counter self-seeds from the live count the first
    // time it's touched, and the DELETE route decrements it.
    const counterRef = adminDb.collection("campCounters").doc(campId);
    const atCapacity = await adminDb.runTransaction(async (tx) => {
      // Capacity is read inside the transaction too: an admin raising the cap
      // mid-transaction then conflicts and we retry against the new value,
      // rather than turning someone away against a stale cap.
      const capacity = capacityFromSnapshot(
        campId,
        await tx.get(campSettingsRef(campId))
      );
      const counterSnap = await tx.get(counterRef);
      let current: number;
      if (counterSnap.exists) {
        current = (counterSnap.data()?.count as number) ?? 0;
      } else {
        // First registration since deploy: seed from the authoritative count.
        const countSnap = await tx.get(
          adminDb
            .collection("campRegistrations")
            .where("campId", "==", campId)
            .count()
        );
        current = countSnap.data().count;
      }

      if (current >= capacity) {
        return true;
      }

      tx.set(ref, registrationData);
      tx.set(
        counterRef,
        { campId, count: current + 1, updatedAt: now },
        { merge: true }
      );
      return false;
    });

    if (atCapacity) {
      return NextResponse.json(
        { error: "Camp is full. Registration is closed." },
        { status: 409 }
      );
    }

    // Best-effort: email the registrant their details + QR check-in pass.
    // Failures never fail the registration itself.
    const emailResult = await sendCampRegistrationEmail(
      ref.id,
      registrationData
    );

    return NextResponse.json(
      {
        registration: serializeRegistration(ref.id, registrationData),
        claimToken,
        camp: { id: camp.id, name: camp.name, fee: camp.fee, currency: camp.currency },
        confirmationEmail: emailResult.queued
          ? { queued: true, to: emailResult.to }
          : { queued: false },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating camp registration:", error);
    return NextResponse.json(
      { error: "Failed to submit registration" },
      { status: 500 }
    );
  }
}
