"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Calendar,
  ClipboardCheck,
  MapPin,
  Shield,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventReportStatus, EventType } from "@/types";

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  POTTERS_WHEEL_SERVICE: "Potter's Wheel Service",
  ROPS_CAMP: "ROPS Camp",
  RETREAT: "Retreat",
  MEETING: "Meeting",
  SPECIAL_EVENT: "Special Event",
  OUTREACH: "Outreach",
};

type ListStatus = EventReportStatus | "NONE";

interface EligibleEvent {
  id: string;
  title: string;
  type: EventType;
  startDate: string | null;
  endDate: string | null;
  venue: string;
  approvalStatus: string;
  reportStatus: ListStatus;
  reviewComments: string | null;
}

const STATUS_META: Record<
  ListStatus,
  {
    label: string;
    badge: string;
    cta: string;
    bar: string;
    description: string;
  }
> = {
  NONE: {
    label: "Report due",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    cta: "Submit Report",
    bar: "bg-amber-400",
    description: "This event has ended. Please submit your report.",
  },
  CHANGES_REQUESTED: {
    label: "Changes requested",
    badge: "bg-red-50 text-red-700 border-red-200",
    cta: "Address feedback",
    bar: "bg-red-400",
    description: "The Chairperson has requested changes on this report.",
  },
  DRAFT: {
    label: "Draft saved",
    badge: "bg-clay-100 text-clay-700 border-clay-200",
    cta: "Continue draft",
    bar: "bg-clay-300",
    description: "You started a report but haven't submitted it yet.",
  },
  SUBMITTED: {
    label: "Awaiting review",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    cta: "View submitted report",
    bar: "bg-blue-400",
    description: "Submitted — the Chairperson will review shortly.",
  },
  REVIEWED: {
    label: "Reviewed",
    badge: "bg-green-50 text-green-700 border-green-200",
    cta: "View report",
    bar: "bg-green-500",
    description: "Reviewed by the Chairperson.",
  },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "EEE, d MMM yyyy");
  } catch {
    return iso;
  }
}

export default function MyEventReportsPage() {
  const { userData } = useAuth();
  const { canAccessPage } = usePermissions();
  const { toast } = useToast();

  const [events, setEvents] = useState<EligibleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const hasAccess = userData ? canAccessPage("event_reports_submit") : false;
  const canReview = userData ? canAccessPage("event_reports_review") : false;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/event-reports/eligible-events");
      if (!res.ok) {
        throw new Error("Failed to fetch");
      }
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error(err);
      setError(true);
      toast({
        title: "Couldn't load your events",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (hasAccess) fetchEvents();
  }, [hasAccess, fetchEvents]);

  if (!hasAccess) {
    return (
      <EmptyState
        icon={Shield}
        title="Access Denied"
        description="You do not have permission to submit event reports."
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
        backHref="/calendar"
        icon={ClipboardList}
        tone="periwinkle"
        title="My Event Reports"
        description="Submit post-event reports for the events you initiated."
        actions={
          canReview ? (
            <Link href="/manage/events/reports/review">
              <Button variant="outline" className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Review submissions</span>
                <span className="sm:hidden">Reviews</span>
              </Button>
            </Link>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <EmptyState
          icon={AlertCircle}
          tone="blush"
          title="Failed to load events"
          action={
            <Button variant="outline" onClick={fetchEvents}>
              Retry
            </Button>
          }
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          tone="sage"
          title="All caught up"
          description="You don't have any events awaiting a report right now."
        />
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const meta = STATUS_META[event.reportStatus];
            return (
              <Card key={event.id} className="overflow-hidden">
                <div className={cn("h-1", meta.bar)} />
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
                          className={cn("text-xs", meta.badge)}
                        >
                          {meta.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-clay-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-clay-400 flex-shrink-0" />
                      <span>{fmtDate(event.endDate ?? event.startDate)}</span>
                    </div>
                    {event.venue && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-clay-400 flex-shrink-0" />
                        <span className="truncate">{event.venue}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-clay-600">{meta.description}</p>

                  {event.reportStatus === "CHANGES_REQUESTED" &&
                    event.reviewComments && (
                      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        <div className="font-semibold mb-1">
                          Chairperson notes
                        </div>
                        <p className="whitespace-pre-wrap">
                          {event.reviewComments}
                        </p>
                      </div>
                    )}

                  <div className="flex justify-end pt-2">
                    <Link href={`/manage/events/reports/${event.id}`}>
                      <Button className="gap-2" variant="gold">
                        {event.reportStatus === "REVIEWED" ||
                        event.reportStatus === "SUBMITTED" ? (
                          <FileText className="h-4 w-4" />
                        ) : (
                          <ClipboardList className="h-4 w-4" />
                        )}
                        {meta.cta}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="bg-cream/40 border-dashed">
        <CardContent className="py-6 flex items-start gap-3">
          <ClipboardCheck className="h-5 w-5 text-clay-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-clay-600">
            Reports become available once an event&apos;s end date has passed.
            The Chairperson reviews submitted reports and can request changes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
