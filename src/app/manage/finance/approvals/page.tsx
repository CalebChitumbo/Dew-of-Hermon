"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  EmptyStateLux,
  StatStripLux,
  SegmentedTabsList,
  SegmentedTab,
  SoftWaves,
  DecorImage,
  luxSurface,
} from "@/components/shared/lux";
import { ApprovalScene } from "@/components/shared/illustrations";
import {
  Bus,
  Shield,
  Calendar,
  Banknote,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Timer,
} from "lucide-react";
import { useTransportAccess } from "@/hooks/useTransportAccess";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TransportPending {
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

interface BudgetPending {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartDate: string | null;
  requestedAmount: number;
  currency: string;
  purpose: string;
  requestedByName: string | null;
  createdAt: string | null;
}

interface DecidedRow {
  createdAt: string | null;
  treasurerDecidedAt: string | null;
}

type TransportAction = "APPROVE" | "REQUEST_CHANGES" | "REJECT";
type BudgetAction = "APPROVE" | "REJECT";

function formatDuration(ms: number): string {
  const hours = ms / 36e5;
  if (hours < 1) return `${Math.max(1, Math.round(ms / 6e4))}m`;
  if (hours < 24) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)}h`;
  const days = hours / 24;
  return `${days < 10 ? days.toFixed(1) : Math.round(days)}d`;
}

export default function AccountsApprovalsPage() {
  const { loading: accessLoading, canApproveAccounts } = useTransportAccess();
  const { toast } = useToast();

  const [transportRequests, setTransportRequests] = useState<TransportPending[]>([]);
  const [budgetRequests, setBudgetRequests] = useState<BudgetPending[]>([]);
  const [approvedToday, setApprovedToday] = useState(0);
  const [avgReviewMs, setAvgReviewMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"transport" | "budget">("transport");

  // Transport action state
  const [tActiveId, setTActiveId] = useState<string | null>(null);
  const [tAction, setTAction] = useState<TransportAction | null>(null);
  const [tComments, setTComments] = useState("");
  const [tSubmitting, setTSubmitting] = useState(false);

  // Budget action state
  const [bActiveId, setBActiveId] = useState<string | null>(null);
  const [bAction, setBAction] = useState<BudgetAction | null>(null);
  const [bApprovedAmount, setBApprovedAmount] = useState("");
  const [bComments, setBComments] = useState("");
  const [bSubmitting, setBSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, bRes, taRes, baRes] = await Promise.all([
        fetch("/api/transport-requests?status=PENDING_TREASURER"),
        fetch("/api/budget-requests?status=PENDING_TREASURER"),
        fetch("/api/transport-requests?status=APPROVED"),
        fetch("/api/budget-requests?status=APPROVED"),
      ]);
      if (!tRes.ok) throw new Error("Failed to fetch transport requests");
      if (!bRes.ok) throw new Error("Failed to fetch budget requests");
      const tData = await tRes.json();
      const bData = await bRes.json();
      setTransportRequests(tData.requests || []);
      setBudgetRequests(bData.requests || []);

      // Derived metrics from approved history (best-effort)
      const approved: DecidedRow[] = [
        ...(taRes.ok ? (await taRes.json()).requests || [] : []),
        ...(baRes.ok ? (await baRes.json()).requests || [] : []),
      ];
      let today = 0;
      let totalMs = 0;
      let n = 0;
      for (const r of approved) {
        if (!r.treasurerDecidedAt) continue;
        const decided = parseISO(r.treasurerDecidedAt);
        if (isToday(decided)) today++;
        if (r.createdAt) {
          totalMs += decided.getTime() - parseISO(r.createdAt).getTime();
          n++;
        }
      }
      setApprovedToday(today);
      setAvgReviewMs(n > 0 ? totalMs / n : null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load requests";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (canApproveAccounts) fetchAll();
  }, [canApproveAccounts, fetchAll]);

  async function handleTransportDecision() {
    if (!tActiveId || !tAction) return;
    if ((tAction === "REQUEST_CHANGES" || tAction === "REJECT") && !tComments.trim()) {
      toast({
        title: "Comments required",
        description: `Provide a reason for ${tAction === "REJECT" ? "rejecting" : "requesting changes"}.`,
        variant: "destructive",
      });
      return;
    }
    setTSubmitting(true);
    try {
      const res = await fetch(`/api/transport-requests/${tActiveId}/treasurer-decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: tAction, comments: tComments.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to record decision");
      }
      const labels: Record<TransportAction, string> = {
        APPROVE: "approved",
        REQUEST_CHANGES: "sent back for changes",
        REJECT: "rejected",
      };
      toast({
        title: `Transport ${labels[tAction]}`,
        description: `The transport request has been ${labels[tAction]}.`,
        variant: "success",
      });
      setTActiveId(null);
      setTAction(null);
      setTComments("");
      await fetchAll();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to record decision";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setTSubmitting(false);
    }
  }

  async function handleBudgetDecision(req: BudgetPending) {
    if (!bActiveId || !bAction) return;
    if (bAction === "REJECT" && !bComments.trim()) {
      toast({
        title: "Comments required",
        description: "Provide a reason for rejecting the budget request.",
        variant: "destructive",
      });
      return;
    }
    let approvedAmount: number | undefined;
    if (bAction === "APPROVE") {
      const candidate = Number(bApprovedAmount);
      if (!Number.isFinite(candidate) || candidate < 0) {
        toast({
          title: "Invalid amount",
          description: "Enter a non-negative number to approve.",
          variant: "destructive",
        });
        return;
      }
      if (candidate > req.requestedAmount) {
        toast({
          title: "Amount too high",
          description: `Approved amount cannot exceed the requested ${req.currency} ${req.requestedAmount.toLocaleString()}.`,
          variant: "destructive",
        });
        return;
      }
      approvedAmount = candidate;
    }
    setBSubmitting(true);
    try {
      const res = await fetch(`/api/budget-requests/${bActiveId}/treasurer-decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: bAction, approvedAmount, comments: bComments.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to record decision");
      }
      const reduced =
        bAction === "APPROVE" && approvedAmount !== undefined && approvedAmount < req.requestedAmount;
      toast({
        title:
          bAction === "APPROVE"
            ? reduced
              ? "Budget approved (reduced)"
              : "Budget approved"
            : "Budget rejected",
        description:
          bAction === "APPROVE"
            ? `${req.currency} ${approvedAmount?.toLocaleString()} approved for "${req.eventTitle}".`
            : `Budget request for "${req.eventTitle}" rejected.`,
        variant: "success",
      });
      setBActiveId(null);
      setBAction(null);
      setBComments("");
      setBApprovedAmount("");
      await fetchAll();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to record decision";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setBSubmitting(false);
    }
  }

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!canApproveAccounts) {
    return (
      <EmptyStateLux
        icon={Shield}
        title="Access Denied"
        description="Only the Treasurer (Finance lead) can review accounts approvals."
        tone="clay"
        action={
          <Link href="/calendar">
            <Button variant="outline" className="rounded-xl">Back to Calendar</Button>
          </Link>
        }
      />
    );
  }

  const totalPending = transportRequests.length + budgetRequests.length;

  return (
    <div className="space-y-7">
      <PageHeader
        backHref="/dashboard"
        icon={Banknote}
        tone="gold"
        title="Accounts Approvals"
        description="Confirm funds availability for transport and event budget requests."
        actions={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold",
              totalPending > 0 ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-600"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", totalPending > 0 ? "bg-blue-500" : "bg-emerald-500")} />
            {totalPending} pending
          </span>
        }
      />

      {/* Stats strip */}
      <StatStripLux
        items={[
          {
            icon: Bus,
            tone: "teal",
            label: "Transport Requests",
            value: transportRequests.length,
            hint: "awaiting your funds",
          },
          {
            icon: Banknote,
            tone: "gold",
            label: "Budget Requests",
            value: budgetRequests.length,
            hint: "awaiting your review",
          },
          {
            icon: CheckCircle2,
            tone: "emerald",
            label: "Approved Today",
            value: approvedToday,
            hint: "transport + budget",
          },
          {
            icon: Timer,
            tone: "periwinkle",
            label: "Avg Review Time",
            value: avgReviewMs != null ? formatDuration(avgReviewMs) : "—",
            hint: "request to decision",
          },
        ]}
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "transport" | "budget")} className="space-y-5">
        <SegmentedTabsList className="sm:max-w-lg">
          <SegmentedTab value="transport" icon={Bus} count={transportRequests.length} underline>
            Transport
          </SegmentedTab>
          <SegmentedTab value="budget" icon={Banknote} count={budgetRequests.length} underline>
            Budget Requests
          </SegmentedTab>
        </SegmentedTabsList>

        {/* Transport tab */}
        <TabsContent value="transport" className="mt-0 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="md" />
            </div>
          ) : transportRequests.length === 0 ? (
            <div className={cn("relative overflow-hidden", luxSurface)}>
              <SoftWaves className="absolute inset-x-0 bottom-0 h-24 w-full text-gold/10" />
              <DecorImage
                src="/images/dashboard/asset-soft-waves.png"
                className="absolute inset-x-0 bottom-0 h-28 w-full object-cover opacity-30"
              />
              <EmptyStateLux
                illustration={<ApprovalScene />}
                tone="emerald"
                title="All caught up!"
                description="No transport requests are awaiting your approval."
                action={
                  budgetRequests.length > 0 ? (
                    <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setActiveTab("budget")}>
                      <Banknote className="h-4 w-4" />
                      Check budget requests
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            transportRequests.map((req) => (
              <div key={req.id} className={cn("overflow-hidden", luxSurface)}>
                <div className="h-1.5 bg-gradient-to-r from-teal to-teal-light" />
                <div className="p-5 sm:p-6">
                  <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-clay-700">
                    <Bus className="h-5 w-5 text-gold-dark" />
                    {req.eventTitle}
                  </h3>
                  <div className="mt-4 space-y-4">
                    {req.eventStartDate && (
                      <div className="flex items-center gap-2 text-sm text-clay-600">
                        <Calendar className="h-4 w-4 text-clay-400" />
                        {format(parseISO(req.eventStartDate), "EEE, d MMM yyyy 'at' h:mm a")}
                      </div>
                    )}

                    <div className="rounded-2xl bg-cream/60 px-4 py-3 text-sm">
                      <p className="mb-1 text-xs font-semibold uppercase text-clay-500">Requested Needs</p>
                      <p className="whitespace-pre-wrap text-clay-700">{req.needsDescription}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                      <p><span className="text-clay-500">Vehicle:</span>{" "}<strong className="text-clay-800">{req.vehicleCount} × {req.vehicleType}</strong></p>
                      <p><span className="text-clay-500">Estimated cost:</span>{" "}<strong className="text-clay-800">{req.currency} {req.estimatedCost?.toLocaleString()}</strong></p>
                      {req.pickupLocation && <p><span className="text-clay-500">Pickup:</span> {req.pickupLocation}</p>}
                      {req.dropoffLocation && <p><span className="text-clay-500">Drop-off:</span> {req.dropoffLocation}</p>}
                      {req.pickupTime && <p><span className="text-clay-500">Depart:</span>{" "}{format(parseISO(req.pickupTime), "EEE, d MMM h:mm a")}</p>}
                      {req.returnTime && <p><span className="text-clay-500">Return:</span>{" "}{format(parseISO(req.returnTime), "EEE, d MMM h:mm a")}</p>}
                    </div>

                    {req.coordinatorNotes && (
                      <p className="rounded-2xl border border-amber-100 bg-amber-50/40 px-4 py-3 text-sm text-clay-600">
                        <span className="font-medium text-amber-800">Coordinator notes: </span>
                        {req.coordinatorNotes}
                      </p>
                    )}

                    <p className="text-xs text-clay-400">
                      Submitted by {req.filledByName ?? "Transport Coordinator"}
                      {req.filledAt && ` · ${format(parseISO(req.filledAt), "d MMM yyyy 'at' h:mm a")}`}
                    </p>

                    {tActiveId === req.id ? (
                      <div className="space-y-3 border-t border-clay-100 pt-4">
                        <p className="text-sm font-medium text-clay-700">
                          {tAction === "APPROVE"
                            ? "Confirm approval"
                            : tAction === "REJECT"
                            ? "Provide a reason for rejection"
                            : "Describe what needs to change"}
                        </p>
                        {tAction !== "APPROVE" && (
                          <div className="space-y-1.5">
                            <Label htmlFor={`t-comments-${req.id}`} className="text-sm">Comments *</Label>
                            <Textarea id={`t-comments-${req.id}`} rows={3} value={tComments} onChange={(e) => setTComments(e.target.value)} className="rounded-xl" />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            onClick={handleTransportDecision}
                            disabled={tSubmitting || (tAction !== "APPROVE" && !tComments.trim())}
                            className={cn(
                              "flex-1 rounded-xl text-white",
                              tAction === "APPROVE"
                                ? "bg-green-600 hover:bg-green-700"
                                : tAction === "REJECT"
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-amber-600 hover:bg-amber-700"
                            )}
                          >
                            {tSubmitting && <LoadingSpinner size="sm" className="mr-2" />}
                            {tAction === "APPROVE" ? "Confirm Approve" : tAction === "REJECT" ? "Confirm Reject" : "Send Back for Changes"}
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => {
                              setTActiveId(null);
                              setTAction(null);
                              setTComments("");
                            }}
                            disabled={tSubmitting}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 border-t border-clay-100 pt-4">
                        <Button
                          size="sm"
                          className="gap-1.5 rounded-xl bg-green-600 text-white hover:bg-green-700"
                          onClick={() => {
                            setTActiveId(req.id);
                            setTAction("APPROVE");
                            setTComments("");
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Confirm Funds
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50"
                          onClick={() => {
                            setTActiveId(req.id);
                            setTAction("REQUEST_CHANGES");
                            setTComments("");
                          }}
                        >
                          <MessageSquare className="h-4 w-4" />
                          Request Changes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 rounded-xl border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setTActiveId(req.id);
                            setTAction("REJECT");
                            setTComments("");
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Budget tab */}
        <TabsContent value="budget" className="mt-0 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="md" />
            </div>
          ) : budgetRequests.length === 0 ? (
            <div className={cn("relative overflow-hidden", luxSurface)}>
              <SoftWaves className="absolute inset-x-0 bottom-0 h-24 w-full text-gold/10" />
              <DecorImage
                src="/images/dashboard/asset-soft-waves.png"
                className="absolute inset-x-0 bottom-0 h-28 w-full object-cover opacity-30"
              />
              <EmptyStateLux
                illustration={<ApprovalScene />}
                tone="emerald"
                title="All caught up!"
                description="No budget requests are awaiting your approval."
                action={
                  transportRequests.length > 0 ? (
                    <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setActiveTab("transport")}>
                      <Bus className="h-4 w-4" />
                      Check transport requests
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            budgetRequests.map((req) => (
              <div key={req.id} className={cn("overflow-hidden", luxSurface)}>
                <div className="h-1.5 bg-gradient-to-r from-gold to-gold-light" />
                <div className="p-5 sm:p-6">
                  <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-clay-700">
                    <Banknote className="h-5 w-5 text-gold-dark" />
                    {req.eventTitle}
                  </h3>
                  <div className="mt-4 space-y-4">
                    {req.eventStartDate && (
                      <div className="flex items-center gap-2 text-sm text-clay-600">
                        <Calendar className="h-4 w-4 text-clay-400" />
                        {format(parseISO(req.eventStartDate), "EEE, d MMM yyyy 'at' h:mm a")}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                      <p><span className="text-clay-500">Requested:</span>{" "}<strong className="text-clay-800">{req.currency} {req.requestedAmount.toLocaleString()}</strong></p>
                      <p><span className="text-clay-500">Requested by:</span> {req.requestedByName ?? "—"}</p>
                    </div>

                    <div className="rounded-2xl bg-cream/60 px-4 py-3 text-sm">
                      <p className="mb-1 text-xs font-semibold uppercase text-clay-500">Purpose</p>
                      <p className="whitespace-pre-wrap text-clay-700">{req.purpose}</p>
                    </div>

                    <p className="text-xs text-clay-400">
                      Submitted{req.createdAt && ` ${format(parseISO(req.createdAt), "d MMM yyyy 'at' h:mm a")}`}
                    </p>

                    {bActiveId === req.id ? (
                      <div className="space-y-3 border-t border-clay-100 pt-4">
                        <p className="text-sm font-medium text-clay-700">
                          {bAction === "APPROVE" ? "Confirm approval (you may reduce the amount)" : "Provide a reason for rejection"}
                        </p>
                        {bAction === "APPROVE" && (
                          <div className="space-y-1.5">
                            <Label htmlFor={`b-amount-${req.id}`} className="text-sm">Approved amount ({req.currency}) *</Label>
                            <Input
                              id={`b-amount-${req.id}`}
                              type="number"
                              min={0}
                              step="0.01"
                              max={req.requestedAmount}
                              value={bApprovedAmount}
                              onChange={(e) => setBApprovedAmount(e.target.value)}
                              className="h-11 rounded-xl"
                            />
                            <p className="text-xs text-clay-400">
                              Up to the requested {req.currency} {req.requestedAmount.toLocaleString()}. Enter a smaller number to approve with reduction.
                            </p>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <Label htmlFor={`b-comments-${req.id}`} className="text-sm">
                            {bAction === "APPROVE" ? "Notes (optional)" : "Reason *"}
                          </Label>
                          <Textarea id={`b-comments-${req.id}`} rows={3} value={bComments} onChange={(e) => setBComments(e.target.value)} className="rounded-xl" />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleBudgetDecision(req)}
                            disabled={
                              bSubmitting ||
                              (bAction === "REJECT" && !bComments.trim()) ||
                              (bAction === "APPROVE" && !bApprovedAmount.trim())
                            }
                            className={cn(
                              "flex-1 rounded-xl text-white",
                              bAction === "APPROVE" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                            )}
                          >
                            {bSubmitting && <LoadingSpinner size="sm" className="mr-2" />}
                            {bAction === "APPROVE" ? "Confirm Approve" : "Confirm Reject"}
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => {
                              setBActiveId(null);
                              setBAction(null);
                              setBComments("");
                              setBApprovedAmount("");
                            }}
                            disabled={bSubmitting}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 border-t border-clay-100 pt-4">
                        <Button
                          size="sm"
                          className="gap-1.5 rounded-xl bg-green-600 text-white hover:bg-green-700"
                          onClick={() => {
                            setBActiveId(req.id);
                            setBAction("APPROVE");
                            setBApprovedAmount(String(req.requestedAmount));
                            setBComments("");
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 rounded-xl border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setBActiveId(req.id);
                            setBAction("REJECT");
                            setBComments("");
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
