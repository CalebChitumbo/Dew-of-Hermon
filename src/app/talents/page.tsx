"use client";

import { useEffect, useMemo, useState } from "react";
import { query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { TalentSubmission, TalentSubmissionStatus } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { SectionHeading } from "@/components/shared/SectionHeading";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/hooks/use-toast";
import {
  Star,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarCheck,
  ExternalLink,
  Sparkles,
} from "lucide-react";
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

const STATUS_META: Record<
  TalentSubmissionStatus,
  { label: string; tone: string }
> = {
  PENDING_REVIEW: { label: "Awaiting review", tone: "bg-gold/15 text-gold-dark" },
  SHORTLISTED: { label: "In the talent pool", tone: "bg-blue-50 text-blue-600" },
  SLOTTED: { label: "Opportunity given", tone: "bg-emerald-50 text-emerald-600" },
  COMPLETED: { label: "Showcased", tone: "bg-emerald-50 text-emerald-600" },
  DECLINED: { label: "Not taken forward", tone: "bg-red-50 text-red-600" },
  WITHDRAWN: { label: "Withdrawn", tone: "bg-clay-100 text-clay-500" },
};

const ACTIVE: TalentSubmissionStatus[] = [
  "PENDING_REVIEW",
  "SHORTLISTED",
  "SLOTTED",
];

// ─── Progress pipeline (Submitted → Review → Opportunity) ──────────────────

function Pipeline({ sub }: { sub: TalentSubmission }) {
  type State = "done" | "active" | "rejected" | "pending";
  const reviewState: State =
    sub.status === "PENDING_REVIEW"
      ? "active"
      : sub.status === "DECLINED"
        ? "rejected"
        : sub.status === "WITHDRAWN"
          ? "pending"
          : "done";
  const opportunityState: State =
    sub.status === "SLOTTED" || sub.status === "COMPLETED"
      ? "done"
      : sub.status === "SHORTLISTED"
        ? "active"
        : "pending";

  const steps: { label: string; state: State }[] = [
    { label: "Submitted", state: "done" },
    {
      label:
        reviewState === "rejected"
          ? "Not taken forward"
          : reviewState === "done"
            ? "Shortlisted"
            : "Leadership review",
      state: reviewState,
    },
    {
      label:
        sub.status === "COMPLETED"
          ? "Showcased"
          : opportunityState === "done"
            ? "Slotted in"
            : "Opportunity",
      state: opportunityState,
    },
  ];

  const dot = (state: State) => {
    if (state === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (state === "active") return <Clock className="h-4 w-4 text-gold-dark" />;
    if (state === "rejected") return <XCircle className="h-4 w-4 text-red-500" />;
    return <div className="h-2 w-2 rounded-full bg-clay-300" />;
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span className="flex h-6 w-6 items-center justify-center">{dot(s.state)}</span>
          <span
            className={`text-xs ${
              s.state === "rejected"
                ? "text-red-500"
                : s.state === "pending"
                  ? "text-clay-400"
                  : "text-clay-600"
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-5 bg-clay-200" />}
        </div>
      ))}
    </div>
  );
}

function TalentsContent() {
  const { userData } = useAuth();
  const { toast } = useToast();

  const [submissions, setSubmissions] = useState<TalentSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [category, setCategory] = useState("");
  const [categoryOther, setCategoryOther] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [experience, setExperience] = useState("");
  const [sampleLink, setSampleLink] = useState("");
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  useEffect(() => {
    if (!userData) return;
    const q = query(
      safeCollection("talentSubmissions"),
      where("userId", "==", userData.id)
    );
    const unsub = onSnapshot(
      q,
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
        console.error("talents: submissions listener", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [userData]);

  const activeSubmissions = useMemo(
    () => submissions.filter((s) => ACTIVE.includes(s.status)),
    [submissions]
  );
  const pastSubmissions = useMemo(
    () => submissions.filter((s) => !ACTIVE.includes(s.status)),
    [submissions]
  );

  const resetForm = () => {
    setCategory("");
    setCategoryOther("");
    setTitle("");
    setDescription("");
    setExperience("");
    setSampleLink("");
    setAvailabilityNote("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !title.trim() || !description.trim()) {
      toast({
        title: "A few details missing",
        description: "Pick a category and fill in the title and description.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/talents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          categoryOther: categoryOther.trim() || undefined,
          title: title.trim(),
          description: description.trim(),
          experience: experience.trim() || undefined,
          sampleLink: sampleLink.trim() || undefined,
          availabilityNote: availabilityNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      toast({
        title: "Talent submitted",
        description:
          "Leadership has been notified. They'll review it and slot you into an opportunity.",
      });
      resetForm();
    } catch (err) {
      toast({
        title: "Couldn't submit",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
    setSubmitting(false);
  };

  const handleWithdraw = async (sub: TalentSubmission) => {
    setWithdrawing(sub.id);
    try {
      const res = await fetch(`/api/talents/${sub.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "WITHDRAW" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to withdraw");
      toast({
        title: "Submission withdrawn",
        description: `"${sub.title}" has been withdrawn.`,
      });
    } catch (err) {
      toast({
        title: "Couldn't withdraw",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
    setWithdrawing(null);
  };

  if (!userData || loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/dashboard"
        icon={Star}
        tone="gold"
        title="Talent Showcase"
        description="Have a talent you haven't shared yet? Put it forward here — leadership will review it and slot you into the right opportunity to showcase it."
      />

      {/* Your submissions */}
      {submissions.length > 0 && (
        <Card className="border-clay-100/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-gold-dark" />
              Your talents
            </CardTitle>
            <CardDescription>
              Track where each submission is — from review to your moment on
              stage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...activeSubmissions, ...pastSubmissions].map((sub) => {
              const meta = STATUS_META[sub.status];
              const canWithdraw =
                sub.status === "PENDING_REVIEW" || sub.status === "SHORTLISTED";
              return (
                <div
                  key={sub.id}
                  className="rounded-lg border border-clay-100/70 bg-white/70 p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-clay-700">{sub.title}</p>
                      <p className="text-xs text-clay-400 mt-0.5">
                        {talentCategoryLabel(sub)} · Submitted{" "}
                        {format(sub.createdAt, "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`${meta.tone} text-xs`}>{meta.label}</Badge>
                      {canWithdraw && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleWithdraw(sub)}
                          disabled={withdrawing === sub.id}
                        >
                          {withdrawing === sub.id ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            "Withdraw"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <Pipeline sub={sub} />
                  </div>

                  {/* Opportunity details once slotted */}
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
                          </p>
                        )}
                      </div>
                    )}

                  {sub.reviewComments && (
                    <p className="text-xs text-clay-500 mt-3 italic">
                      <span className="font-medium not-italic text-clay-600">
                        {sub.reviewedByName || "Leadership"}:
                      </span>{" "}
                      &ldquo;{sub.reviewComments}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Submission form */}
      <section className="space-y-4">
        <SectionHeading>Put a talent forward</SectionHeading>

        <Card className="border-clay-100/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold-dark" />
              Tell us what you can do
            </CardTitle>
            <CardDescription>
              Singing, an instrument, drama, tech, art — whatever it is, this is
              your way of raising your hand. Leadership decides when and where
              to slot you in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="talent-category">Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="talent-category">
                      <SelectValue placeholder="What kind of talent?" />
                    </SelectTrigger>
                    <SelectContent>
                      {TALENT_CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="talent-title">Short title *</Label>
                  <Input
                    id="talent-title"
                    placeholder="e.g. Acoustic guitar & lead vocals"
                    value={title}
                    maxLength={100}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </div>

              {category === "OTHER" && (
                <div className="space-y-2">
                  <Label htmlFor="talent-other">What is your talent? *</Label>
                  <Input
                    id="talent-other"
                    placeholder="Tell us what it is"
                    value={categoryOther}
                    onChange={(e) => setCategoryOther(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="talent-description">Describe it *</Label>
                <Textarea
                  id="talent-description"
                  placeholder="What can you do? What would you love to share with the church?"
                  value={description}
                  maxLength={2000}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="talent-experience">
                  Your experience (optional)
                </Label>
                <Textarea
                  id="talent-experience"
                  placeholder="How long have you been doing this? Any training or places you've performed?"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="talent-sample">
                    Link to a sample (optional)
                  </Label>
                  <Input
                    id="talent-sample"
                    type="url"
                    placeholder="https:// — a video or audio of you"
                    value={sampleLink}
                    onChange={(e) => setSampleLink(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="talent-availability">
                    When are you available? (optional)
                  </Label>
                  <Input
                    id="talent-availability"
                    placeholder="e.g. Sundays, or any Friday evening"
                    value={availabilityNote}
                    onChange={(e) => setAvailabilityNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" variant="gold" disabled={submitting}>
                  {submitting ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Submit my talent
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {submissions.length === 0 && (
          <EmptyState
            icon={Star}
            tone="gold"
            title="No submissions yet"
            description="Be brave — put your talent forward above and leadership will find you the right opportunity to shine."
          />
        )}
      </section>

      {/* Sample link hint for slotted members */}
      {activeSubmissions.some((s) => s.sampleLink) && (
        <p className="flex items-center gap-1.5 text-xs text-clay-400">
          <ExternalLink className="h-3.5 w-3.5" />
          Your sample links are shared with leadership as part of the review.
        </p>
      )}
    </div>
  );
}

export default function TalentsPage() {
  return (
    <RoleProtected pageKey="talents">
      <TalentsContent />
    </RoleProtected>
  );
}
