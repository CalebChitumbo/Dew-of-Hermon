"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onSnapshot, Timestamp } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { hasMinRole } from "@/lib/permissions";
import {
  DepartmentJoinRequest,
  DepartmentJoinRequestStatus,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner, PageLoader } from "@/components/shared/LoadingSpinner";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionHeading } from "@/components/shared/SectionHeading";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus,
  ThumbsUp,
  CheckCircle2,
  Clock,
  Inbox,
  XCircle,
  MinusCircle,
} from "lucide-react";
import { format } from "date-fns";

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return new Date();
}

type DecisionAction = "RECOMMEND" | "DECLINE" | "APPROVE" | "REJECT";

const STATUS_META: Record<
  DepartmentJoinRequestStatus,
  { label: string; tone: string }
> = {
  PENDING_MANAGER: { label: "Awaiting manager", tone: "bg-gold/15 text-gold-dark" },
  PENDING_CHAIR: { label: "Awaiting chairperson", tone: "bg-blue-50 text-blue-600" },
  APPROVED: { label: "Approved", tone: "bg-emerald-50 text-emerald-600" },
  REJECTED: { label: "Not approved", tone: "bg-red-50 text-red-600" },
  CANCELLED: { label: "Cancelled", tone: "bg-clay-100 text-clay-500" },
};

const ACTION_META: Record<
  DecisionAction,
  { title: string; verb: string; needsReason: boolean; destructive: boolean }
> = {
  RECOMMEND: { title: "Recommend request", verb: "Recommend", needsReason: false, destructive: false },
  DECLINE: { title: "Decline request", verb: "Decline", needsReason: true, destructive: true },
  APPROVE: { title: "Approve request", verb: "Approve", needsReason: false, destructive: false },
  REJECT: { title: "Reject request", verb: "Reject", needsReason: true, destructive: true },
};

type StepState = "done" | "current" | "rejected" | "skipped" | "upcoming";

function StepNode({ state }: { state: StepState }) {
  if (state === "done")
    return (
      <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      </span>
    );
  if (state === "current")
    return (
      <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-gold text-white ring-4 ring-gold/25">
        <Clock className="h-4 w-4" />
      </span>
    );
  if (state === "rejected")
    return (
      <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200">
        <XCircle className="h-4 w-4 text-red-500" />
      </span>
    );
  if (state === "skipped")
    return (
      <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-clay-100 ring-1 ring-clay-200">
        <MinusCircle className="h-4 w-4 text-clay-400" />
      </span>
    );
  return (
    <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-clay-100 ring-1 ring-clay-200">
      <span className="h-2 w-2 rounded-full bg-clay-300" />
    </span>
  );
}

/**
 * Horizontal approval timeline (Requested → Manager → Chairperson) so the
 * stage a request is sitting at is obvious at a glance — the current stage is
 * highlighted, which makes it clear when a request is still with the manager
 * and not yet the Chairperson's to approve.
 */
function RequestTimeline({ req }: { req: DepartmentJoinRequest }) {
  const managerActed = !!req.managerDecidedAt;
  const chairActed = !!req.chairDecidedAt;
  const managerDeclined = req.status === "REJECTED" && managerActed && !chairActed;
  const chairRejected = req.status === "REJECTED" && chairActed;
  const skippedManager =
    !managerActed &&
    (req.status === "PENDING_CHAIR" || req.status === "APPROVED" || chairActed);

  const managerState: StepState =
    req.status === "PENDING_MANAGER"
      ? "current"
      : managerDeclined
        ? "rejected"
        : managerActed
          ? "done"
          : skippedManager
            ? "skipped"
            : "upcoming";

  const chairState: StepState =
    req.status === "APPROVED"
      ? "done"
      : chairRejected
        ? "rejected"
        : req.status === "PENDING_CHAIR"
          ? "current"
          : "upcoming";

  const fmt = (d: Date | null) => (d ? format(d, "MMM d") : "");

  const steps: { key: string; label: string; sub?: string; state: StepState }[] = [
    { key: "requested", label: "Requested", sub: fmt(req.createdAt), state: "done" },
    {
      key: "manager",
      label:
        managerState === "current"
          ? "Manager review"
          : managerState === "done"
            ? "Recommended"
            : managerState === "rejected"
              ? "Declined"
              : managerState === "skipped"
                ? "No manager"
                : "Manager",
      sub:
        managerState === "current"
          ? "Awaiting recommendation"
          : managerState === "skipped"
            ? "Routed to chair"
            : managerActed
              ? `${req.managerName || "Manager"} · ${fmt(req.managerDecidedAt)}`
              : undefined,
      state: managerState,
    },
    {
      key: "chair",
      label:
        chairState === "done"
          ? "Approved"
          : chairState === "rejected"
            ? "Not approved"
            : "Chairperson",
      sub:
        chairState === "current"
          ? "Final approval"
          : chairActed
            ? `${req.chairName || "Chairperson"} · ${fmt(req.chairDecidedAt)}`
            : undefined,
      state: chairState,
    },
  ];

  return (
    <ol className="flex items-start">
      {steps.map((step, i) => {
        const reached = step.state !== "upcoming";
        return (
          <li
            key={step.key}
            className="relative flex flex-1 flex-col items-center px-1 text-center"
          >
            {i > 0 && (
              <span
                className={`absolute left-[-50%] right-1/2 top-3.5 h-0.5 ${
                  reached ? "bg-clay-300" : "bg-clay-200/60"
                }`}
              />
            )}
            <StepNode state={step.state} />
            <p
              className={`mt-1.5 text-xs font-semibold leading-tight ${
                step.state === "current"
                  ? "text-gold-dark"
                  : step.state === "rejected"
                    ? "text-red-500"
                    : step.state === "done"
                      ? "text-clay-700"
                      : "text-clay-400"
              }`}
            >
              {step.label}
            </p>
            {step.sub && (
              <p className="mt-0.5 text-[11px] leading-tight text-clay-400">
                {step.sub}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function RequestCard({
  req,
  actions,
}: {
  req: DepartmentJoinRequest;
  actions: { action: DecisionAction; onClick: () => void; busy: boolean }[];
}) {
  const meta = STATUS_META[req.status];
  return (
    <div className="rounded-lg border border-clay-100/70 bg-white/60 p-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-gold/20 text-gold-dark font-bold">
            {(req.userName || "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-clay-700">{req.userName}</p>
            <Badge className={`${meta.tone} text-xs`}>{meta.label}</Badge>
          </div>
          <p className="text-sm text-clay-500 mt-0.5">
            wants to join <span className="font-medium">{req.departmentName}</span>
          </p>
          <p className="text-xs text-clay-400 mt-1">
            Requested {format(req.createdAt, "MMM d, yyyy")}
            {req.userEmail ? ` · ${req.userEmail}` : ""}
          </p>
          {req.message && (
            <p className="text-sm text-clay-600 mt-2 italic">
              &ldquo;{req.message}&rdquo;
            </p>
          )}

          {/* Approval timeline */}
          <div className="mt-4 rounded-md bg-cream/60 px-2 py-3">
            <RequestTimeline req={req} />
          </div>

          {/* Decision notes */}
          {(req.managerComments || req.chairComments) && (
            <div className="mt-3 space-y-1">
              {req.managerComments && (
                <p className="text-xs text-clay-500">
                  <span className="font-medium text-clay-600">
                    {req.managerName || "Manager"}:
                  </span>{" "}
                  &ldquo;{req.managerComments}&rdquo;
                </p>
              )}
              {req.chairComments && (
                <p className="text-xs text-clay-500">
                  <span className="font-medium text-clay-600">
                    {req.chairName || "Chairperson"}:
                  </span>{" "}
                  &ldquo;{req.chairComments}&rdquo;
                </p>
              )}
            </div>
          )}

          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {actions.map((a) => {
                const am = ACTION_META[a.action];
                return (
                  <Button
                    key={a.action}
                    size="sm"
                    variant={am.destructive ? "outline" : "gold"}
                    onClick={a.onClick}
                    disabled={a.busy}
                    className={
                      am.destructive ? "text-red-600 hover:bg-red-50" : ""
                    }
                  >
                    {a.busy ? <LoadingSpinner size="sm" /> : am.verb}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DepartmentRequestsContent() {
  const { userData } = useAuth();
  const { toast } = useToast();

  const [requests, setRequests] = useState<DepartmentJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [pending, setPending] = useState<{
    req: DepartmentJoinRequest;
    action: DecisionAction;
  } | null>(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const role = userData?.role;
  const isChair = role === "SUPER_ADMIN";
  // Admin/Vice can stand in as the manager for any department — a fallback so a
  // request never stalls when a department has no active lead.
  const isManagerLevel = role === "ADMIN" || role === "VICE_CHAIRPERSON";
  // Only Secretary/Admin and up get the read-only oversight of the other stage;
  // a department manager sees just their own queue.
  const canSeeOversight = role ? hasMinRole(role, "ADMIN") : false;
  const leadsDeptIds = useMemo(
    () => new Set(userData?.leadsDepartmentIds || []),
    [userData]
  );

  useEffect(() => {
    if (!userData) return;
    const unsub = onSnapshot(
      safeCollection("departmentJoinRequests"),
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            departmentId: data.departmentId,
            departmentName: data.departmentName,
            userId: data.userId,
            userName: data.userName,
            userEmail: data.userEmail ?? null,
            message: data.message ?? null,
            status: data.status as DepartmentJoinRequestStatus,
            managerId: data.managerId ?? null,
            managerName: data.managerName ?? null,
            managerDecidedAt: data.managerDecidedAt ? toDate(data.managerDecidedAt) : null,
            managerComments: data.managerComments ?? null,
            chairId: data.chairId ?? null,
            chairName: data.chairName ?? null,
            chairDecidedAt: data.chairDecidedAt ? toDate(data.chairDecidedAt) : null,
            chairComments: data.chairComments ?? null,
            statusHistory: data.statusHistory ?? [],
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
          } as DepartmentJoinRequest;
        });
        rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setRequests(rows);
        setLoading(false);
      },
      (err) => {
        console.error("dept-requests listener", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [userData]);

  // A manager-stage request is actionable by the department's own manager, or by
  // an Admin/Vice acting as the manager fallback. The Chairperson oversees this
  // stage but only acts on departments they personally lead.
  const canRecommend = useCallback(
    (req: DepartmentJoinRequest) =>
      leadsDeptIds.has(req.departmentId) || isManagerLevel,
    [leadsDeptIds, isManagerLevel]
  );

  // ── Your queue — the requests waiting on you right now ──
  // Final-approval queue: Chairperson only.
  const chairQueue = useMemo(
    () => (isChair ? requests.filter((r) => r.status === "PENDING_CHAIR") : []),
    [requests, isChair]
  );
  // Manager-stage requests this user can recommend right now.
  const myManagerQueue = useMemo(
    () =>
      requests.filter((r) => r.status === "PENDING_MANAGER" && canRecommend(r)),
    [requests, canRecommend]
  );

  // ── Oversight — read-only view of what's still with someone else ──
  // Manager-stage requests waiting on another manager (shown to the Chairperson
  // so they can see what's still with the managers).
  const managerOversight = useMemo(
    () =>
      canSeeOversight
        ? requests.filter(
            (r) => r.status === "PENDING_MANAGER" && !canRecommend(r)
          )
        : [],
    [requests, canSeeOversight, canRecommend]
  );
  // Requests now with the Chairperson, shown read-only to Admin/Vice.
  const chairOversight = useMemo(
    () =>
      canSeeOversight && !isChair
        ? requests.filter((r) => r.status === "PENDING_CHAIR")
        : [],
    [requests, canSeeOversight, isChair]
  );

  // Recently decided, scoped to what this user oversees.
  const decided = useMemo(
    () =>
      requests
        .filter(
          (r) =>
            (r.status === "APPROVED" ||
              r.status === "REJECTED" ||
              r.status === "CANCELLED") &&
            (canSeeOversight || leadsDeptIds.has(r.departmentId))
        )
        .slice(0, 15),
    [requests, canSeeOversight, leadsDeptIds]
  );

  const openDecision = (req: DepartmentJoinRequest, action: DecisionAction) => {
    setPending({ req, action });
    setComments("");
  };

  const confirmDecision = async () => {
    if (!pending) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/department-join-requests/${pending.req.id}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: pending.action,
            comments: comments.trim() || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update request");
      const am = ACTION_META[pending.action];
      toast({
        title: `${am.verb}d`,
        description: `${pending.req.userName}'s request for ${pending.req.departmentName} was ${am.verb.toLowerCase()}d.`,
      });
      setPending(null);
      setComments("");
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
    setSubmitting(false);
  };

  if (!userData || loading) return <PageLoader />;

  const actionMeta = pending ? ACTION_META[pending.action] : null;
  const totalActionable = chairQueue.length + myManagerQueue.length;
  const totalOversight = managerOversight.length + chairOversight.length;
  const nothingToShow =
    totalActionable === 0 && totalOversight === 0 && decided.length === 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        backHref="/dashboard"
        icon={UserPlus}
        tone="lavender"
        title="Department Join Requests"
        description={
          isChair
            ? "Give final approval on recommended requests, and keep an eye on what's still with the managers."
            : "Recommend members who have requested to join your department."
        }
      />

      {nothingToShow ? (
        <EmptyState
          icon={Inbox}
          title="No requests right now"
          description="When members ask to join a department you manage, their requests will show up here for you to action."
        />
      ) : (
        <>
          {/* Your queue */}
          <section className="space-y-4">
            <SectionHeading>
              Needs your approval{totalActionable > 0 ? ` (${totalActionable})` : ""}
            </SectionHeading>

            {totalActionable === 0 ? (
              <div className="rounded-lg bg-cream/40 px-4 py-3 text-sm text-clay-500">
                Nothing is waiting on you right now.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Chairperson's final approvals */}
                {chairQueue.length > 0 && (
                  <div className="space-y-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-clay-600">
                      <ThumbsUp className="h-4 w-4 text-blue-600" />
                      Awaiting your final approval ({chairQueue.length})
                    </p>
                    <p className="text-xs text-clay-400">
                      Recommended by a manager — approve to add the member to the
                      department.
                    </p>
                    {chairQueue.map((req) => (
                      <RequestCard
                        key={req.id}
                        req={req}
                        actions={[
                          {
                            action: "APPROVE",
                            busy: false,
                            onClick: () => openDecision(req, "APPROVE"),
                          },
                          {
                            action: "REJECT",
                            busy: false,
                            onClick: () => openDecision(req, "REJECT"),
                          },
                        ]}
                      />
                    ))}
                  </div>
                )}

                {/* Manager recommendations */}
                {myManagerQueue.length > 0 && (
                  <div className="space-y-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-clay-600">
                      <UserPlus className="h-4 w-4 text-gold-dark" />
                      Awaiting your recommendation ({myManagerQueue.length})
                    </p>
                    <p className="text-xs text-clay-400">
                      Recommend a request to pass it to the Chairperson, or
                      decline it.
                    </p>
                    {myManagerQueue.map((req) => (
                      <RequestCard
                        key={req.id}
                        req={req}
                        actions={[
                          {
                            action: "RECOMMEND",
                            busy: false,
                            onClick: () => openDecision(req, "RECOMMEND"),
                          },
                          {
                            action: "DECLINE",
                            busy: false,
                            onClick: () => openDecision(req, "DECLINE"),
                          },
                        ]}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Read-only oversight of what's still with someone else */}
          {totalOversight > 0 && (
            <div className="space-y-6">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-clay-400">
                Still with the managers / earlier approvers
              </p>

              {managerOversight.length > 0 && (
                <section className="space-y-3">
                  <SectionHeading>
                    {`Still with the managers (${managerOversight.length})`}
                  </SectionHeading>
                  <p className="text-xs text-clay-400">
                    Waiting on the department manager to recommend or decline.
                  </p>
                  {managerOversight.map((req) => (
                    <RequestCard key={req.id} req={req} actions={[]} />
                  ))}
                </section>
              )}

              {chairOversight.length > 0 && (
                <section className="space-y-3">
                  <SectionHeading>
                    {`Awaiting the Chairperson (${chairOversight.length})`}
                  </SectionHeading>
                  <p className="text-xs text-clay-400">
                    Recommended — now with the Chairperson for final approval.
                  </p>
                  {chairOversight.map((req) => (
                    <RequestCard key={req.id} req={req} actions={[]} />
                  ))}
                </section>
              )}
            </div>
          )}

          {/* Recently decided */}
          {decided.length > 0 && (
            <section className="space-y-3">
              <SectionHeading>Recently decided</SectionHeading>
              {decided.map((req) => (
                <RequestCard key={req.id} req={req} actions={[]} />
              ))}
            </section>
          )}
        </>
      )}

      {/* Decision dialog */}
      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionMeta?.title}</DialogTitle>
            <DialogDescription>
              {pending &&
                `${pending.req.userName} → ${pending.req.departmentName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decision-comments">
              {actionMeta?.needsReason ? "Reason (optional)" : "Note (optional)"}
            </Label>
            <Textarea
              id="decision-comments"
              placeholder={
                actionMeta?.needsReason
                  ? "Let them know why..."
                  : "Add a note (optional)..."
              }
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant={actionMeta?.destructive ? "outline" : "gold"}
              onClick={confirmDecision}
              disabled={submitting}
              className={
                actionMeta?.destructive ? "text-red-600 hover:bg-red-50" : ""
              }
            >
              {submitting ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : null}
              {actionMeta?.verb}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DepartmentRequestsPage() {
  return (
    <RoleProtected pageKey="department_join_requests">
      <DepartmentRequestsContent />
    </RoleProtected>
  );
}
