import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionCaller as getCaller } from "@/lib/server-auth";
import { createNotificationWithEmail } from "@/lib/notifications";
import { TalentCategory, TalentSubmissionStatus } from "@/types";

export const dynamic = "force-dynamic";

const QUEUE_LINK = "/manage/talents";

const CATEGORIES: TalentCategory[] = [
  "SINGING",
  "INSTRUMENTS",
  "DANCE",
  "DRAMA",
  "POETRY_SPOKEN_WORD",
  "PREACHING_TEACHING",
  "MEDIA_CREATIVE",
  "ART_DESIGN",
  "TECH",
  "OTHER",
];

/** Statuses where the submission is still live in the pipeline. */
const ACTIVE_STATUSES: TalentSubmissionStatus[] = [
  "PENDING_REVIEW",
  "SHORTLISTED",
  "SLOTTED",
];

const LEADERSHIP_ROLES = ["SUPER_ADMIN", "VICE_CHAIRPERSON", "ADMIN"];

// POST /api/talents
// Body: { category, categoryOther?, title, description, experience?,
//         sampleLink?, availabilityNote? }
// A member puts a talent forward for leadership to review and slot into an
// opportunity. Notifies the leadership team that a new submission is waiting.
export async function POST(request: Request) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const category = body.category as TalentCategory | undefined;
    const categoryOther =
      (body.categoryOther as string | undefined)?.trim() || null;
    const title = (body.title as string | undefined)?.trim();
    const description = (body.description as string | undefined)?.trim();
    const experience = (body.experience as string | undefined)?.trim() || null;
    const sampleLink = (body.sampleLink as string | undefined)?.trim() || null;
    const availabilityNote =
      (body.availabilityNote as string | undefined)?.trim() || null;

    if (!category || !CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: "A valid talent category is required" },
        { status: 400 }
      );
    }
    if (category === "OTHER" && !categoryOther) {
      return NextResponse.json(
        { error: "Please say what your talent is" },
        { status: 400 }
      );
    }
    if (!title || title.length > 100) {
      return NextResponse.json(
        { error: "A short title is required (max 100 characters)" },
        { status: 400 }
      );
    }
    if (!description || description.length > 2000) {
      return NextResponse.json(
        { error: "A description is required (max 2000 characters)" },
        { status: 400 }
      );
    }
    if (sampleLink && !/^https?:\/\//i.test(sampleLink)) {
      return NextResponse.json(
        { error: "The sample link must be a full URL (starting with http)" },
        { status: 400 }
      );
    }

    // One live submission per category per member keeps the queue clean.
    const existing = await adminDb
      .collection("talentSubmissions")
      .where("userId", "==", caller.uid)
      .where("category", "==", category)
      .get();
    const hasOpen = existing.docs.some((d) =>
      ACTIVE_STATUSES.includes(d.data().status as TalentSubmissionStatus)
    );
    if (hasOpen) {
      return NextResponse.json(
        {
          error:
            "You already have an active submission in this category. Withdraw it first if you'd like to submit a new one.",
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const status: TalentSubmissionStatus = "PENDING_REVIEW";

    const ref = await adminDb.collection("talentSubmissions").add({
      userId: caller.uid,
      userName: caller.name,
      userEmail: caller.email,
      category,
      categoryOther: category === "OTHER" ? categoryOther : null,
      title,
      description,
      experience,
      sampleLink,
      availabilityNote,
      status,
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      reviewComments: null,
      opportunityTitle: null,
      opportunityDate: null,
      opportunityNotes: null,
      slottedBy: null,
      slottedByName: null,
      slottedAt: null,
      statusHistory: [
        {
          status,
          changedBy: caller.uid,
          changedByName: caller.name,
          changedAt: now,
          comments: null,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    // Let the leadership team know a talent is waiting to be discovered.
    const leadersSnap = await adminDb
      .collection("users")
      .where("role", "in", LEADERSHIP_ROLES)
      .get();
    for (const leaderDoc of leadersSnap.docs) {
      if (leaderDoc.data().isActive === false) continue;
      if (leaderDoc.id === caller.uid) continue;
      createNotificationWithEmail({
        userId: leaderDoc.id,
        title: "New Talent Submission",
        message: `${caller.name} has put forward a talent: "${title}". Review it and decide when to slot them in.`,
        type: "announcement",
        link: QUEUE_LINK,
        recipientEmail: leaderDoc.data().email,
        email: {
          subject: `New talent submission from ${caller.name}`,
          text: `${caller.name} has put forward a talent for review: "${title}".\n\n${description}\n\nReview it in the Talent Submissions queue and decide when to give them an opportunity.`,
        },
      }).catch(console.error);
    }

    return NextResponse.json({ success: true, id: ref.id, status });
  } catch (error) {
    console.error("POST /api/talents error:", error);
    return NextResponse.json(
      { error: "Failed to submit talent" },
      { status: 500 }
    );
  }
}
