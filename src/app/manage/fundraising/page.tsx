"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { useFundraisingAccess } from "@/hooks/useFundraisingAccess";
import { useFundraisingOrdersAccess } from "@/hooks/useFundraisingOrdersAccess";
import { LoadingSpinner, PageLoader } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  StatCardLux,
  EmptyStateLux,
  SectionHeadingLux,
  luxSurface,
  luxSurfaceHover,
} from "@/components/shared/lux";
import { BraaiGrillArt } from "@/components/shared/illustrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  CalendarClock,
} from "lucide-react";
import { format, isPast, isToday, isTomorrow, formatDistanceToNow } from "date-fns";
import { BRAAI_TOTAL_RESPONSIBILITIES } from "@/lib/braai";
import { cn } from "@/lib/utils";

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
  if (isToday(date)) return { label: "Today", className: "bg-teal/10 text-teal-dark border-teal/30" };
  if (isTomorrow(date)) return { label: "Tomorrow", className: "bg-gold/10 text-gold-dark border-gold/30" };
  if (isPast(date)) return { label: "Past", className: "bg-clay-100 text-clay-500 border-clay-200" };
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

/** Braai grill illustration drawn in code (warm, on-brand, no photo needed). */
function BraaiIllustration() {
  return <BraaiGrillArt size={208} />;
}

/** Evening braai photo thumbnail with a warm gradient fallback. */
function BraaiThumb() {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-gold/35 via-clay-200 to-clay-300 ring-1 ring-inset ring-white/40">
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/images/dashboard/asset-braai-photo-evening.png"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
      {failed && (
        <span className="absolute inset-0 flex items-center justify-center text-gold-dark">
          <Flame className="h-6 w-6" />
        </span>
      )}
    </div>
  );
}

function BraaiCard({ event }: { event: BraaiEventRow }) {
  const date = event.eventDate ? new Date(event.eventDate) : null;
  const badge = date ? dateBadge(date) : null;
  const unconfirmed = event.assignmentCount - event.confirmedCount;
  const open = BRAAI_TOTAL_RESPONSIBILITIES - event.assignmentCount;

  return (
    <Link href={`/manage/fundraising/braai/${event.id}`} className={cn("group block p-5", luxSurface, luxSurfaceHover)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate font-display text-lg font-semibold text-clay-700">{event.title}</h3>
          {date && (
            <div className="flex items-center gap-2 text-sm text-clay-500">
              <Calendar className="h-3.5 w-3.5" />
              <span>{format(date, "EEEE, d MMMM yyyy")}</span>
            </div>
          )}
        </div>
        {badge && (
          <Badge className={cn("shrink-0 border text-xs font-medium", badge.className)}>{badge.label}</Badge>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4 text-sm text-clay-500">
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
          <div className="h-2 w-20 overflow-hidden rounded-full bg-clay-100">
            <div
              className={cn("h-full rounded-full transition-all", readinessColor(event.assignmentCount, BRAAI_TOTAL_RESPONSIBILITIES))}
              style={{ width: `${Math.min((event.assignmentCount / BRAAI_TOTAL_RESPONSIBILITIES) * 100, 100)}%` }}
            />
          </div>
          {open === 0 && (
            <span className="inline-flex items-center text-green-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-clay-300 transition-all group-hover:translate-x-0.5 group-hover:text-gold" />
        </div>
      </div>
    </Link>
  );
}

function PastBraaiCard({ event }: { event: BraaiEventRow }) {
  const date = event.eventDate ? new Date(event.eventDate) : null;
  const fullyStaffed = event.assignmentCount >= BRAAI_TOTAL_RESPONSIBILITIES;
  const allConfirmed = event.confirmedCount >= BRAAI_TOTAL_RESPONSIBILITIES;

  return (
    <Link
      href={`/manage/fundraising/braai/${event.id}`}
      className={cn("group flex items-center gap-4 p-4", luxSurface, luxSurfaceHover)}
    >
      <BraaiThumb />
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-base font-semibold text-clay-700">{event.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-clay-500">
          {date && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(date, "d MMM yyyy")}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Flame className="h-3 w-3 text-gold-dark" />
            Fundraising team
          </span>
        </div>
      </div>
      <Badge
        className={cn(
          "shrink-0 border text-xs font-medium",
          allConfirmed
            ? "border-green-200 bg-green-50 text-green-700"
            : fullyStaffed
            ? "border-teal/30 bg-teal/10 text-teal-dark"
            : "border-clay-200 bg-clay-50 text-clay-500"
        )}
      >
        {allConfirmed
          ? "All confirmed"
          : `${event.confirmedCount}/${BRAAI_TOTAL_RESPONSIBILITIES} confirmed`}
      </Badge>
      <ChevronRight className="h-4 w-4 shrink-0 text-clay-300 transition-all group-hover:translate-x-0.5 group-hover:text-gold" />
    </Link>
  );
}

function FundraisingContent() {
  const { firebaseUser, userData } = useAuth();
  const { canPlanBraai, loading: accessLoading } = useFundraisingAccess();
  const { canManageOrders, loading: ordersAccessLoading } = useFundraisingOrdersAccess();
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
  }, [firebaseUser, accessLoading, ordersAccessLoading, canPlanBraai, canManageOrders, load]);

  const handleCreate = async () => {
    if (!firebaseUser || !newDate) return;
    setSavingNew(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/fundraising/braai/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ title: newTitle, eventDate: newDate, venue: newVenue, notes: newNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast({
        title: "Braai created",
        description: `${data.event.title} scheduled for ${format(new Date(data.event.eventDate), "EEE, d MMM")}.`,
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
      <EmptyStateLux
        icon={Flame}
        title="Fundraising"
        description="The Fundraising department lead can plan braais here. Ask your chairperson to add you to the Fundraising department to access this page."
        tone="clay"
        className="min-h-[60vh] justify-center"
      />
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

  const unconfirmedAcross = events.reduce((sum, e) => sum + (e.assignmentCount - e.confirmedCount), 0);
  const openSeats = upcoming.reduce((sum, e) => sum + (BRAAI_TOTAL_RESPONSIBILITIES - e.assignmentCount), 0);

  return (
    <div className="space-y-7">
      <PageHeader
        icon={Flame}
        tone="gold"
        title="Fundraising"
        description="Plan the Sunday fundraising braai — assign each responsibility to a member of the Fundraising team and follow up on confirmations."
        actions={
          canPlanBraai ? (
            <>
              <Link href="/manage/fundraising/settings">
                <Button variant="outline" className="gap-2 rounded-xl">
                  <Receipt className="h-4 w-4" />
                  Menu &amp; Settings
                </Button>
              </Link>
              <Button className="gap-2 rounded-xl shadow-sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                New Braai
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCardLux
          icon={Calendar}
          tone="teal"
          label="Upcoming Braais"
          value={upcoming.length}
          hint="scheduled ahead"
          accent="bg-teal"
          art={<Flame className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={AlertTriangle}
          tone="blush"
          label="Unassigned Responsibilities"
          value={openSeats}
          hint="still need an owner"
          accent="bg-[#D69AAB]"
          highlight={openSeats > 0}
          art={<Users className="h-24 w-24" strokeWidth={1} />}
        />
        <StatCardLux
          icon={AlertCircle}
          tone="gold"
          label="Awaiting Confirmation"
          value={unconfirmedAcross}
          hint="members to follow up"
          accent="bg-gold"
          highlight={unconfirmedAcross > 0}
          art={<CheckCircle2 className="h-24 w-24" strokeWidth={1} />}
        />
      </div>

      {error && (
        <Card className="border-red-200">
          <CardContent className="flex items-center gap-3 py-6 text-red-600">
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
          <section className="space-y-4">
            <SectionHeadingLux icon={Flame} tone="gold" title="Upcoming Braais" />
            {upcoming.length === 0 ? (
              <div className={cn("relative overflow-hidden", luxSurface)}>
                <div className="grid items-center md:grid-cols-[0.9fr_1.1fr]">
                  <div className="flex items-center justify-center bg-gradient-to-br from-gold/15 via-cream to-white p-6 md:min-h-[220px]">
                    <BraaiIllustration />
                  </div>
                  <div className="p-6 text-center sm:p-8 md:text-left">
                    <h3 className="font-display text-2xl font-bold text-clay-700">No braais planned</h3>
                    <p className="mt-2 text-clay-500">
                      Create a Sunday braai to start assigning responsibilities to your team.
                    </p>
                    {canPlanBraai && (
                      <Button className="mt-6 gap-2 rounded-xl shadow-sm" onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                        New Braai
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((event) => (
                  <BraaiCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section className="space-y-4">
              <SectionHeadingLux icon={CalendarClock} tone="clay" title="Past Braais" />
              <div className="space-y-3">
                {past.map((event) => (
                  <PastBraaiCard key={event.id} event={event} />
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
        <div className="flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/[0.06] p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
            <AlertCircle className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display font-semibold text-clay-700">
              {unconfirmedAcross} braai assignment{unconfirmedAcross === 1 ? "" : "s"} awaiting confirmation
            </p>
            <p className="mt-1 text-sm text-clay-500">
              Members have been notified but have not yet confirmed availability. Tap into each braai to follow up.
            </p>
          </div>
        </div>
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
  const { canManageOrders, loading: orderLoading } = useFundraisingOrdersAccess();
  if (planLoading || orderLoading) return <PageLoader />;
  if (canPlanBraai || canManageOrders) return <FundraisingContent />;
  return (
    <EmptyStateLux
      icon={Flame}
      title="Access Denied"
      description="You don't have permission to view this page."
      tone="clay"
      className="min-h-[60vh] justify-center"
    />
  );
}
