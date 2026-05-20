import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  canManageFundraisingOrders,
  canPlanBraai,
  getCaller,
} from "../_auth";

export const dynamic = "force-dynamic";

interface EventRow {
  id: string;
  title: string;
  eventDate: string | null;
  venue: string | null;
  notes: string | null;
  createdBy: string;
  createdByName: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  assignmentCount: number;
  confirmedCount: number;
  declinedCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const caller = await getCaller(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Planners need this for the roster; any Fundraising member can also
    // browse here to drill into a braai's Orders tab.
    const [canPlan, canOrders] = await Promise.all([
      canPlanBraai(caller),
      canManageFundraisingOrders(caller),
    ]);
    if (!canPlan && !canOrders) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const snapshot = await adminDb.collection("braaiEvents").get();
    const events: EventRow[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || "",
        eventDate: data.eventDate?.toDate?.()?.toISOString() || null,
        venue: data.venue || null,
        notes: data.notes || null,
        createdBy: data.createdBy || "",
        createdByName: data.createdByName || "",
        isArchived: data.isArchived || false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        assignmentCount: 0,
        confirmedCount: 0,
        declinedCount: 0,
      };
    });

    // Tally assignment counts per event in batches.
    const eventIds = events.map((e) => e.id);
    if (eventIds.length > 0) {
      for (let i = 0; i < eventIds.length; i += 30) {
        const chunk = eventIds.slice(i, i + 30);
        const assignSnap = await adminDb
          .collection("braaiAssignments")
          .where("braaiEventId", "in", chunk)
          .get();
        assignSnap.docs.forEach((a) => {
          const data = a.data();
          const target = events.find((e) => e.id === data.braaiEventId);
          if (!target) return;
          target.assignmentCount += 1;
          if (data.status === "CONFIRMED") target.confirmedCount += 1;
          if (data.status === "DECLINED") target.declinedCount += 1;
        });
      }
    }

    // Sort by event date (upcoming first, then most recently created).
    events.sort((a, b) => {
      const aTime = a.eventDate ? new Date(a.eventDate).getTime() : 0;
      const bTime = b.eventDate ? new Date(b.eventDate).getTime() : 0;
      if (aTime && bTime) return aTime - bTime;
      if (aTime) return -1;
      if (bTime) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error listing braai events:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load braai events", details: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getCaller(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canPlanBraai(caller))) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, eventDate, venue, notes } = body;

    if (!eventDate) {
      return NextResponse.json(
        { error: "Event date is required" },
        { status: 400 }
      );
    }
    const parsedDate = new Date(eventDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Event date is invalid" },
        { status: 400 }
      );
    }

    const callerDoc = await adminDb.collection("users").doc(caller.uid).get();
    const callerName = callerDoc.data()?.name || "Fundraising Lead";
    const now = new Date();
    const data = {
      title: (title as string)?.trim() || "Sunday Fundraising Braai",
      eventDate: parsedDate,
      venue: (venue as string)?.trim() || null,
      notes: (notes as string)?.trim() || null,
      createdBy: caller.uid,
      createdByName: callerName,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await adminDb.collection("braaiEvents").add(data);

    return NextResponse.json(
      {
        event: {
          id: ref.id,
          ...data,
          eventDate: parsedDate.toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating braai event:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create braai event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
