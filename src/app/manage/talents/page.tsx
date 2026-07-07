"use client";

import { useEffect, useMemo, useState } from "react";
import { onSnapshot, Timestamp } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { TalentSubmission, TalentSubmissionStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner, PageLoader } from "@/components/shared/LoadingSpinner";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Star, Inbox, ExternalLink, CalendarCheck } from "lucide-react";
import { format } from "date-fns";
import { TALENT_CATEGORY_OPTIONS, talentCategoryLabel } from "@/lib/talents";

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return new Date();
}

function toDateOrNull(val: unknown): Date | null {
  return val == null ? null : toDate(val);
}

type DecisionAction =
  | "SHORTLIST"
  | "DECLINE"
  | "SLOT"
  | "RETURN_TO_POOL"
  | "COMPLETE";

const STATUS_META: Record<
  TalentSubmissionStatus,
  { label: string; tone: string }
> = {
  PENDING_REVIEW: { label: "Awaiting review", tone: "bg-gold/15 text-gold-dark" },
  SHORTLISTED: { label: "In the pool", tone: "bg-blue-50 text-blue-600" },
  SLOTTED: { label: "Slotted in", tone: "bg-emerald-50 text-emerald-600" },
  COMPLETED: { label: "Showcased", tone: "bg-emerald-50 text-emerald-600" },
  DECLINED: { label: "Declined", tone: "bg-red-50 text-red-600" },
  WITHDRAWN: { label: "Withdrawn", tone: "bg-clay-100 text-clay-500" },
};

const ACTION_META: Record<
  DecisionAction,
  { title: string; verb: string; needsReason: boolean; destructive: boolean }
> = {
  SHORTLIST: { title: "Shortlist into the talent pool", verb: "Shortlist", needsReason: false, destructive: false },
  DECLINE: { title: "Decline submission", verb: "Decline", needsReason: true, destructive: true },
  SLOT: { title: "Slot into an opportunity", verb: "Slot in", needsReason: false, destructive: false },
  RETURN_TO_POOL: { title: "Return to the talent pool", verb: "Return to pool", needsReason: false, destructive: true },
  COMPLETE: { title: "Mark showcase completed", verb: "Mark completed", needsReason: false, destructive: false },
};

function SubmissionCard({
  sub,
  actions,
}: {
  sub: TalentSubmission;
  actions: { action: DecisionAction; onClick: () => void }[];
}) {
  const meta = STATUS_META[sub.status];
  return (
    <div className="rounded-lg border border-clay-100/70 bg-white/60 p-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-gold/20 text-gold-dark font-bold">
            {(sub.userName || "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-clay-700">{sub.userName}</p>
            <Badge className={`${meta.tone} text-xs`}>{meta.label}</Badge>
            <Badge variant="outline" className="text-xs text-clay-500">
              {talentCategoryLabel(sub)}
            </Badge>
          </div>
          <p className="text-sm font-medium text-clay-600 mt-1">{sub.title}</p>
          <p className="text-sm text-clay-500 mt-1 whitespace-pre-wrap">
            {sub.description}
          </p>
          {sub.experience && (
            <p className="text-xs text-clay-500 mt-2">
              <span className="font-medium text-clay-600">Experience:</span>{" "}
              {sub.experience}
            </p>
          )}
          <p className="text-xs text-clay-400 mt-2">
            Submitted {format(sub.createdAt, "MMM d, yyyy")}
            {sub.userEmail ? ` · ${sub.userEmail}` : ""}
            {sub.availabilityNote ? ` · Available: ${sub.availabilityNote}` : ""}
          </p>
          {sub.sampleLink && (
            <a
              href={sub.sampleLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Watch / listen to their sample
            </a>
          )}

          {/* Opportunity details */}
          {(sub.status === "SLOTTED" || sub.status === "COMPLETED") &&
            sub.opportunityTitle && (
              <div className="mt-3 rounded-md bg-emerald-50/60 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CalendarCheck className="h-4 w-4" />
                  {sub.opportunityTitle}
                  {sub.opportunityDate &&
                    ` · ${format(sub.opportunityDate, "EEE, MMM d, yyyy")}`}
                </p>
                {sub.opportunityNotes && (
                  <p className="text-xs text-emerald-700/80 mt-1">
                    {sub.opportunityNotes}
                  </p>
                )}
                {sub.slottedByName && (
                  <p className="text-[11px] text-emerald-600/70 mt-1">
                    Slotted in by {sub.slottedByName}
                    {sub.slottedAt && ` · ${format(sub.slottedAt, "MMM d")}`}
                  </p>
                )}
              </div>
            )}

          {sub.reviewComments && (
            <p className="text-xs text-clay-500 mt-2 italic">
              <span className="font-medium not-italic text-clay-600">
                {sub.reviewedByName || "Reviewer"}:
              </span>{" "}
              &ldquo;{sub.reviewComments}&rdquo;
            </p>
          )}

          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {actions.map((a) => {
                const am = ACTION_META[a.action];
                return (
                  <Button
                    key={a.action}
                    size="sm"
                    variant={am.destructive ? "outline" : "gold"}
                    onClick={a.onClick}
                    className={
                      am.destructive ? "text-red-600 hover:bg-red-50" : ""
                    }
                  >
                    {am.verb}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ManageTalentsContent() {
  const { userData } = useAuth();
  const { toast } = useToast();

  const [submissions, setSubmissions] = useState<TalentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [pending, setPending] = useState<{
    sub: TalentSubmission;
    action: DecisionAction;
  } | null>(null);
  const [comments, setComments] = useState("");
  const [opportunityTitle, setOpportunityTitle] = useState("");
  const [opportunityDate, setOpportunityDate] = useState("");
  const [opportunityNotes, setOpportunityNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>("review");
  const toggleSection = (key: string) =>
    setOpenSection((prev) => (prev === key ? null : key));

  useEffect(() => {
    if (!userData) return;
    const unsub = onSnapshot(
      safeCollection("talentSubmissions"),
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            reviewedAt: toDateOrNull(data.reviewedAt),
            opportunityDate: toDateOrNull(data.opportunityDate),
            slottedAt: toDateOrNull(data.slottedAt),
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
          } as TalentSubmission;
        });
        rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setSubmissions(rows);
        setLoading(false);
      },
      (err) => {
        console.error("manage-talents listener", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [userData]);

  const visible = useMemo(
    () =>
      categoryFilter === "ALL"
        ? submissions
        : submissions.filter((s) => s.category === categoryFilter),
    [submissions, categoryFilter]
  );

  const reviewQueue = useMemo(
    () => visible.filter((s) => s.status === "PENDING_REVIEW"),
    [visible]
  );
  const talentPool = useMemo(
    () => visible.filter((s) => s.status === "SHORTLISTED"),
    [visible]
  );
  const slotted = useMemo(
    () => visible.filter((s) => s.status === "SLOTTED"),
    [visible]
  );
  const closed = useMemo(
    () =>
      visible
        .filter(
          (s) =>
            s.status === "COMPLETED" ||
            s.status === "DECLINED" ||
            s.status === "WITHDRAWN"
        )
        .slice(0, 15),
    [visible]
  );

  const openDecision = (sub: TalentSubmission, action: DecisionAction) => {
    setPending({ sub, action });
    setComments("");
    setOpportunityTitle("");
    setOpportunityDate("");
    setOpportunityNotes("");
  };

  const confirmDecision = async () => {
    if (!pending) return;
    if (pending.action === "SLOT" && !opportunityTitle.trim()) {
      toast({
        title: "Opportunity needed",
        description: "Give the opportunity a title so the member knows what they're slotted into.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/talents/${pending.sub.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: pending.action,
          comments: comments.trim() || undefined,
          ...(pending.action === "SLOT"
            ? {
                opportunityTitle: opportunityTitle.trim(),
                opportunityDate: opportunityDate || undefined,
                opportunityNotes: opportunityNotes.trim() || undefined,
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update submission");
      toast({
        title: "Done",
        description: `${pending.sub.userName}'s "${pending.sub.title}" has been updated.`,
      });
      setPending(null);
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
    setSubmitting(false);
  };

  if (!userData || loading) return <PageLoader />;

  const actionMeta = pending ? ACTION_META[pending.action] : null;
  const nothingToShow =
    reviewQueue.length === 0 &&
    talentPool.length === 0 &&
    slotted.length === 0 &&
    closed.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        backHref="/dashboard"
        icon={Star}
        tone="gold"
        title="Talent Submissions"
        description="Review the talents members have put forward, keep a pool of shortlisted people, and slot them into opportunities when the moment is right."
        actions={
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {TALENT_CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {nothingToShow ? (
        <EmptyState
          icon={Inbox}
          title="No talent submissions yet"
          description="When members put their talents forward on the Talent Showcase page, they'll land here for you to review and slot in."
        />
      ) : (
        <div className="space-y-3">
          <CollapsibleSection
            title="Awaiting review"
            count={reviewQueue.length}
            open={openSection === "review"}
            onToggle={() => toggleSection("review")}
          >
            {reviewQueue.length === 0 ? (
              <div className="rounded-lg bg-cream/40 px-4 py-3 text-sm text-clay-500">
                Nothing is waiting for review right now.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-clay-400">
                  Shortlist to keep someone in the talent pool for later, slot
                  them straight into an opportunity, or decline with feedback.
                </p>
                {reviewQueue.map((sub) => (
                  <SubmissionCard
                    key={sub.id}
                    sub={sub}
                    actions={[
                      { action: "SHORTLIST", onClick: () => openDecision(sub, "SHORTLIST") },
                      { action: "SLOT", onClick: () => openDecision(sub, "SLOT") },
                      { action: "DECLINE", onClick: () => openDecision(sub, "DECLINE") },
                    ]}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Talent pool — ready to slot in"
            count={talentPool.length}
            open={openSection === "pool"}
            onToggle={() => toggleSection("pool")}
          >
            {talentPool.length === 0 ? (
              <div className="rounded-lg bg-cream/40 px-4 py-3 text-sm text-clay-500">
                The pool is empty — shortlist submissions to build it up.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-clay-400">
                  Shortlisted and waiting. When an event or service has room,
                  slot them in.
                </p>
                {talentPool.map((sub) => (
                  <SubmissionCard
                    key={sub.id}
                    sub={sub}
                    actions={[
                      { action: "SLOT", onClick: () => openDecision(sub, "SLOT") },
                      { action: "DECLINE", onClick: () => openDecision(sub, "DECLINE") },
                    ]}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Slotted into opportunities"
            count={slotted.length}
            open={openSection === "slotted"}
            onToggle={() => toggleSection("slotted")}
          >
            {slotted.length === 0 ? (
              <div className="rounded-lg bg-cream/40 px-4 py-3 text-sm text-clay-500">
                No one is currently slotted into an opportunity.
              </div>
            ) : (
              <div className="space-y-3">
                {slotted.map((sub) => (
                  <SubmissionCard
                    key={sub.id}
                    sub={sub}
                    actions={[
                      { action: "COMPLETE", onClick: () => openDecision(sub, "COMPLETE") },
                      { action: "RETURN_TO_POOL", onClick: () => openDecision(sub, "RETURN_TO_POOL") },
                    ]}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {closed.length > 0 && (
            <CollapsibleSection
              title="Recently closed"
              count={closed.length}
              open={openSection === "closed"}
              onToggle={() => toggleSection("closed")}
            >
              <div className="space-y-3">
                {closed.map((sub) => (
                  <SubmissionCard key={sub.id} sub={sub} actions={[]} />
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}

      {/* Decision dialog */}
      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionMeta?.title}</DialogTitle>
            <DialogDescription>
              {pending && `${pending.sub.userName} — "${pending.sub.title}"`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {pending?.action === "SLOT" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="slot-title">Opportunity *</Label>
                  <Input
                    id="slot-title"
                    placeholder="e.g. Special item at the Youth Sunday service"
                    value={opportunityTitle}
                    maxLength={150}
                    onChange={(e) => setOpportunityTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slot-date">Date (optional)</Label>
                  <Input
                    id="slot-date"
                    type="date"
                    value={opportunityDate}
                    onChange={(e) => setOpportunityDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slot-notes">Details for them (optional)</Label>
                  <Textarea
                    id="slot-notes"
                    placeholder="Arrival time, duration, what to prepare..."
                    value={opportunityNotes}
                    onChange={(e) => setOpportunityNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="decision-comments">
                {actionMeta?.needsReason
                  ? "Reason (shared with the member)"
                  : "Note (optional)"}
              </Label>
              <Textarea
                id="decision-comments"
                placeholder={
                  actionMeta?.needsReason
                    ? "Encourage them — let them know why and what could help..."
                    : "Add a note (optional)..."
                }
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant={actionMeta?.destructive ? "outline" : "gold"}
              onClick={confirmDecision}
              disabled={submitting}
              className={
                actionMeta?.destructive ? "text-red-600 hover:bg-red-50" : ""
              }
            >
              {submitting ? <LoadingSpinner size="sm" className="mr-2" /> : null}
              {actionMeta?.verb}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ManageTalentsPage() {
  return (
    <RoleProtected pageKey="manage_talents">
      <ManageTalentsContent />
    </RoleProtected>
  );
}
