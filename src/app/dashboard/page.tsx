"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import {
  CalendarDays,
  Calendar,
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
  Flame,
} from "lucide-react";
import { useFundraisingAccess } from "@/hooks/useFundraisingAccess";
import { BRAAI_TOTAL_RESPONSIBILITIES } from "@/lib/braai";
import { cn } from "@/lib/utils";
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
  onDark = false,
}: {
  filled: number;
  total: number;
  size?: number;
  onDark?: boolean;
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

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="-rotate-90 relative"
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
          stroke={onDark ? "rgba(255,255,255,0.16)" : "#FAEBD7"}
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
          strokeDashoffset={dashOffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "text-3xl font-display font-bold leading-none",
            onDark ? "text-cream" : "text-clay-700"
          )}
        >
          {total > 0 ? `${filled}/${total}` : "—"}
        </span>
        <span
          className={cn(
            "text-[10px] uppercase tracking-[0.16em] mt-1.5",
            onDark ? "text-cream/60" : "text-clay-400"
          )}
        >
          Roles Filled
        </span>
        {total > 0 && (
          <span
            className="text-[10px] font-medium mt-0.5"
            style={{ color }}
          >
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Pulse Tile ──────────────────────────────────────────────────────────

// A flat, number-forward metric for the bento strip.
function MetricTile({
  href,
  icon: Icon,
  label,
  value,
  hint,
  accent = "clay",
  highlight = false,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: "clay" | "gold" | "teal" | "rose" | "blue";
  highlight?: boolean;
}) {
  const accentText = {
    clay: "text-clay-700",
    gold: "text-gold-dark",
    teal: "text-teal",
    rose: "text-rose-600",
    blue: "text-blue-600",
  }[accent];
  return (
    <Link href={href} className="group block focus:outline-none">
      <div
        className={cn(
          "relative flex h-full flex-col justify-between gap-3 rounded-2xl border bg-white p-4 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-sm group-focus-visible:ring-2 group-focus-visible:ring-gold/50",
          highlight
            ? "border-red-200"
            : "border-clay-200 group-hover:border-gold/40"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream text-clay-500 ring-1 ring-inset ring-clay-100">
            <Icon className="h-4 w-4" />
          </span>
          {highlight ? (
            <span aria-hidden className="h-2 w-2 rounded-full bg-red-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-clay-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gold-dark" />
          )}
        </div>
        <div>
          <p
            className={cn(
              "font-display text-[1.7rem] font-bold leading-none",
              accentText
            )}
          >
            {value}
          </p>
          <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-clay-400">
            {label}
          </p>
          {hint && (
            <p className="mt-0.5 truncate text-xs text-clay-400">{hint}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

// A horizontal launcher row used in the "Explore" module grid.
function ModuleLink({
  href,
  icon: Icon,
  label,
  hint,
  iconTone,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  hint?: string;
  iconTone: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-clay-200 bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          iconTone
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-clay-700">
          {label}
        </span>
        {hint && (
          <span className="block truncate text-xs text-clay-400">{hint}</span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-clay-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gold-dark" />
    </Link>
  );
}

// A single row in the vertical "Upcoming" timeline.
function AgendaItem({
  event,
  isLast,
}: {
  event: AppEvent;
  isLast: boolean;
}) {
  const meta = EVENT_TYPE_META[event.type] || EVENT_TYPE_META.MEETING;
  const Icon = meta.icon;
  return (
    <li className="relative flex gap-4">
      <div className="flex w-10 shrink-0 flex-col items-center pt-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gold-dark">
          {format(event.startDate, "MMM")}
        </span>
        <span className="font-display text-2xl font-bold leading-none text-clay-700">
          {format(event.startDate, "d")}
        </span>
      </div>
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset ring-white/40",
            meta.tone
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        {!isLast && <span className="mt-1 w-px flex-1 bg-clay-200" />}
      </div>
      <Link
        href="/calendar"
        className="group -mx-2 mb-4 -mt-0.5 min-w-0 flex-1 rounded-lg px-2 py-1 transition-colors hover:bg-cream/60"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-clay-700">
            {event.title}
          </p>
          <Badge variant="outline" className="bg-white px-1.5 py-0 text-[10px]">
            {meta.label}
          </Badge>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-clay-400">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(event.startDate, "EEE, MMM d")}
          </span>
          <span className="inline-flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3" />
            {event.venue}
          </span>
        </p>
      </Link>
    </li>
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

// ─── Main Dashboard ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const { firebaseUser, userData } = useAuth();
  const { canPlanBraai } = useFundraisingAccess();
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

  // Fundraising braai (for chairperson + Fundraising lead)
  const [nextBraai, setNextBraai] = useState<{
    id: string;
    title: string;
    eventDate: Date;
    venue: string | null;
  } | null>(null);
  const [braaiAssignmentCount, setBraaiAssignmentCount] = useState(0);
  const [braaiConfirmedCount, setBraaiConfirmedCount] = useState(0);
  const [braaiPendingCount, setBraaiPendingCount] = useState(0);

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
          speaker: data.speaker ?? null,
          objective: data.objective ?? null,
          isPaid: data.isPaid ?? false,
          attendanceFee: data.attendanceFee ?? null,
          attendanceFeeCurrency: data.attendanceFeeCurrency ?? null,
          transportRequired: data.transportRequired ?? false,
          transportNeeds: data.transportNeeds ?? null,
          transportRequestId: data.transportRequestId ?? null,
          budgetRequested: data.budgetRequested ?? false,
          budgetAmount: data.budgetAmount ?? null,
          budgetCurrency: data.budgetCurrency ?? null,
          budgetPurpose: data.budgetPurpose ?? null,
          budgetRequestId: data.budgetRequestId ?? null,
          mediaRequired: data.mediaRequired ?? false,
          mediaNeeds: data.mediaNeeds ?? null,
          mediaRequestId: data.mediaRequestId ?? null,
          foodRequired: data.foodRequired ?? false,
          foodNeeds: data.foodNeeds ?? null,
          foodRequestId: data.foodRequestId ?? null,
          viceChairApprovedBy: data.viceChairApprovedBy ?? null,
          viceChairApprovedAt: data.viceChairApprovedAt ? toDate(data.viceChairApprovedAt) : null,
          chairApprovedBy: data.chairApprovedBy ?? null,
          chairApprovedAt: data.chairApprovedAt ? toDate(data.chairApprovedAt) : null,
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
              speaker: data.speaker ?? null,
              objective: data.objective ?? null,
              isPaid: data.isPaid ?? false,
              attendanceFee: data.attendanceFee ?? null,
              attendanceFeeCurrency: data.attendanceFeeCurrency ?? null,
              transportRequired: data.transportRequired ?? false,
              transportNeeds: data.transportNeeds ?? null,
              transportRequestId: data.transportRequestId ?? null,
              budgetRequested: data.budgetRequested ?? false,
              budgetAmount: data.budgetAmount ?? null,
              budgetCurrency: data.budgetCurrency ?? null,
              budgetPurpose: data.budgetPurpose ?? null,
              budgetRequestId: data.budgetRequestId ?? null,
              mediaRequired: data.mediaRequired ?? false,
              mediaNeeds: data.mediaNeeds ?? null,
              mediaRequestId: data.mediaRequestId ?? null,
              foodRequired: data.foodRequired ?? false,
              foodNeeds: data.foodNeeds ?? null,
              foodRequestId: data.foodRequestId ?? null,
              viceChairApprovedBy: data.viceChairApprovedBy ?? null,
              viceChairApprovedAt: data.viceChairApprovedAt ? toDate(data.viceChairApprovedAt) : null,
              chairApprovedBy: data.chairApprovedBy ?? null,
              chairApprovedAt: data.chairApprovedAt ? toDate(data.chairApprovedAt) : null,
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

  // Pending event approvals (admins only) — counts events anywhere in the
  // approval chain (awaiting dispatch, stakeholders, Vice Chair, or Chair).
  useEffect(() => {
    if (!userData || !hasMinRole(userData.role, "ADMIN")) return;
    const q = query(
      safeCollection("events"),
      where("approvalStatus", "in", [
        "PENDING_DISPATCH",
        "PENDING_STAKEHOLDERS",
        "PENDING_VICE_CHAIR",
        "PENDING_CHAIR",
      ])
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

  // Next upcoming fundraising braai for the dashboard tile.
  //
  // We pull from the API (which uses the Admin SDK and so works even before
  // the new Firestore rules for braaiEvents/braaiAssignments have been
  // deployed) and then layer a real-time listener on top as an enhancement.
  // Without the API fallback, an undeployed-rules state would show "No braai
  // scheduled yet" indefinitely because the listener silently fails with
  // permission-denied.
  const fetchNextBraaiViaApi = useCallback(async () => {
    if (!firebaseUser || !canPlanBraai) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/fundraising/braai/events", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const events = (data.events || []) as Array<{
        id: string;
        title: string;
        eventDate: string | null;
        venue: string | null;
        isArchived: boolean;
        assignmentCount: number;
        confirmedCount: number;
        declinedCount: number;
      }>;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const upcoming = events
        .filter(
          (e) =>
            !e.isArchived &&
            e.eventDate &&
            new Date(e.eventDate).getTime() >= todayStart.getTime()
        )
        .sort(
          (a, b) =>
            new Date(a.eventDate as string).getTime() -
            new Date(b.eventDate as string).getTime()
        );
      const next = upcoming[0];
      if (!next) {
        setNextBraai(null);
        setBraaiAssignmentCount(0);
        setBraaiConfirmedCount(0);
        setBraaiPendingCount(0);
        return;
      }
      setNextBraai({
        id: next.id,
        title: next.title || "Sunday Fundraising Braai",
        eventDate: new Date(next.eventDate as string),
        venue: next.venue || null,
      });
      setBraaiAssignmentCount(next.assignmentCount);
      setBraaiConfirmedCount(next.confirmedCount);
      setBraaiPendingCount(
        Math.max(
          0,
          next.assignmentCount - next.confirmedCount - next.declinedCount
        )
      );
    } catch (err) {
      console.warn("dashboard: braai API fetch failed", err);
    }
  }, [firebaseUser, canPlanBraai]);

  useEffect(() => {
    if (!userData || !canPlanBraai) {
      setNextBraai(null);
      setBraaiAssignmentCount(0);
      setBraaiConfirmedCount(0);
      setBraaiPendingCount(0);
      return;
    }
    fetchNextBraaiViaApi();
  }, [userData, canPlanBraai, fetchNextBraaiViaApi]);

  // Real-time enhancement: when the (eventually deployed) Firestore rules
  // allow client reads, keep the tile fresh as people get assigned. We only
  // *overwrite* the state when the listener returns data — a silent failure
  // (permission-denied) leaves the API-driven state intact.
  useEffect(() => {
    if (!userData || !canPlanBraai) return;
    const windowStart = new Date();
    windowStart.setHours(0, 0, 0, 0);
    windowStart.setDate(windowStart.getDate() - 1);
    const q = query(
      safeCollection("braaiEvents"),
      where("eventDate", ">=", Timestamp.fromDate(windowStart)),
      orderBy("eventDate", "asc"),
      limit(5)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const next = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: (data.title as string) || "Sunday Fundraising Braai",
              eventDate: toDate(data.eventDate),
              venue: (data.venue as string | null) || null,
              isArchived: Boolean(data.isArchived),
            };
          })
          .filter((b) => !b.isArchived && b.eventDate >= todayStart)
          .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime())[0];
        if (next) {
          setNextBraai({
            id: next.id,
            title: next.title,
            eventDate: next.eventDate,
            venue: next.venue,
          });
        }
      },
      (err) => console.warn("dashboard: braai listener", err.message)
    );
    return unsub;
  }, [userData, canPlanBraai]);

  // Real-time assignment tally for the next braai. Same fall-through pattern:
  // the API fetch above seeded the counts, and this listener keeps them live
  // when Firestore rules permit client reads.
  useEffect(() => {
    if (!nextBraai || !canPlanBraai) return;
    const q = query(
      safeCollection("braaiAssignments"),
      where("braaiEventId", "==", nextBraai.id)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        let confirmed = 0;
        let pending = 0;
        snap.docs.forEach((d) => {
          const status = d.data().status;
          if (status === "CONFIRMED") confirmed += 1;
          else if (status === "PENDING") pending += 1;
        });
        setBraaiAssignmentCount(snap.size);
        setBraaiConfirmedCount(confirmed);
        setBraaiPendingCount(pending);
      },
      (err) =>
        console.warn("dashboard: braai assignment listener", err.message)
    );
    return unsub;
  }, [nextBraai, canPlanBraai]);

  // Re-fetch when the tab regains focus so a braai you just created in
  // another tab — or the rules being freshly deployed — shows up promptly.
  useEffect(() => {
    if (!canPlanBraai) return;
    const onFocus = () => fetchNextBraaiViaApi();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [canPlanBraai, fetchNextBraaiViaApi]);

  // ─── Derivations ───────────────────────────────────────────────────────

  const isAdmin = userData ? hasMinRole(userData.role, "ADMIN") : false;
  const isDeptLead = userData?.role === "DEPARTMENT_LEAD";
  const isYouthLeader = userData?.role === "YOUTH_LEADER";

  const totalRoles = allRoles.length;
  const filledCount = assignments.length;
  const unassignedCount = Math.max(0, totalRoles - filledCount);

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

  // ─── "What matters now" headline ──────────────────────────────────────

  const headline = useMemo(() => {
    if (!userData) return "";
    if (myAssignment && myAssignment.assignment.status === "PENDING") {
      return `You have a pending ${myAssignment.assignment.roleName} assignment to confirm.`;
    }
    if (isAdmin && pendingApprovalCount > 0) {
      return `${pendingApprovalCount} event${pendingApprovalCount === 1 ? "" : "s"} waiting on your approval.`;
    }
    if ((isAdmin || isDeptLead) && unassignedRoles.length > 0 && nextEvent) {
      const days = Math.ceil(
        (nextEvent.startDate.getTime() - Date.now()) / 86400000
      );
      return `${unassignedRoles.length} role${unassignedRoles.length === 1 ? "" : "s"} still open for the next service${days > 0 ? ` — ${days} day${days === 1 ? "" : "s"} away` : ""}.`;
    }
    if (myAssignedFollowUps > 0) {
      return `You have ${myAssignedFollowUps} follow-up${myAssignedFollowUps === 1 ? "" : "s"} on your plate.`;
    }
    if (myAssignment) {
      return `You're serving as ${myAssignment.assignment.roleName} at the next service.`;
    }
    if (nextEvent) {
      return `Next up: ${nextEvent.title} on ${format(nextEvent.startDate, "EEEE, MMM d")}.`;
    }
    return "All caught up. Nothing on the calendar yet.";
  }, [
    userData,
    myAssignment,
    isAdmin,
    isDeptLead,
    pendingApprovalCount,
    unassignedRoles.length,
    nextEvent,
    myAssignedFollowUps,
  ]);

  // ─── Loading guard ─────────────────────────────────────────────────────

  if (!userData) return <PageLoader />;
  if (loadingCore) return <PageLoader />;

  // ─── Render-prep: spotlight CTA, metrics & module shortcuts ────────────

  const confirmedCount = assignments.filter(
    (a) => a.status === "CONFIRMED"
  ).length;
  const pendingCount = assignments.filter((a) => a.status === "PENDING").length;
  const openRolesCount = isDeptLead
    ? Math.max(0, scopedTotal - scopedFilled)
    : unassignedCount;

  // The single most important next step for this person, shown in the spotlight.
  const primaryCta: { label: string; href: string } | null =
    myAssignment && myAssignment.assignment.status === "PENDING"
      ? { label: "Respond to assignment", href: "/my-schedule" }
      : isAdmin && pendingApprovalCount > 0
        ? { label: "Review approvals", href: "/manage/events/approvals" }
        : (isAdmin || isDeptLead) && unassignedRoles.length > 0
          ? { label: "Assign open roles", href: "/manage/services" }
          : myAssignedFollowUps > 0
            ? { label: "View follow-ups", href: "/department/discipleship" }
            : myAssignment
              ? { label: "View my schedule", href: "/my-schedule" }
              : !isAdmin
                ? { label: "Set availability", href: "/my-schedule/availability" }
                : nextEvent
                  ? { label: "Open calendar", href: "/calendar" }
                  : null;

  // Role-aware headline metrics for the bento strip.
  const metrics: {
    href: string;
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
    hint?: string;
    accent?: "clay" | "gold" | "teal" | "rose" | "blue";
    highlight?: boolean;
  }[] = [];
  if (isAdmin) {
    metrics.push({
      href: "/manage/members",
      icon: Users,
      label: "Members",
      value: activeMemberCount,
      accent: "clay",
      hint: "Active directory",
    });
    metrics.push({
      href: "/manage/events/approvals",
      icon: ClipboardCheck,
      label: "Approvals",
      value: pendingApprovalCount,
      accent: "gold",
      highlight: pendingApprovalCount > 0,
      hint: pendingApprovalCount > 0 ? "Awaiting you" : "All clear",
    });
  }
  if (isAdmin || isDeptLead) {
    metrics.push({
      href: "/manage/services",
      icon: ClipboardList,
      label: isDeptLead ? "Dept filled" : "Roles filled",
      value: scopedTotal > 0 ? `${scopedFilled}/${scopedTotal}` : "—",
      accent: "teal",
      hint: scopedTotal > 0 ? "Next service" : "No roles set",
    });
    metrics.push({
      href: "/manage/services",
      icon: AlertTriangle,
      label: "Open roles",
      value: openRolesCount,
      accent: "rose",
      highlight: openRolesCount > 0,
      hint: openRolesCount > 0 ? "Needs filling" : "Fully staffed",
    });
  }
  if (showFollowUpsTile) {
    metrics.push({
      href: "/department/discipleship",
      icon: Heart,
      label: "Follow-ups",
      value: activeFollowUpCount,
      accent: "rose",
      highlight: pendingFollowUpApprovalCount > 0,
      hint:
        pendingFollowUpApprovalCount > 0
          ? `${pendingFollowUpApprovalCount} to approve`
          : "Discipleship pipeline",
    });
  }
  if (canPlanBraai) {
    metrics.push({
      href: nextBraai
        ? `/manage/fundraising/braai/${nextBraai.id}`
        : "/manage/fundraising",
      icon: Flame,
      label: "Braai",
      value: nextBraai
        ? `${braaiAssignmentCount}/${BRAAI_TOTAL_RESPONSIBILITIES}`
        : "—",
      accent: "gold",
      highlight:
        Boolean(nextBraai) &&
        (braaiAssignmentCount < BRAAI_TOTAL_RESPONSIBILITIES ||
          braaiPendingCount > 0),
      hint: nextBraai
        ? braaiPendingCount > 0
          ? `${braaiPendingCount} pending`
          : "Roster"
        : "None scheduled",
    });
  }
  if (!isAdmin && !isDeptLead) {
    metrics.push({
      href: "/calendar",
      icon: CalendarDays,
      label: "Upcoming",
      value: upcomingEvents.length,
      accent: "clay",
      hint: "Events ahead",
    });
    if (userData.lifeGroup) {
      metrics.push({
        href: "/department/life-groups",
        icon: UsersRound,
        label: "Life group",
        value: userData.lifeGroup,
        accent: "teal",
        hint: "Devotional & directory",
      });
    }
  }

  // Everything you can jump to from the dashboard's "Explore" launcher.
  const moduleLinks: {
    href: string;
    icon: React.ElementType;
    label: string;
    hint?: string;
    iconTone: string;
  }[] = [];
  moduleLinks.push({
    href: "/calendar",
    icon: Calendar,
    label: "Calendar",
    hint: "All events in one view",
    iconTone: "bg-gold/10 text-gold-dark",
  });
  if (!isAdmin)
    moduleLinks.push({
      href: "/my-schedule",
      icon: CalendarDays,
      label: "My schedule",
      hint: "Assignments & availability",
      iconTone: "bg-teal/10 text-teal",
    });
  if (isAdmin || isDeptLead)
    moduleLinks.push({
      href: "/manage/events/new",
      icon: CalendarPlus,
      label: "Create event",
      hint: "Propose a new event",
      iconTone: "bg-blue-50 text-blue-600",
    });
  if (showLatreouTile)
    moduleLinks.push({
      href: "/latreou",
      icon: Music,
      label: "Latreou planner",
      hint: "Worship cycles & rehearsals",
      iconTone: "bg-amber-50 text-amber-600",
    });
  if (showFollowUpsTile)
    moduleLinks.push({
      href: "/department/discipleship",
      icon: Heart,
      label: "Discipleship",
      hint: "Follow-up pipeline",
      iconTone: "bg-rose-50 text-rose-600",
    });
  moduleLinks.push({
    href: "/department/campus-ministry",
    icon: BookOpen,
    label: "Devotionals",
    hint: "This week's reading",
    iconTone: "bg-purple-50 text-purple-600",
  });
  if (!isAdmin && userData.lifeGroup)
    moduleLinks.push({
      href: "/department/life-groups",
      icon: UsersRound,
      label: "My life group",
      hint: userData.lifeGroup,
      iconTone: "bg-emerald-50 text-emerald-600",
    });
  if (!isAdmin && userData.isStudent)
    moduleLinks.push({
      href: "/department/campus-ministry",
      icon: GraduationCap,
      label: "Campus ministry",
      hint: "Updates from your campus",
      iconTone: "bg-indigo-50 text-indigo-600",
    });
  if (canPlanBraai)
    moduleLinks.push({
      href: nextBraai
        ? `/manage/fundraising/braai/${nextBraai.id}`
        : "/manage/fundraising",
      icon: Flame,
      label: "Fundraising",
      hint: "Braai planning & orders",
      iconTone: "bg-red-50 text-red-600",
    });
  moduleLinks.push({
    href: "/rops-camp",
    icon: Tent,
    label: "ROPs Camp",
    hint: "Reserve a place by the fire",
    iconTone: "bg-orange-50 text-orange-600",
  });
  if (isAdmin)
    moduleLinks.push({
      href: "/manage/members",
      icon: Users,
      label: "Members",
      hint: "Directory & roles",
      iconTone: "bg-teal/10 text-teal",
    });
  moduleLinks.push({
    href: "/affirmations",
    icon: Sparkles,
    label: "Affirmations",
    hint: "Encouragement for the team",
    iconTone: "bg-pink-50 text-pink-600",
  });

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Spotlight ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-clay-800 via-clay-700 to-clay-800 text-cream shadow-[0_20px_50px_-24px_rgba(42,24,15,0.6)]">
        {/* Warm corner glow + faint dotted texture */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-gold/20 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="relative grid gap-7 p-6 md:p-8 lg:grid-cols-[1.5fr,1fr] lg:items-center">
          {/* Identity + priority + CTA */}
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-cream/60">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
              {format(now, "EEEE, MMMM d")}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold leading-tight md:text-4xl">
              {greeting(now)},{" "}
              <span className="text-gold-light">
                {userData.name.split(" ")[0]}
              </span>
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold-light ring-1 ring-inset ring-gold/30">
                {roleLabels[userData.role]}
              </span>
              {userData.lifeGroup && (
                <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-cream/80 ring-1 ring-inset ring-white/15">
                  {userData.lifeGroup} life group
                </span>
              )}
            </div>

            <div className="mt-5 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-inset ring-white/10">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-light/80">
                <Inbox className="h-3 w-3" />
                What needs you
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-cream/90 md:text-[15px]">
                {headline}
              </p>
              {primaryCta && (
                <Link href={primaryCta.href} className="mt-3 inline-block">
                  <Button variant="gold" size="sm" className="shadow-sm">
                    {primaryCta.label}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Focus object — readiness for leaders, assignment for members */}
          <div className="lg:pl-2">
            {(isAdmin || isDeptLead) && nextEvent ? (
              <div className="rounded-2xl bg-white/[0.07] p-5 ring-1 ring-inset ring-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-light/80">
                  Next service
                </p>
                <p className="mt-0.5 truncate font-display text-lg font-semibold text-cream">
                  {nextEvent.title}
                </p>
                <p className="mt-0.5 text-xs text-cream/60">
                  {format(nextEvent.startDate, "EEE, MMM d")}
                  {nextService?.serviceTime
                    ? ` · ${nextService.serviceTime}`
                    : ""}
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <ReadinessRing
                    onDark
                    filled={isDeptLead ? scopedFilled : filledCount}
                    total={isDeptLead ? scopedTotal : totalRoles}
                    size={104}
                  />
                  <ul className="flex-1 space-y-1.5 text-sm">
                    <li className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-cream/70">
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-light" />
                        Confirmed
                      </span>
                      <span className="font-display font-bold text-cream">
                        {confirmedCount}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-cream/70">
                        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                        Pending
                      </span>
                      <span className="font-display font-bold text-cream">
                        {pendingCount}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-cream/70">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        Open
                      </span>
                      <span className="font-display font-bold text-cream">
                        {openRolesCount}
                      </span>
                    </li>
                  </ul>
                </div>
                <Link href="/manage/services" className="mt-4 block">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-white/20 bg-white/5 text-cream hover:bg-white/10 hover:text-cream"
                  >
                    View full rota
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : myAssignment ? (
              <div className="rounded-2xl bg-white/[0.07] p-5 ring-1 ring-inset ring-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-light/80">
                  Your next role
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-cream">
                  {myAssignment.assignment.roleName}
                </p>
                <p className="mt-1 truncate text-sm text-cream/70">
                  {myAssignment.event.title}
                </p>
                <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-xs text-cream/60">
                  <Clock className="h-3 w-3" />
                  {format(myAssignment.event.startDate, "EEE, MMM d")}
                  {myAssignment.service.serviceTime
                    ? ` · ${myAssignment.service.serviceTime}`
                    : ""}
                  <span className="text-cream/30">·</span>
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{myAssignment.event.venue}</span>
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-cream ring-1 ring-inset ring-white/15">
                    {myAssignment.assignment.status === "PENDING"
                      ? "Awaiting your response"
                      : myAssignment.assignment.status === "CONFIRMED"
                        ? "Confirmed"
                        : myAssignment.assignment.status === "DECLINED"
                          ? "Declined"
                          : "No response yet"}
                  </span>
                  <Link href="/my-schedule">
                    <Button variant="gold" size="sm">
                      {myAssignment.assignment.status === "PENDING"
                        ? "Respond"
                        : "View"}
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : nextEvent ? (
              <div className="rounded-2xl bg-white/[0.07] p-5 ring-1 ring-inset ring-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-light/80">
                  Coming up
                </p>
                <p className="mt-1 truncate font-display text-xl font-semibold text-cream">
                  {nextEvent.title}
                </p>
                <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-xs text-cream/60">
                  <Clock className="h-3 w-3" />
                  {format(nextEvent.startDate, "EEE, MMM d")}
                  <span className="text-cream/30">·</span>
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{nextEvent.venue}</span>
                </p>
                <Link href="/calendar" className="mt-4 block">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-white/20 bg-white/5 text-cream hover:bg-white/10 hover:text-cream"
                  >
                    View calendar
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/[0.07] p-6 text-center ring-1 ring-inset ring-white/10">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  <Sparkles className="h-6 w-6 text-gold-light" />
                </span>
                <p className="mt-3 text-sm font-medium text-cream">
                  All quiet for now
                </p>
                <p className="mt-1 text-xs text-cream/60">
                  Nothing on the calendar yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Metric strip ────────────────────────────────────────────── */}
      {metrics.length > 0 && (
        <section aria-label="Key metrics">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {metrics.map((m) => (
              <MetricTile
                key={`${m.label}-${m.href}`}
                href={m.href}
                icon={m.icon}
                label={m.label}
                value={m.value}
                hint={m.hint}
                accent={m.accent}
                highlight={m.highlight}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Content grid: upcoming timeline + right rail ────────────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Upcoming — vertical timeline */}
        <Card className="border-clay-200 lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 ring-1 ring-inset ring-gold/20">
                  <CalendarDays className="h-4 w-4 text-gold-dark" />
                </span>
                Upcoming
              </CardTitle>
              <Link href="/calendar">
                <Button variant="ghost" size="sm" className="text-xs">
                  Calendar
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length > 0 ? (
              <ul className="pt-1">
                {upcomingEvents.map((evt, i) => (
                  <AgendaItem
                    key={evt.id}
                    event={evt}
                    isLast={i === upcomingEvents.length - 1}
                  />
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-clay-200 bg-cream/40 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10">
                  <CalendarDays className="h-6 w-6 text-gold-dark" />
                </div>
                <p className="mt-3 text-sm text-clay-500">No events scheduled.</p>
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
          </CardContent>
        </Card>

        {/* Right rail — attention + activity */}
        <div className="space-y-4">
          {/* Leaders see their own assignment here (members see it in the spotlight) */}
          {(isAdmin || isDeptLead) && myAssignment && (
            <Card className="border-clay-200">
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-clay-400">
                  You&apos;re also serving
                </p>
                <p className="mt-1 font-display text-lg font-semibold text-clay-700">
                  {myAssignment.assignment.roleName}
                </p>
                <p className="mt-0.5 truncate text-xs text-clay-400">
                  {myAssignment.event.title} ·{" "}
                  {format(myAssignment.event.startDate, "EEE, MMM d")}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <StatusBadge status={myAssignment.assignment.status} />
                  <Link href="/my-schedule">
                    <Button variant="ghost" size="sm" className="text-xs">
                      View
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Braai needing attention */}
          {canPlanBraai &&
            nextBraai &&
            (braaiAssignmentCount < BRAAI_TOTAL_RESPONSIBILITIES ||
              braaiPendingCount > 0) && (
              <Card className="border-red-200 bg-red-50/40">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-red-700">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 ring-1 ring-inset ring-red-200/60">
                      <Flame className="h-4 w-4" />
                    </span>
                    Braai needs attention
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-sm">
                    {braaiAssignmentCount < BRAAI_TOTAL_RESPONSIBILITIES && (
                      <li className="flex items-center justify-between gap-3">
                        <span className="text-clay-600">Unassigned</span>
                        <Badge
                          variant="outline"
                          className="border-red-200 bg-white text-red-600"
                        >
                          {BRAAI_TOTAL_RESPONSIBILITIES - braaiAssignmentCount}
                        </Badge>
                      </li>
                    )}
                    {braaiPendingCount > 0 && (
                      <li className="flex items-center justify-between gap-3">
                        <span className="text-clay-600">Awaiting confirmation</span>
                        <Badge
                          variant="outline"
                          className="border-gold/40 bg-white text-gold-dark"
                        >
                          {braaiPendingCount}
                        </Badge>
                      </li>
                    )}
                  </ul>
                  <Link
                    href={`/manage/fundraising/braai/${nextBraai.id}`}
                    className="mt-3 block"
                  >
                    <Button variant="gold" size="sm" className="w-full">
                      <Flame className="mr-2 h-4 w-4" />
                      Follow up
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

          {/* Roles needing attention */}
          {(isAdmin || isDeptLead) && unassignedRoles.length > 0 && (
            <Card className="border-red-200 bg-red-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-red-700">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 ring-1 ring-inset ring-red-200/60">
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  Roles needing attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {unassignedRoles.slice(0, 5).map((role) => (
                    <li
                      key={role.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                        <span className="truncate text-clay-600">{role.name}</span>
                      </span>
                      <Badge
                        variant="outline"
                        className="shrink-0 border-red-200 bg-white text-red-600"
                      >
                        Open
                      </Badge>
                    </li>
                  ))}
                  {unassignedRoles.length > 5 && (
                    <li className="pl-4 pt-1 text-xs text-clay-400">
                      +{unassignedRoles.length - 5} more
                    </li>
                  )}
                </ul>
                <Link href="/manage/services" className="mt-3 block">
                  <Button variant="destructive" size="sm" className="w-full">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Assign roles
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Recent activity */}
          <Card className="border-clay-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-clay-100 ring-1 ring-inset ring-clay-200/60">
                    <Activity className="h-4 w-4 text-clay-500" />
                  </span>
                  Recent activity
                </CardTitle>
                <Link href="/notifications">
                  <Button variant="ghost" size="sm" className="text-xs">
                    All
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="divide-y divide-clay-100/60">
                  {recentActivity.slice(0, 5).map((notif) => (
                    <ActivityItem key={notif.id} notif={notif} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-clay-200 bg-cream/40 py-8 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-clay-100">
                    <Activity className="h-5 w-5 text-clay-400" />
                  </div>
                  <p className="mt-3 text-sm text-clay-400">
                    Nothing new to show.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Explore + this week ─────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Module launcher */}
        <Card className="border-clay-200 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 ring-1 ring-inset ring-gold/20">
                <Compass className="h-4 w-4 text-gold-dark" />
              </span>
              Explore
            </CardTitle>
            <CardDescription className="ml-10">
              Jump straight into the tools for your ministry
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {moduleLinks.map((m) => (
                <ModuleLink
                  key={`${m.label}-${m.href}`}
                  href={m.href}
                  icon={m.icon}
                  label={m.label}
                  hint={m.hint}
                  iconTone={m.iconTone}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* This week's devotional */}
        <Card className="border-clay-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 ring-1 ring-inset ring-purple-100">
                <BookOpen className="h-4 w-4 text-purple-600" />
              </span>
              This week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestDevotional ? (
              <Link
                href="/department/campus-ministry"
                className="group block"
              >
                {latestDevotional.scriptureReference && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-dark">
                    {latestDevotional.scriptureReference}
                  </p>
                )}
                <p className="mt-1 font-display text-lg font-semibold leading-snug text-clay-700 group-hover:text-gold-dark">
                  {latestDevotional.title}
                </p>
                <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-clay-500">
                  {latestDevotional.content}
                </p>
                <span className="mt-3 inline-flex items-center text-sm font-medium text-gold-dark">
                  Read devotional
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </span>
              </Link>
            ) : (
              <div className="rounded-xl border border-dashed border-clay-200 bg-cream/40 py-8 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50">
                  <BookOpen className="h-5 w-5 text-purple-400" />
                </div>
                <p className="mt-3 text-sm text-clay-400">No devotional yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
