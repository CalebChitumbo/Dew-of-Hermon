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
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Shield,
  User,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventReportStatus, EventType } from "@/types";

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

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  POTTERS_WHEEL_SERVICE: "Potter's Wheel Service",
  ROPS_CAMP: "ROPS Camp",
  RETREAT: "Retreat",
  MEETING: "Meeting",
  SPECIAL_EVENT: "Special Event",
  OUTREACH: "Outreach",
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

const STATUS_BAR: Record<EventReportStatus, string> = {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<EventReportStatus>("SUBMITTED");

  const hasAccess = userData ? canAccessPage("event_reports_review") : false;

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/event-reports");
      if (!res.ok) {
        throw new Error("Failed to fetch");
      }
      const data = await res.json();
      setReports(data.reports || []);
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
    if (hasAccess) fetchReports();
  }, [hasAccess, fetchReports]);

  const counts = useMemo(() => {
    const c: Record<EventReportStatus, number> = {
      DRAFT: 0,
      SUBMITTED: 0,
      REVIEWED: 0,
      CHANGES_REQUESTED: 0,
    };
    for (const r of reports) c[r.status]++;
    return c;
  }, [reports]);

  const filtered = useMemo(
    () => reports.filter((r) => r.status === tab),
    [reports, tab]
  );

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-700">
          Access Denied
        </h2>
        <p className="text-clay-500 mt-2">
          Only the Chairperson can review event reports.
        </p>
        <Link href="/calendar" className="mt-4">
          <Button variant="outline">Back to Calendar</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/manage/events/reports">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-900">
            Event Report Reviews
          </h1>
          <p className="text-sm text-clay-500 mt-1">
            Review post-event reports submitted by event initiators.
          </p>
        </div>
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
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as EventReportStatus)}
      >
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
          <TabsTrigger value="SUBMITTED">
            Pending ({counts.SUBMITTED})
          </TabsTrigger>
          <TabsTrigger value="CHANGES_REQUESTED">
            Changes ({counts.CHANGES_REQUESTED})
          </TabsTrigger>
          <TabsTrigger value="REVIEWED">
            Reviewed ({counts.REVIEWED})
          </TabsTrigger>
          <TabsTrigger value="DRAFT">Drafts ({counts.DRAFT})</TabsTrigger>
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
                  onClick={fetchReports}
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h3 className="font-display font-semibold text-clay-700 text-lg">
                  Nothing here
                </h3>
                <p className="text-clay-500 mt-2">
                  No reports in this status right now.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filtered.map((r) => (
                <Card key={r.id} className="overflow-hidden">
                  <div className={cn("h-1", STATUS_BAR[r.status])} />
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-lg text-clay-900">
                          {r.eventTitle}
                        </CardTitle>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-xs">
                            {EVENT_TYPE_LABELS[r.eventType] ?? r.eventType}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn("text-xs", STATUS_BADGE[r.status])}
                          >
                            {STATUS_LABEL[r.status]}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-clay-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-clay-400 flex-shrink-0" />
                        <span>{fmt(r.eventEndDate ?? r.eventStartDate)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-clay-400 flex-shrink-0" />
                        <span className="truncate">{r.initiatorName}</span>
                      </div>
                      {r.submittedAt && (
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4 text-clay-400 flex-shrink-0" />
                          <span>Submitted {fmt(r.submittedAt)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end pt-2">
                      <Link
                        href={`/manage/events/reports/review/${r.eventId}`}
                      >
                        <Button variant="gold" className="gap-2">
                          <FileText className="h-4 w-4" />
                          Open report
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
