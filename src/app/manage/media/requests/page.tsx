"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { getDocs, query, where } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useMediaAccess } from "@/hooks/useMediaAccess";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  ArrowLeft,
  Clapperboard,
  Calendar,
  CheckCircle2,
  XCircle,
  Shield,
} from "lucide-react";

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
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-700">
          Access Denied
        </h2>
        <p className="text-clay-500 mt-2">
          You do not have permission to view media requests.
        </p>
        <Link href="/calendar" className="mt-4">
          <Button variant="outline">Back to Calendar</Button>
        </Link>
      </div>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/calendar">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-900 flex items-center gap-2">
            <Clapperboard className="h-6 w-6 text-[#C8963E]" />
            Media Requests
          </h1>
          <p className="text-sm text-clay-500 mt-1">
            Assign Sound, Publicity, and Coverage for upcoming events
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {requests.length} pending
        </Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <h3 className="font-display font-semibold text-clay-700 text-lg">
              All caught up!
            </h3>
            <p className="text-clay-500 mt-2">No media requests are pending.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const pick = getPick(req.id);
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
                    <div className="text-sm bg-clay-50 rounded-md px-3 py-2">
                      <p className="text-xs font-semibold text-clay-500 uppercase tracking-wide mb-1">
                        Media needs
                      </p>
                      <p className="text-clay-700 whitespace-pre-wrap">
                        {req.needsDescription}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(
                      [
                        ["Sound", "sound"],
                        ["Publicity", "publicity"],
                        ["Coverage", "coverage"],
                      ] as const
                    ).map(([label, key]) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-sm">{label} *</Label>
                        <select
                          className="w-full rounded-md border border-clay-200 bg-white px-3 py-2 text-sm"
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
                      Confirm Media
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
