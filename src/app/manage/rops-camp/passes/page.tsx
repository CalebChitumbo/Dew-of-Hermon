"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import {
  AlarmClock,
  ArrowLeft,
  CheckCircle2,
  Clock,
  DoorOpen,
  Inbox,
  Mail,
  MinusCircle,
  Plus,
  ScanLine,
  Search,
  Send,
  ShieldCheck,
  Tent,
  Ticket,
  Undo2,
  XCircle,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { useCampPassAccess } from "@/hooks/useCampPassAccess";
import { CAMPS, DEFAULT_CAMP_ID } from "@/lib/camps";
import { cn } from "@/lib/utils";
import { PageLoader, LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyStateLux, StatCardLux, luxSurface } from "@/components/shared/lux";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SegmentedTab, SegmentedTabsList } from "@/components/shared/lux";
import type { CampPassStage, CampPassStatus } from "@/types";

/**
 * ROPs Camp exit passes — the staff side of the PASS system.
 *
 * A camper who needs to leave camp is signed off by Admissions, then the Camp
 * Manager, then the Chairperson. Only the Chairperson's approval issues the QR
 * gate pass, which the guard scans once on the way out and once on the way
 * back in. This page is the queue for all three desks plus the live register of
 * who is currently off-site.
 */

interface PassRow {
  id: string;
  campId: string;
  registrationId: string;
  camperName: string;
  camperFirstName: string | null;
  camperPhone: string | null;
  contactEmail: string | null;
  reason: string;
  destination: string | null;
  escortName: string | null;
  escortPhone: string | null;
  expectedReturnAt: string | null;
  status: CampPassStatus;
  requestSource: "CAMPER" | "ADMISSIONS";
  requestedByName: string;
  admissionsName: string | null;
  admissionsDecidedAt: string | null;
  admissionsComments: string | null;
  managerName: string | null;
  managerDecidedAt: string | null;
  managerComments: string | null;
  chairName: string | null;
  chairDecidedAt: string | null;
  chairComments: string | null;
  rejectedStage: CampPassStage | null;
  passIssuedAt: string | null;
  passEmailSentAt: string | null;
  passEmailSentTo: string | null;
  checkedOutAt: string | null;
  checkedOutByName: string | null;
  checkedInAt: string | null;
  checkedInByName: string | null;
  returnedLate: boolean;
  createdAt: string | null;
}

interface CamperOption {
  id: string;
  name: string;
  gender: string | null;
  churchOrSchool: string | null;
  phone: string | null;
  checkedIn: boolean;
  onPass: boolean;
  hasEmail: boolean;
}

const STATUS_META: Record<CampPassStatus, { label: string; tone: string }> = {
  PENDING_ADMISSIONS: { label: "Awaiting admissions", tone: "bg-gold/15 text-gold-dark" },
  PENDING_MANAGER: { label: "Awaiting camp manager", tone: "bg-amber-50 text-amber-700" },
  PENDING_CHAIR: { label: "Awaiting chairperson", tone: "bg-blue-50 text-blue-600" },
  APPROVED: { label: "Pass issued", tone: "bg-emerald-50 text-emerald-600" },
  OUT: { label: "Out of camp", tone: "bg-clay-800 text-white" },
  RETURNED: { label: "Returned", tone: "bg-clay-100 text-clay-500" },
  REJECTED: { label: "Declined", tone: "bg-red-50 text-red-600" },
  CANCELLED: { label: "Cancelled", tone: "bg-clay-100 text-clay-500" },
};

const STAGE_BY_STATUS: Partial<Record<CampPassStatus, CampPassStage>> = {
  PENDING_ADMISSIONS: "ADMISSIONS",
  PENDING_MANAGER: "MANAGER",
  PENDING_CHAIR: "CHAIR",
};

const STAGE_LABEL: Record<CampPassStage, string> = {
  ADMISSIONS: "Admissions",
  MANAGER: "Camp Manager",
  CHAIR: "Chairperson",
};

const camp = CAMPS.find((c) => c.id === DEFAULT_CAMP_ID) ?? CAMPS[0];

function fmt(iso: string | null, pattern = "d MMM, HH:mm"): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return "—";
  }
}

function isOverdue(pass: PassRow): boolean {
  if (pass.status !== "OUT" || !pass.expectedReturnAt) return false;
  return parseISO(pass.expectedReturnAt).getTime() < Date.now();
}

/** Default the return time to two hours out, in the input's local format. */
function defaultReturnValue(): string {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function CampPassesPage() {
  const access = useCampPassAccess();
  if (access.loading) return <PageLoader />;
  if (!access.canSeeQueue) {
    return (
      <EmptyStateLux
        icon={Tent}
        tone="clay"
        title="Access Denied"
        description="You don't have permission to work with camp exit passes."
        className="min-h-[60vh] justify-center"
      />
    );
  }
  return <PassesInner access={access} />;
}

function PassesInner({ access }: { access: ReturnType<typeof useCampPassAccess> }) {
  const { toast } = useToast();
  const [passes, setPasses] = useState<PassRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("mine");
  const [newOpen, setNewOpen] = useState(false);
  const [decision, setDecision] = useState<{
    pass: PassRow;
    action: "APPROVE" | "REJECT" | "CANCEL";
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(
        `/api/camp-passes?scope=queue&campId=${encodeURIComponent(camp.id)}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load exit passes");
      setPasses(json.passes as PassRow[]);
    } catch (err) {
      toast({
        title: "Couldn't load exit passes",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const canActOn = useCallback(
    (pass: PassRow): boolean => {
      const stage = STAGE_BY_STATUS[pass.status];
      if (!stage) return false;
      if (stage === "ADMISSIONS") return access.canAdmissions;
      if (stage === "MANAGER") return access.canManager;
      return access.canChair;
    },
    [access]
  );

  const groups = useMemo(() => {
    const all = passes ?? [];
    return {
      mine: all.filter(canActOn),
      pending: all.filter((p) => !!STAGE_BY_STATUS[p.status]),
      live: all.filter((p) => p.status === "APPROVED" || p.status === "OUT"),
      out: all.filter((p) => p.status === "OUT"),
      overdue: all.filter(isOverdue),
      history: all.filter(
        (p) =>
          p.status === "RETURNED" ||
          p.status === "REJECTED" ||
          p.status === "CANCELLED"
      ),
    };
  }, [passes, canActOn]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Ticket}
        tone="gold"
        title="Camp exit passes"
        description="Permission to leave camp: Admissions → Camp Manager → Chairperson, then a QR pass the gate scans out and back in."
        actions={
          <>
            {access.canScanGate && (
              <Link href="/manage/rops-camp/gate">
                <Button variant="outline" className="rounded-xl">
                  <ScanLine className="mr-2 h-4 w-4" />
                  Gate scanner
                </Button>
              </Link>
            )}
            <Link href="/manage/rops-camp">
              <Button variant="outline" className="rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Registrations
              </Button>
            </Link>
            {access.canAdmissions && (
              <Button
                variant="gold"
                className="rounded-xl"
                onClick={() => setNewOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Log a request
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCardLux
          icon={Inbox}
          tone="gold"
          label="Needs your sign-off"
          value={groups.mine.length}
          highlight={groups.mine.length > 0}
        />
        <StatCardLux
          icon={Clock}
          tone="clay"
          label="In approval"
          value={groups.pending.length}
        />
        <StatCardLux
          icon={DoorOpen}
          tone="sage"
          label="Out of camp now"
          value={groups.out.length}
        />
        <StatCardLux
          icon={AlarmClock}
          tone="clay"
          label="Overdue back"
          value={groups.overdue.length}
          highlight={groups.overdue.length > 0}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <SegmentedTabsList>
          <SegmentedTab value="mine" icon={Inbox} count={groups.mine.length}>
            Needs you
          </SegmentedTab>
          <SegmentedTab value="pending" icon={Clock} count={groups.pending.length}>
            In approval
          </SegmentedTab>
          <SegmentedTab value="live" icon={Ticket} count={groups.live.length}>
            Issued &amp; out
          </SegmentedTab>
          <SegmentedTab value="history" icon={CheckCircle2}>
            History
          </SegmentedTab>
        </SegmentedTabsList>

        {loading && passes === null ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <TabsContent value="mine" className="mt-5">
              <PassList
                passes={groups.mine}
                emptyTitle="Nothing waiting on you"
                emptyDescription="When a camper's request reaches your desk it will appear here."
                access={access}
                canActOn={canActOn}
                onDecision={setDecision}
                onChanged={load}
              />
            </TabsContent>
            <TabsContent value="pending" className="mt-5">
              <PassList
                passes={groups.pending}
                emptyTitle="No requests in approval"
                emptyDescription="Requests move through Admissions, the Camp Manager, then the Chairperson."
                access={access}
                canActOn={canActOn}
                onDecision={setDecision}
                onChanged={load}
              />
            </TabsContent>
            <TabsContent value="live" className="mt-5">
              <PassList
                passes={groups.live}
                emptyTitle="No live passes"
                emptyDescription="Approved passes and campers currently off-site show up here."
                access={access}
                canActOn={canActOn}
                onDecision={setDecision}
                onChanged={load}
              />
            </TabsContent>
            <TabsContent value="history" className="mt-5">
              <PassList
                passes={groups.history}
                emptyTitle="No completed passes yet"
                emptyDescription="Returned, declined, and cancelled passes are kept here as a record."
                access={access}
                canActOn={canActOn}
                onDecision={setDecision}
                onChanged={load}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      {newOpen && (
        <NewRequestDialog
          onClose={() => setNewOpen(false)}
          onCreated={() => {
            setNewOpen(false);
            load();
          }}
        />
      )}
      {decision && (
        <DecisionDialog
          pass={decision.pass}
          action={decision.action}
          onClose={() => setDecision(null)}
          onDone={() => {
            setDecision(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ─── List + row ──────────────────────────────────────────────────────────────

function PassList({
  passes,
  emptyTitle,
  emptyDescription,
  access,
  canActOn,
  onDecision,
  onChanged,
}: {
  passes: PassRow[];
  emptyTitle: string;
  emptyDescription: string;
  access: ReturnType<typeof useCampPassAccess>;
  canActOn: (pass: PassRow) => boolean;
  onDecision: (d: { pass: PassRow; action: "APPROVE" | "REJECT" | "CANCEL" }) => void;
  onChanged: () => void;
}) {
  if (passes.length === 0) {
    return (
      <EmptyStateLux
        icon={Ticket}
        tone="sage"
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }
  return (
    <ul className="space-y-4">
      {passes.map((pass) => (
        <li key={pass.id}>
          <PassCard
            pass={pass}
            access={access}
            canAct={canActOn(pass)}
            onDecision={onDecision}
            onChanged={onChanged}
          />
        </li>
      ))}
    </ul>
  );
}

function PassCard({
  pass,
  access,
  canAct,
  onDecision,
  onChanged,
}: {
  pass: PassRow;
  access: ReturnType<typeof useCampPassAccess>;
  canAct: boolean;
  onDecision: (d: { pass: PassRow; action: "APPROVE" | "REJECT" | "CANCEL" }) => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [resending, setResending] = useState(false);
  const meta = STATUS_META[pass.status];
  const stage = STAGE_BY_STATUS[pass.status];
  const overdue = isOverdue(pass);
  const live = pass.status === "APPROVED" || pass.status === "OUT";
  const isStaff = access.canAdmissions || access.canManager || access.canChair;

  const resend = async () => {
    setResending(true);
    try {
      const res = await fetchWithAuth(`/api/camp-passes/${pass.id}/resend`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to re-send");
      toast({ title: "Pass re-sent", description: `Emailed to ${json.to}` });
      onChanged();
    } catch (err) {
      toast({
        title: "Couldn't re-send the pass",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className={cn(luxSurface, "overflow-hidden")}>
      {overdue && (
        <div className="flex items-center gap-2 bg-red-600 px-5 py-2.5 text-sm font-semibold text-white">
          <AlarmClock className="h-4 w-4" />
          Overdue — expected back {fmt(pass.expectedReturnAt)} (
          {formatDistanceToNowStrict(parseISO(pass.expectedReturnAt!))} ago)
        </div>
      )}

      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-xl font-bold text-clay-800">
              {pass.camperName}
            </div>
            <div className="mt-1 text-sm text-clay-600">{pass.reason}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-clay-500">
              {pass.destination && <span>To {pass.destination}</span>}
              <span>Back by {fmt(pass.expectedReturnAt, "EEE d MMM, HH:mm")}</span>
              {pass.escortName && (
                <span>
                  Collected by {pass.escortName}
                  {pass.escortPhone ? ` · ${pass.escortPhone}` : ""}
                </span>
              )}
            </div>
          </div>
          <Badge className={cn("shrink-0 border-0", meta.tone)}>{meta.label}</Badge>
        </div>

        <PassTimeline pass={pass} />

        <div className="grid gap-1.5 text-xs text-clay-500 sm:grid-cols-2">
          <span>
            Requested by {pass.requestedByName || "—"}
            {pass.requestSource === "CAMPER" ? " (online)" : " (desk)"} ·{" "}
            {fmt(pass.createdAt)}
          </span>
          {pass.checkedOutAt && (
            <span>
              Signed out {fmt(pass.checkedOutAt)}
              {pass.checkedOutByName ? ` by ${pass.checkedOutByName}` : ""}
            </span>
          )}
          {pass.checkedInAt && (
            <span>
              Signed back in {fmt(pass.checkedInAt)}
              {pass.checkedInByName ? ` by ${pass.checkedInByName}` : ""}
              {pass.returnedLate ? " · late" : ""}
            </span>
          )}
          {pass.passEmailSentAt && (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Pass emailed to {pass.passEmailSentTo} · {fmt(pass.passEmailSentAt)}
            </span>
          )}
        </div>

        {(pass.admissionsComments || pass.managerComments || pass.chairComments) && (
          <div className="space-y-1.5 rounded-2xl bg-cream/70 p-4 text-xs text-clay-600">
            {pass.admissionsComments && (
              <div>
                <span className="font-semibold">Admissions:</span>{" "}
                {pass.admissionsComments}
              </div>
            )}
            {pass.managerComments && (
              <div>
                <span className="font-semibold">Camp Manager:</span>{" "}
                {pass.managerComments}
              </div>
            )}
            {pass.chairComments && (
              <div>
                <span className="font-semibold">Chairperson:</span> {pass.chairComments}
              </div>
            )}
          </div>
        )}

        {(canAct || live) && (
          <div className="flex flex-col gap-2 sm:flex-row">
            {canAct && stage && (
              <>
                <Button
                  variant="gold"
                  className="h-11 flex-1 rounded-xl"
                  onClick={() => onDecision({ pass, action: "APPROVE" })}
                >
                  {stage === "CHAIR" ? (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Approve &amp; issue pass
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve as {STAGE_LABEL[stage]}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl text-red-600 hover:text-red-700"
                  onClick={() => onDecision({ pass, action: "REJECT" })}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Decline
                </Button>
              </>
            )}
            {live && isStaff && (
              <>
                {pass.status === "APPROVED" && (
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl"
                    onClick={resend}
                    disabled={resending || !pass.contactEmail}
                    title={
                      pass.contactEmail
                        ? undefined
                        : "No email address on the registration"
                    }
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {resending ? "Sending…" : "Re-send pass"}
                  </Button>
                )}
                {pass.status !== "OUT" && (
                  <Button
                    variant="ghost"
                    className="h-11 rounded-xl text-clay-500"
                    onClick={() => onDecision({ pass, action: "CANCEL" })}
                  >
                    <Undo2 className="mr-2 h-4 w-4" />
                    Cancel pass
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Admissions → Camp Manager → Chairperson → out → back, at a glance. */
function PassTimeline({ pass }: { pass: PassRow }) {
  const steps: {
    label: string;
    state: "done" | "current" | "rejected" | "upcoming" | "skipped";
    detail: string | null;
  }[] = [];

  const rejectedAt = pass.rejectedStage;
  const stageDone = (stage: CampPassStage) =>
    stage === "ADMISSIONS"
      ? !!pass.admissionsDecidedAt
      : stage === "MANAGER"
        ? !!pass.managerDecidedAt
        : !!pass.chairDecidedAt;
  const stageName = (stage: CampPassStage) =>
    stage === "ADMISSIONS"
      ? pass.admissionsName
      : stage === "MANAGER"
        ? pass.managerName
        : pass.chairName;

  for (const stage of ["ADMISSIONS", "MANAGER", "CHAIR"] as CampPassStage[]) {
    const current = STAGE_BY_STATUS[pass.status] === stage;
    const state =
      rejectedAt === stage
        ? "rejected"
        : stageDone(stage) && rejectedAt !== stage
          ? "done"
          : current
            ? "current"
            : pass.status === "CANCELLED"
              ? "skipped"
              : "upcoming";
    steps.push({
      label: STAGE_LABEL[stage],
      state,
      detail: state === "done" ? stageName(stage) : null,
    });
  }

  steps.push({
    label: "Signed out",
    state: pass.checkedOutAt
      ? "done"
      : pass.status === "APPROVED"
        ? "current"
        : "upcoming",
    detail: pass.checkedOutAt ? fmt(pass.checkedOutAt, "HH:mm") : null,
  });
  steps.push({
    label: "Back in camp",
    state: pass.checkedInAt ? "done" : pass.status === "OUT" ? "current" : "upcoming",
    detail: pass.checkedInAt ? fmt(pass.checkedInAt, "HH:mm") : null,
  });

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {steps.map((step, i) => (
        <li key={step.label} className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            {step.state === "done" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : step.state === "current" ? (
              <Clock className="h-4 w-4 text-gold-dark" />
            ) : step.state === "rejected" ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : (
              <MinusCircle className="h-4 w-4 text-clay-300" />
            )}
            <span
              className={cn(
                "text-xs",
                step.state === "current"
                  ? "font-semibold text-clay-700"
                  : step.state === "done"
                    ? "text-clay-600"
                    : step.state === "rejected"
                      ? "text-red-600"
                      : "text-clay-400"
              )}
            >
              {step.label}
              {step.detail ? ` · ${step.detail}` : ""}
            </span>
          </span>
          {i < steps.length - 1 && (
            <span aria-hidden className="h-px w-4 bg-clay-200" />
          )}
        </li>
      ))}
    </ol>
  );
}

// ─── Log a walk-up request ───────────────────────────────────────────────────

function NewRequestDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [campers, setCampers] = useState<CamperOption[] | null>(null);
  const [search, setSearch] = useState("");
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [destination, setDestination] = useState("");
  const [escortName, setEscortName] = useState("");
  const [escortPhone, setEscortPhone] = useState("");
  const [expectedReturn, setExpectedReturn] = useState(defaultReturnValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth(
          `/api/camp-passes/campers?campId=${encodeURIComponent(camp.id)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load campers");
        setCampers(json.campers as CamperOption[]);
      } catch (err) {
        toast({
          title: "Couldn't load campers",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
        setCampers([]);
      }
    })();
  }, [toast]);

  const filtered = useMemo(() => {
    const list = campers ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list.slice(0, 40);
    return list
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.churchOrSchool ?? "").toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [campers, search]);

  const selected = (campers ?? []).find((c) => c.id === registrationId) ?? null;

  const submit = async () => {
    if (!registrationId || !reason.trim() || !expectedReturn) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/camp-passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId,
          reason: reason.trim(),
          destination: destination.trim() || null,
          escortName: escortName.trim() || null,
          escortPhone: escortPhone.trim() || null,
          expectedReturnAt: new Date(expectedReturn).toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create the request");
      toast({
        title: "Request logged",
        description:
          json.warning ??
          "Sent to the Camp Manager for the next sign-off. The Chairperson issues the pass.",
      });
      onCreated();
    } catch (err) {
      toast({
        title: "Couldn't log the request",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log a request to leave camp</DialogTitle>
          <DialogDescription>
            Recording it here counts as the Admissions sign-off. It then goes to
            the Camp Manager, and the Chairperson&rsquo;s approval issues the QR
            gate pass.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Camper</Label>
            {selected ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-clay-100 bg-cream/60 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-clay-700">
                    {selected.name}
                  </div>
                  <div className="text-xs text-clay-500">
                    {selected.churchOrSchool ?? "—"}
                    {selected.checkedIn ? " · checked in" : " · not checked in"}
                    {selected.hasEmail ? "" : " · no email on file"}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setRegistrationId(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search campers by name or school"
                    className="h-11 rounded-xl pl-9"
                  />
                </div>
                <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-clay-100">
                  {campers === null ? (
                    <div className="flex justify-center py-6">
                      <LoadingSpinner />
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-clay-500">
                      No campers match that search.
                    </p>
                  ) : (
                    <ul className="divide-y divide-clay-100">
                      {filtered.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-cream/70 disabled:opacity-50"
                            disabled={c.onPass}
                            onClick={() => setRegistrationId(c.id)}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-clay-700">
                                {c.name}
                              </span>
                              <span className="block truncate text-xs text-clay-500">
                                {c.churchOrSchool ?? "—"}
                                {c.checkedIn ? "" : " · not checked in"}
                              </span>
                            </span>
                            {c.onPass && (
                              <Badge className="shrink-0 border-0 bg-clay-800 text-white">
                                Out of camp
                              </Badge>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          <div>
            <Label htmlFor="pass-reason" className="mb-1.5 block">
              Reason for leaving camp
            </Label>
            <Textarea
              id="pass-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Hospital appointment with guardian"
              rows={3}
              className="rounded-xl"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="pass-destination" className="mb-1.5 block">
                Destination <span className="text-clay-400">(optional)</span>
              </Label>
              <Input
                id="pass-destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="pass-return" className="mb-1.5 block">
                Expected back at camp
              </Label>
              <Input
                id="pass-return"
                type="datetime-local"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="pass-escort" className="mb-1.5 block">
                Collected by <span className="text-clay-400">(optional)</span>
              </Label>
              <Input
                id="pass-escort"
                value={escortName}
                onChange={(e) => setEscortName(e.target.value)}
                placeholder="Guardian or escort"
                className="h-11 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="pass-escort-phone" className="mb-1.5 block">
                Escort phone <span className="text-clay-400">(optional)</span>
              </Label>
              <Input
                id="pass-escort-phone"
                value={escortPhone}
                onChange={(e) => setEscortPhone(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="rounded-xl" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="gold"
            className="rounded-xl"
            onClick={submit}
            disabled={saving || !registrationId || reason.trim().length < 3}
          >
            {saving ? "Logging…" : "Log request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Approve / decline / cancel ──────────────────────────────────────────────

function DecisionDialog({
  pass,
  action,
  onClose,
  onDone,
}: {
  pass: PassRow;
  action: "APPROVE" | "REJECT" | "CANCEL";
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const stage = STAGE_BY_STATUS[pass.status];
  const issuing = action === "APPROVE" && stage === "CHAIR";
  const needsReason = action === "REJECT";

  const title =
    action === "APPROVE"
      ? issuing
        ? "Approve and issue the gate pass"
        : `Approve as ${stage ? STAGE_LABEL[stage] : "approver"}`
      : action === "REJECT"
        ? "Decline this request"
        : "Cancel this pass";

  const submit = async () => {
    if (needsReason && !comments.trim()) return;
    setBusy(true);
    try {
      const res = await fetchWithAuth(`/api/camp-passes/${pass.id}/decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comments: comments.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");

      toast({
        title:
          action === "CANCEL"
            ? "Pass cancelled"
            : action === "REJECT"
              ? "Request declined"
              : json.issued
                ? "Pass issued"
                : "Approved",
        description:
          action === "CANCEL"
            ? "The QR code has been voided — it will no longer scan."
            : action === "REJECT"
              ? `${pass.camperName} may not leave camp.`
              : json.issued
                ? json.emailQueued
                  ? `The QR gate pass was emailed to ${pass.contactEmail}.`
                  : `Pass issued, but the email couldn't be sent${
                      json.emailReason ? `: ${json.emailReason}` : ""
                    }. It's still available on the camper's registration page.`
                : "Sent on to the next approver.",
        variant:
          action === "APPROVE" && json.issued && !json.emailQueued
            ? "destructive"
            : undefined,
      });
      onDone();
    } catch (err) {
      toast({
        title: "Couldn't record the decision",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {pass.camperName} — {pass.reason}. Expected back{" "}
            {fmt(pass.expectedReturnAt, "EEE d MMM, HH:mm")}.
            {issuing &&
              " Approving now generates the QR pass and emails it. It scans once out and once back in, then expires."}
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="decision-comments" className="mb-1.5 block">
            {needsReason ? "Reason (required)" : "Notes (optional)"}
          </Label>
          <Textarea
            id="decision-comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            className="rounded-xl"
            placeholder={
              needsReason
                ? "Why is this request being declined?"
                : "Anything the next approver or the gate should know"
            }
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" className="rounded-xl" onClick={onClose}>
            Back
          </Button>
          <Button
            variant={action === "APPROVE" ? "gold" : "destructive"}
            className="rounded-xl"
            onClick={submit}
            disabled={busy || (needsReason && !comments.trim())}
          >
            {busy
              ? "Working…"
              : action === "APPROVE"
                ? issuing
                  ? "Approve & issue pass"
                  : "Approve"
                : action === "REJECT"
                  ? "Decline request"
                  : "Cancel pass"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
