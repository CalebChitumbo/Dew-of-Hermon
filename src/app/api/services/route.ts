import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { serverHasFeatureMinRole } from "@/lib/feature-permissions-server";
import { ensureServiceForDate, maybeNotifyRotaOpen } from "@/lib/service-provisioning";

export const dynamic = "force-dynamic";
import { UserRole } from "@/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const archived = searchParams.get("archived") === "true";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Use a simple equality filter only (no orderBy) to avoid
    // requiring a composite Firestore index that may not be deployed.
    // Sorting is done in JS below.
    const servicesSnapshot = await adminDb
      .collection("services")
      .where("isArchived", "==", archived)
      .get();

    const totalCount = servicesSnapshot.size;

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
        autoProvisioned: data.autoProvisioned || false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        event: eventsMap[data.eventId] || null,
        assignmentCount: assignmentCounts[doc.id] || 0,
      };
    });

    // Sort by createdAt descending (newest first) in JS
    services.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    const offset = (page - 1) * limit;
    const paginatedServices = services.slice(offset, offset + limit);

    return NextResponse.json({
      services: paginatedServices,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch services", details: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, theme, venue, serviceTime, callerRole, callerId } = body;

    if (!callerRole || !(await serverHasFeatureMinRole("create_service", callerRole as UserRole))) {
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

    const serviceDate = new Date(date);

    // Provision (idempotently) the service for this date. If a Potter's Wheel
    // service already exists for the day — e.g. it was auto-prepared ahead of
    // time — this returns the existing one instead of creating a duplicate.
    const ensured = await ensureServiceForDate(serviceDate, {
      venue: venue.trim(),
      serviceTime,
      theme: theme?.trim() || null,
      createdBy: callerId || "",
      autoProvisioned: false,
    });

    // Notify department heads the rota is open (no-op if already notified, or
    // if this service was already provisioned earlier).
    maybeNotifyRotaOpen(ensured).catch((err) =>
      console.error("Failed to notify heads of opened rota:", err)
    );

    if (!ensured.created) {
      return NextResponse.json(
        {
          service: { id: ensured.serviceId, eventId: ensured.eventId },
          event: { id: ensured.eventId },
          alreadyExisted: true,
          message:
            "A service for this date already exists — opening the existing rota.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        service: {
          id: ensured.serviceId,
          eventId: ensured.eventId,
          theme: ensured.theme,
          serviceTime: ensured.serviceTime,
          programNotes: null,
          attendanceCount: null,
          isArchived: false,
        },
        event: {
          id: ensured.eventId,
          startDate: ensured.date,
          venue: ensured.venue,
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
