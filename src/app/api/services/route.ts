import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { canCreateService } from "@/lib/permissions";
import { UserRole } from "@/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const archived = searchParams.get("archived") === "true";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    let query = adminDb
      .collection("services")
      .where("isArchived", "==", archived)
      .orderBy("createdAt", "desc");

    // For pagination, use offset-based approach
    const offset = (page - 1) * limit;
    if (offset > 0) {
      query = query.offset(offset);
    }
    query = query.limit(limit);

    const servicesSnapshot = await query.get();

    // Get total count for pagination
    const countSnapshot = await adminDb
      .collection("services")
      .where("isArchived", "==", archived)
      .count()
      .get();
    const totalCount = countSnapshot.data().count;

    // Collect all eventIds so we can batch-fetch linked events
    const eventIds = new Set<string>();
    servicesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.eventId) eventIds.add(data.eventId);
    });

    // Fetch linked events
    const eventsMap: Record<string, Record<string, unknown>> = {};
    if (eventIds.size > 0) {
      const eventIdArray = Array.from(eventIds);
      // Firestore 'in' queries support up to 30 items
      const chunks: string[][] = [];
      for (let i = 0; i < eventIdArray.length; i += 30) {
        chunks.push(eventIdArray.slice(i, i + 30));
      }
      for (const chunk of chunks) {
        const eventsSnapshot = await adminDb
          .collection("events")
          .where("__name__", "in", chunk)
          .get();
        eventsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          eventsMap[doc.id] = {
            id: doc.id,
            title: data.title,
            description: data.description || null,
            type: data.type,
            startDate: data.startDate?.toDate?.()?.toISOString() || null,
            endDate: data.endDate?.toDate?.()?.toISOString() || null,
            venue: data.venue,
            isRecurring: data.isRecurring || false,
            createdBy: data.createdBy,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          };
        });
      }
    }

    // For each service, count how many assignments exist
    const serviceIds = servicesSnapshot.docs.map((doc) => doc.id);
    const assignmentCounts: Record<string, number> = {};
    if (serviceIds.length > 0) {
      const assignmentChunks: string[][] = [];
      for (let i = 0; i < serviceIds.length; i += 30) {
        assignmentChunks.push(serviceIds.slice(i, i + 30));
      }
      for (const chunk of assignmentChunks) {
        const assignmentsSnapshot = await adminDb
          .collection("serviceAssignments")
          .where("serviceId", "in", chunk)
          .get();
        assignmentsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const sid = data.serviceId;
          assignmentCounts[sid] = (assignmentCounts[sid] || 0) + 1;
        });
      }
    }

    const services = servicesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        eventId: data.eventId,
        theme: data.theme || null,
        serviceTime: data.serviceTime,
        programNotes: data.programNotes || null,
        attendanceCount: data.attendanceCount || null,
        isArchived: data.isArchived || false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        event: eventsMap[data.eventId] || null,
        assignmentCount: assignmentCounts[doc.id] || 0,
      };
    });

    return NextResponse.json({
      services,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, theme, venue, serviceTime, callerRole, callerId } = body;

    if (!callerRole || !canCreateService(callerRole as UserRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    if (!date || !venue || !serviceTime) {
      return NextResponse.json(
        { error: "Date, venue, and service time are required" },
        { status: 400 }
      );
    }

    const now = new Date();
    const serviceDate = new Date(date);

    // Create the linked event document first
    const eventData = {
      title: theme ? `Potter's Wheel: ${theme}` : "Potter's Wheel Service",
      description: null,
      type: "POTTERS_WHEEL_SERVICE",
      startDate: serviceDate,
      endDate: null,
      venue,
      isRecurring: false,
      createdBy: callerId || "",
      createdAt: now,
      updatedAt: now,
    };

    const eventRef = await adminDb.collection("events").add(eventData);

    // Create the service document linked to the event
    const serviceData = {
      eventId: eventRef.id,
      theme: theme || null,
      serviceTime,
      programNotes: null,
      attendanceCount: null,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    const serviceRef = await adminDb.collection("services").add(serviceData);

    // Create default checklist items for the service
    const defaultChecklist = [
      { task: "Sound system setup and test", category: "Technical", order: 1 },
      { task: "Projector and slides ready", category: "Technical", order: 2 },
      { task: "Musical instruments tuned", category: "Technical", order: 3 },
      { task: "Worship song list finalized", category: "Worship", order: 4 },
      { task: "Worship team rehearsal complete", category: "Worship", order: 5 },
      { task: "Sermon notes / message prepared", category: "Ministry", order: 6 },
      { task: "Welcome team briefed", category: "Hospitality", order: 7 },
      { task: "Venue cleaned and arranged", category: "Hospitality", order: 8 },
      { task: "Refreshments organized", category: "Hospitality", order: 9 },
      { task: "Attendance register ready", category: "Admin", order: 10 },
      { task: "Offering baskets prepared", category: "Admin", order: 11 },
      { task: "All role assignments confirmed", category: "Admin", order: 12 },
    ];

    const batch = adminDb.batch();
    for (const item of defaultChecklist) {
      const ref = adminDb.collection("checklistItems").doc();
      batch.set(ref, {
        serviceId: serviceRef.id,
        task: item.task,
        category: item.category,
        isCompleted: false,
        completedBy: null,
        order: item.order,
        updatedAt: now,
      });
    }
    await batch.commit();

    return NextResponse.json(
      {
        service: {
          id: serviceRef.id,
          ...serviceData,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        event: {
          id: eventRef.id,
          ...eventData,
          startDate: serviceDate.toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating service:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create service";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
