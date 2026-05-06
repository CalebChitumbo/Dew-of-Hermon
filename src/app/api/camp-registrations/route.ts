import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getCamp, DEFAULT_CAMP_ID } from "@/lib/camps";
import {
  getCallerWithDepartments,
  callerCanManageCampRegistrations,
} from "./_auth";
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

export function serializeRegistration(
  id: string,
  data: FirebaseFirestore.DocumentData
) {
  return {
    id,
    campId: data.campId,
    registrantType: (data.registrantType as RegistrantType | undefined) ?? null,
    firstName: data.firstName,
    lastName: data.lastName,
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
    phone: data.phone,
    email: data.email ?? null,
    churchOrSchool: data.churchOrSchool,
    emergencyContactName: data.emergencyContactName,
    emergencyContactPhone: data.emergencyContactPhone,
    emergencyContactRelationship: data.emergencyContactRelationship ?? null,
    medicalNotes: data.medicalNotes ?? null,
    allergies: data.allergies ?? null,
    medications: data.medications ?? null,
    tshirtSize: data.tshirtSize ?? null,
    dietaryPreference: data.dietaryPreference ?? null,
    parentName: data.parentName ?? null,
    parentRelationship: data.parentRelationship ?? null,
    parentAltPhone: data.parentAltPhone ?? null,
    parentEmail: data.parentEmail ?? null,
    address: data.address ?? null,
    dropoffLocation: data.dropoffLocation ?? null,
    notes: data.notes ?? null,
    consentGiven: data.consentGiven ?? false,
    submittedByUid: data.submittedByUid ?? null,
    submittedByEmail: data.submittedByEmail ?? null,
    paymentStatus: data.paymentStatus,
    paymentAmount: data.paymentAmount ?? null,
    paymentReference: data.paymentReference ?? null,
    paymentNotes: data.paymentNotes ?? null,
    paymentMarkedBy: data.paymentMarkedBy ?? null,
    paymentMarkedByName: data.paymentMarkedByName ?? null,
    paymentMarkedAt: data.paymentMarkedAt?.toDate?.()?.toISOString() ?? null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
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

    // Capacity check (count current registrations for this camp).
    const countSnap = await adminDb
      .collection("campRegistrations")
      .where("campId", "==", campId)
      .count()
      .get();
    const currentCount = countSnap.data().count;
    if (currentCount >= camp.capacity) {
      return NextResponse.json(
        { error: "Camp is full. Registration is closed." },
        { status: 409 }
      );
    }

    const now = new Date();
    const ref = adminDb.collection("campRegistrations").doc();

    const registrationData = {
      campId,
      registrantType,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      dateOfBirth: body.dateOfBirth.trim(),
      gender,
      phone: body.phone.trim(),
      email: optionalString(body.email),
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
      parentEmail: optionalString(body.parentEmail),
      address: optionalString(body.address),
      dropoffLocation,
      notes: optionalString(body.notes),
      consentGiven: !!body.consentGiven,
      submittedByUid: submitter?.uid ?? null,
      submittedByEmail: submitter?.email ?? null,
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

    await ref.set(registrationData);

    return NextResponse.json(
      {
        registration: serializeRegistration(ref.id, registrationData),
        camp: { id: camp.id, name: camp.name, fee: camp.fee, currency: camp.currency },
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
