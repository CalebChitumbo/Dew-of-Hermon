"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  Bell,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  MapPin,
  Shield,
  User,
  XCircle,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventReportStatus, EventType } from "@/types";

type TabKey = EventReportStatus | "NOT_STARTED";

interface ReportListItem {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartDate: string | null;
  eventEndDate: string | null;
  eventType: EventType;
  initiatorName: string;
  status: EventReportStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string | null;
}

interface OverdueEvent {
  id: string;
  title: string;
  type: EventType;
  startDate: string | null;
  endDate: string | null;
  venue: string;
  createdBy: string;
  createdByName: string | null;
  reportStatus: "NONE" | "DRAFT" | "CHANGES_REQUESTED";
  reviewComments: string | null;
}

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  POTTERS_WHEEL_SERVICE: "Potter's Wheel Service",
  ROPS_CAMP: "ROPS Camp",
  RETREAT: "Retreat",
  MEETING: "Meeting",
  SPECIAL_EVENT: "Special Event",
  OUTREACH: "Outreach",
};

const TAB_LABEL: Record<TabKey, string> = {
  NOT_STARTED: "Not started",
  SUBMITTED: "Pending",
  CHANGES_REQUESTED: "Changes",
  DRAFT: "Drafts",
  REVIEWED: "Reviewed",
};

const STATUS_BADGE: Record<TabKey, string> = {
  NOT_STARTED: "bg-amber-50 text-amber-700 border-amber-200",
  DRAFT: "bg-clay-100 text-clay-700 border-clay-200",
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200",
  REVIEWED: "bg-green-50 text-green-700 border-green-200",
  CHANGES_REQUESTED: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABEL: Record<TabKey, string> = {
  NOT_STARTED: "Report not started",
  DRAFT: "Draft",
  SUBMITTED: "Awaiting review",
  REVIEWED: "Reviewed",
  CHANGES_REQUESTED: "Changes requested",
};

const STATUS_BAR: Record<TabKey, string> = {
  NOT_STARTED: "bg-amber-400",
  DRAFT: "bg-clay-300",
  SUBMITTED: "bg-blue-400",
  REVIEWED: "bg-green-500",
  CHANGES_REQUESTED: "bg-red-400",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

export default function EventReportsReviewPage() {
  const { userData } = useAuth();
  const { canAccessPage } = usePermissions();
  const { toast } = useToast();

  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [overdueEvents, setOverdueEvents] = useState<OverdueEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<TabKey>("SUBMITTED");

  const [confirmingBulkRemind, setConfirmingBulkRemind] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [remindingEventId, setRemindingEventId] = useState<string | null>(null);

  const hasAccess = userData ? canAccessPage("event_reports_review") : false;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [reportsRes, overdueRes] = await Promise.all([
        fetch("/api/event-reports"),
        fetch("/api/event-reports/overdue"),
      ]);
      if (!reportsRes.ok || !overdueRes.ok) {
        throw new Error("Failed to fetch");
      }
      const reportsData = await reportsRes.json();
      const overdueData = await overdueRes.json();
      setReports(reportsData.reports || []);
      setOverdueEvents(overdueData.events || []);
    } catch (err) {
      console.error(err);
      setError(true);
      toast({
        title: "Couldn't load reports",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (hasAccess) fetchAll();
  }, [hasAccess, fetchAll]);

  const reportCounts = useMemo(() => {
    const c: Record<EventReportStatus, number> = {
      DRAFT: 0,
      SUBMITTED: 0,
      REVIEWED: 0,
      CHANGES_REQUESTED: 0,
    };
    for (const r of reports) c[r.status]++;
    return c;
  }, [reports]);

  const notStartedCount = useMemo(
    () => overdueEvents.filter((e) => e.reportStatus === "NONE").length,
    [overdueEvents]
  );

  const counts: Record<TabKey, number> = {
    NOT_STARTED: notStartedCount,
    SUBMITTED: reportCounts.SUBMITTED,
    CHANGES_REQUESTED: reportCounts.CHANGES_REQUESTED,
    DRAFT: reportCounts.DRAFT,
    REVIEWED: reportCounts.REVIEWED,
  };

  const overdueTotal =
    counts.NOT_STARTED + counts.DRAFT + counts.CHANGES_REQUESTED;

  const filteredReports = useMemo(
    () =>
      tab === "NOT_STARTED"
        ? []
        : reports.filter((r) => r.status === tab),
    [reports, tab]
  );

  const filteredOverdue = useMemo(
    () =>
      tab === "NOT_STARTED"
        ? overdueEvents.filter((e) => e.reportStatus === "NONE")
        : [],
    [overdueEvents, tab]
  );

  async function sendBulkReminders() {
    setSendingBulk(true);
    try {
      const res = await fetch("/api/event-reports/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send reminders");
      }
      const data = await res.json();
      const n: number = data.remindedCount ?? 0;
      toast({
        title:
          n === 0
            ? "No reminders sent"
            : n === 1
            ? "Reminder sent"
            : `${n} reminders sent`,
        description:
          n === 0
            ? "There are no overdue reports right now."
            : "Initiators have been notified by email and in-app notification.",
        variant: "success",
      });
      setConfirmingBulkRemind(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSendingBulk(false);
    }
  }

  async function sendSingleReminder(eventId: string, initiatorLabel: string) {
    setRemindingEventId(eventId);
    try {
      const res = await fetch("/api/event-reports/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send reminder");
      }
      const data = await res.json();
      if ((data.remindedCount ?? 0) === 0) {
        toast({
          title: "No reminder sent",
          description: "This report is no longer overdue.",
          variant: "default",
        });
      } else {
        toast({
          title: "Reminder sent",
          description: `${initiatorLabel} has been notified.`,
          variant: "success",
        });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setRemindingEventId(null);
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

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/manage/events/reports"
        icon={ClipboardCheck}
        tone="periwinkle"
        title="Event Report Reviews"
        description="Review post-event reports submitted by event initiators."
        actions={
          <Badge
            variant="outline"
            className={cn(
              "text-sm",
              counts.SUBMITTED > 0
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-green-50 text-green-700 border-green-200"
            )}
          >
            {counts.SUBMITTED} pending
          </Badge>
        }
      />

      {/* Bulk reminder action bar */}
      <Card
        className={cn(
          "border",
          overdueTotal > 0
            ? "border-amber-200 bg-amber-50"
            : "border-clay-100/70 bg-cream/40"
        )}
      >
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <Bell
            className={cn(
              "h-5 w-5 flex-shrink-0",
              overdueTotal > 0 ? "text-amber-600" : "text-clay-400"
            )}
          />
          <div className="flex-1 text-sm">
            {overdueTotal > 0 ? (
              <>
                <p className="font-semibold text-clay-900">
                  {overdueTotal} overdue{" "}
                  {overdueTotal === 1 ? "report" : "reports"}
                </p>
                <p className="text-clay-600">
                  {counts.NOT_STARTED} not started · {counts.DRAFT}{" "}
                  {counts.DRAFT === 1 ? "draft" : "drafts"} ·{" "}
                  {counts.CHANGES_REQUESTED} awaiting changes
                </p>
              </>
            ) : (
              <p className="font-semibold text-clay-700">
                No overdue reports — everyone is up to date.
              </p>
            )}
          </div>
          <Button
            variant="gold"
            className="gap-2"
            disabled={overdueTotal === 0 || sendingBulk}
            onClick={() => setConfirmingBulkRemind(true)}
          >
            <Bell className="h-4 w-4" />
            {overdueTotal > 0
              ? `Send ${overdueTotal} reminder${overdueTotal === 1 ? "" : "s"}`
              : "Send reminders"}
          </Button>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="grid grid-cols-3 sm:grid-cols-5 gap-2 w-full sm:w-auto">
          <TabsTrigger value="SUBMITTED">
            Pending ({counts.SUBMITTED})
          </TabsTrigger>
          <TabsTrigger value="NOT_STARTED">
            Not started ({counts.NOT_STARTED})
          </TabsTrigger>
          <TabsTrigger value="CHANGES_REQUESTED">
            Changes ({counts.CHANGES_REQUESTED})
          </TabsTrigger>
          <TabsTrigger value="DRAFT">Drafts ({counts.DRAFT})</TabsTrigger>
          <TabsTrigger value="REVIEWED">
            Reviewed ({counts.REVIEWED})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <Card>
              <CardContent className="py-16 text-center">
                <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h3 className="font-display font-semibold text-clay-700 text-lg">
                  Failed to load reports
                </h3>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={fetchAll}
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : tab === "NOT_STARTED" ? (
            filteredOverdue.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                tone="sage"
                title="Nothing here"
                description="No past events are missing a report right now."
              />
            ) : (
              <div className="space-y-4">
                {filteredOverdue.map((e) => (
                  <NotStartedCard
                    key={e.id}
                    event={e}
                    onRemind={() =>
                      sendSingleReminder(
                        e.id,
                        e.createdByName ?? "The initiator"
                      )
                    }
                    sending={remindingEventId === e.id}
                  />
                ))}
              </div>
            )
          ) : filteredReports.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Nothing here"
              description="No reports in this status right now."
            />
          ) : (
            <div className="space-y-4">
              {filteredReports.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  canRemind={
                    r.status === "DRAFT" || r.status === "CHANGES_REQUESTED"
                  }
                  onRemind={() =>
                    sendSingleReminder(r.eventId, r.initiatorName)
                  }
                  sending={remindingEventId === r.eventId}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={confirmingBulkRemind}
        onOpenChange={(open) => !sendingBulk && setConfirmingBulkRemind(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Send reminders to {overdueTotal}{" "}
              {overdueTotal === 1 ? "initiator" : "initiators"}?
            </DialogTitle>
            <DialogDescription>
              Each initiator with an overdue post-event report will receive an
              email and an in-app notification asking them to complete it.
              {counts.NOT_STARTED > 0 && (
                <>
                  <br />• {counts.NOT_STARTED} not started
                </>
              )}
              {counts.DRAFT > 0 && (
                <>
                  <br />• {counts.DRAFT}{" "}
                  {counts.DRAFT === 1 ? "draft" : "drafts"} pending submission
                </>
              )}
              {counts.CHANGES_REQUESTED > 0 && (
                <>
                  <br />• {counts.CHANGES_REQUESTED} awaiting requested changes
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmingBulkRemind(false)}
              disabled={sendingBulk}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              onClick={sendBulkReminders}
              disabled={sendingBulk}
              className="gap-2"
            >
              <Bell className="h-4 w-4" />
              {sendingBulk ? "Sending…" : "Send reminders"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportCard({
  report,
  canRemind,
  onRemind,
  sending,
}: {
  report: ReportListItem;
  canRemind: boolean;
  onRemind: () => void;
  sending: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className={cn("h-1", STATUS_BAR[report.status])} />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg text-clay-900">
              {report.eventTitle}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {EVENT_TYPE_LABELS[report.eventType] ?? report.eventType}
              </Badge>
              <Badge
                variant="outline"
                className={cn("text-xs", STATUS_BADGE[report.status])}
              >
                {STATUS_LABEL[report.status]}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-clay-600">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-clay-400 flex-shrink-0" />
            <span>{fmt(report.eventEndDate ?? report.eventStartDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-clay-400 flex-shrink-0" />
            <span className="truncate">{report.initiatorName}</span>
          </div>
          {report.submittedAt && (
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-clay-400 flex-shrink-0" />
              <span>Submitted {fmt(report.submittedAt)}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
          {canRemind && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={onRemind}
              disabled={sending}
            >
              <Bell className="h-4 w-4" />
              {sending ? "Sending…" : "Remind initiator"}
            </Button>
          )}
          <Link href={`/manage/events/reports/review/${report.eventId}`}>
            <Button variant="gold" className="gap-2">
              <FileText className="h-4 w-4" />
              Open report
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function NotStartedCard({
  event,
  onRemind,
  sending,
}: {
  event: OverdueEvent;
  onRemind: () => void;
  sending: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className={cn("h-1", STATUS_BAR.NOT_STARTED)} />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg text-clay-900">
              {event.title}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {EVENT_TYPE_LABELS[event.type] ?? event.type}
              </Badge>
              <Badge
                variant="outline"
                className={cn("text-xs", STATUS_BADGE.NOT_STARTED)}
              >
                {STATUS_LABEL.NOT_STARTED}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-clay-600">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-clay-400 flex-shrink-0" />
            <span>Ended {fmt(event.endDate ?? event.startDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-clay-400 flex-shrink-0" />
            <span className="truncate">
              {event.createdByName ?? "Unknown initiator"}
            </span>
          </div>
          {event.venue && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-clay-400 flex-shrink-0" />
              <span className="truncate">{event.venue}</span>
            </div>
          )}
        </div>
        <div className="flex justify-end pt-2">
          <Button
            variant="gold"
            className="gap-2"
            onClick={onRemind}
            disabled={sending}
          >
            <Bell className="h-4 w-4" />
            {sending ? "Sending…" : "Remind initiator"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
