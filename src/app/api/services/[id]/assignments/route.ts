import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { canAssignAnyRole, canAssignOwnDeptRole } from "@/lib/permissions";
import { createNotificationWithEmail } from "@/lib/notifications";
import { getSessionCaller } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Assignments include member emails/phone numbers — require a session.
    const caller = await getSessionCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assignmentsSnapshot = await adminDb
      .collection("serviceAssignments")
      .where("serviceId", "==", id)
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

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params;
    const body = await request.json();
    const { roleId, userId } = body;

    // The caller's role must come from a verified session — never the body.
    const caller = await getSessionCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canAssignAnyRole(caller.role) && !canAssignOwnDeptRole(caller.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    if (!roleId || !userId) {
      return NextResponse.json(
        { error: "Role ID and User ID are required" },
        { status: 400 }
      );
    }

    // Department scoping: ADMIN+ can assign any role, but a department head may
    // only assign roles within a department they lead (so the Media head staffs
    // Media, Hospitality staffs Hospitality, etc.).
    if (!canAssignAnyRole(caller.role)) {
      const roleSnap = await adminDb.collection("serviceRoles").doc(roleId).get();
      if (!roleSnap.exists) {
        return NextResponse.json(
          { error: "Service role not found" },
          { status: 404 }
        );
      }
      const roleDeptId = roleSnap.data()!.departmentId;
      if (!caller.leadsDepartmentIds.includes(roleDeptId)) {
        return NextResponse.json(
          {
            error:
              "You can only assign roles for departments you lead. Ask the Potter's Wheel manager or an admin for other roles.",
          },
          { status: 403 }
        );
      }
    }

    // Verify the service exists
    const serviceDoc = await adminDb.collection("services").doc(serviceId).get();
    if (!serviceDoc.exists) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Use a Firestore transaction for conflict detection
    const result = await adminDb.runTransaction(async (transaction) => {
      // Check 1: Is this person already assigned to ANY role in this service?
      const userAssignmentsQuery = adminDb
        .collection("serviceAssignments")
        .where("serviceId", "==", serviceId)
        .where("userId", "==", userId);

      const userAssignments = await transaction.get(userAssignmentsQuery);
      if (!userAssignments.empty) {
        const existingRole = userAssignments.docs[0].data().roleName;
        return {
          error: `This person is already assigned as "${existingRole}" in this service. Each person can only fill one role per service.`,
          status: 409,
        };
      }

      // Check 2: Is this role already filled in this service?
      const roleAssignmentsQuery = adminDb
        .collection("serviceAssignments")
        .where("serviceId", "==", serviceId)
        .where("roleId", "==", roleId);

      const roleAssignments = await transaction.get(roleAssignmentsQuery);
      if (!roleAssignments.empty) {
        const existingPerson = roleAssignments.docs[0].data().userName;
        return {
          error: `This role is already assigned to ${existingPerson}. Remove the existing assignment first.`,
          status: 409,
        };
      }

      // Fetch the service role details for denormalization
      const roleDoc = await transaction.get(
        adminDb.collection("serviceRoles").doc(roleId)
      );
      if (!roleDoc.exists) {
        return { error: "Service role not found", status: 404 };
      }
      const roleData = roleDoc.data()!;

      // Fetch the user details for denormalization
      const userDoc = await transaction.get(
        adminDb.collection("users").doc(userId)
      );
      if (!userDoc.exists) {
        return { error: "User not found", status: 404 };
      }
      const userData = userDoc.data()!;

      const now = new Date();
      const assignmentRef = adminDb.collection("serviceAssignments").doc();

      const assignmentData = {
        serviceId,
        roleId,
        roleName: roleData.name,
        userId,
        userName: userData.name,
        userEmail: userData.email,
        userPhone: userData.phone || null,
        status: "PENDING",
        emailSent: false,
        emailSentAt: null,
        confirmedAt: null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      };

      transaction.set(assignmentRef, assignmentData);

      return {
        assignment: {
          id: assignmentRef.id,
          ...assignmentData,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        status: 201,
      };
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    // Create in-app notification + send email for the assigned user
    try {
      const assignment = result.assignment!;
      // Fetch event info for the notification message
      const serviceDoc = await adminDb.collection("services").doc(serviceId).get();
      const serviceData = serviceDoc.data();
      let eventDate = "";
      let venue = "";
      let eventTitle = "";
      let serviceTime = serviceData?.serviceTime || "";
      let theme = serviceData?.theme || "";
      if (serviceData?.eventId) {
        const eventDoc = await adminDb.collection("events").doc(serviceData.eventId).get();
        const eventData = eventDoc.data();
        if (eventData?.startDate) {
          const date = eventData.startDate.toDate?.() || new Date(eventData.startDate);
          eventDate = date.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          });
        }
        venue = eventData?.venue || "";
        eventTitle = eventData?.title || "";
      }

      // Fetch role details for arrival time
      const roleDoc = await adminDb.collection("serviceRoles").doc(body.roleId).get();
      const roleData = roleDoc.data();
      const arrivalTime = roleData?.arrivalTime || serviceTime || "TBD";

      const notificationMessage = eventDate
        ? `You have been assigned as ${assignment.roleName} for the service on ${eventDate}. Please confirm or decline.`
        : `You have been assigned as ${assignment.roleName}. Please confirm or decline.`;

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dew-of-hermon-xy9h.vercel.app";
      const confirmLink = `${appUrl}/my-schedule`;

      const emailSubject = `New Assignment: ${assignment.roleName}${eventDate ? ` - ${eventDate}` : ""}`;
      const emailTextLines = [
        `Dear ${assignment.userName},`,
        "",
        `You have been assigned as ${assignment.roleName}${eventTitle ? ` for ${eventTitle}` : ""}${eventDate ? ` on ${eventDate}` : ""}.`,
        "",
        ...(serviceTime ? [`Service Time: ${serviceTime}`] : []),
        ...(arrivalTime ? [`Arrival Time: ${arrivalTime}`] : []),
        ...(venue ? [`Venue: ${venue}`] : []),
        ...(theme ? [`Theme: ${theme}`] : []),
        "",
        "Please confirm or decline your assignment:",
        confirmLink,
        "",
        "Blessings,",
        "Potter's Wheel Team",
      ];
      const emailText = emailTextLines.join("\n");
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5C4033;">New Assignment: ${assignment.roleName}</h2>
          <p>Dear ${assignment.userName},</p>
          <p>You have been assigned as <strong>${assignment.roleName}</strong>${eventTitle ? ` for <strong>${eventTitle}</strong>` : ""}${eventDate ? ` on <strong>${eventDate}</strong>` : ""}.</p>
          <table style="margin: 16px 0; border-collapse: collapse;">
            ${serviceTime ? `<tr><td style="padding: 4px 12px 4px 0; color: #888;">Service Time</td><td style="padding: 4px 0;">${serviceTime}</td></tr>` : ""}
            ${arrivalTime ? `<tr><td style="padding: 4px 12px 4px 0; color: #888;">Arrival Time</td><td style="padding: 4px 0;">${arrivalTime}</td></tr>` : ""}
            ${venue ? `<tr><td style="padding: 4px 12px 4px 0; color: #888;">Venue</td><td style="padding: 4px 0;">${venue}</td></tr>` : ""}
            ${theme ? `<tr><td style="padding: 4px 12px 4px 0; color: #888;">Theme</td><td style="padding: 4px 0;">${theme}</td></tr>` : ""}
          </table>
          <p>Please confirm or decline your assignment:</p>
          <a href="${confirmLink}" style="display: inline-block; padding: 10px 24px; background-color: #14b8a6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">View My Schedule</a>
          <p style="margin-top: 24px; color: #888;">Blessings,<br/>Potter's Wheel Team</p>
        </div>
      `;

      const { emailSent } = await createNotificationWithEmail({
        userId: assignment.userId,
        recipientEmail: assignment.userEmail,
        title: `New Assignment: ${assignment.roleName}`,
        message: notificationMessage,
        type: "assignment",
        link: "/my-schedule",
        metadata: { assignmentId: assignment.id, serviceId },
        email: {
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
        },
      });

      // Update emailSent status on the assignment
      if (emailSent) {
        const assignmentRef = adminDb.collection("serviceAssignments").doc(assignment.id);
        const sentAt = new Date();
        await assignmentRef.update({
          emailSent: true,
          emailSentAt: sentAt,
        });
        (assignment as Record<string, unknown>).emailSent = true;
        (assignment as Record<string, unknown>).emailSentAt = sentAt.toISOString();
      }
    } catch (notifError) {
      // Don't fail the assignment if notification/email fails, but log clearly
      console.error("Error creating notification or sending email:", notifError);
    }

    return NextResponse.json(
      { assignment: result.assignment },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating assignment:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create assignment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
