"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useFoodAccess } from "@/hooks/useFoodAccess";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
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
      <EmptyState
        icon={Shield}
        title="Access Denied"
        description="You do not have permission to view food requests."
        tone="clay"
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
        icon={UtensilsCrossed}
        tone="blush"
        title="Food Requests"
        description="Plan catering and confirm food provision for upcoming events"
        actions={
          <Badge variant="outline" className="text-sm">
            {requests.length} pending
          </Badge>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All caught up!"
          description="No food requests are pending."
          tone="sage"
        />
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const plan = getPlan(req.id);
            const busy = submittingId === req.id;
            return (
              <Card key={req.id} className="overflow-hidden">
                <div className="h-1 bg-amber-400" />
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-clay-900">
                    {req.eventTitle}
                  </CardTitle>
                  {req.eventStartDate && (
                    <div className="flex items-center gap-2 text-sm text-clay-600">
                      <Calendar className="h-4 w-4 text-clay-400" />
                      {format(parseISO(req.eventStartDate), "EEE, d MMM yyyy")}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {req.needsDescription && (
                    <div className="text-sm bg-cream/60 rounded-md px-3 py-2">
                      <p className="text-xs font-semibold text-clay-500 uppercase tracking-wide mb-1">
                        Food needs
                      </p>
                      <p className="text-clay-700 whitespace-pre-wrap">
                        {req.needsDescription}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`headcount-${req.id}`} className="text-sm">
                        Headcount
                      </Label>
                      <Input
                        id={`headcount-${req.id}`}
                        type="number"
                        min={1}
                        placeholder="e.g. 60"
                        value={plan.headcount}
                        onChange={(e) => setPlan(req.id, { headcount: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor={`menu-${req.id}`} className="text-sm">
                        Menu plan
                      </Label>
                      <Input
                        id={`menu-${req.id}`}
                        placeholder="e.g. Rice, chicken, salad, drinks"
                        value={plan.menuPlan}
                        onChange={(e) => setPlan(req.id, { menuPlan: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Funds request to Finance */}
                  <div className="rounded-md border border-clay-100/70 p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPlan(req.id, { raiseFunds: false })}
                        className={cn(
                          "rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all text-center",
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
                          "rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all text-center",
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
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2 space-y-1.5">
                            <Label htmlFor={`amount-${req.id}`} className="text-sm">
                              Amount *
                            </Label>
                            <Input
                              id={`amount-${req.id}`}
                              type="number"
                              min={1}
                              step="0.01"
                              placeholder="e.g. 2000"
                              value={plan.amount}
                              onChange={(e) => setPlan(req.id, { amount: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`currency-${req.id}`} className="text-sm">
                              Currency *
                            </Label>
                            <Input
                              id={`currency-${req.id}`}
                              placeholder="ZMW"
                              value={plan.currency}
                              onChange={(e) => setPlan(req.id, { currency: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`purpose-${req.id}`} className="text-sm">
                            What are the funds for? *
                          </Label>
                          <Textarea
                            id={`purpose-${req.id}`}
                            rows={2}
                            placeholder="e.g. Ingredients and drinks for ~60 attendees"
                            value={plan.purpose}
                            onChange={(e) => setPlan(req.id, { purpose: e.target.value })}
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
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                      disabled={busy}
                      onClick={() => handleConfirm(req.id)}
                    >
                      {busy ? (
                        <LoadingSpinner size="sm" className="mr-1" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Confirm Food
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50 gap-1.5"
                      disabled={busy}
                      onClick={() => handleDecline(req.id)}
                    >
                      <XCircle className="h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
