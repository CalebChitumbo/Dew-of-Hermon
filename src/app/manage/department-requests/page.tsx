"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onSnapshot, Timestamp } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { hasMinRole } from "@/lib/permissions";
import {
  DepartmentJoinRequest,
  DepartmentJoinRequestStatus,
} from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner, PageLoader } from "@/components/shared/LoadingSpinner";
import { RoleProtected } from "@/components/shared/RoleProtected";
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
  ArrowLeft,
  UserPlus,
  ThumbsUp,
  CheckCircle2,
  Clock,
  Inbox,
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

function RequestCard({
  req,
  actions,
}: {
  req: DepartmentJoinRequest;
  actions: { action: DecisionAction; onClick: () => void; busy: boolean }[];
}) {
  const meta = STATUS_META[req.status];
  return (
    <div className="rounded-lg border border-clay-200/70 bg-white/60 p-4">
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
          {req.managerName && req.managerDecidedAt && (
            <p className="text-xs text-clay-500 mt-2">
              Recommended by {req.managerName} on{" "}
              {format(req.managerDecidedAt, "MMM d")}
              {req.managerComments ? ` — "${req.managerComments}"` : ""}
            </p>
          )}
          {req.chairName && req.chairDecidedAt && (
            <p className="text-xs text-clay-500 mt-1">
              Decided by {req.chairName} on {format(req.chairDecidedAt, "MMM d")}
              {req.chairComments ? ` — "${req.chairComments}"` : ""}
            </p>
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

  const isAdmin = userData ? hasMinRole(userData.role, "ADMIN") : false;
  const isSuperAdmin = userData?.role === "SUPER_ADMIN";
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

  // Manager stage: requests I lead the department for (admins see all).
  const managerQueue = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.status === "PENDING_MANAGER" &&
          (isAdmin || leadsDeptIds.has(r.departmentId))
      ),
    [requests, isAdmin, leadsDeptIds]
  );

  // Chair stage: final approvals — Chairperson only.
  const chairQueue = useMemo(
    () => (isSuperAdmin ? requests.filter((r) => r.status === "PENDING_CHAIR") : []),
    [requests, isSuperAdmin]
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
            (isAdmin || leadsDeptIds.has(r.departmentId))
        )
        .slice(0, 15),
    [requests, isAdmin, leadsDeptIds]
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
  const totalActionable = managerQueue.length + chairQueue.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
            Department Join Requests
          </h1>
          <p className="text-clay-500 mt-1">
            {isSuperAdmin
              ? "Recommend requests for your departments and give final approval as Chairperson."
              : "Recommend members who have requested to join your department."}
          </p>
        </div>
      </div>

      {totalActionable === 0 && decided.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Inbox className="h-12 w-12 text-clay-300 mb-4" />
            <h3 className="text-lg font-display font-semibold text-clay-600">
              No requests right now
            </h3>
            <p className="text-clay-400 text-sm mt-1 text-center max-w-sm">
              When members ask to join a department you manage, their requests
              will show up here for you to action.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Manager stage */}
          {managerQueue.length > 0 && (
            <Card className="border-clay-200/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-gold-dark" />
                  Awaiting your recommendation ({managerQueue.length})
                </CardTitle>
                <CardDescription>
                  Recommend a request to pass it to the Chairperson, or decline it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {managerQueue.map((req) => (
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
              </CardContent>
            </Card>
          )}

          {/* Chair stage */}
          {isSuperAdmin && chairQueue.length > 0 && (
            <Card className="border-clay-200/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ThumbsUp className="h-5 w-5 text-blue-600" />
                  Awaiting your final approval ({chairQueue.length})
                </CardTitle>
                <CardDescription>
                  Recommended by a manager — approve to add the member to the
                  department.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
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
              </CardContent>
            </Card>
          )}

          {/* Recently decided */}
          {decided.length > 0 && (
            <Card className="border-clay-200/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-clay-400" />
                  Recently decided
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {decided.map((req) => (
                  <RequestCard key={req.id} req={req} actions={[]} />
                ))}
              </CardContent>
            </Card>
          )}

          {totalActionable === 0 && (
            <Card className="border-clay-200/70 bg-cream/40">
              <CardContent className="flex items-center gap-3 py-4">
                <Clock className="h-5 w-5 text-clay-400" />
                <p className="text-sm text-clay-500">
                  Nothing is waiting on you right now.
                </p>
              </CardContent>
            </Card>
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
