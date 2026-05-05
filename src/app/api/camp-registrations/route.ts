import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getCamp, DEFAULT_CAMP_ID } from "@/lib/camps";
import {
  getCallerWithDepartments,
  callerCanManageCampRegistrations,
} from "./_auth";
import type {
  CampGender,
  CampPaymentStatus,
  CampTShirtSize,
} from "@/types";

export const dynamic = "force-dynamic";

const VALID_GENDERS: CampGender[] = ["MALE", "FEMALE"];
const VALID_TSHIRT_SIZES: CampTShirtSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

function serializeRegistration(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    campId: data.campId,
    firstName: data.firstName,
    lastName: data.lastName,
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
    phone: data.phone,
    email: data.email ?? null,
    churchOrSchool: data.churchOrSchool,
    emergencyContactName: data.emergencyContactName,
    emergencyContactPhone: data.emergencyContactPhone,
    medicalNotes: data.medicalNotes ?? null,
    tshirtSize: data.tshirtSize,
    dietaryPreference: data.dietaryPreference ?? null,
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

    const snapshot = await adminDb
      .collection("campRegistrations")
      .where("campId", "==", campId)
      .orderBy("createdAt", "desc")
      .get();

    const registrations = snapshot.docs.map((doc) =>
      serializeRegistration(doc.id, doc.data())
    );

    return NextResponse.json({ registrations });
  } catch (error) {
    console.error("Error fetching camp registrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch registrations" },
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
      "churchOrSchool",
      "emergencyContactName",
      "emergencyContactPhone",
      "tshirtSize",
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

    const tshirtSize = body.tshirtSize as CampTShirtSize;
    if (!VALID_TSHIRT_SIZES.includes(tshirtSize)) {
      return NextResponse.json({ error: "Invalid t-shirt size" }, { status: 400 });
    }

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
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      dateOfBirth: body.dateOfBirth.trim(),
      gender,
      phone: body.phone.trim(),
      email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : null,
      churchOrSchool: body.churchOrSchool.trim(),
      emergencyContactName: body.emergencyContactName.trim(),
      emergencyContactPhone: body.emergencyContactPhone.trim(),
      medicalNotes:
        typeof body.medicalNotes === "string" && body.medicalNotes.trim()
          ? body.medicalNotes.trim()
          : null,
      tshirtSize,
      dietaryPreference:
        typeof body.dietaryPreference === "string" && body.dietaryPreference.trim()
          ? body.dietaryPreference.trim()
          : null,
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
