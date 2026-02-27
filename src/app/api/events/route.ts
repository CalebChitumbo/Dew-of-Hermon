export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { EventType } from "@/types";

// ─── Helper: Verify Firebase auth token from Authorization header ───

async function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded;
  } catch {
    return null;
  }
}

// ─── Helper: Get user role from Firestore ───

async function getUserRole(uid: string): Promise<string | null> {
  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) return null;
    return userDoc.data()?.role || null;
  } catch {
    return null;
  }
}

// ─── Helper: Check if role can create events (ADMIN or above) ───

const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  DEPARTMENT_LEAD: 3,
  YOUTH_LEADER: 2,
  MEMBER: 1,
};

function canCreateEvents(role: string): boolean {
  return (ROLE_HIERARCHY[role] || 0) >= ROLE_HIERARCHY["ADMIN"];
}

// ─── GET /api/events ───
// Query params:
//   - startDate (ISO string) — filter events from this date
//   - endDate (ISO string) — filter events up to this date
//   - type (EventType) — filter by event type

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await verifyToken(request);
    if (!decodedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const typeParam = searchParams.get("type");

    let eventsQuery: FirebaseFirestore.Query = adminDb.collection("events");

    // Filter by date range
    if (startDateParam) {
      const startDate = new Date(startDateParam);
      eventsQuery = eventsQuery.where(
        "startDate",
        ">=",
        adminDb.collection("_").doc().id ? startDate : startDate
      );
    }
    if (endDateParam) {
      const endDate = new Date(endDateParam);
      eventsQuery = eventsQuery.where(
        "startDate",
        "<=",
        endDate
      );
    }

    // Filter by event type
    if (typeParam) {
      eventsQuery = eventsQuery.where("type", "==", typeParam);
    }

    // Order by startDate
    eventsQuery = eventsQuery.orderBy("startDate", "asc");

    const snapshot = await eventsQuery.get();

    const events = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description || null,
        type: data.type,
        startDate: data.startDate?.toDate?.()?.toISOString() || null,
        endDate: data.endDate?.toDate?.()?.toISOString() || null,
        venue: data.venue || "",
        isRecurring: data.isRecurring || false,
        createdBy: data.createdBy || "",
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
      };
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

// ─── POST /api/events ───
// Body: { title, type, startDate, endDate?, venue, description?, isRecurring? }
// Admin only

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await verifyToken(request);
    if (!decodedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin role
    const role = await getUserRole(decodedToken.uid);
    if (!role || !canCreateEvents(role)) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, type, startDate, endDate, venue, description, isRecurring } =
      body;

    // Validate required fields
    if (!title || !type || !startDate || !venue) {
      return NextResponse.json(
        {
          error: "Missing required fields: title, type, startDate, venue",
        },
        { status: 400 }
      );
    }

    // Validate event type
    const validTypes: EventType[] = [
      "POTTERS_WHEEL_SERVICE",
      "ROPS_CAMP",
      "RETREAT",
      "SPECIAL_EVENT",
      "MEETING",
      "OUTREACH",
    ];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid event type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const now = new Date();
    const eventData = {
      title,
      type,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      venue,
      description: description || null,
      isRecurring: isRecurring || false,
      createdBy: decodedToken.uid,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection("events").add(eventData);

    return NextResponse.json(
      {
        id: docRef.id,
        ...eventData,
        startDate: eventData.startDate.toISOString(),
        endDate: eventData.endDate?.toISOString() || null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/events error:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
