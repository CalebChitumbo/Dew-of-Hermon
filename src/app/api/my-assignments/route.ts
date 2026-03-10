import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Fetch user's assignments
    const assignmentsSnapshot = await adminDb
      .collection("serviceAssignments")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
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

    // Collect unique serviceIds to fetch services and events
    const serviceIds = Array.from(new Set(assignments.map((a) => a.serviceId)));

    const servicesMap: Record<string, Record<string, unknown>> = {};
    const eventsMap: Record<string, Record<string, unknown>> = {};

    // Fetch services in batches of 10 (Firestore "in" limit)
    for (let i = 0; i < serviceIds.length; i += 10) {
      const batch = serviceIds.slice(i, i + 10);
      const servicesSnapshot = await adminDb
        .collection("services")
        .where("__name__", "in", batch)
        .get();

      servicesSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        servicesMap[doc.id] = {
          id: doc.id,
          eventId: data.eventId,
          theme: data.theme || null,
          serviceTime: data.serviceTime,
        };
      });
    }

    // Fetch events for all services
    const eventIds = Array.from(new Set(
      Object.values(servicesMap)
        .map((s) => s.eventId as string)
        .filter(Boolean)
    ));

    for (let i = 0; i < eventIds.length; i += 10) {
      const batch = eventIds.slice(i, i + 10);
      const eventsSnapshot = await adminDb
        .collection("events")
        .where("__name__", "in", batch)
        .get();

      eventsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        eventsMap[doc.id] = {
          id: doc.id,
          title: data.title,
          startDate: data.startDate?.toDate?.()?.toISOString() || null,
          venue: data.venue || null,
        };
      });
    }

    return NextResponse.json({ assignments, services: servicesMap, events: eventsMap });
  } catch (error) {
    console.error("Error fetching user assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { assignmentId, status, userId } = body;

    if (!assignmentId || !status || !userId) {
      return NextResponse.json(
        { error: "assignmentId, status, and userId are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["CONFIRMED", "DECLINED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify assignment belongs to user
    const assignmentDoc = await adminDb
      .collection("serviceAssignments")
      .doc(assignmentId)
      .get();

    if (!assignmentDoc.exists) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    const assignmentData = assignmentDoc.data()!;
    if (assignmentData.userId !== userId) {
      return NextResponse.json(
        { error: "You can only update your own assignments" },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (status === "CONFIRMED") {
      updateData.confirmedAt = new Date();
    }

    await adminDb
      .collection("serviceAssignments")
      .doc(assignmentId)
      .update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating assignment:", error);
    return NextResponse.json(
      { error: "Failed to update assignment" },
      { status: 500 }
    );
  }
}
