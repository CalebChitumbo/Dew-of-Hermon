"use client";

import { useEffect, useMemo, useState } from "react";
import { query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
  Department,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner, PageLoader } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { EmptyState } from "@/components/shared/EmptyState";
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
  Building2,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  UserPlus,
  Send,
} from "lucide-react";
import { format } from "date-fns";

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return new Date();
}

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

const ACTIVE: DepartmentJoinRequestStatus[] = ["PENDING_MANAGER", "PENDING_CHAIR"];

// ─── Approval pipeline (Requested → Manager → Chairperson) ─────────────────

function Pipeline({ req }: { req: DepartmentJoinRequest }) {
  type State = "done" | "active" | "rejected" | "pending";
  const rejectedAtManager =
    req.status === "REJECTED" && req.managerDecidedAt != null && req.chairDecidedAt == null;
  const rejectedAtChair = req.status === "REJECTED" && req.chairDecidedAt != null;

  const managerState: State = rejectedAtManager
    ? "rejected"
    : req.status === "PENDING_MANAGER"
      ? "active"
      : "done";
  const chairState: State =
    req.status === "APPROVED"
      ? "done"
      : rejectedAtChair
        ? "rejected"
        : req.status === "PENDING_CHAIR"
          ? "active"
          : req.status === "CANCELLED" || rejectedAtManager
            ? "pending"
            : "pending";

  const steps: { label: string; state: State }[] = [
    { label: "Requested", state: "done" },
    { label: "Manager", state: managerState },
    { label: "Chairperson", state: chairState },
  ];

  const dot = (state: State) => {
    if (state === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (state === "active") return <Clock className="h-4 w-4 text-gold-dark" />;
    if (state === "rejected") return <XCircle className="h-4 w-4 text-red-500" />;
    return <div className="h-2 w-2 rounded-full bg-clay-300" />;
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span className="flex h-6 w-6 items-center justify-center">{dot(s.state)}</span>
          <span
            className={`text-xs ${
              s.state === "rejected"
                ? "text-red-500"
                : s.state === "pending"
                  ? "text-clay-400"
                  : "text-clay-600"
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-5 bg-clay-200" />}
        </div>
      ))}
    </div>
  );
}

export default function JoinDepartmentPage() {
  const { userData } = useAuth();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [requests, setRequests] = useState<DepartmentJoinRequest[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [dialogDept, setDialogDept] = useState<Department | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Departments
  useEffect(() => {
    const unsub = onSnapshot(safeCollection("departments"), (snap) => {
      const depts = snap.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() || new Date(),
        }))
        .sort((a, b) => (a as Department).order - (b as Department).order) as Department[];
      setDepartments(depts);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // My join requests
  useEffect(() => {
    if (!userData) return;
    const q = query(
      safeCollection("departmentJoinRequests"),
      where("userId", "==", userData.id)
    );
    const unsub = onSnapshot(
      q,
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
      },
      (err) => console.error("join: requests listener", err)
    );
    return () => unsub();
  }, [userData]);

  // Member counts per department
  useEffect(() => {
    const unsub = onSnapshot(safeCollection("users"), (snap) => {
      const counts: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.isActive === false) return;
        (data.departmentIds || []).forEach((id: string) => {
          counts[id] = (counts[id] || 0) + 1;
        });
      });
      setMemberCounts(counts);
    });
    return () => unsub();
  }, []);

  const activeRequestByDept = useMemo(() => {
    const map = new Map<string, DepartmentJoinRequest>();
    for (const r of requests) {
      if (ACTIVE.includes(r.status) && !map.has(r.departmentId)) {
        map.set(r.departmentId, r);
      }
    }
    return map;
  }, [requests]);

  const myDeptIds = useMemo(
    () => new Set(userData?.departmentIds || []),
    [userData]
  );

  const joinable = useMemo(
    () =>
      departments.filter(
        (d) => !myDeptIds.has(d.id) && !activeRequestByDept.has(d.id)
      ),
    [departments, myDeptIds, activeRequestByDept]
  );

  const activeRequests = useMemo(
    () => requests.filter((r) => ACTIVE.includes(r.status)),
    [requests]
  );
  const pastRequests = useMemo(
    () => requests.filter((r) => !ACTIVE.includes(r.status)),
    [requests]
  );

  const handleSubmit = async () => {
    if (!dialogDept) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/department-join-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: dialogDept.id,
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");
      toast({
        title: "Request sent",
        description:
          data.status === "PENDING_CHAIR"
            ? `Your request to join ${dialogDept.name} has gone to the Chairperson for approval.`
            : `Your request to join ${dialogDept.name} has gone to the department manager.`,
      });
      setDialogDept(null);
      setMessage("");
    } catch (err) {
      toast({
        title: "Couldn't send request",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
    setSubmitting(false);
  };

  const handleCancel = async (req: DepartmentJoinRequest) => {
    setCancelling(req.id);
    try {
      const res = await fetch(
        `/api/department-join-requests/${req.id}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "CANCEL" }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel");
      toast({
        title: "Request cancelled",
        description: `Your request to join ${req.departmentName} has been withdrawn.`,
      });
    } catch (err) {
      toast({
        title: "Couldn't cancel",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
    setCancelling(null);
  };

  if (!userData || loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        backHref="/dashboard"
        icon={Building2}
        tone="lavender"
        title="Join a Department"
        description="Request to join a department. Your request goes to the department manager, then to the Chairperson for final approval."
      />

      {/* Your requests */}
      {(activeRequests.length > 0 || pastRequests.length > 0) && (
        <Card className="border-clay-100/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-gold-dark" />
              Your requests
            </CardTitle>
            <CardDescription>
              Track where each request is in the approval chain.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...activeRequests, ...pastRequests].map((req) => {
              const meta = STATUS_META[req.status];
              const note =
                req.chairComments || req.managerComments || null;
              return (
                <div
                  key={req.id}
                  className="rounded-lg border border-clay-100/70 bg-white/70 p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-clay-700">
                        {req.departmentName}
                      </p>
                      <p className="text-xs text-clay-400 mt-0.5">
                        Requested {format(req.createdAt, "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`${meta.tone} text-xs`}>{meta.label}</Badge>
                      {ACTIVE.includes(req.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancel(req)}
                          disabled={cancelling === req.id}
                        >
                          {cancelling === req.id ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            "Cancel"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <Pipeline req={req} />
                  </div>
                  {note && (
                    <p className="text-xs text-clay-500 mt-3 italic">
                      &ldquo;{note}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Departments you can join */}
      <section className="space-y-4">
        <SectionHeading>Departments you can join</SectionHeading>

        {joinable.length === 0 ? (
          <EmptyState
            icon={Building2}
            tone="lavender"
            title="Nothing to join right now"
            description="You're already a member of every department, or you have pending requests for the rest."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {joinable.map((dept) => (
              <Card
                key={dept.id}
                className="h-full border-clay-100/70 transition-all hover:bg-white hover:shadow-[0_8px_24px_-16px_rgba(91,58,41,0.18)]"
              >
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{dept.icon}</span>
                    <h3 className="font-display font-semibold text-clay-700">
                      {dept.name}
                    </h3>
                  </div>
                  {dept.description && (
                    <p className="text-sm text-clay-500 mb-3 line-clamp-3 flex-1">
                      {dept.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-2">
                    <span className="flex items-center gap-1.5 text-sm text-clay-500">
                      <Users className="h-4 w-4" />
                      {memberCounts[dept.id] || 0} member
                      {(memberCounts[dept.id] || 0) !== 1 ? "s" : ""}
                    </span>
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => {
                        setDialogDept(dept);
                        setMessage("");
                      }}
                    >
                      <UserPlus className="mr-1.5 h-4 w-4" />
                      Request to join
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Request dialog */}
      <Dialog open={!!dialogDept} onOpenChange={(o) => !o && setDialogDept(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to join {dialogDept?.name}</DialogTitle>
            <DialogDescription>
              Your request will be sent to the department manager to recommend,
              then to the Chairperson for final approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="join-message">Add a note (optional)</Label>
            <Textarea
              id="join-message"
              placeholder="Why you'd like to join this department..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogDept(null)}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
