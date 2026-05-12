import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { canPlanBraai, getCaller } from "../../../_auth";
import { createNotificationWithEmail } from "@/lib/notifications";
import {
  BRAAI_RESPONSIBILITIES,
  BRAAI_RESPONSIBILITY_KEYS,
  getBraaiResponsibility,
} from "@/lib/braai";

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
    if (!(await canPlanBraai(caller))) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const snap = await adminDb
      .collection("braaiAssignments")
      .where("braaiEventId", "==", id)
      .get();

    const assignments = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        braaiEventId: data.braaiEventId,
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

    return NextResponse.json({
      assignments,
      responsibilities: BRAAI_RESPONSIBILITIES,
    });
  } catch (error) {
    console.error("Error listing braai assignments:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load braai assignments", details: message },
      { status: 500 }
    );
  }
}

export async function POST(
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

    const { id: braaiEventId } = await params;
    const body = await request.json();
    const { responsibilityKey, userId } = body;

    if (!responsibilityKey || !userId) {
      return NextResponse.json(
        { error: "Responsibility and user are required" },
        { status: 400 }
      );
    }
    if (!BRAAI_RESPONSIBILITY_KEYS.has(responsibilityKey)) {
      return NextResponse.json(
        { error: "Unknown responsibility" },
        { status: 400 }
      );
    }
    const responsibility = getBraaiResponsibility(responsibilityKey)!;

    const braaiDoc = await adminDb
      .collection("braaiEvents")
      .doc(braaiEventId)
      .get();
    if (!braaiDoc.exists) {
      return NextResponse.json(
        { error: "Braai event not found" },
        { status: 404 }
      );
    }

    const result = await adminDb.runTransaction(async (tx) => {
      // Has this responsibility already been filled?
      const existingForRoleQ = adminDb
        .collection("braaiAssignments")
        .where("braaiEventId", "==", braaiEventId)
        .where("responsibilityKey", "==", responsibilityKey);
      const existingForRole = await tx.get(existingForRoleQ);
      if (!existingForRole.empty) {
        return {
          error: `${existingForRole.docs[0].data().userName} is already assigned to "${responsibility.name}". Remove that assignment first.`,
          status: 409 as const,
        };
      }

      const userDoc = await tx.get(adminDb.collection("users").doc(userId));
      if (!userDoc.exists) {
        return { error: "User not found", status: 404 as const };
      }
      const userData = userDoc.data()!;
      if (userData.isActive === false) {
        return { error: "This member is inactive", status: 400 as const };
      }

      const now = new Date();
      const assignmentRef = adminDb.collection("braaiAssignments").doc();
      const data = {
        braaiEventId,
        responsibilityKey: responsibility.key,
        responsibilityName: responsibility.name,
        phase: responsibility.phase,
        userId,
        userName: userData.name || "",
        userEmail: userData.email || "",
        userPhone: userData.phone || null,
        status: "PENDING" as const,
        emailSent: false,
        emailSentAt: null,
        confirmedAt: null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      };
      tx.set(assignmentRef, data);
      return {
        status: 201 as const,
        assignment: { id: assignmentRef.id, ...data },
      };
    });

    if ("error" in result && result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    // Send the heads-up email + in-app notification
    const assignment = result.assignment!;
    const braaiData = braaiDoc.data()!;
    const eventDateRaw = braaiData.eventDate?.toDate?.();
    const eventDateLabel = eventDateRaw
      ? eventDateRaw.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "an upcoming Sunday";
    const eventTitle = braaiData.title || "Sunday Fundraising Braai";
    const venue = braaiData.venue || "";

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://dew-of-hermon-xy9h.vercel.app";
    const confirmLink = `${appUrl}/my-schedule`;

    const messageLines = [
      `Greetings ${assignment.userName.split(" ")[0] || ""} 🙏🏾`,
      "",
      `You have been assigned to "${assignment.responsibilityName}" for the ${eventTitle} on ${eventDateLabel}.`,
      "",
      ...(venue ? [`📍 Venue: ${venue}`] : []),
      `Phase: ${assignment.phase === "PREPARATION" ? "Preparations" : "Actual Day"}`,
      "",
      "Please confirm or decline your availability:",
      confirmLink,
      "",
      "Thank you for serving!",
      "Dew of Hermon Fundraising Team",
    ];
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color:#5C4033;">Braai Duty: ${assignment.responsibilityName}</h2>
        <p>Greetings ${assignment.userName.split(" ")[0] || ""} 🙏🏾</p>
        <p>You have been assigned to <strong>${assignment.responsibilityName}</strong> for <strong>${eventTitle}</strong> on <strong>${eventDateLabel}</strong>.</p>
        <table style="margin:16px 0;border-collapse:collapse;">
          ${venue ? `<tr><td style="padding:4px 12px 4px 0;color:#888;">Venue</td><td style="padding:4px 0;">${venue}</td></tr>` : ""}
          <tr><td style="padding:4px 12px 4px 0;color:#888;">Phase</td><td style="padding:4px 0;">${assignment.phase === "PREPARATION" ? "Preparations" : "Actual Day"}</td></tr>
        </table>
        <p>Please confirm or decline your availability:</p>
        <a href="${confirmLink}" style="display:inline-block;padding:10px 24px;background-color:#14b8a6;color:white;text-decoration:none;border-radius:6px;font-weight:600;">View My Schedule</a>
        <p style="margin-top:24px;color:#888;">Thank you for serving!<br/>Dew of Hermon Fundraising Team</p>
      </div>
    `;

    try {
      const { emailSent } = await createNotificationWithEmail({
        userId: assignment.userId,
        recipientEmail: assignment.userEmail,
        title: `Braai Duty: ${assignment.responsibilityName}`,
        message: `You have been assigned to "${assignment.responsibilityName}" for the ${eventTitle} on ${eventDateLabel}. Please confirm or decline.`,
        type: "assignment",
        link: "/my-schedule",
        email: {
          subject: `Braai Duty: ${assignment.responsibilityName} — ${eventDateLabel}`,
          text: messageLines.join("\n"),
          html,
        },
      });

      if (emailSent) {
        const sentAt = new Date();
        await adminDb
          .collection("braaiAssignments")
          .doc(assignment.id)
          .update({ emailSent: true, emailSentAt: sentAt });
        (assignment as Record<string, unknown>).emailSent = true;
        (assignment as Record<string, unknown>).emailSentAt = sentAt.toISOString();
      }
    } catch (err) {
      console.error(
        "Failed to send braai assignment notification/email:",
        err
      );
    }

    return NextResponse.json(
      {
        assignment: {
          ...assignment,
          createdAt:
            (assignment as { createdAt: Date }).createdAt.toISOString?.() ||
            new Date().toISOString(),
          updatedAt:
            (assignment as { updatedAt: Date }).updatedAt.toISOString?.() ||
            new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating braai assignment:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create assignment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
