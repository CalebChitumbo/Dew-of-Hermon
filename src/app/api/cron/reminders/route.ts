import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { validateEmailConfig } from "@/lib/email";
import { createNotificationWithEmail } from "@/lib/notifications";
import {
  ReminderDay,
  ServiceRole,
  ServiceAssignment,
  AppEvent,
  Service,
} from "@/types";
import { format, addDays, startOfDay, endOfDay } from "date-fns";

export const dynamic = "force-dynamic";

// Map day of week (0=Sun, 1=Mon ... 6=Sat) to ReminderDay
function getTodayReminderDay(): ReminderDay | null {
  const dayOfWeek = new Date().getDay();
  switch (dayOfWeek) {
    case 1:
      return "MONDAY";
    case 4:
      return "THURSDAY";
    case 6:
      return "SATURDAY";
    default:
      return null;
  }
}

// Replace template placeholders with actual values
function replacePlaceholders(
  template: string,
  data: {
    memberName: string;
    roleName: string;
    serviceDate: string;
    serviceTime: string;
    arrivalTime: string;
    venue: string;
    theme: string;
    eventTitle: string;
    confirmLink: string;
  }
): string {
  return template
    .replace(/\{\{memberName\}\}/g, data.memberName)
    .replace(/\{\{roleName\}\}/g, data.roleName)
    .replace(/\{\{serviceDate\}\}/g, data.serviceDate)
    .replace(/\{\{serviceTime\}\}/g, data.serviceTime)
    .replace(/\{\{arrivalTime\}\}/g, data.arrivalTime)
    .replace(/\{\{venue\}\}/g, data.venue)
    .replace(/\{\{theme\}\}/g, data.theme)
    .replace(/\{\{eventTitle\}\}/g, data.eventTitle)
    .replace(/\{\{confirmLink\}\}/g, data.confirmLink);
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET is not configured");
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Determine today's reminder day
    const today = getTodayReminderDay();
    if (!today) {
      return NextResponse.json({
        message: "No reminders scheduled for today",
        sent: 0,
      });
    }

    const now = new Date();
    const sevenDaysFromNow = addDays(now, 7);

    // Query events in the next 7 days of type POTTERS_WHEEL_SERVICE
    const eventsSnapshot = await adminDb
      .collection("events")
      .where("type", "==", "POTTERS_WHEEL_SERVICE")
      .where("startDate", ">=", startOfDay(now))
      .where("startDate", "<=", endOfDay(sevenDaysFromNow))
      .get();

    if (eventsSnapshot.empty) {
      return NextResponse.json({
        message: "No upcoming Potter's Wheel services in the next 7 days",
        sent: 0,
      });
    }

    // Collect event data
    const eventMap = new Map<string, AppEvent>();
    eventsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      eventMap.set(doc.id, {
        id: doc.id,
        title: data.title,
        description: data.description || null,
        type: data.type,
        startDate: data.startDate?.toDate?.() || new Date(),
        endDate: data.endDate?.toDate?.() || null,
        venue: data.venue,
        isRecurring: data.isRecurring,
        createdBy: data.createdBy,
        lifeGroupTarget: data.lifeGroupTarget || null,
        approvalStatus: data.approvalStatus || "APPROVED",
        approvalComments: data.approvalComments || null,
        approvedBy: data.approvedBy || null,
        approvedAt: data.approvedAt?.toDate?.() || null,
        createdByDepartmentId: data.createdByDepartmentId || null,
        coreRoles: data.coreRoles || [],
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      });
    });

    const eventIds = Array.from(eventMap.keys());

    // For each event, get linked services
    const servicesSnapshot = await adminDb
      .collection("services")
      .where("eventId", "in", eventIds.slice(0, 10)) // Firestore "in" limit
      .get();

    if (servicesSnapshot.empty) {
      return NextResponse.json({
        message: "No services linked to upcoming events",
        sent: 0,
      });
    }

    const serviceMap = new Map<string, Service>();
    servicesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      serviceMap.set(doc.id, {
        id: doc.id,
        eventId: data.eventId,
        theme: data.theme || null,
        serviceTime: data.serviceTime,
        programNotes: data.programNotes || null,
        attendanceCount: data.attendanceCount || null,
        isArchived: data.isArchived || false,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      });
    });

    const serviceIds = Array.from(serviceMap.keys());

    // Fetch all service roles (to check reminderSchedule)
    const rolesSnapshot = await adminDb.collection("serviceRoles").get();
    const roleMap = new Map<string, ServiceRole>();
    rolesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      roleMap.set(doc.id, {
        id: doc.id,
        name: data.name,
        departmentId: data.departmentId,
        description: data.description || null,
        emailSubject: data.emailSubject || "",
        emailBody: data.emailBody || "",
        reminderSchedule: data.reminderSchedule || [],
        arrivalTime: data.arrivalTime || null,
        timeSlot: data.timeSlot || null,
        order: data.order || 0,
      });
    });

    // For each service, get assignments
    let totalSent = 0;
    let totalSkipped = 0;
    let totalNoEmail = 0;
    const errors: string[] = [];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dew-of-hermon-xy9h.vercel.app";

    for (const serviceId of serviceIds) {
      const service = serviceMap.get(serviceId);
      if (!service) continue;

      const event = eventMap.get(service.eventId);
      if (!event) continue;

      // Fetch assignments for this service
      const assignmentsSnapshot = await adminDb
        .collection("serviceAssignments")
        .where("serviceId", "==", serviceId)
        .get();

      for (const assignDoc of assignmentsSnapshot.docs) {
        const assignment = assignDoc.data() as Omit<ServiceAssignment, "id">;
        const role = roleMap.get(assignment.roleId);

        if (!role) continue;

        // Check if this role's reminderSchedule includes today's day
        if (!role.reminderSchedule.includes(today)) continue;

        // Skip if already declined
        if (assignment.status === "DECLINED") {
          totalSkipped++;
          continue;
        }

        // Check for missing email
        if (!assignment.userEmail) {
          totalNoEmail++;
          errors.push(
            `${assignment.userName || "Unknown user"} has no email address on file`
          );
          continue;
        }

        // Build email from role template
        const placeholderData = {
          memberName: assignment.userName,
          roleName: role.name,
          serviceDate: format(event.startDate, "EEEE, MMMM d, yyyy"),
          serviceTime: service.serviceTime || "TBD",
          arrivalTime: role.arrivalTime || service.serviceTime || "TBD",
          venue: event.venue || "TBD",
          theme: service.theme || "N/A",
          eventTitle: event.title,
          confirmLink: `${appUrl}/my-schedule`,
        };

        const emailSubject = replacePlaceholders(
          role.emailSubject || `Reminder: ${role.name} - ${event.title}`,
          placeholderData
        );
        const emailBody = replacePlaceholders(
          role.emailBody ||
            `Dear {{memberName}},\n\nThis is a reminder that you are assigned as {{roleName}} for {{eventTitle}} on {{serviceDate}} at {{serviceTime}}.\n\nPlease arrive by {{arrivalTime}} at {{venue}}.\n\nTheme: {{theme}}\n\nPlease confirm your attendance: {{confirmLink}}\n\nBlessings,\nPotter's Wheel Team`,
          placeholderData
        );

        try {
          const notificationMessage = `You are assigned as ${role.name} for ${event.title} on ${format(event.startDate, "MMM d, yyyy")}. ${assignment.status === "PENDING" ? "Please confirm your attendance." : ""}`;

          const { emailSent } = await createNotificationWithEmail({
            userId: assignment.userId,
            recipientEmail: assignment.userEmail,
            title: `Service Reminder: ${role.name}`,
            message: notificationMessage,
            type: "reminder",
            link: "/my-schedule",
            email: {
              subject: emailSubject,
              text: emailBody,
              html: emailBody.replace(/\n/g, "<br/>"),
            },
          });

          if (emailSent) {
            totalSent++;
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
    }

    // Log the batch to reminderLogs collection
    await adminDb.collection("reminderLogs").add({
      reminderDay: today,
      sentAt: new Date(),
      recipientCount: totalSent,
      skippedCount: totalSkipped,
      noEmailCount: totalNoEmail,
      errors: errors.length > 0 ? errors.join("; ") : null,
      errorDetails: errors.slice(0, 10),
      serviceIds,
    });

    return NextResponse.json({
      message: `Reminder batch completed for ${today}`,
      sent: totalSent,
      skipped: totalSkipped,
      noEmail: totalNoEmail,
      errors: errors.length,
      errorDetails: errors.slice(0, 10),
    });
  } catch (error) {
    console.error("Cron reminder error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
