import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getCallerUid } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const uid = await getCallerUid();
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's service assignments
    const assignmentsSnapshot = await adminDb
      .collection("serviceAssignments")
      .where("userId", "==", uid)
      .get();

    const assignments = assignmentsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        serviceId: data.serviceId,
        roleId: data.roleId,
        roleName: data.roleName,
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        userPhone: data.userPhone || null,
        status: data.status,
        emailSent: data.emailSent || false,
        emailSentAt: data.emailSentAt?.toDate?.()?.toISOString() || null,
        confirmedAt: data.confirmedAt?.toDate?.()?.toISOString() || null,
        notes: data.notes || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    // Fetch services and events for enrichment
    const serviceIds = Array.from(new Set(assignments.map((a) => a.serviceId)));
    const servicesMap: Record<string, { eventId?: string; serviceTime?: string; theme?: string }> = {};
    const eventIds: string[] = [];

    // Fetch services in batches of 10 (Firestore 'in' query limit)
    for (let i = 0; i < serviceIds.length; i += 10) {
      const batch = serviceIds.slice(i, i + 10);
      const servicesSnapshot = await adminDb
        .collection("services")
        .where("__name__", "in", batch)
        .get();
      servicesSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        servicesMap[doc.id] = {
          eventId: data.eventId,
          serviceTime: data.serviceTime,
          theme: data.theme,
        };
        if (data.eventId && !eventIds.includes(data.eventId)) eventIds.push(data.eventId);
      });
    }

    // Fetch events
    const eventsMap: Record<string, { title?: string; startDate?: string; venue?: string }> = {};
    for (let i = 0; i < eventIds.length; i += 10) {
      const batch = eventIds.slice(i, i + 10);
      const eventsSnapshot = await adminDb
        .collection("events")
        .where("__name__", "in", batch)
        .get();
      eventsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        eventsMap[doc.id] = {
          title: data.title,
          startDate: data.startDate?.toDate?.()?.toISOString() || null,
          venue: data.venue,
        };
      });
    }

    // Enrich assignments with service/event data
    const enrichedServiceAssignments = assignments.map((assignment) => {
      const service = servicesMap[assignment.serviceId];
      const event = service?.eventId ? eventsMap[service.eventId] : undefined;
      return {
        ...assignment,
        kind: "service" as const,
        parentId: assignment.serviceId,
        serviceDate: event?.startDate || null,
        serviceTime: service?.serviceTime || null,
        eventTitle: event?.title || null,
        venue: event?.venue || null,
        theme: service?.theme || null,
        arrivalTime: null,
      };
    });

    // ── Fetch user's braai assignments and enrich with the parent braai event ──
    const braaiSnapshot = await adminDb
      .collection("braaiAssignments")
      .where("userId", "==", uid)
      .get();

    const braaiAssignments = braaiSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        braaiEventId: data.braaiEventId as string,
        responsibilityKey: data.responsibilityKey,
        responsibilityName: data.responsibilityName,
        phase: data.phase,
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        userPhone: data.userPhone || null,
        status: data.status,
        emailSent: data.emailSent || false,
        emailSentAt: data.emailSentAt?.toDate?.()?.toISOString() || null,
        confirmedAt: data.confirmedAt?.toDate?.()?.toISOString() || null,
        notes: data.notes || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    const braaiEventIds = Array.from(
      new Set(braaiAssignments.map((a) => a.braaiEventId))
    );
    const braaiEventsMap: Record<
      string,
      { title?: string; eventDate?: string | null; venue?: string | null }
    > = {};
    for (let i = 0; i < braaiEventIds.length; i += 10) {
      const batch = braaiEventIds.slice(i, i + 10);
      const snap = await adminDb
        .collection("braaiEvents")
        .where("__name__", "in", batch)
        .get();
      snap.docs.forEach((d) => {
        const data = d.data();
        braaiEventsMap[d.id] = {
          title: data.title,
          eventDate: data.eventDate?.toDate?.()?.toISOString() || null,
          venue: data.venue || null,
        };
      });
    }

    const enrichedBraaiAssignments = braaiAssignments.map((a) => {
      const evt = braaiEventsMap[a.braaiEventId];
      return {
        id: a.id,
        kind: "braai" as const,
        parentId: a.braaiEventId,
        serviceId: a.braaiEventId,
        roleId: a.responsibilityKey,
        roleName: a.responsibilityName,
        userId: a.userId,
        userName: a.userName,
        userEmail: a.userEmail,
        userPhone: a.userPhone,
        status: a.status,
        emailSent: a.emailSent,
        emailSentAt: a.emailSentAt,
        confirmedAt: a.confirmedAt,
        notes: a.notes,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        serviceDate: evt?.eventDate || null,
        serviceTime: null,
        eventTitle: evt?.title || "Fundraising Braai",
        venue: evt?.venue || null,
        theme:
          a.phase === "PREPARATION" ? "Preparations" : "Actual Day",
        arrivalTime: null,
      };
    });

    return NextResponse.json({
      assignments: [
        ...enrichedServiceAssignments,
        ...enrichedBraaiAssignments,
      ],
    });
  } catch (error) {
    console.error("Error fetching my assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}
