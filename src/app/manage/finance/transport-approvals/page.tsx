"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  ArrowLeft,
  Bus,
  Shield,
  Calendar,
  Banknote,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { useTransportAccess } from "@/hooks/useTransportAccess";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PendingRequest {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartDate: string | null;
  needsDescription: string;
  vehicleType: string | null;
  vehicleCount: number | null;
  estimatedCost: number | null;
  currency: string | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  pickupTime: string | null;
  returnTime: string | null;
  coordinatorNotes: string | null;
  filledByName: string | null;
  filledAt: string | null;
}

type Action = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

export default function TransportApprovalsPage() {
  const { loading: accessLoading, canApproveTransportBudget } =
    useTransportAccess();
  const { toast } = useToast();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/transport-requests?status=PENDING_TREASURER");
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
    if (canApproveTransportBudget) fetchRequests();
  }, [canApproveTransportBudget, fetchRequests]);

  async function handleDecision() {
    if (!activeId || !activeAction) return;
    if ((activeAction === "REQUEST_CHANGES" || activeAction === "REJECT") && !comments.trim()) {
      toast({
        title: "Comments required",
        description: `Provide a reason for ${activeAction === "REJECT" ? "rejecting" : "requesting changes"}.`,
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/transport-requests/${activeId}/treasurer-decision`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: activeAction,
            comments: comments.trim() || undefined,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to record decision");
      }
      const labels: Record<Action, string> = {
        APPROVE: "approved",
        REQUEST_CHANGES: "sent back for changes",
        REJECT: "rejected",
      };
      toast({
        title: `Request ${labels[activeAction]}`,
        description: `The transport request has been ${labels[activeAction]}.`,
        variant: "success",
      });
      setActiveId(null);
      setActiveAction(null);
      setComments("");
      await fetchRequests();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to record decision";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!canApproveTransportBudget) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-700">
          Access Denied
        </h2>
        <p className="text-clay-500 mt-2">
          Only the Treasurer (Finance lead) can approve transport budgets.
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
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-900 flex items-center gap-2">
            <Banknote className="h-7 w-7 text-[#C8963E]" />
            Transport Approvals
          </h1>
          <p className="text-sm text-clay-500 mt-1">
            Confirm funds availability for transport requests submitted by the
            Transport Coordinator.
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-sm",
            requests.length > 0
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-green-50 text-green-700 border-green-200"
          )}
        >
          {requests.length} pending
        </Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <h3 className="font-display font-semibold text-clay-700 text-lg">
              All caught up!
            </h3>
            <p className="text-clay-500 mt-2">
              No transport requests are currently awaiting your approval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id} className="overflow-hidden">
              <div className="h-1 bg-blue-400" />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg text-clay-900 flex items-center gap-2">
                      <Bus className="h-5 w-5 text-[#C8963E]" />
                      {req.eventTitle}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                      >
                        Awaiting Treasurer
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {req.eventStartDate && (
                  <div className="flex items-center gap-2 text-sm text-clay-600">
                    <Calendar className="h-4 w-4 text-clay-400" />
                    {format(parseISO(req.eventStartDate), "EEE, d MMM yyyy 'at' h:mm a")}
                  </div>
                )}

                <div className="rounded-md bg-clay-50 px-3 py-2 text-sm">
                  <p className="text-xs font-semibold text-clay-500 uppercase mb-1">
                    Requested Needs
                  </p>
                  <p className="text-clay-700 whitespace-pre-wrap">
                    {req.needsDescription}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <p>
                    <span className="text-clay-500">Vehicle:</span>{" "}
                    <strong className="text-clay-800">
                      {req.vehicleCount} × {req.vehicleType}
                    </strong>
                  </p>
                  <p>
                    <span className="text-clay-500">Estimated cost:</span>{" "}
                    <strong className="text-clay-800">
                      {req.currency} {req.estimatedCost?.toLocaleString()}
                    </strong>
                  </p>
                  {req.pickupLocation && (
                    <p>
                      <span className="text-clay-500">Pickup:</span> {req.pickupLocation}
                    </p>
                  )}
                  {req.dropoffLocation && (
                    <p>
                      <span className="text-clay-500">Drop-off:</span> {req.dropoffLocation}
                    </p>
                  )}
                  {req.pickupTime && (
                    <p>
                      <span className="text-clay-500">Depart:</span>{" "}
                      {format(parseISO(req.pickupTime), "EEE, d MMM h:mm a")}
                    </p>
                  )}
                  {req.returnTime && (
                    <p>
                      <span className="text-clay-500">Return:</span>{" "}
                      {format(parseISO(req.returnTime), "EEE, d MMM h:mm a")}
                    </p>
                  )}
                </div>

                {req.coordinatorNotes && (
                  <p className="text-sm text-clay-600 bg-amber-50/40 border border-amber-100 rounded-md px-3 py-2">
                    <span className="font-medium text-amber-800">Coordinator notes: </span>
                    {req.coordinatorNotes}
                  </p>
                )}

                <p className="text-xs text-clay-400">
                  Submitted by {req.filledByName ?? "Transport Coordinator"}
                  {req.filledAt &&
                    ` · ${format(parseISO(req.filledAt), "d MMM yyyy 'at' h:mm a")}`}
                </p>

                {activeId === req.id ? (
                  <div className="space-y-3 pt-2 border-t border-clay-100">
                    <p className="text-sm font-medium text-clay-700">
                      {activeAction === "APPROVE"
                        ? "Confirm approval"
                        : activeAction === "REJECT"
                          ? "Provide a reason for rejection"
                          : "Describe what needs to change"}
                    </p>
                    {activeAction !== "APPROVE" && (
                      <div className="space-y-1.5">
                        <Label htmlFor={`comments-${req.id}`} className="text-sm">
                          Comments *
                        </Label>
                        <Textarea
                          id={`comments-${req.id}`}
                          rows={3}
                          placeholder={
                            activeAction === "REJECT"
                              ? "Reason for rejection..."
                              : "What needs to change..."
                          }
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleDecision}
                        disabled={
                          submitting ||
                          (activeAction !== "APPROVE" && !comments.trim())
                        }
                        className={cn(
                          "flex-1",
                          activeAction === "APPROVE"
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : activeAction === "REJECT"
                              ? "bg-red-600 hover:bg-red-700 text-white"
                              : "bg-amber-600 hover:bg-amber-700 text-white"
                        )}
                      >
                        {submitting && <LoadingSpinner size="sm" className="mr-2" />}
                        {activeAction === "APPROVE"
                          ? "Confirm Approve"
                          : activeAction === "REJECT"
                            ? "Confirm Reject"
                            : "Send Back for Changes"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setActiveId(null);
                          setActiveAction(null);
                          setComments("");
                        }}
                        disabled={submitting}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-clay-100">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                      onClick={() => {
                        setActiveId(req.id);
                        setActiveAction("APPROVE");
                        setComments("");
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm Funds
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5"
                      onClick={() => {
                        setActiveId(req.id);
                        setActiveAction("REQUEST_CHANGES");
                        setComments("");
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Request Changes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50 gap-1.5"
                      onClick={() => {
                        setActiveId(req.id);
                        setActiveAction("REJECT");
                        setComments("");
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
