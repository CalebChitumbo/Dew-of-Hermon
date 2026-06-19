"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useFoodAccess } from "@/hooks/useFoodAccess";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  EmptyStateLux,
  SoftWaves,
  BotanicalCorner,
  luxSurface,
} from "@/components/shared/lux";
import { FoodScene } from "@/components/shared/illustrations";
import {
  UtensilsCrossed,
  Calendar,
  CheckCircle2,
  XCircle,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FoodReq {
  id: string;
  eventTitle: string;
  eventStartDate: string | null;
  needsDescription: string;
  status: string;
}

interface Plan {
  headcount: string;
  menuPlan: string;
  raiseFunds: boolean;
  amount: string;
  currency: string;
  purpose: string;
  notes: string;
}

const EMPTY_PLAN: Plan = {
  headcount: "",
  menuPlan: "",
  raiseFunds: false,
  amount: "",
  currency: "ZMW",
  purpose: "",
  notes: "",
};

export default function FoodRequestsPage() {
  const { canConfirmFood, loading: accessLoading } = useFoodAccess();
  const { toast } = useToast();

  const [requests, setRequests] = useState<FoodReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, Plan>>({});

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/food-requests?status=PENDING_FOOD");
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canConfirmFood) fetchRequests();
  }, [canConfirmFood, fetchRequests]);

  const getPlan = (id: string): Plan => plans[id] || EMPTY_PLAN;
  const setPlan = (id: string, patch: Partial<Plan>) =>
    setPlans((p) => ({ ...p, [id]: { ...getPlan(id), ...patch } }));

  async function handleConfirm(id: string) {
    const plan = getPlan(id);
    if (plan.raiseFunds) {
      const amt = Number(plan.amount);
      if (!Number.isFinite(amt) || amt <= 0 || !plan.currency.trim() || !plan.purpose.trim()) {
        toast({
          title: "Funds details required",
          description: "Enter a positive amount, currency, and purpose for the funds request.",
          variant: "destructive",
        });
        return;
      }
    }
    setSubmittingId(id);
    try {
      const res = await fetch(`/api/food-requests/${id}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CONFIRM",
          headcount: plan.headcount ? Number(plan.headcount) : undefined,
          menuPlan: plan.menuPlan.trim() || undefined,
          raiseBudget: plan.raiseFunds
            ? {
                amount: Number(plan.amount),
                currency: plan.currency.trim(),
                purpose: plan.purpose.trim(),
              }
            : undefined,
          comments: plan.notes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to confirm");
      toast({
        title: "Food confirmed",
        description: plan.raiseFunds
          ? "Catering confirmed and a funds request was sent to Finance."
          : "Catering confirmed.",
        variant: "success",
      });
      await fetchRequests();
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleDecline(id: string) {
    const plan = getPlan(id);
    if (!plan.notes.trim()) {
      toast({
        title: "Reason required",
        description: "Add a note explaining why catering cannot be provided.",
        variant: "destructive",
      });
      return;
    }
    setSubmittingId(id);
    try {
      const res = await fetch(`/api/food-requests/${id}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DECLINE", comments: plan.notes.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to decline");
      toast({ title: "Food request declined", variant: "success" });
      await fetchRequests();
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSubmittingId(null);
    }
  }

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!canConfirmFood) {
    return (
      <EmptyStateLux
        icon={Shield}
        title="Access Denied"
        description="You do not have permission to view food requests."
        tone="clay"
        action={
          <Link href="/calendar">
            <Button variant="outline" className="rounded-xl">Back to Calendar</Button>
          </Link>
        }
      />
    );
  }

  const pendingCount = requests.length;

  return (
    <div className="space-y-7">
      <PageHeader
        backHref="/calendar"
        icon={UtensilsCrossed}
        tone="blush"
        title="Food Requests"
        description="Plan catering and confirm food provision for upcoming events"
        actions={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold",
              pendingCount > 0 ? "bg-[#F6E6EA] text-[#BC7488]" : "bg-emerald-50 text-emerald-600"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", pendingCount > 0 ? "bg-[#BC7488]" : "bg-emerald-500")} />
            {pendingCount} pending
          </span>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : requests.length === 0 ? (
        <div className={cn("relative overflow-hidden bg-gradient-to-b from-[#FDF6F2] to-white", luxSurface)}>
          <BotanicalCorner className="pointer-events-none absolute -left-3 -top-3 h-28 w-28 text-[#D69AAB]/30" />
          <SoftWaves className="absolute inset-x-0 bottom-0 h-28 w-full text-[#D69AAB]/12" />
          <EmptyStateLux
            illustration={<FoodScene />}
            tone="blush"
            title="All caught up!"
            description="No food requests are pending."
            note={
              <>
                <UtensilsCrossed className="mt-0.5 h-4 w-4 shrink-0 text-[#BC7488]" />
                <span>When new requests come in, they&apos;ll appear here.</span>
              </>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const plan = getPlan(req.id);
            const busy = submittingId === req.id;
            return (
              <div key={req.id} className={cn("overflow-hidden", luxSurface)}>
                <div className="h-1.5 bg-gradient-to-r from-[#D69AAB] to-[#E7B9C5]" />
                <div className="p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F6E6EA] text-[#BC7488]">
                      <UtensilsCrossed className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold text-clay-700">{req.eventTitle}</h3>
                      {req.eventStartDate && (
                        <div className="mt-0.5 flex items-center gap-2 text-sm text-clay-500">
                          <Calendar className="h-4 w-4 text-clay-400" />
                          {format(parseISO(req.eventStartDate), "EEE, d MMM yyyy")}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {req.needsDescription && (
                      <div className="rounded-2xl bg-cream/60 px-4 py-3 text-sm">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-clay-500">
                          Food needs
                        </p>
                        <p className="whitespace-pre-wrap text-clay-700">{req.needsDescription}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`headcount-${req.id}`} className="text-sm">Headcount</Label>
                        <Input
                          id={`headcount-${req.id}`}
                          type="number"
                          min={1}
                          placeholder="e.g. 60"
                          value={plan.headcount}
                          onChange={(e) => setPlan(req.id, { headcount: e.target.value })}
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={`menu-${req.id}`} className="text-sm">Menu plan</Label>
                        <Input
                          id={`menu-${req.id}`}
                          placeholder="e.g. Rice, chicken, salad, drinks"
                          value={plan.menuPlan}
                          onChange={(e) => setPlan(req.id, { menuPlan: e.target.value })}
                          className="h-11 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Funds request to Finance */}
                    <div className="space-y-3 rounded-2xl border border-clay-100/80 p-4">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPlan(req.id, { raiseFunds: false })}
                          className={cn(
                            "rounded-xl border-2 px-3 py-2 text-center text-sm font-medium transition-all",
                            !plan.raiseFunds
                              ? "border-clay-400 bg-clay-50 text-clay-700"
                              : "border-clay-200 text-clay-500 hover:border-clay-300"
                          )}
                        >
                          No funds needed
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlan(req.id, { raiseFunds: true })}
                          className={cn(
                            "rounded-xl border-2 px-3 py-2 text-center text-sm font-medium transition-all",
                            plan.raiseFunds
                              ? "border-amber-500 bg-amber-50 text-amber-700"
                              : "border-clay-200 text-clay-500 hover:border-clay-300"
                          )}
                        >
                          Request funds from Finance
                        </button>
                      </div>
                      {plan.raiseFunds && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label htmlFor={`amount-${req.id}`} className="text-sm">Amount *</Label>
                              <Input
                                id={`amount-${req.id}`}
                                type="number"
                                min={1}
                                step="0.01"
                                placeholder="e.g. 2000"
                                value={plan.amount}
                                onChange={(e) => setPlan(req.id, { amount: e.target.value })}
                                className="h-11 rounded-xl"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`currency-${req.id}`} className="text-sm">Currency *</Label>
                              <Input
                                id={`currency-${req.id}`}
                                placeholder="ZMW"
                                value={plan.currency}
                                onChange={(e) => setPlan(req.id, { currency: e.target.value })}
                                className="h-11 rounded-xl"
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`purpose-${req.id}`} className="text-sm">What are the funds for? *</Label>
                            <Textarea
                              id={`purpose-${req.id}`}
                              rows={2}
                              placeholder="e.g. Ingredients and drinks for ~60 attendees"
                              value={plan.purpose}
                              onChange={(e) => setPlan(req.id, { purpose: e.target.value })}
                              className="rounded-xl"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`notes-${req.id}`} className="text-sm">
                        Notes (required to decline)
                      </Label>
                      <Textarea
                        id={`notes-${req.id}`}
                        rows={2}
                        placeholder="Optional notes, or the reason if declining"
                        value={plan.notes}
                        onChange={(e) => setPlan(req.id, { notes: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        className="gap-1.5 rounded-xl bg-green-600 text-white hover:bg-green-700"
                        disabled={busy}
                        onClick={() => handleConfirm(req.id)}
                      >
                        {busy ? <LoadingSpinner size="sm" className="mr-1" /> : <CheckCircle2 className="h-4 w-4" />}
                        Confirm Food
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 rounded-xl border-red-300 text-red-700 hover:bg-red-50"
                        disabled={busy}
                        onClick={() => handleDecline(req.id)}
                      >
                        <XCircle className="h-4 w-4" />
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
