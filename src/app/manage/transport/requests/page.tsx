"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  EmptyStateLux,
  SegmentedTabsList,
  SegmentedTab,
  SoftWaves,
  luxSurface,
  luxSurfaceHover,
} from "@/components/shared/lux";
import { TransportScene } from "@/components/shared/illustrations";
import {
  Bus,
  Shield,
  ChevronRight,
  Calendar,
  MapPin,
  FileClock,
  Banknote,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useTransportAccess } from "@/hooks/useTransportAccess";
import { useToast } from "@/hooks/use-toast";
import type { TransportRequestStatus } from "@/types";
import { cn } from "@/lib/utils";

interface TransportRequestRow {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartDate: string | null;
  needsDescription: string;
  status: TransportRequestStatus;
  vehicleType: string | null;
  vehicleCount: number | null;
  estimatedCost: number | null;
  currency: string | null;
  createdAt: string | null;
}

const STATUS_LABEL: Record<TransportRequestStatus, string> = {
  PENDING_DETAILS: "Awaiting Details",
  PENDING_TREASURER: "Sent to Treasurer",
  APPROVED: "Approved",
  REJECTED_TREASURER: "Rejected by Treasurer",
  CANCELLED: "Cancelled",
};

const STATUS_COLOR: Record<TransportRequestStatus, string> = {
  PENDING_DETAILS: "bg-amber-50 text-amber-700 border-amber-200",
  PENDING_TREASURER: "bg-blue-50 text-blue-700 border-blue-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  REJECTED_TREASURER: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-clay-50 text-clay-500 border-clay-200",
};

const TAB_FILTERS: {
  key: string;
  label: string;
  icon: React.ElementType;
  statuses: TransportRequestStatus[];
}[] = [
  { key: "awaiting", label: "Awaiting Details", icon: FileClock, statuses: ["PENDING_DETAILS"] },
  { key: "treasurer", label: "Sent to Treasurer", icon: Banknote, statuses: ["PENDING_TREASURER"] },
  { key: "approved", label: "Approved", icon: CheckCircle2, statuses: ["APPROVED"] },
  {
    key: "closed",
    label: "Cancelled / Rejected",
    icon: XCircle,
    statuses: ["CANCELLED", "REJECTED_TREASURER"],
  },
];

export default function TransportRequestsPage() {
  const { loading: accessLoading, canManageTransport } = useTransportAccess();
  const { toast } = useToast();
  const [requests, setRequests] = useState<TransportRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("awaiting");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/transport-requests");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load requests");
      }
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load requests";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (canManageTransport) fetchRequests();
  }, [canManageTransport, fetchRequests]);

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!canManageTransport) {
    return (
      <EmptyStateLux
        icon={Shield}
        title="Access Denied"
        description="Only the Transport & Logistics lead can view transport requests."
        tone="clay"
        action={
          <Link href="/calendar">
            <Button variant="outline" className="rounded-xl">Back to Calendar</Button>
          </Link>
        }
      />
    );
  }

  const counts: Record<string, number> = {};
  for (const tab of TAB_FILTERS) {
    counts[tab.key] = requests.filter((r) => tab.statuses.includes(r.status)).length;
  }

  return (
    <div className="space-y-7">
      <PageHeader
        backHref="/dashboard"
        icon={Bus}
        tone="teal"
        title="Transport Requests"
        description="Cost and schedule transport for events that need it."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <SegmentedTabsList>
          {TAB_FILTERS.map((tab) => (
            <SegmentedTab key={tab.key} value={tab.key} icon={tab.icon} count={counts[tab.key]}>
              {tab.label}
            </SegmentedTab>
          ))}
        </SegmentedTabsList>

        {TAB_FILTERS.map((tab) => {
          const filtered = requests.filter((r) => tab.statuses.includes(r.status));
          return (
            <TabsContent key={tab.key} value={tab.key} className="mt-0 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="md" />
                </div>
              ) : filtered.length === 0 ? (
                <div className={cn("relative overflow-hidden", luxSurface)}>
                  <SoftWaves className="absolute inset-x-0 bottom-0 h-24 w-full text-teal/10" />
                  <EmptyStateLux
                    illustration={<TransportScene />}
                    tone="teal"
                    title="Nothing here yet"
                    description="No requests in this group."
                  />
                </div>
              ) : (
                filtered.map((req) => (
                  <Link
                    key={req.id}
                    href={`/manage/transport/requests/${req.id}`}
                    className={cn("group block p-5", luxSurface, luxSurfaceHover)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-base font-semibold text-clay-700">
                          {req.eventTitle}
                        </h3>
                        <div className="mt-1.5">
                          <Badge variant="outline" className={cn("text-xs", STATUS_COLOR[req.status])}>
                            {STATUS_LABEL[req.status]}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-clay-300 transition-all group-hover:translate-x-0.5 group-hover:text-gold" />
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-clay-500">
                        {req.eventStartDate && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(req.eventStartDate), "d MMM yyyy, h:mm a")}
                          </span>
                        )}
                        {req.vehicleType && (
                          <span className="inline-flex items-center gap-1">
                            <Bus className="h-3 w-3" />
                            {req.vehicleCount ?? "?"} × {req.vehicleType}
                          </span>
                        )}
                        {req.estimatedCost !== null && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {req.currency} {req.estimatedCost.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {req.needsDescription && (
                        <p className="line-clamp-2 text-sm text-clay-600">{req.needsDescription}</p>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
