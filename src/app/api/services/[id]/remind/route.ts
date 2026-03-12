import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { validateEmailConfig } from "@/lib/email";
import { createNotificationWithEmail } from "@/lib/notifications";
import { hasMinRole } from "@/lib/permissions";
import { UserRole } from "@/types";
import { format } from "date-fns";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params;
    const body = await request.json();
    const { callerRole } = body as { callerRole: UserRole };

    if (!callerRole || !hasMinRole(callerRole, "DEPARTMENT_LEAD")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Pre-flight check: validate email configuration
    const configError = validateEmailConfig();
    if (configError) {
      console.error("Email config validation failed:", configError);
      return NextResponse.json(
        {
          error: "Email configuration error",
          message: configError,
        },
        { status: 500 }
      );
    }

    // Fetch the service
    const serviceDoc = await adminDb
      .collection("services")
      .doc(serviceId)
      .get();

    if (!serviceDoc.exists) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    const serviceData = serviceDoc.data()!;

    // Fetch the linked event
    let eventTitle = "Upcoming Service";
    let eventDate = "";
    let venue = "";

    if (serviceData.eventId) {
      const eventDoc = await adminDb
        .collection("events")
        .doc(serviceData.eventId)
        .get();

      if (eventDoc.exists) {
        const eventData = eventDoc.data()!;
        eventTitle = eventData.title || eventTitle;
        venue = eventData.venue || "";
        if (eventData.startDate) {
          const startDate = eventData.startDate.toDate
            ? eventData.startDate.toDate()
            : new Date(eventData.startDate);
          eventDate = format(startDate, "EEEE, MMMM d, yyyy");
        }
      }
    }

    // Fetch all assignments for this service
    const assignmentsSnapshot = await adminDb
      .collection("serviceAssignments")
      .where("serviceId", "==", serviceId)
      .get();

    if (assignmentsSnapshot.empty) {
      return NextResponse.json(
        { error: "No assignments found for this service" },
        { status: 400 }
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://app.potterswheel.com";
    const serviceTime = serviceData.serviceTime || "TBD";
    const theme = serviceData.theme || "";

    let sentCount = 0;
    let skippedCount = 0;
    let noEmailCount = 0;
    const errors: string[] = [];
    const totalAssignments = assignmentsSnapshot.docs.length;

    for (const assignDoc of assignmentsSnapshot.docs) {
      const assignment = assignDoc.data();

      // Skip declined assignments
      if (assignment.status === "DECLINED") {
        skippedCount++;
        continue;
      }

      // Check for missing email
      if (!assignment.userEmail) {
        noEmailCount++;
        errors.push(
          `${assignment.userName || "Unknown user"} has no email address on file`
        );
        continue;
      }

      const subject = `Reminder: ${assignment.roleName} - ${eventTitle}`;
      const text = [
        `Dear ${assignment.userName},`,
        "",
        `This is a friendly reminder that you are assigned as ${assignment.roleName} for ${eventTitle}${eventDate ? ` on ${eventDate}` : ""}.`,
        "",
        `Service Time: ${serviceTime}`,
        venue ? `Venue: ${venue}` : "",
        theme ? `Theme: ${theme}` : "",
        "",
        assignment.status === "PENDING"
          ? "Please confirm your attendance at your earliest convenience."
          : "",
        "",
        `View your schedule: ${appUrl}/my-schedule`,
        "",
        "Blessings,",
        "Potter's Wheel Team",
      ]
        .filter(Boolean)
        .join("\n");

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5f5243;">Service Reminder</h2>
          <p>Dear ${assignment.userName},</p>
          <p>This is a friendly reminder that you are assigned as <strong>${assignment.roleName}</strong> for <strong>${eventTitle}</strong>${eventDate ? ` on <strong>${eventDate}</strong>` : ""}.</p>
          <table style="margin: 16px 0; border-collapse: collapse;">
            <tr><td style="padding: 4px 12px 4px 0; color: #888;">Service Time</td><td style="padding: 4px 0;">${serviceTime}</td></tr>
            ${venue ? `<tr><td style="padding: 4px 12px 4px 0; color: #888;">Venue</td><td style="padding: 4px 0;">${venue}</td></tr>` : ""}
            ${theme ? `<tr><td style="padding: 4px 12px 4px 0; color: #888;">Theme</td><td style="padding: 4px 0;">${theme}</td></tr>` : ""}
          </table>
          ${assignment.status === "PENDING" ? "<p>Please confirm your attendance at your earliest convenience.</p>" : ""}
          <a href="${appUrl}/my-schedule" style="display: inline-block; background: #14b8a6; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">View My Schedule</a>
          <p style="margin-top: 24px; color: #888; font-size: 14px;">Blessings,<br/>Potter's Wheel Team</p>
        </div>
      `;

      try {
        const notificationMessage = `Reminder: You are assigned as ${assignment.roleName} for ${eventTitle}${eventDate ? ` on ${eventDate}` : ""}.${assignment.status === "PENDING" ? " Please confirm your attendance." : ""}`;

        const { emailSent } = await createNotificationWithEmail({
          userId: assignment.userId,
          recipientEmail: assignment.userEmail,
          title: `Service Reminder: ${assignment.roleName}`,
          message: notificationMessage,
          type: "reminder",
          link: "/my-schedule",
          email: {
            subject,
            text,
            html,
          },
        });

        if (emailSent) {
          sentCount++;
          // Update emailSent status on the assignment
          await adminDb
            .collection("serviceAssignments")
            .doc(assignDoc.id)
            .update({
              emailSent: true,
              emailSentAt: new Date(),
            });
        }
      } catch (emailError) {
        const errorMsg = `Failed to send to ${assignment.userEmail}: ${emailError instanceof Error ? emailError.message : "Unknown error"}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return NextResponse.json({
      message: `Reminders sent successfully`,
      sent: sentCount,
      total: totalAssignments,
      skipped: skippedCount,
      noEmail: noEmailCount,
      errors: errors.length,
      errorDetails: errors.slice(0, 10),
    });
  } catch (error) {
    console.error("Send reminder error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
