import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { validateEmailConfig } from "@/lib/email";
import { createNotificationWithEmail } from "@/lib/notifications";
import { isBirthdayOn, getAgeTurning } from "@/lib/birthdays";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

/**
 * Daily birthday check. Runs every morning and, when one or more active members
 * have a birthday that day, notifies the Chairperson (SUPER_ADMIN) and the
 * Secretary (ADMIN) so they can send each celebrant a birthday wish from the
 * Birthdays page. The Chairperson's note nudges them to send the wish.
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("CRON_SECRET is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }
    if (request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Email is best-effort; the in-app notification still fires if it's missing.
    const configError = validateEmailConfig();
    if (configError) {
      console.warn("Birthday cron: email not configured —", configError);
    }

    const today = new Date();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://dew-of-hermon-xy9h.vercel.app";

    // Find today's celebrants among active members.
    const usersSnap = await adminDb
      .collection("users")
      .where("isActive", "==", true)
      .get();

    const celebrants = usersSnap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: (data.name as string) || "A member",
          dateOfBirth: (data.dateOfBirth as string | null) || null,
          role: data.role as string,
        };
      })
      .filter((u) => isBirthdayOn(u.dateOfBirth, today));

    if (celebrants.length === 0) {
      return NextResponse.json({ message: "No birthdays today", celebrants: 0, notified: 0 });
    }

    // Build a readable summary, e.g. "Tariro (turns 22) and James".
    const namePieces = celebrants.map((c) => {
      const age = getAgeTurning(c.dateOfBirth, today);
      return age !== null ? `${c.name} (turns ${age})` : c.name;
    });
    const summary =
      namePieces.length === 1
        ? namePieces[0]
        : `${namePieces.slice(0, -1).join(", ")} and ${namePieces[namePieces.length - 1]}`;
    const count = celebrants.length;
    const headline =
      count === 1
        ? `🎂 It's ${celebrants[0].name}'s birthday today!`
        : `🎂 ${count} birthdays today!`;
    const dateStr = format(today, "EEEE, d MMMM yyyy");
    const link = "/manage/birthdays";

    // Notify the Chairperson and the Secretary (and Vice Chair, who can also act).
    const leadersSnap = await adminDb
      .collection("users")
      .where("role", "in", ["SUPER_ADMIN", "VICE_CHAIRPERSON", "ADMIN"])
      .where("isActive", "==", true)
      .get();

    let notified = 0;
    const errors: string[] = [];

    for (const leaderDoc of leadersSnap.docs) {
      const leader = leaderDoc.data();
      const isChair = leader.role === "SUPER_ADMIN";
      const action = isChair
        ? "Open the Birthdays page to send each of them a birthday wish."
        : "See the Birthdays page for the full list.";
      const message = `${summary} ${count === 1 ? "has" : "have"} a birthday today (${dateStr}). ${action}`;

      try {
        await createNotificationWithEmail({
          userId: leaderDoc.id,
          recipientEmail: leader.email,
          title: headline,
          message,
          type: "birthday",
          link,
          email: {
            subject: headline,
            text: `${message}\n\nOpen the Birthdays page: ${appUrl}${link}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="font-size: 40px;">🎂</div>
                <h2 style="color: #5C4033;">${headline}</h2>
                <p style="color: #3E2518; line-height: 1.6;">${message}</p>
                <a href="${appUrl}${link}" style="display: inline-block; margin-top: 8px; padding: 10px 24px; background-color: #C8963E; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Open Birthdays</a>
              </div>
            `,
          },
        });
        notified++;
      } catch (err) {
        const msg = `Birthday notify failed for ${leader.email}: ${err instanceof Error ? err.message : "Unknown"}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    await adminDb.collection("birthdayCronLogs").add({
      date: format(today, "yyyy-MM-dd"),
      sentAt: new Date(),
      celebrantCount: count,
      celebrantNames: celebrants.map((c) => c.name),
      leadersNotified: notified,
      errors: errors.length > 0 ? errors.slice(0, 10) : null,
    });

    return NextResponse.json({
      message: `Birthday check complete for ${dateStr}`,
      celebrants: count,
      notified,
      errors: errors.length,
    });
  } catch (error) {
    console.error("Birthday cron error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
