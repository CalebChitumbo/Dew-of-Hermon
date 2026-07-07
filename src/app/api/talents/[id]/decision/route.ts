import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { createNotificationWithEmail } from "@/lib/notifications";
import { hasMinRole } from "@/lib/permissions";
import { getSessionCaller as getCaller } from "@/lib/server-auth";
import { transitionIfStatus } from "@/lib/workflow-transitions";
import { TalentSubmissionStatus } from "@/types";

export const dynamic = "force-dynamic";

const MEMBER_LINK = "/talents";
const QUEUE_LINK = "/manage/talents";

type DecisionAction =
  | "SHORTLIST"
  | "DECLINE"
  | "SLOT"
  | "RETURN_TO_POOL"
  | "COMPLETE"
  | "WITHDRAW";

const ACTIONS: DecisionAction[] = [
  "SHORTLIST",
  "DECLINE",
  "SLOT",
  "RETURN_TO_POOL",
  "COMPLETE",
  "WITHDRAW",
];

// POST /api/talents/[id]/decision
// Body: { action, comments?, opportunityTitle?, opportunityDate?, opportunityNotes? }
//
// Leadership (ADMIN and up) moves a submission through its lifecycle:
//   SHORTLIST       PENDING_REVIEW → SHORTLISTED   (into the talent pool)
//   DECLINE         PENDING_REVIEW | SHORTLISTED → DECLINED
//   SLOT            PENDING_REVIEW | SHORTLISTED → SLOTTED (needs opportunityTitle)
//   RETURN_TO_POOL  SLOTTED → SHORTLISTED          (opportunity fell through)
//   COMPLETE        SLOTTED → COMPLETED            (they showcased it)
// The submitter themselves can:
//   WITHDRAW        PENDING_REVIEW | SHORTLISTED → WITHDRAWN
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action as DecisionAction | undefined;
    const comments = (body.comments as string | undefined)?.trim() || null;

    if (!action || !ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `Body must include action: ${ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const { id } = await params;
    const doc = await adminDb.collection("talentSubmissions").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Talent submission not found" },
        { status: 404 }
      );
    }

    const sub = doc.data()!;
    const subStatus = sub.status as TalentSubmissionStatus;
    const submitterId = sub.userId as string;
    const submitterName = (sub.userName as string) || "The member";
    const talentTitle = (sub.title as string) || "their talent";

    const isLeadership = hasMinRole(caller.role, "ADMIN");
    const now = new Date();

    // ── Member withdrawal ─────────────────────────────────────────────────
    if (action === "WITHDRAW") {
      if (submitterId !== caller.uid) {
        return NextResponse.json(
          { error: "You can only withdraw your own submission." },
          { status: 403 }
        );
      }
      if (subStatus !== "PENDING_REVIEW" && subStatus !== "SHORTLISTED") {
        return NextResponse.json(
          { error: `This submission can no longer be withdrawn (status: ${subStatus}).` },
          { status: 400 }
        );
      }

      const txn = await transitionIfStatus({
        collection: "talentSubmissions",
        id,
        expectedStatus: ["PENDING_REVIEW", "SHORTLISTED"],
        newStatus: "WITHDRAWN",
        actor: { uid: caller.uid, name: caller.name },
        comments,
      });
      if (!txn.ok) {
        return NextResponse.json({ error: txn.error }, { status: txn.httpStatus });
      }
      return NextResponse.json({ success: true, status: "WITHDRAWN" });
    }

    // Everything else is a leadership decision.
    if (!isLeadership) {
      return NextResponse.json(
        { error: "Only leadership can act on talent submissions." },
        { status: 403 }
      );
    }

    // ── Shortlist into the talent pool ────────────────────────────────────
    if (action === "SHORTLIST") {
      const txn = await transitionIfStatus({
        collection: "talentSubmissions",
        id,
        expectedStatus: "PENDING_REVIEW",
        newStatus: "SHORTLISTED",
        actor: { uid: caller.uid, name: caller.name },
        comments,
        patch: {
          reviewedBy: caller.uid,
          reviewedByName: caller.name,
          reviewedAt: now,
          reviewComments: comments,
        },
      });
      if (!txn.ok) {
        return NextResponse.json({ error: txn.error }, { status: txn.httpStatus });
      }

      if (submitterId !== caller.uid) {
        createNotificationWithEmail({
          userId: submitterId,
          title: "Your Talent Was Shortlisted",
          message: `${caller.name} has shortlisted "${talentTitle}". You're in the talent pool — leadership will slot you into an opportunity.`,
          type: "announcement",
          link: MEMBER_LINK,
          recipientEmail: sub.userEmail || undefined,
          email: {
            subject: "Your talent was shortlisted",
            text: `Great news — ${caller.name} has shortlisted your talent "${talentTitle}".${
              comments ? `\n\nTheir note: "${comments}"` : ""
            }\n\nYou're now in the talent pool. Leadership will let you know when they've found the right opportunity to slot you in.`,
          },
        }).catch(console.error);
      }
      return NextResponse.json({ success: true, status: "SHORTLISTED" });
    }

    // ── Decline with feedback ─────────────────────────────────────────────
    if (action === "DECLINE") {
      const txn = await transitionIfStatus({
        collection: "talentSubmissions",
        id,
        expectedStatus: ["PENDING_REVIEW", "SHORTLISTED"],
        newStatus: "DECLINED",
        actor: { uid: caller.uid, name: caller.name },
        comments,
        patch: {
          reviewedBy: caller.uid,
          reviewedByName: caller.name,
          reviewedAt: now,
          reviewComments: comments,
        },
      });
      if (!txn.ok) {
        return NextResponse.json({ error: txn.error }, { status: txn.httpStatus });
      }

      if (submitterId !== caller.uid) {
        createNotificationWithEmail({
          userId: submitterId,
          title: "Talent Submission Update",
          message: `Your submission "${talentTitle}" wasn't taken forward this time.${
            comments ? ` Note from ${caller.name}: ${comments}` : ""
          }`,
          type: "announcement",
          link: MEMBER_LINK,
        }).catch(console.error);
      }
      return NextResponse.json({ success: true, status: "DECLINED" });
    }

    // ── Slot into an opportunity ──────────────────────────────────────────
    if (action === "SLOT") {
      const opportunityTitle =
        (body.opportunityTitle as string | undefined)?.trim();
      const opportunityNotes =
        (body.opportunityNotes as string | undefined)?.trim() || null;
      const rawDate = (body.opportunityDate as string | undefined)?.trim();
      let opportunityDate: Date | null = null;
      if (rawDate) {
        const parsed = new Date(rawDate);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: "opportunityDate is not a valid date" },
            { status: 400 }
          );
        }
        opportunityDate = parsed;
      }

      if (!opportunityTitle || opportunityTitle.length > 150) {
        return NextResponse.json(
          { error: "An opportunity title is required (max 150 characters)" },
          { status: 400 }
        );
      }

      const txn = await transitionIfStatus({
        collection: "talentSubmissions",
        id,
        expectedStatus: ["PENDING_REVIEW", "SHORTLISTED"],
        newStatus: "SLOTTED",
        actor: { uid: caller.uid, name: caller.name },
        comments,
        patch: {
          // Slotting straight from the review queue counts as the review.
          reviewedBy: sub.reviewedBy || caller.uid,
          reviewedByName: sub.reviewedByName || caller.name,
          reviewedAt: sub.reviewedAt || now,
          opportunityTitle,
          opportunityDate,
          opportunityNotes,
          slottedBy: caller.uid,
          slottedByName: caller.name,
          slottedAt: now,
        },
      });
      if (!txn.ok) {
        return NextResponse.json({ error: txn.error }, { status: txn.httpStatus });
      }

      if (submitterId !== caller.uid) {
        const dateLine = opportunityDate
          ? ` on ${opportunityDate.toDateString()}`
          : "";
        createNotificationWithEmail({
          userId: submitterId,
          title: "You've Been Given an Opportunity!",
          message: `${caller.name} has slotted you in: ${opportunityTitle}${dateLine}. Check your talent page for details.`,
          type: "assignment",
          link: MEMBER_LINK,
          recipientEmail: sub.userEmail || undefined,
          email: {
            subject: `Opportunity to showcase your talent: ${opportunityTitle}`,
            text: `Great news — ${caller.name} has slotted your talent "${talentTitle}" into an opportunity:\n\n${opportunityTitle}${dateLine}${
              opportunityNotes ? `\n\nDetails: ${opportunityNotes}` : ""
            }${comments ? `\n\nNote: "${comments}"` : ""}\n\nOpen your Talent Showcase page for the full details.`,
          },
        }).catch(console.error);
      }
      return NextResponse.json({ success: true, status: "SLOTTED" });
    }

    // ── Return a slotted talent to the pool ───────────────────────────────
    if (action === "RETURN_TO_POOL") {
      const txn = await transitionIfStatus({
        collection: "talentSubmissions",
        id,
        expectedStatus: "SLOTTED",
        newStatus: "SHORTLISTED",
        actor: { uid: caller.uid, name: caller.name },
        comments,
        patch: {
          opportunityTitle: null,
          opportunityDate: null,
          opportunityNotes: null,
          slottedBy: null,
          slottedByName: null,
          slottedAt: null,
        },
      });
      if (!txn.ok) {
        return NextResponse.json({ error: txn.error }, { status: txn.httpStatus });
      }

      if (submitterId !== caller.uid) {
        createNotificationWithEmail({
          userId: submitterId,
          title: "Opportunity Rescheduled",
          message: `Your slot for "${talentTitle}" was returned to the talent pool.${
            comments ? ` Note from ${caller.name}: ${comments}` : ""
          } Leadership will line up another opportunity.`,
          type: "announcement",
          link: MEMBER_LINK,
        }).catch(console.error);
      }
      return NextResponse.json({ success: true, status: "SHORTLISTED" });
    }

    // ── Mark the showcase as done ─────────────────────────────────────────
    if (action === "COMPLETE") {
      const txn = await transitionIfStatus({
        collection: "talentSubmissions",
        id,
        expectedStatus: "SLOTTED",
        newStatus: "COMPLETED",
        actor: { uid: caller.uid, name: caller.name },
        comments,
      });
      if (!txn.ok) {
        return NextResponse.json({ error: txn.error }, { status: txn.httpStatus });
      }

      if (submitterId !== caller.uid) {
        createNotificationWithEmail({
          userId: submitterId,
          title: "Thank You for Showcasing Your Talent!",
          message: `Your showcase "${talentTitle}" has been marked completed.${
            comments ? ` Note from ${caller.name}: ${comments}` : ""
          }`,
          type: "announcement",
          link: MEMBER_LINK,
        }).catch(console.error);
      }
      return NextResponse.json({ success: true, status: "COMPLETED" });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/talents/[id]/decision error:", error);
    return NextResponse.json(
      { error: "Failed to update talent submission" },
      { status: 500 }
    );
  }
}
