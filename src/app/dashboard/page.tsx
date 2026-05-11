"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { hasMinRole, roleLabels } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import {
  CalendarDays,
  MapPin,
  Clock,
  Users,
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  Bell,
  UserPlus,
  Activity,
  ArrowRight,
  Sparkles,
  GraduationCap,
  UsersRound,
  Heart,
  Music,
  ClipboardCheck,
  CalendarPlus,
  Compass,
  BookOpen,
  Inbox,
  Tent,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type {
  AppEvent,
  Service,
  ServiceAssignment,
  ServiceRole,
  AssignmentStatus,
  EventType,
  Notification,
  Devotional,
  FollowUpCard,
} from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return new Date();
}

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Hero gradient drifts a little with the time of day — morning is cooler & dewy,
// afternoon is warmer gold, evening leans deeper amber. Same palette throughout.
function heroBackground(now: Date): string {
  const h = now.getHours();
  if (h < 12) {
    return "radial-gradient(circle at 0% 0%, rgba(200,150,62,0.13), transparent 45%), radial-gradient(circle at 100% 100%, rgba(74,155,142,0.12), transparent 50%), linear-gradient(135deg, #FFFDF8 0%, #FFFFFF 60%, rgba(74,155,142,0.05) 100%)";
  }
  if (h < 17) {
    return "radial-gradient(circle at 0% 0%, rgba(200,150,62,0.18), transparent 45%), radial-gradient(circle at 100% 100%, rgba(74,155,142,0.08), transparent 50%), linear-gradient(135deg, #FFF8F0 0%, #FFFFFF 55%, rgba(200,150,62,0.10) 100%)";
  }
  return "radial-gradient(circle at 0% 0%, rgba(154,114,48,0.20), transparent 45%), radial-gradient(circle at 100% 100%, rgba(74,155,142,0.10), transparent 55%), linear-gradient(135deg, #FFF8F0 0%, #FAEBD7 55%, rgba(154,114,48,0.12) 100%)";
}

// Tweens a number from its previous value up to the target with an ease-out cubic.
// Avoids any animation dep — small enough to inline.
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (Number.isNaN(target)) return;
    let raf = 0;
    const start = performance.now();
    const initial = prev.current;
    const tick = (t: number) => {
      const elapsed = t - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(initial + (target - initial) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

const EVENT_TYPE_META: Record<
  EventType,
  { label: string; tone: string; icon: React.ElementType }
> = {
  POTTERS_WHEEL_SERVICE: { label: "Service", tone: "bg-gold/10 text-gold-dark", icon: BookOpen },
  ROPS_CAMP: { label: "ROPS Camp", tone: "bg-teal/10 text-teal", icon: Compass },
  RETREAT: { label: "Retreat", tone: "bg-purple-50 text-purple-600", icon: Compass },
  SPECIAL_EVENT: { label: "Special", tone: "bg-blue-50 text-blue-600", icon: Sparkles },
  MEETING: { label: "Meeting", tone: "bg-clay-100 text-clay-600", icon: Users },
  OUTREACH: { label: "Outreach", tone: "bg-emerald-50 text-emerald-600", icon: Heart },
};

// ─── Readiness Ring ──────────────────────────────────────────────────────

function ReadinessRing({
  filled,
  total,
  size = 120,
}: {
  filled: number;
  total: number;
  size?: number;
}) {
  const percentage = total > 0 ? (filled / total) * 100 : 0;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percentage / 100) * circumference;

  const color =
    percentage >= 80 ? "#4A9B8E" : percentage >= 50 ? "#C8963E" : "#EF4444";
  const gradientId = `readiness-grad-${color.replace("#", "")}`;
  const gradientStops =
    percentage >= 80
      ? ["#6DB8AB", "#4A9B8E", "#357A6F"]
      : percentage >= 50
        ? ["#E0B872", "#C8963E", "#9A7230"]
        : ["#FCA5A5", "#EF4444", "#B91C1C"];

  // Animate-in: render the ring at 0% on first paint, then transition to
  // the real offset so it "draws" itself in. Subsequent data changes
  // animate smoothly via the same CSS transition.
  const [hasAnimated, setHasAnimated] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setHasAnimated(true), 80);
    return () => window.clearTimeout(t);
  }, []);
  const renderedOffset = hasAnimated ? dashOffset : circumference;

  const isFull = total > 0 && filled >= total;
  const displayedPercent = useCountUp(Math.round(percentage));

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Soft halo behind the ring */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full blur-2xl opacity-30 transition-colors duration-700"
        style={{ backgroundColor: color }}
      />
      {/* When fully staffed, breathe a gentle teal glow */}
      {isFull && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full animate-ring-glow"
        />
      )}
      <svg
        width={size}
        height={size}
        className="-rotate-90 relative drop-shadow-[0_4px_10px_rgba(91,58,41,0.10)]"
        aria-label={`${filled} of ${total} roles filled`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradientStops[0]} />
            <stop offset="60%" stopColor={gradientStops[1]} />
            <stop offset="100%" stopColor={gradientStops[2]} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#FAEBD7"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={renderedOffset}
          className="transition-all duration-[1100ms] ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-display font-bold text-clay-700 leading-none tabular-nums">
          {total > 0 ? `${filled}/${total}` : "—"}
        </span>
        <span className="text-[10px] text-clay-400 uppercase tracking-[0.16em] mt-1.5">
          Roles Filled
        </span>
        {total > 0 && (
          <span
            className="text-[10px] font-medium mt-0.5 tabular-nums transition-colors duration-700"
            style={{ color }}
          >
            {displayedPercent}%
          </span>
        )}
        {isFull && (
          <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.14em] text-teal">
            <svg
              width="10"
              height="10"
              viewBox="0 0 14 14"
              fill="none"
              className="text-teal"
            >
              <path
                d="M3 7.5 L6 10.5 L11 4.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="24"
                className="animate-draw-check"
              />
            </svg>
            Fully staffed
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Activity Item ───────────────────────────────────────────────────────

function ActivityItem({
  notif,
}: {
  notif: Notification;
}) {
  const meta: Record<string, { icon: React.ElementType; tone: string }> = {
    assignment: { icon: UserPlus, tone: "bg-teal/10 text-teal" },
    reminder: { icon: Bell, tone: "bg-gold/10 text-gold-dark" },
    event: { icon: CalendarDays, tone: "bg-blue-50 text-blue-600" },
    announcement: { icon: Sparkles, tone: "bg-purple-50 text-purple-600" },
  };
  const { icon: Icon, tone } =
    meta[notif.type] || { icon: Activity, tone: "bg-clay-100 text-clay-500" };

  const inner = (
    <div className="flex items-start gap-3 py-3">
      <div
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone} ring-1 ring-inset ring-white/40 shadow-sm`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-clay-700 truncate">
          {notif.title}
        </p>
        <p className="text-xs text-clay-400 truncate mt-0.5">{notif.message}</p>
      </div>
      <span className="text-[11px] text-clay-400 whitespace-nowrap shrink-0 mt-1">
        {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
      </span>
    </div>
  );

  return notif.link ? (
    <Link
      href={notif.link}
      className="block -mx-2 px-2 rounded-lg hover:bg-cream/70 transition-colors"
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}

// ─── Section Header ──────────────────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3 md:mb-4">
      <div className="min-w-0">
        <h2 className="text-base md:text-lg font-display font-semibold text-clay-700">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs md:text-sm text-clay-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && (
        <Link href={action.href} className="shrink-0">
          <Button variant="ghost" size="sm" className="text-xs">
            {action.label}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      )}
    </div>
  );
}

// ─── Focus Card ──────────────────────────────────────────────────────────
// The single most important card on the dashboard, adaptive to the user's
// most urgent state. Members see what's next for them; leaders see what
// needs their attention. Replaces the old "headline + My Next" stack.

type FocusKind =
  | "pending-rsvp"
  | "admin-approvals"
  | "open-roles"
  | "upcoming-assignment"
  | "my-followups"
  | "next-event"
  | "free";

function FocusCard({
  userData,
  myAssignment,
  nextEvent,
  isAdmin,
  isDeptLead,
  pendingApprovalCount,
  openRolesCount,
  myAssignedFollowUps,
  daysUntilNext,
}: {
  userData: { name: string };
  myAssignment:
    | { assignment: ServiceAssignment; event: AppEvent; service: Service }
    | null;
  nextEvent: AppEvent | null;
  isAdmin: boolean;
  isDeptLead: boolean;
  pendingApprovalCount: number;
  openRolesCount: number;
  myAssignedFollowUps: number;
  daysUntilNext: number | null;
}) {
  let kind: FocusKind;
  if (myAssignment?.assignment.status === "PENDING") kind = "pending-rsvp";
  else if (isAdmin && pendingApprovalCount > 0) kind = "admin-approvals";
  else if ((isAdmin || isDeptLead) && openRolesCount > 0 && nextEvent)
    kind = "open-roles";
  else if (myAssignment) kind = "upcoming-assignment";
  else if (myAssignedFollowUps > 0) kind = "my-followups";
  else if (nextEvent) kind = "next-event";
  else kind = "free";

  // Visual treatments per kind — accent rail color, icon tone, CTA variant.
  const palette = {
    "pending-rsvp": {
      tone: "from-gold/15 via-gold-light/10 to-cream",
      icon: Bell,
      iconBg: "bg-gold/15 text-gold-dark ring-gold/30",
      ctaVariant: "gold" as const,
      eyebrowColor: "text-gold-dark",
    },
    "admin-approvals": {
      tone: "from-blue-50/70 via-cream to-cream",
      icon: ClipboardCheck,
      iconBg: "bg-blue-100/80 text-blue-600 ring-blue-200/60",
      ctaVariant: "default" as const,
      eyebrowColor: "text-blue-600",
    },
    "open-roles": {
      tone: "from-red-50/60 via-cream to-cream",
      icon: AlertTriangle,
      iconBg: "bg-red-100/80 text-red-600 ring-red-200/60",
      ctaVariant: "destructive" as const,
      eyebrowColor: "text-red-500",
    },
    "upcoming-assignment": {
      tone: "from-teal/10 via-cream to-cream",
      icon: ClipboardList,
      iconBg: "bg-teal/15 text-teal ring-teal/30",
      ctaVariant: "gold" as const,
      eyebrowColor: "text-teal-dark",
    },
    "my-followups": {
      tone: "from-rose-50/60 via-cream to-cream",
      icon: Heart,
      iconBg: "bg-rose-100/80 text-rose-600 ring-rose-200/60",
      ctaVariant: "gold" as const,
      eyebrowColor: "text-rose-600",
    },
    "next-event": {
      tone: "from-gold/10 via-cream to-cream",
      icon: CalendarDays,
      iconBg: "bg-gold/15 text-gold-dark ring-gold/30",
      ctaVariant: "outline" as const,
      eyebrowColor: "text-gold-dark",
    },
    free: {
      tone: "from-teal/8 via-cream to-cream",
      icon: Sparkles,
      iconBg: "bg-teal/15 text-teal ring-teal/30",
      ctaVariant: "outline" as const,
      eyebrowColor: "text-teal-dark",
    },
  }[kind];

  let eyebrow = "";
  let title = "";
  let body: React.ReactNode = null;
  let cta: { label: string; href: string } | null = null;

  if (kind === "pending-rsvp" && myAssignment) {
    eyebrow = "Action needed";
    title = `Confirm your ${myAssignment.assignment.roleName} role`;
    body = (
      <>
        <span className="font-medium text-clay-700">
          {myAssignment.event.title}
        </span>{" "}
        ·{" "}
        {format(myAssignment.event.startDate, "EEE, MMM d")}
        {myAssignment.service.serviceTime
          ? ` · ${myAssignment.service.serviceTime}`
          : ""}{" "}
        · {myAssignment.event.venue}
      </>
    );
    cta = { label: "Respond now", href: "/my-schedule" };
  } else if (kind === "admin-approvals") {
    eyebrow = "Approvals waiting";
    title = `${pendingApprovalCount} event${
      pendingApprovalCount === 1 ? "" : "s"
    } need your decision`;
    body = "Review and approve so they appear on the calendar.";
    cta = { label: "Review approvals", href: "/manage/events/approvals" };
  } else if (kind === "open-roles" && nextEvent) {
    eyebrow = "Service prep";
    title = `${openRolesCount} role${
      openRolesCount === 1 ? "" : "s"
    } still need filling`;
    body = (
      <>
        For{" "}
        <span className="font-medium text-clay-700">{nextEvent.title}</span> on{" "}
        {format(nextEvent.startDate, "EEE, MMM d")}
        {daysUntilNext !== null
          ? ` · ${
              daysUntilNext === 0
                ? "today"
                : daysUntilNext === 1
                  ? "tomorrow"
                  : `${daysUntilNext} days away`
            }`
          : ""}
      </>
    );
    cta = { label: "Assign roles", href: "/manage/services" };
  } else if (kind === "upcoming-assignment" && myAssignment) {
    eyebrow = "You're up";
    title = `Serving as ${myAssignment.assignment.roleName}`;
    body = (
      <>
        <span className="font-medium text-clay-700">
          {myAssignment.event.title}
        </span>{" "}
        ·{" "}
        {format(myAssignment.event.startDate, "EEE, MMM d")}
        {myAssignment.service.serviceTime
          ? ` · ${myAssignment.service.serviceTime}`
          : ""}{" "}
        · {myAssignment.event.venue}
      </>
    );
    cta = { label: "View details", href: "/my-schedule" };
  } else if (kind === "my-followups") {
    eyebrow = "Follow-ups";
    title = `${myAssignedFollowUps} follow-up${
      myAssignedFollowUps === 1 ? "" : "s"
    } on your plate`;
    body = "People to check in with this week.";
    cta = { label: "Open follow-ups", href: "/department/discipleship" };
  } else if (kind === "next-event" && nextEvent) {
    eyebrow = "Coming up";
    title = nextEvent.title;
    body = (
      <>
        {format(nextEvent.startDate, "EEEE, MMM d")} · {nextEvent.venue}
        {daysUntilNext !== null && daysUntilNext > 0
          ? ` · in ${daysUntilNext} day${daysUntilNext === 1 ? "" : "s"}`
          : ""}
      </>
    );
    cta = { label: "See on calendar", href: "/calendar" };
  } else {
    eyebrow = "All clear";
    title = "Nothing on your plate right now";
    body =
      "Set your availability so leaders know when to call on you for upcoming services.";
    cta = { label: "Set availability", href: "/my-schedule/availability" };
  }

  const Icon = palette.icon;

  return (
    <Card
      className={`relative overflow-hidden border-clay-200/70 bg-gradient-to-br ${palette.tone}`}
    >
      {/* Subtle corner glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gold/15 blur-3xl"
      />
      <CardContent className="relative p-5 md:p-7">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset shadow-sm ${palette.iconBg}`}
          >
            <Icon className="h-5 w-5 md:h-6 md:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`text-[11px] uppercase tracking-[0.18em] font-semibold ${palette.eyebrowColor}`}
            >
              {eyebrow}
            </p>
            <h2 className="text-xl md:text-2xl font-display font-bold text-clay-700 mt-1 leading-tight text-balance">
              {title}
            </h2>
            {body && (
              <p className="text-sm md:text-base text-clay-500 mt-2 leading-relaxed">
                {body}
              </p>
            )}
            {cta && (
              <div className="mt-4 md:mt-5">
                <Link href={cta.href}>
                  <Button
                    variant={palette.ctaVariant}
                    size="sm"
                    className="shadow-sm"
                  >
                    {cta.label}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Quick Actions Strip ─────────────────────────────────────────────────
// Horizontal-scroll chips on mobile so the most-used links are always one
// thumb-tap away without scrolling past the focus card.

type QuickAction = {
  href: string;
  icon: React.ElementType;
  label: string;
  highlight?: boolean;
};

function QuickActionsStrip({ items }: { items: QuickAction[] }) {
  if (!items.length) return null;
  return (
    <div className="-mx-4 md:mx-0">
      <div className="flex gap-2 overflow-x-auto px-4 md:px-0 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {items.map(({ href, icon: Icon, label, highlight }) => (
          <Link
            key={`${href}-${label}`}
            href={href}
            className="group shrink-0 snap-start"
          >
            <div
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full border bg-white/80 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_18px_-10px_rgba(200,150,62,0.45)] ${
                highlight
                  ? "border-gold/50 bg-gold/5 text-clay-700"
                  : "border-clay-200/80 text-clay-600 hover:border-gold/50"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${highlight ? "text-gold-dark" : "text-clay-500 group-hover:text-gold-dark transition-colors"}`}
              />
              <span className="text-sm font-medium whitespace-nowrap">
                {label}
              </span>
              {highlight && (
                <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-gold animate-sparkle-pulse" />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Event Card (used in horizontal carousel) ────────────────────────────

function EventCard({ event }: { event: AppEvent }) {
  const meta = EVENT_TYPE_META[event.type] || EVENT_TYPE_META.MEETING;
  const Icon = meta.icon;
  return (
    <Link
      href="/calendar"
      className="group block w-[78%] sm:w-[55%] md:w-auto shrink-0 snap-start"
    >
      <Card className="h-full relative overflow-hidden border-clay-200/70 bg-gradient-to-br from-white to-cream/60 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-gold/50 group-hover:shadow-[0_18px_38px_-18px_rgba(200,150,62,0.45)]">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-12 -right-12 h-28 w-28 rounded-full bg-gold/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        />
        <CardContent className="relative p-4 md:p-5 flex flex-col gap-3 h-full">
          <div className="flex items-start justify-between gap-3">
            {/* Calendar-tile date chip */}
            <div className="relative flex flex-col items-center justify-center h-14 w-14 shrink-0 rounded-xl bg-white border border-clay-200/80 shadow-sm overflow-hidden">
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-gold to-gold-dark"
              />
              <span className="relative text-[10px] uppercase tracking-wider font-semibold text-white leading-none mt-1">
                {format(event.startDate, "MMM")}
              </span>
              <span className="relative text-xl font-display font-bold text-clay-700 leading-none mt-2 tabular-nums">
                {format(event.startDate, "d")}
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.tone}`}
            >
              <Icon className="h-2.5 w-2.5" />
              {meta.label}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-base font-display font-semibold text-clay-700 leading-tight line-clamp-2">
              {event.title}
            </p>
            <p className="text-xs text-clay-400 mt-1.5 inline-flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{event.venue}</span>
            </p>
          </div>
          <div className="mt-auto pt-1 flex items-center justify-between">
            <span className="text-[11px] text-clay-500">
              {format(event.startDate, "EEE")}
            </span>
            <Badge variant="gold" className="text-[10px]">
              {formatDistanceToNow(event.startDate, { addSuffix: true })}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── Leaders Panel ───────────────────────────────────────────────────────
// Single consolidated card for admins/leads: readiness ring + stat blocks
// + open-roles list. Replaces three previously-separate cards.

function LeadersPanel({
  nextEvent,
  nextService,
  filled,
  total,
  confirmedCount,
  pendingCount,
  openCount,
  unassignedRoles,
  isDeptLead,
}: {
  nextEvent: AppEvent;
  nextService: Service | null;
  filled: number;
  total: number;
  confirmedCount: number;
  pendingCount: number;
  openCount: number;
  unassignedRoles: ServiceRole[];
  isDeptLead: boolean;
}) {
  const confirmedDisplay = useCountUp(confirmedCount);
  const pendingDisplay = useCountUp(pendingCount);
  const openDisplay = useCountUp(openCount);
  const isFull = total > 0 && filled >= total;

  return (
    <Card
      className="relative overflow-hidden border-clay-200/70"
      style={{
        backgroundImage: isFull
          ? "linear-gradient(135deg, #FFFFFF 0%, rgba(74,155,142,0.06) 60%, rgba(74,155,142,0.10) 100%)"
          : "linear-gradient(135deg, #FFFFFF 0%, #FFF8F0 60%, rgba(200,150,62,0.05) 100%)",
      }}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl transition-colors duration-700 ${
          isFull ? "bg-teal/15" : "bg-gold/10"
        }`}
      />
      <CardContent className="relative p-5 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <p
              className={`text-[11px] uppercase tracking-[0.16em] font-semibold ${
                isFull ? "text-teal-dark" : "text-gold-dark"
              }`}
            >
              {isDeptLead ? "Department readiness" : "Service readiness"}
            </p>
            <p className="text-sm text-clay-500 mt-0.5">
              {nextEvent.title} · {format(nextEvent.startDate, "EEE, MMM d")}
              {nextService?.serviceTime ? ` · ${nextService.serviceTime}` : ""}
            </p>
          </div>
          <Link href="/manage/services">
            <Button variant="outline" size="sm">
              Full rota
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {isFull && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-teal/25 bg-teal/8 px-3 py-2 text-xs font-medium text-teal-dark animate-float-up">
            <Sparkles className="h-3.5 w-3.5 animate-sparkle-pulse" />
            <span>Every role is filled. The team is ready.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-5 md:gap-7 items-center">
          <div className="flex justify-center">
            <ReadinessRing filled={filled} total={total} size={130} />
          </div>
          <div className="grid grid-cols-3 gap-2 md:gap-3 text-center">
            <div className="rounded-xl border border-teal/15 bg-white/70 backdrop-blur-sm py-3 md:py-4">
              <p className="text-2xl md:text-3xl font-display font-bold text-teal leading-none tabular-nums">
                {confirmedDisplay}
              </p>
              <p className="text-[10px] md:text-[11px] text-clay-400 uppercase tracking-[0.12em] mt-1.5">
                Confirmed
              </p>
            </div>
            <div className="rounded-xl border border-gold/20 bg-white/70 backdrop-blur-sm py-3 md:py-4">
              <p className="text-2xl md:text-3xl font-display font-bold text-gold-dark leading-none tabular-nums">
                {pendingDisplay}
              </p>
              <p className="text-[10px] md:text-[11px] text-clay-400 uppercase tracking-[0.12em] mt-1.5">
                Pending
              </p>
            </div>
            <div className="rounded-xl border border-red-200/60 bg-white/70 backdrop-blur-sm py-3 md:py-4">
              <p className="text-2xl md:text-3xl font-display font-bold text-red-500 leading-none tabular-nums">
                {openDisplay}
              </p>
              <p className="text-[10px] md:text-[11px] text-clay-400 uppercase tracking-[0.12em] mt-1.5">
                Open
              </p>
            </div>
          </div>
        </div>

        {unassignedRoles.length > 0 && (
          <div className="mt-5 pt-5 border-t border-clay-100">
            <p className="text-[11px] uppercase tracking-[0.14em] text-clay-400 font-medium mb-2.5">
              Roles still open
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {unassignedRoles.slice(0, 8).map((role) => (
                <li key={role.id}>
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-white border border-red-200/70 text-clay-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    {role.name}
                  </span>
                </li>
              ))}
              {unassignedRoles.length > 8 && (
                <li>
                  <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full bg-clay-100 text-clay-500">
                    +{unassignedRoles.length - 8} more
                  </span>
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Explore Tile ────────────────────────────────────────────────────────
// Compact, low-emphasis tile for ministry exploration content (devotionals,
// affirmations, etc). These are reference, not action — so they're smaller.

function ExploreTile({
  href,
  icon: Icon,
  iconTone,
  label,
  sub,
}: {
  href: string;
  icon: React.ElementType;
  iconTone: string;
  label: string;
  sub?: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="relative h-full overflow-hidden border-clay-200/70 bg-white transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-gold/50 group-hover:shadow-[0_10px_24px_-14px_rgba(200,150,62,0.4)]">
        <CardContent className="p-3 md:p-4 flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconTone} ring-1 ring-inset ring-white/40 shadow-sm transition-transform duration-300 group-hover:scale-110`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-clay-700 truncate">
              {label}
            </p>
            {sub && (
              <p className="text-xs text-clay-400 truncate mt-0.5">{sub}</p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-clay-300 shrink-0 group-hover:text-gold group-hover:translate-x-0.5 transition-all" />
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const { userData } = useAuth();
  const now = useMemo(() => new Date(), []);

  // Core service-prep data
  const [nextEvent, setNextEvent] = useState<AppEvent | null>(null);
  const [nextService, setNextService] = useState<Service | null>(null);
  const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
  const [allRoles, setAllRoles] = useState<ServiceRole[]>([]);

  // Personal
  const [myAssignment, setMyAssignment] = useState<{
    assignment: ServiceAssignment;
    event: AppEvent;
    service: Service;
  } | null>(null);

  // Activity & content
  const [recentActivity, setRecentActivity] = useState<Notification[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<AppEvent[]>([]);
  const [latestDevotional, setLatestDevotional] = useState<Devotional | null>(null);

  // Admin/leader pulses
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [activeMemberCount, setActiveMemberCount] = useState(0);
  const [followUps, setFollowUps] = useState<FollowUpCard[]>([]);

  const [loadingCore, setLoadingCore] = useState(true);

  // ─── Subscriptions ─────────────────────────────────────────────────────

  // Next upcoming approved event
  useEffect(() => {
    if (!userData) return;
    const q = query(
      safeCollection("events"),
      where("startDate", ">=", Timestamp.fromDate(new Date())),
      orderBy("startDate", "asc"),
      limit(1)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setNextEvent(null);
          setLoadingCore(false);
          return;
        }
        const d = snap.docs[0];
        const data = d.data();
        setNextEvent({
          id: d.id,
          title: data.title,
          description: data.description ?? null,
          type: data.type,
          startDate: toDate(data.startDate),
          endDate: data.endDate ? toDate(data.endDate) : null,
          venue: data.venue,
          isRecurring: data.isRecurring ?? false,
          createdBy: data.createdBy,
          lifeGroupTarget: data.lifeGroupTarget ?? null,
          approvalStatus: data.approvalStatus ?? "APPROVED",
          approvalComments: data.approvalComments ?? null,
          approvedBy: data.approvedBy ?? null,
          approvedAt: data.approvedAt ? toDate(data.approvedAt) : null,
          createdByDepartmentId: data.createdByDepartmentId ?? null,
          coreRoles: data.coreRoles ?? [],
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        });
      },
      (err) => {
        console.error("dashboard: events listener", err);
        setLoadingCore(false);
      }
    );
    return unsub;
  }, [userData]);

  // Service tied to next event (only for service-type events)
  useEffect(() => {
    if (!nextEvent || nextEvent.type !== "POTTERS_WHEEL_SERVICE") {
      setNextService(null);
      setLoadingCore(false);
      return;
    }
    const q = query(
      safeCollection("services"),
      where("eventId", "==", nextEvent.id),
      limit(1)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setNextService(null);
        } else {
          const d = snap.docs[0];
          const data = d.data();
          setNextService({
            id: d.id,
            eventId: data.eventId,
            theme: data.theme ?? null,
            serviceTime: data.serviceTime,
            programNotes: data.programNotes ?? null,
            attendanceCount: data.attendanceCount ?? null,
            isArchived: data.isArchived ?? false,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
          });
        }
        setLoadingCore(false);
      },
      (err) => {
        console.error("dashboard: services listener", err);
        setLoadingCore(false);
      }
    );
    return unsub;
  }, [nextEvent]);

  // Assignments for the next service
  useEffect(() => {
    if (!nextService) {
      setAssignments([]);
      return;
    }
    const q = query(
      safeCollection("serviceAssignments"),
      where("serviceId", "==", nextService.id)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAssignments(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              serviceId: data.serviceId,
              roleId: data.roleId,
              roleName: data.roleName,
              userId: data.userId,
              userName: data.userName,
              userEmail: data.userEmail,
              userPhone: data.userPhone ?? null,
              status: data.status as AssignmentStatus,
              emailSent: data.emailSent ?? false,
              emailSentAt: data.emailSentAt ? toDate(data.emailSentAt) : null,
              confirmedAt: data.confirmedAt ? toDate(data.confirmedAt) : null,
              notes: data.notes ?? null,
              createdAt: toDate(data.createdAt),
              updatedAt: toDate(data.updatedAt),
            };
          })
        );
      },
      (err) => console.error("dashboard: assignments listener", err)
    );
    return unsub;
  }, [nextService]);

  // All service roles
  useEffect(() => {
    if (!userData) return;
    const q = query(safeCollection("serviceRoles"), orderBy("order", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAllRoles(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name,
              departmentId: data.departmentId,
              description: data.description ?? null,
              emailSubject: data.emailSubject ?? "",
              emailBody: data.emailBody ?? "",
              reminderSchedule: data.reminderSchedule ?? [],
              arrivalTime: data.arrivalTime ?? null,
              timeSlot: data.timeSlot ?? null,
              order: data.order ?? 0,
            };
          })
        );
      },
      (err) => console.error("dashboard: roles listener", err)
    );
    return unsub;
  }, [userData]);

  // The current user's next assignment (across any upcoming service)
  useEffect(() => {
    if (!userData) return;
    const q = query(
      safeCollection("serviceAssignments"),
      where("userId", "==", userData.id)
    );
    const unsub = onSnapshot(
      q,
      async (snap) => {
        if (snap.empty) {
          setMyAssignment(null);
          return;
        }
        const items = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            serviceId: data.serviceId,
            roleName: data.roleName,
            status: data.status as AssignmentStatus,
            createdAt: toDate(data.createdAt),
            raw: data,
          };
        });
        // Find which corresponds to the upcoming service we already loaded
        if (nextService && nextEvent) {
          const match = items.find((i) => i.serviceId === nextService.id);
          if (match) {
            setMyAssignment({
              assignment: {
                id: match.id,
                serviceId: match.serviceId,
                roleId: match.raw.roleId,
                roleName: match.roleName,
                userId: match.raw.userId,
                userName: match.raw.userName,
                userEmail: match.raw.userEmail,
                userPhone: match.raw.userPhone ?? null,
                status: match.status,
                emailSent: match.raw.emailSent ?? false,
                emailSentAt: match.raw.emailSentAt
                  ? toDate(match.raw.emailSentAt)
                  : null,
                confirmedAt: match.raw.confirmedAt
                  ? toDate(match.raw.confirmedAt)
                  : null,
                notes: match.raw.notes ?? null,
                createdAt: match.createdAt,
                updatedAt: toDate(match.raw.updatedAt),
              },
              event: nextEvent,
              service: nextService,
            });
            return;
          }
        }
        setMyAssignment(null);
      },
      (err) => console.error("dashboard: my assignments listener", err)
    );
    return unsub;
  }, [userData, nextService, nextEvent]);

  // Recent notifications
  useEffect(() => {
    if (!userData) return;
    const q = query(
      safeCollection("notifications"),
      where("userId", "==", userData.id),
      orderBy("createdAt", "desc"),
      limit(6)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRecentActivity(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: data.userId,
              title: data.title,
              message: data.message,
              type: data.type,
              isRead: data.isRead ?? false,
              link: data.link ?? null,
              emailStatus: data.emailStatus ?? "not_sent",
              emailDocId: data.emailDocId ?? null,
              emailError: data.emailError ?? null,
              createdAt: toDate(data.createdAt),
            };
          })
        );
      },
      (err) => console.error("dashboard: notifications listener", err)
    );
    return unsub;
  }, [userData]);

  // Upcoming events (next 5 of any type, approved only)
  useEffect(() => {
    if (!userData) return;
    const q = query(
      safeCollection("events"),
      where("startDate", ">=", Timestamp.fromDate(new Date())),
      orderBy("startDate", "asc"),
      limit(8)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: AppEvent[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title,
              description: data.description ?? null,
              type: data.type,
              startDate: toDate(data.startDate),
              endDate: data.endDate ? toDate(data.endDate) : null,
              venue: data.venue,
              isRecurring: data.isRecurring ?? false,
              createdBy: data.createdBy,
              lifeGroupTarget: data.lifeGroupTarget ?? null,
              approvalStatus: data.approvalStatus ?? "APPROVED",
              approvalComments: data.approvalComments ?? null,
              approvedBy: data.approvedBy ?? null,
              approvedAt: data.approvedAt ? toDate(data.approvedAt) : null,
              createdByDepartmentId: data.createdByDepartmentId ?? null,
              coreRoles: data.coreRoles ?? [],
              createdAt: toDate(data.createdAt),
              updatedAt: toDate(data.updatedAt),
            };
          })
          .filter((e) => e.approvalStatus === "APPROVED")
          .slice(0, 5);
        setUpcomingEvents(items);
      },
      (err) => console.error("dashboard: upcoming listener", err)
    );
    return unsub;
  }, [userData]);

  // Latest devotional (this week or most recent)
  useEffect(() => {
    if (!userData) return;
    const q = query(
      safeCollection("devotionals"),
      orderBy("weekStartDate", "desc"),
      limit(1)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setLatestDevotional(null);
          return;
        }
        const d = snap.docs[0];
        const data = d.data();
        setLatestDevotional({
          id: d.id,
          scope: data.scope ?? "CAMPUS_MINISTRY",
          title: data.title,
          content: data.content,
          weekStartDate: data.weekStartDate,
          scriptureReference: data.scriptureReference ?? null,
          authorId: data.authorId,
          authorName: data.authorName,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        });
      },
      (err) => console.error("dashboard: devotional listener", err)
    );
    return unsub;
  }, [userData]);

  // Pending event approvals (admins only)
  useEffect(() => {
    if (!userData || !hasMinRole(userData.role, "ADMIN")) return;
    const q = query(
      safeCollection("events"),
      where("approvalStatus", "==", "PENDING_APPROVAL")
    );
    const unsub = onSnapshot(
      q,
      (snap) => setPendingApprovalCount(snap.size),
      (err) => console.error("dashboard: approvals listener", err)
    );
    return unsub;
  }, [userData]);

  // Active members (admins only)
  useEffect(() => {
    if (!userData || !hasMinRole(userData.role, "ADMIN")) return;
    const q = query(safeCollection("users"), where("isActive", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => setActiveMemberCount(snap.size),
      (err) => console.error("dashboard: members listener", err)
    );
    return unsub;
  }, [userData]);

  // Follow-up cards (admins always; otherwise gated client-side after fetch is fine
  // because rules already restrict access). We listen widely so we can show the
  // right slice for the role; if rules deny the read, we'll just show 0.
  useEffect(() => {
    if (!userData) return;
    const q = query(safeCollection("followUpCards"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setFollowUps(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name,
              phone: data.phone,
              source: data.source,
              sourceDetail: data.sourceDetail,
              status: data.status,
              reason: data.reason ?? null,
              notes: data.notes,
              dateOfContact: toDate(data.dateOfContact),
              assigneeId: data.assigneeId ?? null,
              assigneeName: data.assigneeName ?? null,
              createdBy: data.createdBy,
              createdByName: data.createdByName,
              submittedByRole: data.submittedByRole ?? null,
              approvedBy: data.approvedBy ?? null,
              approvedByName: data.approvedByName ?? null,
              approvedAt: data.approvedAt ? toDate(data.approvedAt) : null,
              rejectionReason: data.rejectionReason ?? null,
              statusHistory: data.statusHistory ?? [],
              createdAt: toDate(data.createdAt),
              updatedAt: toDate(data.updatedAt),
            };
          })
        );
      },
      // Permission denied is expected for some roles — fail silently.
      () => setFollowUps([])
    );
    return unsub;
  }, [userData]);

  // ─── Derivations ───────────────────────────────────────────────────────

  const isAdmin = userData ? hasMinRole(userData.role, "ADMIN") : false;
  const isDeptLead = userData?.role === "DEPARTMENT_LEAD";
  const isYouthLeader = userData?.role === "YOUTH_LEADER";

  const totalRoles = allRoles.length;
  const filledCount = assignments.length;
  const unassignedCount = Math.max(0, totalRoles - filledCount);

  // Days-until-next chip in the hero
  const daysUntilNext = useMemo(() => {
    if (!nextEvent) return null;
    const diff = nextEvent.startDate.getTime() - Date.now();
    if (diff < 0) return 0;
    return Math.ceil(diff / 86400000);
  }, [nextEvent]);

  const myDeptRoleIds = useMemo(() => {
    if (!userData || !isDeptLead) return null;
    const ids = new Set(
      allRoles
        .filter((r) => userData.leadsDepartmentIds.includes(r.departmentId))
        .map((r) => r.id)
    );
    return ids;
  }, [allRoles, userData, isDeptLead]);

  const scopedFilled = isDeptLead && myDeptRoleIds
    ? assignments.filter((a) => myDeptRoleIds.has(a.roleId)).length
    : filledCount;
  const scopedTotal = isDeptLead && myDeptRoleIds
    ? myDeptRoleIds.size
    : totalRoles;

  const unassignedRoles = useMemo(() => {
    const taken = new Set(assignments.map((a) => a.roleId));
    let pool = allRoles.filter((r) => !taken.has(r.id));
    if (isDeptLead && userData) {
      pool = pool.filter((r) =>
        userData.leadsDepartmentIds.includes(r.departmentId)
      );
    }
    return pool;
  }, [allRoles, assignments, isDeptLead, userData]);

  const activeFollowUpCount = useMemo(
    () => followUps.filter((f) => f.status === "NEW_CONTACT").length,
    [followUps]
  );
  const pendingFollowUpApprovalCount = useMemo(
    () => followUps.filter((f) => f.status === "PENDING_LEAD_APPROVAL").length,
    [followUps]
  );
  const myAssignedFollowUps = useMemo(
    () =>
      userData
        ? followUps.filter(
            (f) =>
              f.assigneeId === userData.id &&
              f.status !== "MEMBER" &&
              f.status !== "REJECTED"
          ).length
        : 0,
    [followUps, userData]
  );

  // ─── Department-flavour gating (by name match) ─────────────────────────
  // We don't have department docs loaded here, so gate by the names that the
  // access-control config uses by convention. Anything more involved should
  // live behind usePermissions/checkFeatureAccess.
  const inDept = (names: string[]) => {
    if (!userData) return false;
    if (isAdmin) return true;
    // Without a name->id map we conservatively expose tiles to anyone who
    // leads OR belongs to any department; the linked page enforces real ACLs.
    return (
      userData.leadsDepartmentIds.length > 0 ||
      userData.departmentIds.length > 0
    );
  };
  const showFollowUpsTile = inDept([
    "Discipleship & Follow-Up",
    "Campus Ministry",
    "Life Groups",
  ]);
  const showLatreouTile = isAdmin || inDept(["Worship & Music"]);

  // ─── Quick actions — surface high-value links as one-tap chips ─────────
  const quickActions: QuickAction[] = useMemo(() => {
    const items: QuickAction[] = [];
    items.push({ href: "/my-schedule", icon: Inbox, label: "My schedule" });
    items.push({ href: "/calendar", icon: CalendarDays, label: "Calendar" });
    items.push({
      href: "/notifications",
      icon: Bell,
      label: "Notifications",
      highlight: recentActivity.some((n) => !n.isRead),
    });
    if (isAdmin) {
      items.push({
        href: "/manage/events/approvals",
        icon: ClipboardCheck,
        label: `Approvals${pendingApprovalCount > 0 ? ` · ${pendingApprovalCount}` : ""}`,
        highlight: pendingApprovalCount > 0,
      });
      items.push({
        href: "/manage/services",
        icon: ClipboardList,
        label: "Services",
      });
      items.push({
        href: "/manage/members",
        icon: Users,
        label: `Members · ${activeMemberCount}`,
      });
    }
    if (isDeptLead) {
      items.push({
        href: "/manage/services",
        icon: ClipboardList,
        label: "Services",
      });
    }
    items.push({
      href: "/my-schedule/availability",
      icon: Sparkles,
      label: "Availability",
    });
    return items;
  }, [
    isAdmin,
    isDeptLead,
    pendingApprovalCount,
    activeMemberCount,
    recentActivity,
  ]);

  // ─── Loading guard ─────────────────────────────────────────────────────

  if (!userData) return <PageLoader />;
  if (loadingCore) return <PageLoader />;

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 md:space-y-7">
      {/* ── 1. Compact greeting hero ───────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-2xl border border-clay-200/70 bg-white/70 px-5 py-5 md:px-7 md:py-6 shadow-[0_1px_2px_rgba(91,58,41,0.04),0_10px_28px_-14px_rgba(91,58,41,0.16)]"
        style={{ backgroundImage: heroBackground(now) }}
      >
        {/* Dew-drop pattern overlay — leans into the "Dew of Hermon" name */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="dew-pattern"
              x="0"
              y="0"
              width="44"
              height="44"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="11" cy="11" r="1.6" fill="#5B3A29" />
              <circle cx="33" cy="27" r="1" fill="#5B3A29" />
              <circle cx="20" cy="36" r="0.8" fill="#5B3A29" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dew-pattern)" />
        </svg>

        {/* Decorative orbs */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-gold/18 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-teal/12 blur-3xl"
        />

        {/* Slow shimmer sweep */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <span className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </span>

        <div className="relative">
          <p className="inline-flex items-center gap-2 text-[10px] md:text-[11px] uppercase tracking-[0.18em] text-clay-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold animate-sparkle-pulse" />
            {format(now, "EEEE, MMMM d")}
          </p>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700 mt-1.5 leading-tight">
            {greeting(now)},{" "}
            <span className="bg-gradient-to-r from-clay-700 via-gold-dark to-gold bg-clip-text text-transparent">
              {userData.name.split(" ")[0]}
            </span>
          </h1>
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <Badge variant="gold" className="text-[10px] md:text-xs">
              {roleLabels[userData.role]}
            </Badge>
            {userData.lifeGroup && (
              <Badge
                variant="outline"
                className="text-[10px] md:text-xs bg-white/60 backdrop-blur-sm"
              >
                {userData.lifeGroup} life group
              </Badge>
            )}
            {daysUntilNext !== null && (
              <span className="inline-flex items-center gap-1.5 text-[11px] md:text-xs font-medium px-2.5 py-0.5 rounded-full bg-white/70 backdrop-blur-sm border border-gold/30 text-clay-600 shadow-sm">
                <Clock className="h-3 w-3 text-gold-dark" />
                {daysUntilNext === 0
                  ? "Today"
                  : daysUntilNext === 1
                    ? "Tomorrow"
                    : `${daysUntilNext} days`}
                <span className="text-clay-400 hidden sm:inline">
                  until next
                </span>
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── 2. Focus Card — the most important thing right now ─────── */}
      <FocusCard
        userData={userData}
        myAssignment={myAssignment}
        nextEvent={nextEvent}
        isAdmin={isAdmin}
        isDeptLead={isDeptLead}
        pendingApprovalCount={pendingApprovalCount}
        openRolesCount={
          isDeptLead ? unassignedRoles.length : unassignedCount
        }
        myAssignedFollowUps={myAssignedFollowUps}
        daysUntilNext={daysUntilNext}
      />

      {/* ── 3. Quick actions ──────────────────────────────────────── */}
      <QuickActionsStrip items={quickActions} />

      {/* ── 4. Leaders panel — readiness, stats, open roles ───────── */}
      {(isAdmin || isDeptLead) && nextEvent && (
        <section>
          <LeadersPanel
            nextEvent={nextEvent}
            nextService={nextService}
            filled={isDeptLead ? scopedFilled : filledCount}
            total={isDeptLead ? scopedTotal : totalRoles}
            confirmedCount={
              assignments.filter((a) => a.status === "CONFIRMED").length
            }
            pendingCount={
              assignments.filter((a) => a.status === "PENDING").length
            }
            openCount={unassignedCount}
            unassignedRoles={unassignedRoles}
            isDeptLead={isDeptLead}
          />
        </section>
      )}

      {/* ── 5. Upcoming events — horizontal scroll on mobile ──────── */}
      <section>
        <SectionHeader
          title="Up next"
          subtitle="Services, camps, retreats & meetings"
          action={{ label: "Calendar", href: "/calendar" }}
        />
        {upcomingEvents.length > 0 ? (
          <div className="-mx-4 md:mx-0">
            <div className="flex gap-3 md:gap-4 overflow-x-auto md:overflow-visible px-4 md:px-0 pb-2 snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {upcomingEvents.map((evt) => (
                <EventCard key={evt.id} event={evt} />
              ))}
            </div>
          </div>
        ) : (
          <div className="py-8 md:py-10 text-center rounded-xl border border-dashed border-clay-200/70 bg-cream/40">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/10">
              <CalendarDays className="h-5 w-5 text-gold-dark" />
            </div>
            <p className="text-sm text-clay-500 mt-3">
              No events scheduled.
            </p>
            {isAdmin && (
              <Link href="/manage/events/new">
                <Button variant="outline" size="sm" className="mt-4">
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Create event
                </Button>
              </Link>
            )}
          </div>
        )}
      </section>

      {/* ── 6. Explore — ministry content tiles ──────────────────── */}
      <section>
        <SectionHeader title="Explore" subtitle="Devotionals, life groups, and more" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-3">
          <ExploreTile
            href="/department/campus-ministry"
            icon={BookOpen}
            iconTone="bg-purple-50 text-purple-600"
            label="This week's devotional"
            sub={
              latestDevotional
                ? latestDevotional.scriptureReference ||
                  latestDevotional.title
                : "No devotional yet"
            }
          />
          <ExploreTile
            href="/affirmations"
            icon={Sparkles}
            iconTone="bg-pink-50 text-pink-600"
            label="Affirmations"
            sub="Encouragement for the team"
          />
          <ExploreTile
            href="/rops-camp"
            icon={Tent}
            iconTone="bg-orange-50 text-orange-600"
            label="ROPs Camp"
            sub="Reserve a place by the fire"
          />
          {!isAdmin && userData.lifeGroup && (
            <ExploreTile
              href="/department/life-groups"
              icon={UsersRound}
              iconTone="bg-emerald-50 text-emerald-600"
              label={`${userData.lifeGroup} life group`}
              sub="Devotional & directory"
            />
          )}
          {!isAdmin && userData.isStudent && (
            <ExploreTile
              href="/department/campus-ministry"
              icon={GraduationCap}
              iconTone="bg-indigo-50 text-indigo-600"
              label="Campus ministry"
              sub="Updates from your campus"
            />
          )}
          {showLatreouTile && (
            <ExploreTile
              href="/latreou"
              icon={Music}
              iconTone="bg-amber-50 text-amber-600"
              label="Latreou planner"
              sub="Worship cycles & rehearsals"
            />
          )}
          {showFollowUpsTile && (
            <ExploreTile
              href="/department/discipleship"
              icon={Heart}
              iconTone="bg-rose-50 text-rose-600"
              label="Discipleship"
              sub={
                activeFollowUpCount > 0
                  ? `${activeFollowUpCount} active follow-up${
                      activeFollowUpCount === 1 ? "" : "s"
                    }`
                  : "Follow-up pipeline"
              }
            />
          )}
        </div>
      </section>

      {/* ── 7. Recent activity — compact at the bottom ───────────── */}
      <section>
        <SectionHeader
          title="Recent activity"
          action={
            recentActivity.length > 0
              ? { label: "All", href: "/notifications" }
              : undefined
          }
        />
        <Card className="border-clay-200/70">
          <CardContent className="p-3 md:p-4">
            {recentActivity.length > 0 ? (
              <div className="divide-y divide-clay-100/60">
                {recentActivity.slice(0, 4).map((notif) => (
                  <ActivityItem key={notif.id} notif={notif} />
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-clay-100">
                  <Activity className="h-5 w-5 text-clay-400" />
                </div>
                <p className="text-sm text-clay-400 mt-3">
                  Nothing new to show.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
