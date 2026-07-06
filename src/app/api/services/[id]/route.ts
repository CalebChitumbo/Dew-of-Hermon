import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { serverHasFeatureMinRole } from "@/lib/feature-permissions-server";
import { getSessionCaller } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getSessionCaller();
    if (!caller) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const serviceDoc = await adminDb.collection("services").doc(id).get();

    if (!serviceDoc.exists) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const data = serviceDoc.data()!;

    // Fetch linked event
    let event = null;
    if (data.eventId) {
      const eventDoc = await adminDb.collection("events").doc(data.eventId).get();
      if (eventDoc.exists) {
        const eventData = eventDoc.data()!;
        event = {
          id: eventDoc.id,
          title: eventData.title,
          description: eventData.description || null,
          type: eventData.type,
          startDate: eventData.startDate?.toDate?.()?.toISOString() || null,
          endDate: eventData.endDate?.toDate?.()?.toISOString() || null,
          venue: eventData.venue,
          isRecurring: eventData.isRecurring || false,
          createdBy: eventData.createdBy,
          createdAt: eventData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: eventData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        };
      }
    }

    // Fetch assignments for this service
    const assignmentsSnapshot = await adminDb
      .collection("serviceAssignments")
      .where("serviceId", "==", id)
      .get();

    const assignments = assignmentsSnapshot.docs.map((doc) => {
      const aData = doc.data();
      return {
        id: doc.id,
        serviceId: aData.serviceId,
        roleId: aData.roleId,
        roleName: aData.roleName,
        userId: aData.userId,
        userName: aData.userName,
        userEmail: aData.userEmail,
        userPhone: aData.userPhone || null,
        status: aData.status,
        emailSent: aData.emailSent || false,
        emailSentAt: aData.emailSentAt?.toDate?.()?.toISOString() || null,
        confirmedAt: aData.confirmedAt?.toDate?.()?.toISOString() || null,
        notes: aData.notes || null,
        createdAt: aData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: aData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    // Fetch all service roles
    const rolesSnapshot = await adminDb
      .collection("serviceRoles")
      .orderBy("order")
      .get();

    const roles = rolesSnapshot.docs.map((doc) => {
      const rData = doc.data();
      return {
        id: doc.id,
        name: rData.name,
        departmentId: rData.departmentId,
        description: rData.description || null,
        emailSubject: rData.emailSubject || "",
        emailBody: rData.emailBody || "",
        reminderSchedule: rData.reminderSchedule || [],
        arrivalTime: rData.arrivalTime || null,
        timeSlot: rData.timeSlot || null,
        order: rData.order || 0,
      };
    });

    const service = {
      id: serviceDoc.id,
      eventId: data.eventId,
      theme: data.theme || null,
      serviceTime: data.serviceTime,
      programNotes: data.programNotes || null,
      attendanceCount: data.attendanceCount || null,
      isArchived: data.isArchived || false,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      event,
      assignments,
      roles,
    };

    return NextResponse.json({ service });
  } catch (error) {
    console.error("Error fetching service:", error);
    return NextResponse.json(
      { error: "Failed to fetch service" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getSessionCaller();
    if (!caller) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    if (!(await serverHasFeatureMinRole("create_service", caller.role))) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { theme, serviceTime, programNotes, attendanceCount, isArchived } = body;

    const serviceDoc = await adminDb.collection("services").doc(id).get();
    if (!serviceDoc.exists) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (theme !== undefined) updateData.theme = theme || null;
    if (serviceTime !== undefined) updateData.serviceTime = serviceTime;
    if (programNotes !== undefined) updateData.programNotes = programNotes || null;
    if (attendanceCount !== undefined) updateData.attendanceCount = attendanceCount;
    if (isArchived !== undefined) updateData.isArchived = isArchived;

    await adminDb.collection("services").doc(id).update(updateData);

    // Also update linked event if venue/date changed
    if (body.venue || body.date) {
      const existingData = serviceDoc.data()!;
      const eventUpdate: Record<string, unknown> = { updatedAt: new Date() };
      if (body.venue) eventUpdate.venue = body.venue;
      if (body.date) eventUpdate.startDate = new Date(body.date);
      if (theme !== undefined) {
        eventUpdate.title = theme ? `Potter's Wheel: ${theme}` : "Potter's Wheel Service";
      }
      await adminDb.collection("events").doc(existingData.eventId).update(eventUpdate);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error updating service:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update service";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getSessionCaller();
    if (!caller) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    if (caller.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only the Chairperson (Super Admin) can delete services" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const serviceDoc = await adminDb.collection("services").doc(id).get();
    if (!serviceDoc.exists) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const serviceData = serviceDoc.data()!;

    // Delete linked assignments
    const assignmentsSnapshot = await adminDb
      .collection("serviceAssignments")
      .where("serviceId", "==", id)
      .get();

    const batch = adminDb.batch();

    assignmentsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete linked checklist items
    const checklistSnapshot = await adminDb
      .collection("checklistItems")
      .where("serviceId", "==", id)
      .get();

    checklistSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete linked event
    if (serviceData.eventId) {
      batch.delete(adminDb.collection("events").doc(serviceData.eventId));
    }

    // Delete the service itself
    batch.delete(adminDb.collection("services").doc(id));

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting service:", error);
    return NextResponse.json(
      { error: "Failed to delete service" },
      { status: 500 }
    );
  }
}
