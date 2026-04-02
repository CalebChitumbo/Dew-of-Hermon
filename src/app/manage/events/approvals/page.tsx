"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { getDocs, query, where, orderBy } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { canApproveEvents } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { AppEvent, EventType } from "@/types";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Timestamp } from "firebase/firestore";

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

type ActionState = {
  eventId: string;
  action: "APPROVE" | "REJECT" | "REQUEST_CHANGES";
} | null;

export default function EventApprovalsPage() {
  const { userData } = useAuth();
  const { toast } = useToast();

  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check permission: Events & Fellowship Manager or ADMIN+
  const efDeptId = userData?.leadsDepartmentIds || [];
  // We'll determine canApprove by checking against all departments they lead
  // The actual canApproveEvents needs the EF dept ID, but we check on the server
  // For display, any ADMIN+ or DEPARTMENT_LEAD can visit; access denied shown if unauthorized
  const isAdmin = userData
    ? userData.role === "SUPER_ADMIN" || userData.role === "ADMIN"
    : false;
  const isDeptLead = userData?.role === "DEPARTMENT_LEAD";
  const hasAccess = isAdmin || isDeptLead;

  const fetchPendingEvents = useCallback(async () => {
    setLoading(true);
    try {
      const eventsRef = safeCollection("events");
      const q = query(
        eventsRef,
        where("approvalStatus", "==", "PENDING_APPROVAL"),
        orderBy("createdAt", "asc")
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
          createdBy: data.createdBy || "",
          createdAt: parseFirestoreDate(data.createdAt),
          updatedAt: parseFirestoreDate(data.updatedAt),
        };
      });

      setPendingEvents(events);
    } catch (error) {
      console.error("Failed to fetch pending events:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingEvents();
  }, [fetchPendingEvents]);

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
                          Comments {actionState.action !== "APPROVE" && "*"}
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
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-clay-100">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
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
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
