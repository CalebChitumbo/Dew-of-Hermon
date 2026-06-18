"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Calendar,
  MapPin,
  ClipboardList,
  Send,
  Save,
  Download,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  EventReport,
  EventReportStatus,
  ObjectivesMetRating,
} from "@/types";
import { buildEventReportPdf } from "../lib/report-pdf";

interface FormState {
  attendanceCount: string;
  objectivesMetRating: "" | "1" | "2" | "3" | "4" | "5";
  highlights: string;
  challenges: string;
  lessonsLearned: string;
  recommendations: string;
  includeFinances: boolean;
  budget: string;
  actualSpend: string;
  financesNotes: string;
  mediaLink: string;
  additionalComments: string;
}

const EMPTY_FORM: FormState = {
  attendanceCount: "",
  objectivesMetRating: "",
  highlights: "",
  challenges: "",
  lessonsLearned: "",
  recommendations: "",
  includeFinances: false,
  budget: "",
  actualSpend: "",
  financesNotes: "",
  mediaLink: "",
  additionalComments: "",
};

const STATUS_LABEL: Record<EventReportStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted — awaiting review",
  REVIEWED: "Reviewed",
  CHANGES_REQUESTED: "Changes requested",
};

const STATUS_BADGE: Record<EventReportStatus, string> = {
  DRAFT: "bg-clay-100 text-clay-700 border-clay-200",
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200",
  REVIEWED: "bg-green-50 text-green-700 border-green-200",
  CHANGES_REQUESTED: "bg-red-50 text-red-700 border-red-200",
};

function parseIsoToDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  try {
    return parseISO(iso);
  } catch {
    return null;
  }
}

function reportToDates(raw: SerializedReport): EventReport {
  return {
    ...raw,
    eventStartDate: parseIsoToDate(raw.eventStartDate) ?? new Date(),
    eventEndDate: parseIsoToDate(raw.eventEndDate),
    submittedAt: parseIsoToDate(raw.submittedAt),
    reviewedAt: parseIsoToDate(raw.reviewedAt),
    createdAt: parseIsoToDate(raw.createdAt) ?? new Date(),
    updatedAt: parseIsoToDate(raw.updatedAt) ?? new Date(),
  };
}

interface SerializedReport extends Omit<
  EventReport,
  "eventStartDate" | "eventEndDate" | "submittedAt" | "reviewedAt" | "createdAt" | "updatedAt"
> {
  eventStartDate: string | null;
  eventEndDate: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export default function EventReportFormPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const { userData } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [report, setReport] = useState<EventReport | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState<null | "draft" | "submit">(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [eventMeta, setEventMeta] = useState<{
    title: string;
    venue: string | null;
    startDate: Date | null;
    endDate: Date | null;
    createdBy: string;
    hasEnded: boolean;
  } | null>(null);

  const eventId = params?.eventId;

  const isOwner = !!(
    userData &&
    eventMeta &&
    eventMeta.createdBy === userData.id
  );
  const isAdmin =
    userData?.role === "ADMIN" || userData?.role === "SUPER_ADMIN";

  const readOnly = !!report && report.status === "REVIEWED";
  const locked =
    !!eventMeta && !eventMeta.hasEnded ? true : readOnly;

  const loadAll = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setAccessDenied(false);
    setNotFound(false);
    try {
      const [eventRes, reportRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/event-reports/${eventId}`),
      ]);

      if (eventRes.status === 404) {
        setNotFound(true);
        return;
      }
      if (!eventRes.ok) {
        throw new Error("Failed to load event");
      }
      const eventData = await eventRes.json();
      const evt = eventData.event ?? eventData;
      const startDate = parseIsoToDate(evt.startDate);
      const endDate = parseIsoToDate(evt.endDate);
      const effectiveEnd = endDate ?? startDate;
      setEventMeta({
        title: evt.title,
        venue: evt.venue,
        startDate,
        endDate,
        createdBy: evt.createdBy,
        hasEnded: !!effectiveEnd && effectiveEnd <= new Date(),
      });

      if (reportRes.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (reportRes.ok) {
        const j = await reportRes.json();
        if (j.report) {
          const r: EventReport = reportToDates(j.report);
          setReport(r);
          setForm({
            attendanceCount:
              r.attendanceCount === null ? "" : String(r.attendanceCount),
            objectivesMetRating: (r.objectivesMetRating
              ? String(r.objectivesMetRating)
              : "") as FormState["objectivesMetRating"],
            highlights: r.highlights || "",
            challenges: r.challenges || "",
            lessonsLearned: r.lessonsLearned || "",
            recommendations: r.recommendations || "",
            includeFinances: !!r.finances,
            budget:
              r.finances?.budget !== null && r.finances?.budget !== undefined
                ? String(r.finances.budget)
                : "",
            actualSpend:
              r.finances?.actualSpend !== null &&
              r.finances?.actualSpend !== undefined
                ? String(r.finances.actualSpend)
                : "",
            financesNotes: r.finances?.notes || "",
            mediaLink: r.mediaLink || "",
            additionalComments: r.additionalComments || "",
          });
        }
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Couldn't load report",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const buildPayload = useCallback(() => {
    const attendanceCount =
      form.attendanceCount.trim() === ""
        ? null
        : Number(form.attendanceCount);
    const objectivesMetRating: ObjectivesMetRating | null =
      form.objectivesMetRating === ""
        ? null
        : (Number(form.objectivesMetRating) as ObjectivesMetRating);

    const finances = form.includeFinances
      ? {
          budget:
            form.budget.trim() === "" ? null : Number(form.budget),
          actualSpend:
            form.actualSpend.trim() === "" ? null : Number(form.actualSpend),
          notes: form.financesNotes.trim() || null,
        }
      : null;

    return {
      attendanceCount,
      objectivesMetRating,
      highlights: form.highlights.trim(),
      challenges: form.challenges.trim(),
      lessonsLearned: form.lessonsLearned.trim(),
      recommendations: form.recommendations.trim(),
      finances,
      mediaLink: form.mediaLink.trim() || null,
      additionalComments: form.additionalComments.trim() || null,
    };
  }, [form]);

  async function save(action: "SAVE_DRAFT" | "SUBMIT") {
    if (!eventId) return;
    setSaving(action === "SUBMIT" ? "submit" : "draft");
    try {
      const res = await fetch(`/api/event-reports/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload: buildPayload() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      const data = await res.json();
      if (data.report) {
        setReport(reportToDates(data.report));
      }
      toast({
        title: action === "SUBMIT" ? "Report submitted" : "Draft saved",
        description:
          action === "SUBMIT"
            ? "The Chairperson has been notified."
            : "Your progress is saved. You can return any time.",
        variant: "success",
      });
      if (action === "SUBMIT") {
        setTimeout(() => router.push("/manage/events/reports"), 800);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      toast({
        title: "Couldn't save",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
      setConfirmingSubmit(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (notFound) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Event not found"
        className="py-20"
        action={
          <Link href="/manage/events/reports">
            <Button variant="outline">Back to My Reports</Button>
          </Link>
        }
      />
    );
  }

  if (accessDenied || (!isOwner && !isAdmin)) {
    return (
      <EmptyState
        icon={Shield}
        title="Access Denied"
        description="Only the event initiator can submit a report for this event."
        className="py-20"
        action={
          <Link href="/manage/events/reports">
            <Button variant="outline">Back to My Reports</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/manage/events/reports"
        icon={ClipboardList}
        tone="periwinkle"
        title="Post-Event Report"
        description={eventMeta?.title ?? "—"}
        actions={
          report ? (
            <Badge
              variant="outline"
              className={cn("text-xs", STATUS_BADGE[report.status])}
            >
              {STATUS_LABEL[report.status]}
            </Badge>
          ) : undefined
        }
      />

      {eventMeta && (
        <Card>
          <CardContent className="py-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-clay-600">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-clay-400 flex-shrink-0" />
              <span>
                {eventMeta.startDate
                  ? format(eventMeta.startDate, "EEE, d MMM yyyy")
                  : "—"}
                {eventMeta.endDate &&
                  eventMeta.endDate.toDateString() !==
                    eventMeta.startDate?.toDateString() && (
                    <>
                      {" → "}
                      {format(eventMeta.endDate, "EEE, d MMM yyyy")}
                    </>
                  )}
              </span>
            </div>
            {eventMeta.venue && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-clay-400 flex-shrink-0" />
                <span className="truncate">{eventMeta.venue}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {eventMeta && !eventMeta.hasEnded && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-5 flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold mb-1">Report not yet available</p>
              <p>
                You&apos;ll be able to fill out the post-event report once the
                event&apos;s end date has passed.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {report?.status === "CHANGES_REQUESTED" && report.reviewComments && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-900 flex-1">
              <p className="font-semibold mb-1">
                Chairperson requested changes
                {report.reviewedByName ? ` from ${report.reviewedByName}` : ""}
              </p>
              <p className="whitespace-pre-wrap">{report.reviewComments}</p>
              <p className="mt-2 text-red-800">
                Update the relevant sections below and resubmit.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {report?.status === "REVIEWED" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-5 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-900 flex-1">
              <p className="font-semibold mb-1">
                Reviewed
                {report.reviewedByName ? ` by ${report.reviewedByName}` : ""}
              </p>
              {report.reviewComments && (
                <p className="whitespace-pre-wrap">{report.reviewComments}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <fieldset disabled={locked} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-clay-900">
              <ClipboardList className="h-5 w-5 text-clay-500" />
              Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="attendanceCount">Attendance count</Label>
              <Input
                id="attendanceCount"
                type="number"
                min={0}
                inputMode="numeric"
                value={form.attendanceCount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, attendanceCount: e.target.value }))
                }
                placeholder="e.g. 120"
              />
            </div>
            <div>
              <Label htmlFor="objectivesMetRating">Were objectives met?</Label>
              <Select
                value={form.objectivesMetRating}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    objectivesMetRating: v as FormState["objectivesMetRating"],
                  }))
                }
              >
                <SelectTrigger id="objectivesMetRating">
                  <SelectValue placeholder="Choose a rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — Not met</SelectItem>
                  <SelectItem value="2">2 — Partially met</SelectItem>
                  <SelectItem value="3">3 — Mostly met</SelectItem>
                  <SelectItem value="4">4 — Met</SelectItem>
                  <SelectItem value="5">5 — Exceeded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-clay-900">Reflection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="highlights">Highlights — what went well</Label>
              <Textarea
                id="highlights"
                rows={4}
                value={form.highlights}
                onChange={(e) =>
                  setForm((f) => ({ ...f, highlights: e.target.value }))
                }
                placeholder="Moments of impact, testimonies, wins…"
              />
            </div>
            <div>
              <Label htmlFor="challenges">Challenges encountered</Label>
              <Textarea
                id="challenges"
                rows={4}
                value={form.challenges}
                onChange={(e) =>
                  setForm((f) => ({ ...f, challenges: e.target.value }))
                }
                placeholder="What didn't go as planned"
              />
            </div>
            <div>
              <Label htmlFor="lessonsLearned">Lessons learned</Label>
              <Textarea
                id="lessonsLearned"
                rows={4}
                value={form.lessonsLearned}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lessonsLearned: e.target.value }))
                }
                placeholder="What we now know"
              />
            </div>
            <div>
              <Label htmlFor="recommendations">
                Recommendations for next time
              </Label>
              <Textarea
                id="recommendations"
                rows={4}
                value={form.recommendations}
                onChange={(e) =>
                  setForm((f) => ({ ...f, recommendations: e.target.value }))
                }
                placeholder="What to do differently next time"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-clay-900">Finances</CardTitle>
            <p className="text-sm text-clay-500">
              Optional — include if your event had a budget.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="includeFinances"
                checked={form.includeFinances}
                onCheckedChange={(checked) =>
                  setForm((f) => ({
                    ...f,
                    includeFinances: checked === true,
                  }))
                }
              />
              <Label
                htmlFor="includeFinances"
                className="text-sm text-clay-700 cursor-pointer"
              >
                Include a finances section in this report
              </Label>
            </div>
            {form.includeFinances && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="budget">Budget</Label>
                    <Input
                      id="budget"
                      type="number"
                      step="0.01"
                      value={form.budget}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, budget: e.target.value }))
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="actualSpend">Actual spend</Label>
                    <Input
                      id="actualSpend"
                      type="number"
                      step="0.01"
                      value={form.actualSpend}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          actualSpend: e.target.value,
                        }))
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="financesNotes">Finances notes</Label>
                  <Textarea
                    id="financesNotes"
                    rows={3}
                    value={form.financesNotes}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        financesNotes: e.target.value,
                      }))
                    }
                    placeholder="Breakdown, variances, vendor notes…"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-clay-900">
              Media &amp; Comments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="mediaLink">Photos / media link (optional)</Label>
              <Input
                id="mediaLink"
                type="url"
                value={form.mediaLink}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mediaLink: e.target.value }))
                }
                placeholder="https://…"
              />
            </div>
            <div>
              <Label htmlFor="additionalComments">Additional comments</Label>
              <Textarea
                id="additionalComments"
                rows={3}
                value={form.additionalComments}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    additionalComments: e.target.value,
                  }))
                }
                placeholder="Anything else worth noting"
              />
            </div>
          </CardContent>
        </Card>
      </fieldset>

      <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
        {report && report.status !== "DRAFT" && (
          <Button
            variant="outline"
            type="button"
            onClick={() => buildEventReportPdf(report)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        )}
        {!readOnly && (
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => save("SAVE_DRAFT")}
              disabled={!!saving || locked}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saving === "draft" ? "Saving…" : "Save draft"}
            </Button>
            <Button
              variant="gold"
              type="button"
              onClick={() => setConfirmingSubmit(true)}
              disabled={!!saving || locked}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {report?.status === "CHANGES_REQUESTED"
                ? "Resubmit"
                : "Submit report"}
            </Button>
          </>
        )}
      </div>

      <Dialog
        open={confirmingSubmit}
        onOpenChange={(open) => !saving && setConfirmingSubmit(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit this report?</DialogTitle>
            <DialogDescription>
              The Chairperson will be notified and asked to review. You can
              update the report again only if changes are requested.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmingSubmit(false)}
              disabled={!!saving}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              onClick={() => save("SUBMIT")}
              disabled={!!saving}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {saving === "submit" ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
