"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
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

type TransportAction = "APPROVE" | "REQUEST_CHANGES" | "REJECT";
type BudgetAction = "APPROVE" | "REJECT";

export default function AccountsApprovalsPage() {
  const { loading: accessLoading, canApproveAccounts } = useTransportAccess();
  const { toast } = useToast();

  const [transportRequests, setTransportRequests] = useState<TransportPending[]>([]);
  const [budgetRequests, setBudgetRequests] = useState<BudgetPending[]>([]);
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
      const [tRes, bRes] = await Promise.all([
        fetch("/api/transport-requests?status=PENDING_TREASURER"),
        fetch("/api/budget-requests?status=PENDING_TREASURER"),
      ]);
      if (!tRes.ok) throw new Error("Failed to fetch transport requests");
      if (!bRes.ok) throw new Error("Failed to fetch budget requests");
      const tData = await tRes.json();
      const bData = await bRes.json();
      setTransportRequests(tData.requests || []);
      setBudgetRequests(bData.requests || []);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load requests";
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
      const res = await fetch(
        `/api/transport-requests/${tActiveId}/treasurer-decision`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: tAction,
            comments: tComments.trim() || undefined,
          }),
        }
      );
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
      const message =
        error instanceof Error ? error.message : "Failed to record decision";
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
      const res = await fetch(
        `/api/budget-requests/${bActiveId}/treasurer-decision`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: bAction,
            approvedAmount,
            comments: bComments.trim() || undefined,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to record decision");
      }
      const reduced =
        bAction === "APPROVE" &&
        approvedAmount !== undefined &&
        approvedAmount < req.requestedAmount;
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
      const message =
        error instanceof Error ? error.message : "Failed to record decision";
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
      <EmptyState
        icon={Shield}
        title="Access Denied"
        description="Only the Treasurer (Finance lead) can review accounts approvals."
        tone="clay"
        action={
          <Link href="/calendar">
            <Button variant="outline">Back to Calendar</Button>
          </Link>
        }
      />
    );
  }

  const totalPending = transportRequests.length + budgetRequests.length;

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/dashboard"
        icon={Banknote}
        tone="gold"
        title="Accounts Approvals"
        description="Confirm funds availability for transport and event budget requests."
        actions={
          <Badge
            variant="outline"
            className={cn(
              "text-sm",
              totalPending > 0
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-green-50 text-green-700 border-green-200"
            )}
          >
            {totalPending} pending
          </Badge>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "transport" | "budget")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transport" className="gap-2">
            <Bus className="h-4 w-4" />
            Transport
            {transportRequests.length > 0 && (
              <span className="ml-1 text-xs opacity-70">({transportRequests.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="budget" className="gap-2">
            <Banknote className="h-4 w-4" />
            Budget Requests
            {budgetRequests.length > 0 && (
              <span className="ml-1 text-xs opacity-70">({budgetRequests.length})</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Transport tab */}
        <TabsContent value="transport" className="mt-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="md" />
            </div>
          ) : transportRequests.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All caught up!"
              description="No transport requests are awaiting your approval."
              tone="sage"
            />
          ) : (
            transportRequests.map((req) => (
              <Card key={req.id} className="overflow-hidden">
                <div className="h-1 bg-blue-400" />
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-clay-900 flex items-center gap-2">
                    <Bus className="h-5 w-5 text-[#C8963E]" />
                    {req.eventTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {req.eventStartDate && (
                    <div className="flex items-center gap-2 text-sm text-clay-600">
                      <Calendar className="h-4 w-4 text-clay-400" />
                      {format(parseISO(req.eventStartDate), "EEE, d MMM yyyy 'at' h:mm a")}
                    </div>
                  )}

                  <div className="rounded-md bg-cream/60 px-3 py-2 text-sm">
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

                  {tActiveId === req.id ? (
                    <div className="space-y-3 pt-2 border-t border-clay-100">
                      <p className="text-sm font-medium text-clay-700">
                        {tAction === "APPROVE"
                          ? "Confirm approval"
                          : tAction === "REJECT"
                            ? "Provide a reason for rejection"
                            : "Describe what needs to change"}
                      </p>
                      {tAction !== "APPROVE" && (
                        <div className="space-y-1.5">
                          <Label htmlFor={`t-comments-${req.id}`} className="text-sm">
                            Comments *
                          </Label>
                          <Textarea
                            id={`t-comments-${req.id}`}
                            rows={3}
                            value={tComments}
                            onChange={(e) => setTComments(e.target.value)}
                          />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          onClick={handleTransportDecision}
                          disabled={
                            tSubmitting ||
                            (tAction !== "APPROVE" && !tComments.trim())
                          }
                          className={cn(
                            "flex-1",
                            tAction === "APPROVE"
                              ? "bg-green-600 hover:bg-green-700 text-white"
                              : tAction === "REJECT"
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-amber-600 hover:bg-amber-700 text-white"
                          )}
                        >
                          {tSubmitting && <LoadingSpinner size="sm" className="mr-2" />}
                          {tAction === "APPROVE"
                            ? "Confirm Approve"
                            : tAction === "REJECT"
                              ? "Confirm Reject"
                              : "Send Back for Changes"}
                        </Button>
                        <Button
                          variant="outline"
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
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-clay-100">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
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
                        className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5"
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
                        className="border-red-300 text-red-700 hover:bg-red-50 gap-1.5"
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
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Budget tab */}
        <TabsContent value="budget" className="mt-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="md" />
            </div>
          ) : budgetRequests.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All caught up!"
              description="No budget requests are awaiting your approval."
              tone="sage"
            />
          ) : (
            budgetRequests.map((req) => (
              <Card key={req.id} className="overflow-hidden">
                <div className="h-1 bg-blue-400" />
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-clay-900 flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-[#C8963E]" />
                    {req.eventTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {req.eventStartDate && (
                    <div className="flex items-center gap-2 text-sm text-clay-600">
                      <Calendar className="h-4 w-4 text-clay-400" />
                      {format(parseISO(req.eventStartDate), "EEE, d MMM yyyy 'at' h:mm a")}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <p>
                      <span className="text-clay-500">Requested:</span>{" "}
                      <strong className="text-clay-800">
                        {req.currency} {req.requestedAmount.toLocaleString()}
                      </strong>
                    </p>
                    <p>
                      <span className="text-clay-500">Requested by:</span>{" "}
                      {req.requestedByName ?? "—"}
                    </p>
                  </div>

                  <div className="rounded-md bg-cream/60 px-3 py-2 text-sm">
                    <p className="text-xs font-semibold text-clay-500 uppercase mb-1">
                      Purpose
                    </p>
                    <p className="text-clay-700 whitespace-pre-wrap">{req.purpose}</p>
                  </div>

                  <p className="text-xs text-clay-400">
                    Submitted
                    {req.createdAt &&
                      ` ${format(parseISO(req.createdAt), "d MMM yyyy 'at' h:mm a")}`}
                  </p>

                  {bActiveId === req.id ? (
                    <div className="space-y-3 pt-2 border-t border-clay-100">
                      <p className="text-sm font-medium text-clay-700">
                        {bAction === "APPROVE"
                          ? "Confirm approval (you may reduce the amount)"
                          : "Provide a reason for rejection"}
                      </p>
                      {bAction === "APPROVE" && (
                        <div className="space-y-1.5">
                          <Label htmlFor={`b-amount-${req.id}`} className="text-sm">
                            Approved amount ({req.currency}) *
                          </Label>
                          <Input
                            id={`b-amount-${req.id}`}
                            type="number"
                            min={0}
                            step="0.01"
                            max={req.requestedAmount}
                            value={bApprovedAmount}
                            onChange={(e) => setBApprovedAmount(e.target.value)}
                          />
                          <p className="text-xs text-clay-400">
                            Up to the requested {req.currency}{" "}
                            {req.requestedAmount.toLocaleString()}. Enter a
                            smaller number to approve with reduction.
                          </p>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label htmlFor={`b-comments-${req.id}`} className="text-sm">
                          {bAction === "APPROVE" ? "Notes (optional)" : "Reason *"}
                        </Label>
                        <Textarea
                          id={`b-comments-${req.id}`}
                          rows={3}
                          value={bComments}
                          onChange={(e) => setBComments(e.target.value)}
                        />
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
                            "flex-1",
                            bAction === "APPROVE"
                              ? "bg-green-600 hover:bg-green-700 text-white"
                              : "bg-red-600 hover:bg-red-700 text-white"
                          )}
                        >
                          {bSubmitting && <LoadingSpinner size="sm" className="mr-2" />}
                          {bAction === "APPROVE" ? "Confirm Approve" : "Confirm Reject"}
                        </Button>
                        <Button
                          variant="outline"
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
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-clay-100">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
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
                        className="border-red-300 text-red-700 hover:bg-red-50 gap-1.5"
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
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
