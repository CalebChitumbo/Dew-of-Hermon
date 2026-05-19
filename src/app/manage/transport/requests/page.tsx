"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  ArrowLeft,
  Bus,
  Shield,
  ChevronRight,
  Calendar,
  MapPin,
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

const TAB_FILTERS: { key: string; label: string; statuses: TransportRequestStatus[] }[] =
  [
    { key: "awaiting", label: "Awaiting Details", statuses: ["PENDING_DETAILS"] },
    { key: "treasurer", label: "Sent to Treasurer", statuses: ["PENDING_TREASURER"] },
    { key: "approved", label: "Approved", statuses: ["APPROVED"] },
    {
      key: "closed",
      label: "Cancelled / Rejected",
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
      const message =
        error instanceof Error ? error.message : "Failed to load requests";
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
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-700">
          Access Denied
        </h2>
        <p className="text-clay-500 mt-2">
          Only the Transport & Logistics lead can view transport requests.
        </p>
        <Link href="/calendar" className="mt-4">
          <Button variant="outline">Back to Calendar</Button>
        </Link>
      </div>
    );
  }

  const counts: Record<string, number> = {};
  for (const tab of TAB_FILTERS) {
    counts[tab.key] = requests.filter((r) => tab.statuses.includes(r.status)).length;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-900 flex items-center gap-2">
            <Bus className="h-7 w-7 text-[#C8963E]" />
            Transport Requests
          </h1>
          <p className="text-sm text-clay-500 mt-1">
            Cost and schedule transport for events that need it.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          {TAB_FILTERS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="text-xs sm:text-sm">
              {tab.label}{" "}
              {counts[tab.key] > 0 && (
                <span className="ml-1 text-xs opacity-70">({counts[tab.key]})</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_FILTERS.map((tab) => {
          const filtered = requests.filter((r) => tab.statuses.includes(r.status));
          return (
            <TabsContent key={tab.key} value={tab.key} className="mt-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="md" />
                </div>
              ) : filtered.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-clay-500">
                    No requests in this group.
                  </CardContent>
                </Card>
              ) : (
                filtered.map((req) => (
                  <Link
                    key={req.id}
                    href={`/manage/transport/requests/${req.id}`}
                    className="block"
                  >
                    <Card className="hover:border-[#C8963E]/40 transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base text-clay-900">
                              {req.eventTitle}
                            </CardTitle>
                            <div className="flex gap-2 mt-1.5">
                              <Badge
                                variant="outline"
                                className={cn("text-xs", STATUS_COLOR[req.status])}
                              >
                                {STATUS_LABEL[req.status]}
                              </Badge>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-clay-400" />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pb-3">
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-clay-500">
                          {req.eventStartDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(req.eventStartDate), "d MMM yyyy, h:mm a")}
                            </span>
                          )}
                          {req.vehicleType && (
                            <span className="flex items-center gap-1">
                              <Bus className="h-3 w-3" />
                              {req.vehicleCount ?? "?"} × {req.vehicleType}
                            </span>
                          )}
                          {req.estimatedCost !== null && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {req.currency} {req.estimatedCost.toLocaleString()}
                            </span>
                          )}
                        </div>
                        {req.needsDescription && (
                          <p className="text-sm text-clay-600 line-clamp-2">
                            {req.needsDescription}
                          </p>
                        )}
                      </CardContent>
                    </Card>
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
