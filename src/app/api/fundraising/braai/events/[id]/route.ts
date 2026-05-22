import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  canManageFundraisingOrders,
  canPlanBraai,
  getCaller,
} from "../../_auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Event metadata is read by both planners (to manage the roster) and
    // any Fundraising member who needs the header context for the orders
    // tab. So allow either permission.
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

    const { id } = await params;
    const doc = await adminDb.collection("braaiEvents").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Braai event not found" },
        { status: 404 }
      );
    }
    const data = doc.data()!;
    return NextResponse.json({
      event: {
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
      },
    });
  } catch (error) {
    console.error("Error fetching braai event:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load braai event", details: message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const ref = adminDb.collection("braaiEvents").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Braai event not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.title === "string") update.title = body.title.trim();
    if (typeof body.venue === "string") update.venue = body.venue.trim() || null;
    if (typeof body.notes === "string") update.notes = body.notes.trim() || null;
    if (typeof body.isArchived === "boolean") update.isArchived = body.isArchived;
    if (body.eventDate) {
      const parsed = new Date(body.eventDate);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "Event date is invalid" },
          { status: 400 }
        );
      }
      update.eventDate = parsed;
    }

    await ref.update(update);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating braai event:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update braai event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (caller.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only the Chairperson (Super Admin) can delete braai events" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const ref = adminDb.collection("braaiEvents").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Braai event not found" },
        { status: 404 }
      );
    }

    // Clean up assignments
    const assignSnap = await adminDb
      .collection("braaiAssignments")
      .where("braaiEventId", "==", id)
      .get();
    const batch = adminDb.batch();
    assignSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(ref);
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting braai event:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete braai event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
