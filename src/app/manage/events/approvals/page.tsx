"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { getDocs, query, where, Timestamp } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { hasMinRole } from "@/lib/permissions";
import { AppEvent, EventType, EventApprovalStatus, UserRole } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionHeading } from "@/components/shared/SectionHeading";
import {
  Calendar,
  MapPin,
  Clock,
  Check,
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
  ClipboardCheck,
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

// Order of the approval chain, used to lay out the oversight groups.
const STAGE_ORDER: Stage[] = ["EVENTS_LEAD", "VICE_CHAIR", "CHAIR"];

// Who is responsible for acting at each stage — used to label the read-only
// oversight groups a higher role sees ("With the Events Lead", etc.).
const STAGE_OWNER_LABEL: Record<Stage, string> = {
  EVENTS_LEAD: "Events Lead",
  VICE_CHAIR: "Vice Chair",
  CHAIR: "Chairperson",
};

// The single stage a given role is responsible for approving. Everything sitting
// at the other stages is shown to senior roles as read-only oversight, so the
// queue that's actually theirs to action is never buried among the rest.
function ownStageForRole(role: UserRole | undefined): Stage {
  if (role === "SUPER_ADMIN") return "CHAIR";
  if (role === "VICE_CHAIRPERSON") return "VICE_CHAIR";
  return "EVENTS_LEAD";
}

// ─── Approval-chain pipeline ───

const PIPELINE_STEPS = [
  "Initiated",
  "Events Lead",
  "Vice Chair",
  "Chairperson",
  "Live",
] as const;

// Index of the step the event is currently sitting at.
function pipelineIndex(status: EventApprovalStatus): number {
  switch (status) {
    case "PENDING_DISPATCH":
    case "PENDING_STAKEHOLDERS":
      return 1; // Events Lead
    case "PENDING_VICE_CHAIR":
      return 2;
    case "PENDING_CHAIR":
      return 3;
    case "APPROVED":
      return 4;
    default:
      return 1;
  }
}

function ApprovalPipeline({ status }: { status: EventApprovalStatus }) {
  const current = pipelineIndex(status);
  return (
    <div className="flex items-start">
      {PIPELINE_STEPS.map((label, i) => {
        const completed = i < current;
        const isCurrent = i === current;
        return (
          <div
            key={label}
            className="relative flex flex-1 flex-col items-center"
          >
            {/* connector from the previous node to this one */}
            {i > 0 && (
              <div
                className={cn(
                  "absolute top-3.5 left-[-50%] right-1/2 h-0.5",
                  i <= current ? "bg-green-400" : "bg-clay-200"
                )}
              />
            )}
            <div
              className={cn(
                "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold",
                completed
                  ? "border-green-500 bg-green-500 text-white"
                  : isCurrent
                    ? "border-amber-500 bg-amber-500 text-white ring-4 ring-amber-100"
                    : "border-clay-200 bg-white text-clay-400"
              )}
            >
              {completed ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "mt-1.5 text-center text-[10px] sm:text-xs leading-tight",
                isCurrent
                  ? "font-semibold text-amber-700"
                  : completed
                    ? "text-green-700"
                    : "text-clay-400"
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
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

  // ─── Group the pending events by stage so each role sees its own queue first ───
  const ownStage = ownStageForRole(role);
  // Only senior roles (Secretary/Admin and up) see the read-only oversight of
  // the other stages; a department/events manager sees just their own queue.
  const canSeeOversight = role ? hasMinRole(role, "ADMIN") : false;

  const byStage: Record<Stage, PendingEvent[]> = {
    EVENTS_LEAD: [],
    VICE_CHAIR: [],
    CHAIR: [],
  };
  for (const evt of events) byStage[stageOf(evt.approvalStatus)].push(evt);

  const yourQueue = byStage[ownStage];
  const oversightStages = canSeeOversight
    ? STAGE_ORDER.filter((s) => s !== ownStage && byStage[s].length > 0)
    : [];

  // Renders one event card. `actionable` controls whether the approve/reject
  // controls are shown (the viewer's own queue) or the card is read-only
  // oversight of a stage that belongs to someone earlier in the chain.
  function renderEventCard(event: PendingEvent, actionable: boolean) {
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

    // Events Lead can approve once dispatched (if needed) and all ready.
    const approveBlocked =
      stage === "EVENTS_LEAD" &&
      ((hasResources && notDispatched) || !allReady);

    return (
      <Card key={event.id} className="overflow-hidden">
        <div className={cn("h-1", actionable ? "bg-amber-400" : "bg-clay-200")} />
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
          {/* Approval-chain pipeline */}
          <div className="rounded-lg bg-cream/40 px-3 py-3">
            <ApprovalPipeline status={event.approvalStatus} />
          </div>

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
            <div className="text-sm bg-cream/40 rounded-md px-3 py-2">
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
            <div className="space-y-2">
              <SectionHeading>Stakeholders</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {resourceRows.map((r) => {
                  const Icon = r.icon;
                  return (
                    <div
                      key={r.key}
                      className="flex items-center justify-between text-sm rounded border border-clay-100/70 px-3 py-1.5"
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
          {!actionable ? (
            <p className="text-xs text-clay-400 pt-2 border-t border-clay-100">
              {STATUS_LABELS[event.approvalStatus] || "Pending"} — no action
              needed from you yet.
            </p>
          ) : isEditing ? (
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
  }

  if (!hasAccess) {
    return (
      <EmptyState
        icon={Shield}
        title="Access Denied"
        description="You do not have permission to view event approvals."
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
        icon={ClipboardCheck}
        tone="periwinkle"
        title="Event Approvals"
        description="Dispatch stakeholder requests and move events through the approval chain"
        actions={
          <Badge variant="outline" className="text-sm">
            {yourQueue.length} awaiting you
          </Badge>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : fetchError ? (
        <EmptyState
          icon={XCircle}
          tone="blush"
          title="Failed to load pending events"
          action={
            <Button variant="outline" onClick={fetchPending}>
              Retry
            </Button>
          }
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          tone="sage"
          title="All caught up!"
          description="No events are currently pending."
        />
      ) : (
        <div className="space-y-10">
          {/* Your own queue — the events at the stage you're responsible for. */}
          <section className="space-y-4">
            <SectionHeading>
              Needs your approval{yourQueue.length > 0 ? ` (${yourQueue.length})` : ""}
            </SectionHeading>
            {yourQueue.length === 0 ? (
              <div className="rounded-lg bg-cream/40 px-4 py-3 text-sm text-clay-500">
                Nothing is waiting on you right now.
              </div>
            ) : (
              <div className="space-y-4">
                {yourQueue.map((event) => renderEventCard(event, true))}
              </div>
            )}
          </section>

          {/* Read-only oversight of the stages still with earlier approvers. */}
          {oversightStages.length > 0 && (
            <div className="space-y-6">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-clay-400">
                Still with the managers / earlier approvers
              </p>
              {oversightStages.map((s) => (
                <section key={s} className="space-y-3">
                  <SectionHeading>
                    {`With the ${STAGE_OWNER_LABEL[s]} (${byStage[s].length})`}
                  </SectionHeading>
                  <div className="space-y-4">
                    {byStage[s].map((event) => renderEventCard(event, false))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
