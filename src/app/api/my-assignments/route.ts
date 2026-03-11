import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

async function getAuthUid(request: NextRequest): Promise<string | null> {
  // Try Bearer token first
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
      return decoded.uid;
    } catch {
      // fall through to session cookie
    }
  }

  // Fall back to session cookie
  const cookieStore = await cookies();
  const session = cookieStore.get("session");
  if (session?.value) {
    try {
      const decoded = await adminAuth.verifyIdToken(session.value);
      return decoded.uid;
    } catch {
      return null;
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const uid = await getAuthUid(request);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's assignments
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
    const enrichedAssignments = assignments.map((assignment) => {
      const service = servicesMap[assignment.serviceId];
      const event = service?.eventId ? eventsMap[service.eventId] : undefined;
      return {
        ...assignment,
        serviceDate: event?.startDate || null,
        serviceTime: service?.serviceTime || null,
        eventTitle: event?.title || null,
        venue: event?.venue || null,
        theme: service?.theme || null,
      };
    });

    return NextResponse.json({ assignments: enrichedAssignments });
  } catch (error) {
    console.error("Error fetching my assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}
