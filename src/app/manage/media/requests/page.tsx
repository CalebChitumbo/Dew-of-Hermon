"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { getDocs, query, where } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useMediaAccess } from "@/hooks/useMediaAccess";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyStateLux, SoftWaves, DecorImage, luxSurface } from "@/components/shared/lux";
import { MediaScene } from "@/components/shared/illustrations";
import {
  Clapperboard,
  Calendar,
  CheckCircle2,
  XCircle,
  Shield,
  Volume2,
  Megaphone,
  Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaReq {
  id: string;
  eventTitle: string;
  eventStartDate: string | null;
  needsDescription: string;
  status: string;
}

interface Member {
  id: string;
  name: string;
}

interface Pick {
  sound: string;
  publicity: string;
  coverage: string;
  notes: string;
}

const EMPTY_PICK: Pick = { sound: "", publicity: "", coverage: "", notes: "" };

const ROLE_META: { label: string; key: keyof Pick; icon: React.ElementType }[] = [
  { label: "Sound", key: "sound", icon: Volume2 },
  { label: "Publicity", key: "publicity", icon: Megaphone },
  { label: "Coverage", key: "coverage", icon: Camera },
];

export default function MediaRequestsPage() {
  const { canManageMedia, loading: accessLoading } = useMediaAccess();
  const { toast } = useToast();

  const [requests, setRequests] = useState<MediaReq[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, Pick>>({});

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media-requests?status=PENDING_MEDIA");
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManageMedia) fetchRequests();
  }, [canManageMedia, fetchRequests]);

  useEffect(() => {
    if (!canManageMedia) return;
    (async () => {
      try {
        const snap = await getDocs(
          query(safeCollection("users"), where("isActive", "==", true))
        );
        setMembers(
          snap.docs
            .map((d) => ({ id: d.id, name: (d.data().name as string) || "Unknown" }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch {
        setMembers([]);
      }
    })();
  }, [canManageMedia]);

  const getPick = (id: string): Pick => picks[id] || EMPTY_PICK;
  const setPick = (id: string, patch: Partial<Pick>) =>
    setPicks((p) => ({ ...p, [id]: { ...getPick(id), ...patch } }));
  const nameOf = (uid: string) => members.find((m) => m.id === uid)?.name || null;

  async function handleConfirm(id: string) {
    const pick = getPick(id);
    if (!pick.sound || !pick.publicity || !pick.coverage) {
      toast({
        title: "Assign all three roles",
        description: "Sound, Publicity, and Coverage must all be assigned to confirm.",
        variant: "destructive",
      });
      return;
    }
    setSubmittingId(id);
    try {
      const res = await fetch(`/api/media-requests/${id}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CONFIRM",
          soundUserId: pick.sound,
          soundUserName: nameOf(pick.sound),
          publicityUserId: pick.publicity,
          publicityUserName: nameOf(pick.publicity),
          coverageUserId: pick.coverage,
          coverageUserName: nameOf(pick.coverage),
          comments: pick.notes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to confirm");
      toast({ title: "Media confirmed", variant: "success" });
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
    const pick = getPick(id);
    if (!pick.notes.trim()) {
      toast({
        title: "Reason required",
        description: "Add a note explaining why media cannot be provided.",
        variant: "destructive",
      });
      return;
    }
    setSubmittingId(id);
    try {
      const res = await fetch(`/api/media-requests/${id}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DECLINE", comments: pick.notes.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to decline");
      toast({ title: "Media request declined", variant: "success" });
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

  if (!canManageMedia) {
    return (
      <EmptyStateLux
        icon={Shield}
        title="Access Denied"
        description="You do not have permission to view media requests."
        tone="clay"
        action={
          <Link href="/calendar">
            <Button variant="outline" className="rounded-xl">Back to Calendar</Button>
          </Link>
        }
      />
    );
  }

  const memberOptions = (
    <>
      <option value="">Unassigned</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </>
  );

  const pendingCount = requests.length;

  return (
    <div className="space-y-7">
      <PageHeader
        backHref="/calendar"
        icon={Clapperboard}
        tone="periwinkle"
        title="Media Requests"
        description="Assign Sound, Publicity, and Coverage for upcoming events"
        actions={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold",
              pendingCount > 0
                ? "bg-[#E6E8F6] text-[#6E74B8]"
                : "bg-emerald-50 text-emerald-600"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", pendingCount > 0 ? "bg-[#6E74B8]" : "bg-emerald-500")} />
            {pendingCount} pending
          </span>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : requests.length === 0 ? (
        <div className={cn("relative overflow-hidden", luxSurface)}>
          <SoftWaves className="absolute inset-x-0 bottom-0 h-28 w-full text-[#6E74B8]/10" />
          <DecorImage
            src="/images/dashboard/asset-soft-waves.png"
            className="absolute inset-x-0 bottom-0 h-28 w-full object-cover opacity-30"
          />
          <EmptyStateLux
            illustration={<MediaScene />}
            tone="periwinkle"
            title="All caught up!"
            description="No media requests are pending."
            note={
              <>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>
                  You&apos;re all set. New media requests will appear here once they&apos;re created.
                </span>
              </>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const pick = getPick(req.id);
            const busy = submittingId === req.id;
            return (
              <div key={req.id} className={cn("overflow-hidden", luxSurface)}>
                <div className="h-1.5 bg-gradient-to-r from-[#6E74B8] to-[#8A90C8]" />
                <div className="p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#E6E8F6] text-[#6E74B8]">
                      <Clapperboard className="h-5 w-5" />
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
                          Media needs
                        </p>
                        <p className="whitespace-pre-wrap text-clay-700">{req.needsDescription}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {ROLE_META.map(({ label, key, icon: Icon }) => (
                        <div key={key} className="space-y-1.5">
                          <Label className="flex items-center gap-1.5 text-sm">
                            <Icon className="h-3.5 w-3.5 text-[#6E74B8]" />
                            {label} *
                          </Label>
                          <select
                            className="h-11 w-full rounded-xl border border-clay-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-700 focus-visible:ring-offset-2 ring-offset-cream"
                            value={pick[key]}
                            onChange={(e) => setPick(req.id, { [key]: e.target.value })}
                          >
                            {memberOptions}
                          </select>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`notes-${req.id}`} className="text-sm">
                        Notes (required to decline)
                      </Label>
                      <Textarea
                        id={`notes-${req.id}`}
                        rows={2}
                        placeholder="Optional notes, or the reason if declining"
                        value={pick.notes}
                        onChange={(e) => setPick(req.id, { notes: e.target.value })}
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
                        Confirm Media
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
