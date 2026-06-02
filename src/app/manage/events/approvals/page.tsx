"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { getDocs, query, where, Timestamp } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { AppEvent, EventType, EventApprovalStatus } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Shield,
  Send,
  Bus,
  Banknote,
  Clapperboard,
  UtensilsCrossed,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  POTTERS_WHEEL_SERVICE: "Potter's Wheel Service",
  ROPS_CAMP: "ROPS Camp",
  RETREAT: "Retreat",
  MEETING: "Meeting",
  SPECIAL_EVENT: "Special Event",
  OUTREACH: "Outreach",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_DISPATCH: "Awaiting Dispatch",
  PENDING_STAKEHOLDERS: "Gathering Confirmations",
  PENDING_VICE_CHAIR: "Awaiting Vice Chair",
  PENDING_CHAIR: "Awaiting Chairperson",
};

// Per-resource status → label + whether it counts as "ready" for the Events
// Lead's approve gate.
const RESOURCE_READY: Record<string, (status: string | undefined) => boolean> = {
  transport: (s) => s === "APPROVED",
  budget: (s) => s === "APPROVED" || s === "REJECTED",
  media: (s) => s === "CONFIRMED",
  food: (s) => s === "CONFIRMED",
};

function parseFirestoreDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string") return parseISO(val);
  if (val && typeof val === "object" && "seconds" in val) {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  return new Date();
}

type Stage = "EVENTS_LEAD" | "VICE_CHAIR" | "CHAIR";

function stageOf(status: EventApprovalStatus): Stage {
  if (status === "PENDING_VICE_CHAIR") return "VICE_CHAIR";
  if (status === "PENDING_CHAIR") return "CHAIR";
  return "EVENTS_LEAD";
}

interface PendingEvent extends AppEvent {
  // request statuses keyed onto the event for display + gating
  transportStatus?: string;
  budgetStatus?: string;
  mediaStatus?: string;
  foodStatus?: string;
}

const PENDING_STATUSES = [
  "PENDING_DISPATCH",
  "PENDING_STAKEHOLDERS",
  "PENDING_VICE_CHAIR",
  "PENDING_CHAIR",
];

type ActionKind = "APPROVE" | "REJECT" | "REQUEST_CHANGES";

export default function EventApprovalsPage() {
  const { userData } = useAuth();
  const { canAccessPage } = usePermissions();
  const { toast } = useToast();

  const role = userData?.role;
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [actionState, setActionState] = useState<
    { eventId: string; action: ActionKind } | null
  >(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const hasAccess = userData ? canAccessPage("events_approvals") : false;

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const snapshot = await getDocs(
        query(
          safeCollection("events"),
          where("approvalStatus", "in", PENDING_STATUSES)
        )
      );

      const list: PendingEvent[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          description: data.description || null,
          type: data.type as EventType,
          startDate: parseFirestoreDate(data.startDate),
          endDate: data.endDate ? parseFirestoreDate(data.endDate) : null,
          venue: data.venue || "",
          isRecurring: data.isRecurring || false,
          lifeGroupTarget: data.lifeGroupTarget || null,
          approvalStatus: data.approvalStatus,
          approvalComments: data.approvalComments || null,
          approvedBy: data.approvedBy || null,
          approvedAt: data.approvedAt ? parseFirestoreDate(data.approvedAt) : null,
          createdByDepartmentId: data.createdByDepartmentId || null,
          coreRoles: data.coreRoles || [],
          speaker: data.speaker || null,
          objective: data.objective || null,
          isPaid: data.isPaid || false,
          attendanceFee: data.attendanceFee ?? null,
          attendanceFeeCurrency: data.attendanceFeeCurrency || null,
          transportRequired: data.transportRequired || false,
          transportNeeds: data.transportNeeds || null,
          transportRequestId: data.transportRequestId || null,
          budgetRequested: data.budgetRequested || false,
          budgetAmount: data.budgetAmount ?? null,
          budgetCurrency: data.budgetCurrency || null,
          budgetPurpose: data.budgetPurpose || null,
          budgetRequestId: data.budgetRequestId || null,
          mediaRequired: data.mediaRequired || false,
          mediaNeeds: data.mediaNeeds || null,
          mediaRequestId: data.mediaRequestId || null,
          foodRequired: data.foodRequired || false,
          foodNeeds: data.foodNeeds || null,
          foodRequestId: data.foodRequestId || null,
          viceChairApprovedBy: data.viceChairApprovedBy || null,
          viceChairApprovedAt: data.viceChairApprovedAt
            ? parseFirestoreDate(data.viceChairApprovedAt)
            : null,
          chairApprovedBy: data.chairApprovedBy || null,
          chairApprovedAt: data.chairApprovedAt
            ? parseFirestoreDate(data.chairApprovedAt)
            : null,
          createdBy: data.createdBy || "",
          createdAt: parseFirestoreDate(data.createdAt),
          updatedAt: parseFirestoreDate(data.updatedAt),
        };
      });

      // Resolve linked request statuses server-side (Admin SDK) so this page
      // never depends on client-side read rules for the request collections.
      try {
        const res = await fetch("/api/events/stakeholder-statuses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventIds: list.map((e) => e.id) }),
        });
        if (res.ok) {
          const { statuses } = (await res.json()) as {
            statuses: Record<
              string,
              {
                transport?: string | null;
                budget?: string | null;
                media?: string | null;
                food?: string | null;
              }
            >;
          };
          for (const evt of list) {
            const s = statuses[evt.id];
            if (!s) continue;
            evt.transportStatus = s.transport ?? undefined;
            evt.budgetStatus = s.budget ?? undefined;
            evt.mediaStatus = s.media ?? undefined;
            evt.foodStatus = s.food ?? undefined;
          }
        }
      } catch (err) {
        console.error("Failed to resolve stakeholder statuses:", err);
      }

      list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      setEvents(list);
    } catch (error) {
      console.error("Failed to fetch pending events:", error);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) fetchPending();
  }, [hasAccess, fetchPending]);

  useEffect(() => {
    function onFocus() {
      if (hasAccess) fetchPending();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [hasAccess, fetchPending]);

  async function handleDispatch(eventId: string) {
    setDispatchingId(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}/dispatch`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to dispatch");
      toast({
        title: "Dispatched to stakeholders",
        description: "Requests have been sent. You'll be able to approve once all confirm.",
        variant: "success",
      });
      await fetchPending();
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setDispatchingId(null);
    }
  }

  async function handleAction() {
    if (!actionState) return;
    const event = events.find((e) => e.id === actionState.eventId);
    if (!event) return;
    setSubmitting(true);
    try {
      // Events Lead stage uses /approve; executive tiers use /tier-approve.
      const endpoint =
        stageOf(event.approvalStatus) === "EVENTS_LEAD"
          ? `/api/events/${actionState.eventId}/approve`
          : `/api/events/${actionState.eventId}/tier-approve`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionState.action,
          comments: comments.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Action failed");
      toast({ title: "Done", variant: "success" });
      setActionState(null);
      setComments("");
      await fetchPending();
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function canActOnStage(stage: Stage): boolean {
    if (role === "SUPER_ADMIN") return true;
    if (stage === "EVENTS_LEAD") return true; // server enforces approve_events
    if (stage === "VICE_CHAIR") return role === "VICE_CHAIRPERSON";
    return false; // CHAIR stage is SUPER_ADMIN only
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-700">
          Access Denied
        </h2>
        <p className="text-clay-500 mt-2">
          You do not have permission to view event approvals.
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
        <Link href="/calendar">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-900">
            Event Approvals
          </h1>
          <p className="text-sm text-clay-500 mt-1">
            Dispatch stakeholder requests and move events through the approval chain
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {events.length} pending
        </Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : fetchError ? (
        <Card>
          <CardContent className="py-16 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="font-display font-semibold text-clay-700 text-lg">
              Failed to load pending events
            </h3>
            <Button variant="outline" className="mt-4" onClick={fetchPending}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <h3 className="font-display font-semibold text-clay-700 text-lg">
              All caught up!
            </h3>
            <p className="text-clay-500 mt-2">No events are currently pending.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const stage = stageOf(event.approvalStatus);
            const isEditing = actionState?.eventId === event.id;
            const dispatching = dispatchingId === event.id;

            // Resource readiness for the Events Lead approve gate.
            const resourceRows = [
              event.transportRequired && {
                key: "transport",
                label: "Transport",
                icon: Bus,
                status: event.transportStatus,
                ready: RESOURCE_READY.transport(event.transportStatus),
              },
              event.budgetRequested && {
                key: "budget",
                label: "Funds",
                icon: Banknote,
                status: event.budgetStatus,
                ready: RESOURCE_READY.budget(event.budgetStatus),
              },
              event.mediaRequired && {
                key: "media",
                label: "Media",
                icon: Clapperboard,
                status: event.mediaStatus,
                ready: RESOURCE_READY.media(event.mediaStatus),
              },
              event.foodRequired && {
                key: "food",
                label: "Food",
                icon: UtensilsCrossed,
                status: event.foodStatus,
                ready: RESOURCE_READY.food(event.foodStatus),
              },
            ].filter(Boolean) as {
              key: string;
              label: string;
              icon: typeof Bus;
              status?: string;
              ready: boolean;
            }[];

            const hasResources = resourceRows.length > 0;
            const notDispatched = event.approvalStatus === "PENDING_DISPATCH";
            const allReady = resourceRows.every((r) => r.ready);
            const canAct = canActOnStage(stage);

            // Events Lead can approve once dispatched (if needed) and all ready.
            const approveBlocked =
              stage === "EVENTS_LEAD" &&
              ((hasResources && notDispatched) || !allReady);

            return (
              <Card key={event.id} className="overflow-hidden">
                <div className="h-1 bg-amber-400" />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg text-clay-900">
                      {event.title}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="text-xs bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap"
                    >
                      {STATUS_LABELS[event.approvalStatus] || event.approvalStatus}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline" className="text-xs">
                      {EVENT_TYPE_LABELS[event.type] || event.type}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-clay-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-clay-400" />
                      <span>{format(event.startDate, "EEE, d MMM yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-clay-400" />
                      <span>{format(event.startDate, "h:mm a")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-clay-400" />
                      <span>{event.venue}</span>
                    </div>
                  </div>

                  {event.objective && (
                    <div className="text-sm bg-clay-50 rounded-md px-3 py-2">
                      <p className="text-xs font-semibold text-clay-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                        <Target className="h-3 w-3" />
                        Objective
                      </p>
                      <p className="text-clay-700 whitespace-pre-wrap">
                        {event.objective}
                      </p>
                    </div>
                  )}

                  {/* Stakeholder status */}
                  {hasResources && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-clay-500 uppercase tracking-wide">
                        Stakeholders
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {resourceRows.map((r) => {
                          const Icon = r.icon;
                          return (
                            <div
                              key={r.key}
                              className="flex items-center justify-between text-sm rounded border border-clay-200 px-3 py-1.5"
                            >
                              <span className="flex items-center gap-1.5 text-clay-600">
                                <Icon className="h-3.5 w-3.5 text-clay-400" />
                                {r.label}
                              </span>
                              <span
                                className={cn(
                                  "text-xs font-medium",
                                  r.ready ? "text-green-700" : "text-amber-700"
                                )}
                              >
                                {notDispatched
                                  ? "Not dispatched"
                                  : r.status
                                    ? r.status.replace(/_/g, " ").toLowerCase()
                                    : "pending"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Action area */}
                  {isEditing ? (
                    <div className="space-y-3 pt-2 border-t border-clay-100">
                      {actionState.action !== "APPROVE" && (
                        <div className="space-y-1.5">
                          <Label className="text-sm">Comments *</Label>
                          <Textarea
                            rows={3}
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            placeholder={
                              actionState.action === "REJECT"
                                ? "Reason for rejection..."
                                : "What changes are needed..."
                            }
                          />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          onClick={handleAction}
                          disabled={
                            submitting ||
                            (actionState.action !== "APPROVE" && !comments.trim())
                          }
                          className={cn(
                            "flex-1 text-white",
                            actionState.action === "APPROVE"
                              ? "bg-green-600 hover:bg-green-700"
                              : actionState.action === "REJECT"
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-amber-600 hover:bg-amber-700"
                          )}
                        >
                          {submitting && <LoadingSpinner size="sm" className="mr-2" />}
                          Confirm
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setActionState(null);
                            setComments("");
                          }}
                          disabled={submitting}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : !canAct ? (
                    <p className="text-xs text-clay-400 pt-2 border-t border-clay-100">
                      {STATUS_LABELS[event.approvalStatus] || "Pending"} — no action
                      needed from you.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-clay-100">
                      {stage === "EVENTS_LEAD" && hasResources && notDispatched && (
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                          disabled={dispatching}
                          onClick={() => handleDispatch(event.id)}
                        >
                          {dispatching ? (
                            <LoadingSpinner size="sm" className="mr-1" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Dispatch to stakeholders
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white gap-1.5 disabled:opacity-50"
                        disabled={approveBlocked}
                        title={
                          approveBlocked
                            ? "All stakeholders must confirm first"
                            : undefined
                        }
                        onClick={() =>
                          setActionState({ eventId: event.id, action: "APPROVE" })
                        }
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5"
                        onClick={() => {
                          setActionState({ eventId: event.id, action: "REQUEST_CHANGES" });
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
                          setActionState({ eventId: event.id, action: "REJECT" });
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
            );
          })}
        </div>
      )}
    </div>
  );
}
