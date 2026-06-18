"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatTile } from "@/components/shared/StatTile";
import {
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  MapPin,
  MessageSquare,
  Shield,
  User,
  Users,
  Target,
  XCircle,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  EventReport,
  EventReportStatus,
  EventType,
} from "@/types";
import { buildEventReportPdf } from "../../lib/report-pdf";

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  POTTERS_WHEEL_SERVICE: "Potter's Wheel Service",
  ROPS_CAMP: "ROPS Camp",
  RETREAT: "Retreat",
  MEETING: "Meeting",
  SPECIAL_EVENT: "Special Event",
  OUTREACH: "Outreach",
};

const OBJECTIVES_LABELS: Record<number, string> = {
  1: "Not met",
  2: "Partially met",
  3: "Mostly met",
  4: "Met",
  5: "Exceeded",
};

const STATUS_BADGE: Record<EventReportStatus, string> = {
  DRAFT: "bg-clay-100 text-clay-700 border-clay-200",
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200",
  REVIEWED: "bg-green-50 text-green-700 border-green-200",
  CHANGES_REQUESTED: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABEL: Record<EventReportStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Awaiting review",
  REVIEWED: "Reviewed",
  CHANGES_REQUESTED: "Changes requested",
};

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

function parseIso(iso: string | null | undefined): Date | null {
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
    eventStartDate: parseIso(raw.eventStartDate) ?? new Date(),
    eventEndDate: parseIso(raw.eventEndDate),
    submittedAt: parseIso(raw.submittedAt),
    reviewedAt: parseIso(raw.reviewedAt),
    createdAt: parseIso(raw.createdAt) ?? new Date(),
    updatedAt: parseIso(raw.updatedAt) ?? new Date(),
  };
}

function ReadOnlySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-clay-900">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-clay-700 whitespace-pre-wrap">
        {children}
      </CardContent>
    </Card>
  );
}

export default function EventReportReviewDetailPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params?.eventId;

  const { userData } = useAuth();
  const { canAccessPage } = usePermissions();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [report, setReport] = useState<EventReport | null>(null);
  const [comments, setComments] = useState("");
  const [actionState, setActionState] = useState<
    null | "REVIEWED" | "REQUEST_CHANGES"
  >(null);
  const [submitting, setSubmitting] = useState(false);

  const hasAccess = userData ? canAccessPage("event_reports_review") : false;

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/event-reports/${eventId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load report");
      }
      const data = await res.json();
      if (!data.report) {
        setNotFound(true);
        return;
      }
      setReport(reportToDates(data.report));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Couldn't load report";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    if (hasAccess) load();
  }, [hasAccess, load]);

  async function submitReview() {
    if (!actionState || !eventId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/event-reports/${eventId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionState,
          comments: comments.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Action failed");
      }
      const data = await res.json();
      if (data.report) {
        setReport(reportToDates(data.report));
      }
      toast({
        title:
          actionState === "REVIEWED"
            ? "Marked as reviewed"
            : "Changes requested",
        description: "The initiator has been notified.",
        variant: "success",
      });
      setActionState(null);
      setComments("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!hasAccess) {
    return (
      <EmptyState
        icon={Shield}
        title="Access Denied"
        description="Only the Chairperson can review event reports."
        className="py-20"
        action={
          <Link href="/calendar">
            <Button variant="outline">Back to Calendar</Button>
          </Link>
        }
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <EmptyState
        icon={XCircle}
        title="Report not found"
        className="py-20"
        action={
          <Link href="/manage/events/reports/review">
            <Button variant="outline">Back to reviews</Button>
          </Link>
        }
      />
    );
  }

  const canTakeAction = report.status === "SUBMITTED";

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/manage/events/reports/review"
        icon={FileText}
        tone="periwinkle"
        title={report.eventTitle}
        description={`Post-event report — ${
          EVENT_TYPE_LABELS[report.eventType] ?? report.eventType
        }`}
        actions={
          <Badge
            variant="outline"
            className={cn("text-xs", STATUS_BADGE[report.status])}
          >
            {STATUS_LABEL[report.status]}
          </Badge>
        }
      />

      <Card>
        <CardContent className="py-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-clay-600">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-clay-400 flex-shrink-0" />
            <span>
              {report.eventStartDate
                ? format(report.eventStartDate, "EEE, d MMM yyyy")
                : "—"}
              {report.eventEndDate &&
                report.eventEndDate.toDateString() !==
                  report.eventStartDate?.toDateString() && (
                  <>
                    {" → "}
                    {format(report.eventEndDate, "EEE, d MMM yyyy")}
                  </>
                )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-clay-400 flex-shrink-0" />
            <span>Submitted by {report.initiatorName}</span>
          </div>
          {report.submittedAt && (
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-clay-400 flex-shrink-0" />
              <span>Submitted {format(report.submittedAt, "d MMM yyyy")}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatTile
          icon={Users}
          tone="periwinkle"
          label="Attendance"
          value={report.attendanceCount ?? "—"}
        />
        <StatTile
          icon={Target}
          tone="sage"
          label="Objectives met"
          value={
            report.objectivesMetRating
              ? `${report.objectivesMetRating} / 5`
              : "—"
          }
          hint={
            report.objectivesMetRating
              ? OBJECTIVES_LABELS[report.objectivesMetRating]
              : undefined
          }
        />
      </div>

      <ReadOnlySection title="Highlights — what went well">
        {report.highlights || "—"}
      </ReadOnlySection>
      <ReadOnlySection title="Challenges encountered">
        {report.challenges || "—"}
      </ReadOnlySection>
      <ReadOnlySection title="Lessons learned">
        {report.lessonsLearned || "—"}
      </ReadOnlySection>
      <ReadOnlySection title="Recommendations for next time">
        {report.recommendations || "—"}
      </ReadOnlySection>

      {report.finances && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-clay-900">Finances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-clay-700">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-clay-500">
                  Budget
                </p>
                <p className="text-lg font-semibold text-clay-900">
                  {report.finances.budget?.toLocaleString() ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-clay-500">
                  Actual spend
                </p>
                <p className="text-lg font-semibold text-clay-900">
                  {report.finances.actualSpend?.toLocaleString() ?? "—"}
                </p>
              </div>
              {report.finances.budget !== null &&
                report.finances.actualSpend !== null && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-clay-500">
                      Variance
                    </p>
                    <p className="text-lg font-semibold text-clay-900">
                      {(
                        report.finances.budget - report.finances.actualSpend
                      ).toLocaleString()}
                    </p>
                  </div>
                )}
            </div>
            {report.finances.notes && (
              <p className="whitespace-pre-wrap pt-2 border-t border-clay-100">
                {report.finances.notes}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {report.mediaLink && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-clay-900">
              Media &amp; photos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={report.mediaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-clay-700 hover:underline break-all"
            >
              {report.mediaLink}
              <ExternalLink className="h-4 w-4 flex-shrink-0" />
            </a>
          </CardContent>
        </Card>
      )}

      {report.additionalComments && (
        <ReadOnlySection title="Additional comments">
          {report.additionalComments}
        </ReadOnlySection>
      )}

      {(report.status === "REVIEWED" ||
        report.status === "CHANGES_REQUESTED") &&
        report.reviewComments && (
          <Card
            className={cn(
              report.status === "REVIEWED"
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            )}
          >
            <CardContent className="py-5">
              <p className="text-sm font-semibold mb-1 text-clay-900">
                {report.status === "REVIEWED"
                  ? "Review notes"
                  : "Changes requested"}
                {report.reviewedByName ? ` — ${report.reviewedByName}` : ""}
              </p>
              <p className="whitespace-pre-wrap text-sm text-clay-700">
                {report.reviewComments}
              </p>
            </CardContent>
          </Card>
        )}

      <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
        <Button
          variant="outline"
          onClick={() => buildEventReportPdf(report)}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      {canTakeAction && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-clay-900">
              Review actions
            </CardTitle>
            <p className="text-sm text-clay-500">
              Add notes (optional for Mark Reviewed; required when requesting
              changes), then choose an action.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="reviewComments">Notes for the initiator</Label>
              <Textarea
                id="reviewComments"
                rows={4}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Optional notes that the initiator will see…"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <Button
                variant="outline"
                className="gap-2 border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setActionState("REQUEST_CHANGES")}
              >
                <MessageSquare className="h-4 w-4" />
                Request changes
              </Button>
              <Button
                variant="gold"
                className="gap-2"
                onClick={() => setActionState("REVIEWED")}
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark reviewed
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={actionState !== null}
        onOpenChange={(open) => !submitting && !open && setActionState(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionState === "REVIEWED"
                ? "Mark report as reviewed?"
                : "Request changes on this report?"}
            </DialogTitle>
            <DialogDescription>
              {actionState === "REVIEWED"
                ? "The initiator will be notified that the report has been reviewed."
                : "The initiator will be notified and asked to update the report with your notes."}
            </DialogDescription>
          </DialogHeader>
          {actionState === "REQUEST_CHANGES" && !comments.trim() && (
            <p className="text-sm text-red-600">
              Notes are required when requesting changes. Please add comments
              before continuing.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionState(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant={actionState === "REVIEWED" ? "gold" : "default"}
              onClick={submitReview}
              disabled={
                submitting ||
                (actionState === "REQUEST_CHANGES" && !comments.trim())
              }
            >
              {submitting
                ? "Working…"
                : actionState === "REVIEWED"
                ? "Confirm reviewed"
                : "Confirm request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
