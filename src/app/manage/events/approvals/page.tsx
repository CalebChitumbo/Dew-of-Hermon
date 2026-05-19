"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { getDocs, query, where, Timestamp, documentId } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { AppEvent, EventType, TransportRequest, TransportRequestStatus } from "@/types";
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
  Users,
  Bus,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Event type labels ───

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  POTTERS_WHEEL_SERVICE: "Potter's Wheel Service",
  ROPS_CAMP: "ROPS Camp",
  RETREAT: "Retreat",
  MEETING: "Meeting",
  SPECIAL_EVENT: "Special Event",
  OUTREACH: "Outreach",
};

const LIFE_GROUP_LABELS: Record<string, string> = {
  BRIDGE: "Bridge",
  ANCHOR: "Anchor",
  CORNERSTONE: "Cornerstone",
  ALL: "All Life Groups",
};

// ─── Parse Firestore date ───

function parseFirestoreDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string") return parseISO(val);
  if (val && typeof val === "object" && "seconds" in val) {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  return new Date();
}

interface PendingEvent extends AppEvent {
  creatorName?: string;
  departmentName?: string;
}

type TransportSummary = Pick<
  TransportRequest,
  | "id"
  | "status"
  | "vehicleType"
  | "vehicleCount"
  | "estimatedCost"
  | "currency"
  | "pickupLocation"
  | "dropoffLocation"
  | "pickupTime"
  | "returnTime"
  | "coordinatorNotes"
  | "treasurerComments"
>;

const TRANSPORT_STATUS_LABEL: Record<TransportRequestStatus, string> = {
  PENDING_DETAILS: "Awaiting Transport Coordinator",
  PENDING_TREASURER: "Awaiting Treasurer",
  APPROVED: "Transport Approved",
  REJECTED_TREASURER: "Transport Rejected by Treasurer",
  CANCELLED: "Transport Cancelled",
};

type ActionState = {
  eventId: string;
  action: "APPROVE" | "REJECT" | "REQUEST_CHANGES";
} | null;

export default function EventApprovalsPage() {
  const { userData } = useAuth();
  const { canAccessPage } = usePermissions();
  const { toast } = useToast();

  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);
  const [transportByEvent, setTransportByEvent] = useState<Record<string, TransportSummary>>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notifyingEventId, setNotifyingEventId] = useState<string | null>(null);

  // Access: uses configurable page permissions; final approval permission enforced server-side
  const hasAccess = userData ? canAccessPage("events_approvals") : false;

  const fetchPendingEvents = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const eventsRef = safeCollection("events");
      const q = query(
        eventsRef,
        where("approvalStatus", "==", "PENDING_APPROVAL")
      );
      const snapshot = await getDocs(q);

      const events: PendingEvent[] = snapshot.docs.map((doc) => {
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
          approvalStatus: data.approvalStatus || "PENDING_APPROVAL",
          approvalComments: data.approvalComments || null,
          approvedBy: data.approvedBy || null,
          approvedAt: data.approvedAt ? parseFirestoreDate(data.approvedAt) : null,
          createdByDepartmentId: data.createdByDepartmentId || null,
          coreRoles: data.coreRoles || [],
          transportRequired: data.transportRequired || false,
          transportNeeds: data.transportNeeds || null,
          transportRequestId: data.transportRequestId || null,
          createdBy: data.createdBy || "",
          createdAt: parseFirestoreDate(data.createdAt),
          updatedAt: parseFirestoreDate(data.updatedAt),
        };
      });

      events.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      setPendingEvents(events);

      // Fetch transport requests for events that have one. Wrap in its own
      // try/catch so a transport-side failure (e.g. rules not yet deployed)
      // never hides the pending events list itself.
      const requestIds = events
        .map((e) => e.transportRequestId)
        .filter((id): id is string => Boolean(id));
      const summaries: Record<string, TransportSummary> = {};
      if (requestIds.length > 0) {
        try {
          // Firestore 'in' queries support up to 30 IDs
          for (let i = 0; i < requestIds.length; i += 30) {
            const chunk = requestIds.slice(i, i + 30);
            const tSnap = await getDocs(
              query(safeCollection("transportRequests"), where(documentId(), "in", chunk))
            );
            tSnap.docs.forEach((d) => {
              const td = d.data();
              const event = events.find((e) => e.transportRequestId === d.id);
              if (!event) return;
              summaries[event.id] = {
                id: d.id,
                status: td.status as TransportRequestStatus,
                vehicleType: td.vehicleType ?? null,
                vehicleCount: td.vehicleCount ?? null,
                estimatedCost: td.estimatedCost ?? null,
                currency: td.currency ?? null,
                pickupLocation: td.pickupLocation ?? null,
                dropoffLocation: td.dropoffLocation ?? null,
                pickupTime: td.pickupTime ? parseFirestoreDate(td.pickupTime) : null,
                returnTime: td.returnTime ? parseFirestoreDate(td.returnTime) : null,
                coordinatorNotes: td.coordinatorNotes ?? null,
                treasurerComments: td.treasurerComments ?? null,
              };
            });
          }
        } catch (transportErr) {
          // Don't blow up the whole approvals view if the transport-requests
          // collection can't be read (e.g. firestore.rules not yet deployed).
          // Events still render; the transport panel will just say "Loading…"
          // and the Approve button stays disabled (safe default).
          console.error("Failed to fetch transport requests:", transportErr);
        }
      }
      setTransportByEvent(summaries);
    } catch (error) {
      console.error("Failed to fetch pending events:", error);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingEvents();
  }, [fetchPendingEvents]);

  async function handleNotifyTransport(eventId: string) {
    setNotifyingEventId(eventId);
    try {
      const res = await fetch("/api/transport-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to notify transport coordinator");
      }
      toast({
        title: "Transport Coordinator Notified",
        description:
          "The request has been sent. You'll be notified when costing and treasurer approval are complete.",
        variant: "success",
      });
      await fetchPendingEvents();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setNotifyingEventId(null);
    }
  }

  async function handleAction() {
    if (!actionState) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/events/${actionState.eventId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionState.action,
          comments: comments.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Action failed");
      }

      const actionLabels = {
        APPROVE: "approved",
        REJECT: "rejected",
        REQUEST_CHANGES: "sent back for changes",
      };

      toast({
        title: `Event ${actionLabels[actionState.action]}`,
        description: `The event has been ${actionLabels[actionState.action]}.`,
        variant: "success",
      });

      setActionState(null);
      setComments("");
      await fetchPendingEvents();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
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
      {/* Page Header */}
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
            Review and approve submitted events
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-sm",
            pendingEvents.length > 0
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-green-50 text-green-700 border-green-200"
          )}
        >
          {pendingEvents.length} pending
        </Badge>
      </div>

      {/* Pending Events */}
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
            <p className="text-clay-500 mt-2">
              There was a problem fetching events. Please try again.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={fetchPendingEvents}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : pendingEvents.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <h3 className="font-display font-semibold text-clay-700 text-lg">
              All caught up!
            </h3>
            <p className="text-clay-500 mt-2">
              No events are currently pending approval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingEvents.map((event) => (
            <Card key={event.id} className="overflow-hidden">
              <div className="h-1 bg-amber-400" />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg text-clay-900">
                      {event.title}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">
                        {EVENT_TYPE_LABELS[event.type] || event.type}
                      </Badge>
                      {event.lifeGroupTarget && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                        >
                          {LIFE_GROUP_LABELS[event.lifeGroupTarget] || event.lifeGroupTarget}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                      >
                        Pending Approval
                      </Badge>
                      {event.transportRequired && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1"
                        >
                          <Bus className="h-3 w-3" />
                          Transport Required
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Event details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-clay-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-clay-400 flex-shrink-0" />
                    <span>{format(event.startDate, "EEE, d MMM yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-clay-400 flex-shrink-0" />
                    <span>{format(event.startDate, "h:mm a")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-clay-400 flex-shrink-0" />
                    <span>{event.venue}</span>
                  </div>
                </div>

                {event.description && (
                  <p className="text-sm text-clay-600 bg-clay-50 rounded-md px-3 py-2">
                    {event.description}
                  </p>
                )}

                {/* Core Roles */}
                {event.coreRoles && event.coreRoles.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-clay-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      Core Roles
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {event.coreRoles.map((role, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm rounded border border-clay-200 px-3 py-1.5"
                        >
                          <span className="text-clay-600">{role.role}</span>
                          {role.assignedUserName ? (
                            <span className="font-medium text-clay-800">
                              {role.assignedUserName}
                            </span>
                          ) : (
                            <span className="text-clay-400 italic text-xs">Unassigned</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transport panel */}
                {event.transportRequired && (
                  <div className="rounded-md border border-amber-200 bg-amber-50/40 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Bus className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold text-amber-800">
                          Transport Required
                        </p>
                        {event.transportNeeds && (
                          <p className="text-sm text-clay-700">{event.transportNeeds}</p>
                        )}
                        {(() => {
                          const t = transportByEvent[event.id];
                          if (!event.transportRequestId) {
                            return (
                              <p className="text-xs text-amber-700">
                                Not yet routed. Click <strong>Notify Transport Coordinator</strong> below to start costing.
                              </p>
                            );
                          }
                          if (!t) {
                            return (
                              <p className="text-xs text-clay-500">Loading transport request…</p>
                            );
                          }
                          return (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-amber-700">
                                {TRANSPORT_STATUS_LABEL[t.status]}
                              </p>
                              {t.status === "APPROVED" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-clay-700">
                                  {t.vehicleType && (
                                    <p>
                                      <span className="text-clay-500">Vehicle:</span>{" "}
                                      <strong>
                                        {t.vehicleCount ?? "?"} × {t.vehicleType}
                                      </strong>
                                    </p>
                                  )}
                                  {t.estimatedCost !== null && (
                                    <p>
                                      <span className="text-clay-500">Cost:</span>{" "}
                                      <strong>
                                        {t.currency} {t.estimatedCost.toLocaleString()}
                                      </strong>
                                    </p>
                                  )}
                                  {t.pickupLocation && (
                                    <p>
                                      <span className="text-clay-500">Pickup:</span> {t.pickupLocation}
                                    </p>
                                  )}
                                  {t.dropoffLocation && (
                                    <p>
                                      <span className="text-clay-500">Drop-off:</span> {t.dropoffLocation}
                                    </p>
                                  )}
                                  {t.pickupTime && (
                                    <p>
                                      <span className="text-clay-500">Depart:</span>{" "}
                                      {format(t.pickupTime, "EEE, d MMM h:mm a")}
                                    </p>
                                  )}
                                  {t.returnTime && (
                                    <p>
                                      <span className="text-clay-500">Return:</span>{" "}
                                      {format(t.returnTime, "EEE, d MMM h:mm a")}
                                    </p>
                                  )}
                                  {t.coordinatorNotes && (
                                    <p className="sm:col-span-2">
                                      <span className="text-clay-500">Notes:</span> {t.coordinatorNotes}
                                    </p>
                                  )}
                                </div>
                              )}
                              {t.status === "REJECTED_TREASURER" && t.treasurerComments && (
                                <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">
                                  Treasurer: {t.treasurerComments}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Submitted info */}
                <p className="text-xs text-clay-400">
                  Submitted {format(event.createdAt, "d MMM yyyy 'at' h:mm a")}
                </p>

                {/* Action buttons */}
                {actionState?.eventId === event.id ? (
                  <div className="space-y-3 pt-2 border-t border-clay-100">
                    <p className="text-sm font-medium text-clay-700">
                      {actionState.action === "APPROVE"
                        ? "Confirm approval"
                        : actionState.action === "REJECT"
                        ? "Provide a reason for rejection"
                        : "Describe the changes needed"}
                    </p>
                    {actionState.action !== "APPROVE" && (
                      <div className="space-y-1.5">
                        <Label htmlFor={`comments-${event.id}`} className="text-sm">
                          Comments *
                        </Label>
                        <Textarea
                          id={`comments-${event.id}`}
                          placeholder={
                            actionState.action === "REJECT"
                              ? "Reason for rejection..."
                              : "What changes are needed..."
                          }
                          rows={3}
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
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
                          "flex-1",
                          actionState.action === "APPROVE"
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : actionState.action === "REJECT"
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-amber-600 hover:bg-amber-700 text-white"
                        )}
                      >
                        {submitting ? (
                          <LoadingSpinner size="sm" className="mr-2" />
                        ) : null}
                        {actionState.action === "APPROVE"
                          ? "Confirm Approve"
                          : actionState.action === "REJECT"
                          ? "Confirm Reject"
                          : "Send for Changes"}
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
                ) : (
                  (() => {
                    const transport = transportByEvent[event.id];
                    const needsRouting =
                      event.transportRequired && !event.transportRequestId;
                    const transportBlocking =
                      event.transportRequired &&
                      transport?.status !== "APPROVED";
                    const approveTooltip = needsRouting
                      ? "Notify the Transport Coordinator first"
                      : transport && transport.status !== "APPROVED"
                        ? TRANSPORT_STATUS_LABEL[transport.status]
                        : undefined;
                    return (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-clay-100">
                        {needsRouting && (
                          <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                            onClick={() => handleNotifyTransport(event.id)}
                            disabled={notifyingEventId === event.id}
                          >
                            {notifyingEventId === event.id ? (
                              <LoadingSpinner size="sm" className="mr-1" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            Notify Transport Coordinator
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white gap-1.5 disabled:opacity-50"
                          onClick={() =>
                            setActionState({ eventId: event.id, action: "APPROVE" })
                          }
                          disabled={transportBlocking}
                          title={approveTooltip}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5"
                          onClick={() => {
                            setActionState({
                              eventId: event.id,
                              action: "REQUEST_CHANGES",
                            });
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
                    );
                  })()
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
