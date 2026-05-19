"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { useFundraisingAccess } from "@/hooks/useFundraisingAccess";
import { useFundraisingOrdersAccess } from "@/hooks/useFundraisingOrdersAccess";
import { LoadingSpinner, PageLoader } from "@/components/shared/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  Flame,
  Calendar,
  MapPin,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Users,
  Receipt,
} from "lucide-react";
import { format, isPast, isToday, isTomorrow, formatDistanceToNow } from "date-fns";
import { BRAAI_TOTAL_RESPONSIBILITIES } from "@/lib/braai";

interface BraaiEventRow {
  id: string;
  title: string;
  eventDate: string | null;
  venue: string | null;
  notes: string | null;
  createdBy: string;
  createdByName: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  assignmentCount: number;
  confirmedCount: number;
  declinedCount: number;
}

function dateBadge(date: Date): { label: string; className: string } {
  if (isToday(date))
    return { label: "Today", className: "bg-teal/10 text-teal-dark border-teal/30" };
  if (isTomorrow(date))
    return { label: "Tomorrow", className: "bg-gold/10 text-gold-dark border-gold/30" };
  if (isPast(date))
    return { label: "Past", className: "bg-clay-100 text-clay-500 border-clay-200" };
  return {
    label: formatDistanceToNow(date, { addSuffix: true }),
    className: "bg-cream text-clay-600 border-clay-200",
  };
}

function readinessColor(count: number, total: number): string {
  if (total === 0) return "bg-clay-200";
  const r = count / total;
  if (r >= 1) return "bg-green-500";
  if (r >= 0.7) return "bg-teal";
  if (r >= 0.4) return "bg-gold";
  return "bg-red-500";
}

function BraaiCard({ event }: { event: BraaiEventRow }) {
  const date = event.eventDate ? new Date(event.eventDate) : null;
  const badge = date ? dateBadge(date) : null;
  const unconfirmed = event.assignmentCount - event.confirmedCount;
  const open = BRAAI_TOTAL_RESPONSIBILITIES - event.assignmentCount;

  return (
    <Link href={`/manage/fundraising/braai/${event.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer border-clay-200 hover:border-clay-300">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-lg font-display text-clay-700 truncate">
                {event.title}
              </CardTitle>
              {date && (
                <div className="flex items-center gap-2 text-sm text-clay-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(date, "EEEE, d MMMM yyyy")}</span>
                </div>
              )}
            </div>
            {badge && (
              <Badge className={`${badge.className} border text-xs font-medium shrink-0`}>
                {badge.label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-4 text-sm text-clay-500 min-w-0">
              {event.venue && (
                <span className="inline-flex items-center gap-1 truncate">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate">{event.venue}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {event.assignmentCount}/{BRAAI_TOTAL_RESPONSIBILITIES}
              </span>
              {unconfirmed > 0 && (
                <span className="inline-flex items-center gap-1 text-gold-dark">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {unconfirmed} unconfirmed
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-20 h-2 bg-clay-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${readinessColor(event.assignmentCount, BRAAI_TOTAL_RESPONSIBILITIES)}`}
                  style={{
                    width: `${Math.min(
                      (event.assignmentCount / BRAAI_TOTAL_RESPONSIBILITIES) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
              {open === 0 && (
                <span className="inline-flex items-center text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-clay-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function FundraisingContent() {
  const { firebaseUser, userData } = useAuth();
  const { canPlanBraai, loading: accessLoading } = useFundraisingAccess();
  const { canManageOrders, loading: ordersAccessLoading } =
    useFundraisingOrdersAccess();
  const { toast } = useToast();

  const [events, setEvents] = useState<BraaiEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [newTitle, setNewTitle] = useState("Sunday Fundraising Braai");
  const [newDate, setNewDate] = useState("");
  const [newVenue, setNewVenue] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    setError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/fundraising/braai/events", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setEvents(data.events || []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load braais");
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || accessLoading || ordersAccessLoading) return;
    if (!canPlanBraai && !canManageOrders) {
      setLoading(false);
      return;
    }
    load();
  }, [
    firebaseUser,
    accessLoading,
    ordersAccessLoading,
    canPlanBraai,
    canManageOrders,
    load,
  ]);

  const handleCreate = async () => {
    if (!firebaseUser || !newDate) return;
    setSavingNew(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/fundraising/braai/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          title: newTitle,
          eventDate: newDate,
          venue: newVenue,
          notes: newNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast({
        title: "Braai created",
        description: `${data.event.title} scheduled for ${format(
          new Date(data.event.eventDate),
          "EEE, d MMM"
        )}.`,
        variant: "success",
      });
      setDialogOpen(false);
      setNewTitle("Sunday Fundraising Braai");
      setNewDate("");
      setNewVenue("");
      setNewNotes("");
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create braai";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSavingNew(false);
    }
  };

  if (accessLoading || ordersAccessLoading) return <PageLoader />;

  if (!canPlanBraai && !canManageOrders) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center max-w-md">
          <Flame className="h-12 w-12 text-clay-300 mx-auto mb-4" />
          <h2 className="text-2xl font-display text-clay-700">Fundraising</h2>
          <p className="mt-2 text-clay-500">
            The Fundraising department lead can plan braais here. Ask your chairperson
            to add you to the Fundraising department to access this page.
          </p>
        </div>
      </div>
    );
  }

  const upcoming = events.filter((e) => {
    if (e.isArchived) return false;
    const d = e.eventDate ? new Date(e.eventDate) : null;
    return !d || !isPast(d) || isToday(d);
  });
  const past = events.filter((e) => {
    const d = e.eventDate ? new Date(e.eventDate) : null;
    return d && isPast(d) && !isToday(d);
  });

  const unconfirmedAcross = events.reduce(
    (sum, e) => sum + (e.assignmentCount - e.confirmedCount),
    0
  );
  const openSeats = upcoming.reduce(
    (sum, e) => sum + (BRAAI_TOTAL_RESPONSIBILITIES - e.assignmentCount),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold text-clay-700 flex items-center gap-2">
            <Flame className="h-7 w-7 text-gold-dark" />
            Fundraising
          </h1>
          <p className="mt-1 text-clay-500">
            Plan the Sunday fundraising braai — assign each responsibility to a
            member of the Fundraising team and follow up on confirmations.
          </p>
        </div>
        {canPlanBraai && (
          <div className="flex gap-2">
            <Link href="/manage/fundraising/settings">
              <Button variant="outline" className="gap-2">
                <Receipt className="h-4 w-4" />
                Menu & Settings
              </Button>
            </Link>
            <Button className="gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              New Braai
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-teal/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-teal" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-clay-700">{upcoming.length}</p>
                <p className="text-sm text-clay-500">Upcoming braais</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-clay-700">{openSeats}</p>
                <p className="text-sm text-clay-500">Unassigned responsibilities</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gold/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-gold-dark" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-clay-700">{unconfirmedAcross}</p>
                <p className="text-sm text-clay-500">Awaiting confirmation</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-red-200">
          <CardContent className="py-6 flex items-center gap-3 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <div className="flex-1">{error}</div>
            <Button variant="outline" size="sm" onClick={load}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          <section>
            <h2 className="text-lg font-display font-semibold text-clay-700 mb-3">
              Upcoming
            </h2>
            {upcoming.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Flame className="h-12 w-12 text-clay-300 mx-auto mb-4" />
                  <h3 className="text-lg font-display text-clay-600 mb-2">
                    No braais planned
                  </h3>
                  <p className="text-sm text-clay-400 mb-4">
                    Create a Sunday braai to start assigning responsibilities to your team.
                  </p>
                  <Button variant="outline" className="gap-2" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    New Braai
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcoming.map((event) => (
                  <BraaiCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-display font-semibold text-clay-700 mb-3">
                Past braais
              </h2>
              <div className="space-y-3">
                {past.map((event) => (
                  <BraaiCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New fundraising braai</DialogTitle>
            <DialogDescription>
              Schedule a Sunday braai. You can assign responsibilities once it&apos;s created.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="braai-title">Title</Label>
              <Input
                id="braai-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Sunday Fundraising Braai"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="braai-date">Date</Label>
              <Input
                id="braai-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="braai-venue">Venue</Label>
              <Input
                id="braai-venue"
                value={newVenue}
                onChange={(e) => setNewVenue(e.target.value)}
                placeholder="Church grounds"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="braai-notes">Notes (optional)</Label>
              <Textarea
                id="braai-notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Anything the team should know..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={savingNew}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newDate || savingNew} variant="gold">
              {savingNew ? <LoadingSpinner size="sm" className="mr-2" /> : <Plus className="mr-2 h-4 w-4" />}
              Create braai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {userData?.role === "SUPER_ADMIN" && unconfirmedAcross > 0 && (
        <Card className="border-gold/30 bg-gold/5">
          <CardContent className="p-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-gold-dark mt-0.5 shrink-0" />
            <div>
              <p className="font-display font-semibold text-clay-700">
                {unconfirmedAcross} braai assignment{unconfirmedAcross === 1 ? "" : "s"} awaiting confirmation
              </p>
              <p className="text-sm text-clay-500 mt-1">
                Members have been notified but have not yet confirmed availability. Tap into each braai to follow up.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function FundraisingPage() {
  return (
    <RoleProtected pageKey="fundraising" fallback={<FundraisingFallbackWrapper />}>
      <FundraisingContent />
    </RoleProtected>
  );
}

/**
 * Fallback wrapper that still respects the Fundraising lead exception so that
 * a DEPARTMENT_LEAD of the Fundraising department can access the page even if
 * the page-level access control says "none" for their role.
 */
function FundraisingFallbackWrapper() {
  const { canPlanBraai, loading: planLoading } = useFundraisingAccess();
  const { canManageOrders, loading: orderLoading } =
    useFundraisingOrdersAccess();
  if (planLoading || orderLoading) return <PageLoader />;
  if (canPlanBraai || canManageOrders) return <FundraisingContent />;
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-display text-clay-700">Access Denied</h2>
        <p className="mt-2 text-clay-500">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    </div>
  );
}
