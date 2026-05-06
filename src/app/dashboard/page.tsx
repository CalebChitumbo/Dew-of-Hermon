"use client";

import { useEffect, useMemo, useState } from "react";
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

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        aria-label={`${filled} of ${total} roles filled`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#F0D0A8"
          strokeWidth={strokeWidth}
          fill="none"
          className="opacity-40"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-display font-bold text-clay-700">
          {total > 0 ? `${filled}/${total}` : "—"}
        </span>
        <span className="text-[10px] text-clay-400 uppercase tracking-wider">
          Roles Filled
        </span>
      </div>
    </div>
  );
}

// ─── Pulse Tile ──────────────────────────────────────────────────────────

function PulseTile({
  href,
  icon: Icon,
  iconTone,
  label,
  value,
  hint,
  highlight = false,
}: {
  href: string;
  icon: React.ElementType;
  iconTone: string;
  label: string;
  value: React.ReactNode;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href} className="block group">
      <Card
        className={`h-full transition-all group-hover:border-gold group-hover:shadow-md ${
          highlight ? "border-red-200 bg-red-50/30" : ""
        }`}
      >
        <CardContent className="p-4 flex flex-col gap-3 h-full">
          <div className="flex items-center justify-between">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconTone}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <ChevronRight className="h-4 w-4 text-clay-300 group-hover:text-gold transition-colors" />
          </div>
          <div>
            <p className="text-xs text-clay-400 uppercase tracking-wider">
              {label}
            </p>
            <p className="text-2xl font-display font-bold text-clay-700 mt-0.5">
              {value}
            </p>
            {hint && (
              <p className="text-xs text-clay-400 mt-0.5 line-clamp-1">
                {hint}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
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
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-clay-700 truncate">
          {notif.title}
        </p>
        <p className="text-xs text-clay-400 truncate">{notif.message}</p>
      </div>
      <span className="text-[11px] text-clay-400 whitespace-nowrap shrink-0">
        {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
      </span>
    </div>
  );

  return notif.link ? (
    <Link href={notif.link} className="block hover:bg-clay-50/60 -mx-2 px-2 rounded">
      {inner}
    </Link>
  ) : (
    inner
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

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Welcome Hero ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-clay-200 bg-gradient-to-br from-cream via-white to-gold/10 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-clay-400">
              {format(now, "EEEE, MMMM d")}
            </p>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700 mt-1">
              {greeting(now)}, {userData.name.split(" ")[0]}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="gold" className="text-xs">
                {roleLabels[userData.role]}
              </Badge>
              {userData.lifeGroup && (
                <Badge variant="outline" className="text-xs">
                  {userData.lifeGroup} life group
                </Badge>
              )}
            </div>
            <p className="text-sm md:text-base text-clay-600 mt-3 max-w-2xl">
              {headline}
            </p>
          </div>

          {/* Admin mini-stats */}
          {isAdmin && (
            <div className="grid grid-cols-3 gap-3 md:gap-4 shrink-0">
              <div className="text-center">
                <p className="text-xl md:text-2xl font-display font-bold text-clay-700">
                  {activeMemberCount}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-clay-400">
                  Members
                </p>
              </div>
              <div className="text-center">
                <p className="text-xl md:text-2xl font-display font-bold text-clay-700">
                  {pendingApprovalCount}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-clay-400">
                  Approvals
                </p>
              </div>
              <div className="text-center">
                <p className="text-xl md:text-2xl font-display font-bold text-clay-700">
                  {activeFollowUpCount}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-clay-400">
                  Follow-ups
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── My Next ─────────────────────────────────────────────────── */}
      <section>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Inbox className="h-5 w-5 text-gold" />
                My Next
              </CardTitle>
              <Link href="/my-schedule">
                <Button variant="ghost" size="sm" className="text-xs">
                  Full schedule
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {myAssignment ? (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-clay-400">
                    {format(myAssignment.event.startDate, "EEE, MMM d")}
                    {myAssignment.service.serviceTime
                      ? ` · ${myAssignment.service.serviceTime}`
                      : ""}
                  </p>
                  <p className="text-lg font-display font-semibold text-clay-700 mt-0.5">
                    {myAssignment.assignment.roleName}
                  </p>
                  <p className="text-sm text-clay-500 mt-1 truncate">
                    {myAssignment.event.title} · {myAssignment.event.venue}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={myAssignment.assignment.status} />
                  <Link href="/my-schedule">
                    <Button size="sm" variant="gold">
                      {myAssignment.assignment.status === "PENDING"
                        ? "Respond"
                        : "View"}
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center gap-4 py-2">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal/10">
                  <Sparkles className="h-6 w-6 text-teal" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-clay-700">
                    You're free right now.
                  </p>
                  <p className="text-xs text-clay-400 mt-0.5">
                    No upcoming role assignments. Set your availability so leads
                    know when to call on you.
                  </p>
                </div>
                <Link href="/my-schedule/availability">
                  <Button variant="outline" size="sm">
                    Set availability
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Ministry Pulse Grid ─────────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium text-clay-500 uppercase tracking-wider">
            Ministry Pulse
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Service Readiness — leaders & admins */}
          {(isAdmin || isDeptLead || isYouthLeader) && (
            <PulseTile
              href="/manage/services"
              icon={ClipboardList}
              iconTone="bg-gold/10 text-gold-dark"
              label={isDeptLead ? "Dept readiness" : "Service readiness"}
              value={scopedTotal > 0 ? `${scopedFilled}/${scopedTotal}` : "—"}
              hint={
                scopedTotal > 0
                  ? `${Math.max(0, scopedTotal - scopedFilled)} role${
                      scopedTotal - scopedFilled === 1 ? "" : "s"
                    } open`
                  : "No roles configured yet"
              }
              highlight={scopedTotal > 0 && scopedFilled < scopedTotal * 0.5}
            />
          )}

          {/* Pending event approvals — admins */}
          {isAdmin && (
            <PulseTile
              href="/manage/events/approvals"
              icon={ClipboardCheck}
              iconTone="bg-blue-50 text-blue-600"
              label="Pending approvals"
              value={pendingApprovalCount}
              hint={
                pendingApprovalCount > 0
                  ? "Events awaiting your decision"
                  : "Nothing waiting"
              }
              highlight={pendingApprovalCount > 0}
            />
          )}

          {/* Follow-ups — discipleship/campus/life-groups departments */}
          {showFollowUpsTile && (
            <PulseTile
              href="/department/discipleship"
              icon={Heart}
              iconTone="bg-rose-50 text-rose-600"
              label="Active follow-ups"
              value={activeFollowUpCount}
              hint={
                pendingFollowUpApprovalCount > 0
                  ? `${pendingFollowUpApprovalCount} awaiting lead approval`
                  : myAssignedFollowUps > 0
                    ? `${myAssignedFollowUps} assigned to you`
                    : "Discipleship pipeline"
              }
              highlight={pendingFollowUpApprovalCount > 0}
            />
          )}

          {/* This week's devotional — everyone */}
          <PulseTile
            href="/department/campus-ministry"
            icon={BookOpen}
            iconTone="bg-purple-50 text-purple-600"
            label="This week's devotional"
            value={latestDevotional ? "Read" : "—"}
            hint={
              latestDevotional
                ? latestDevotional.scriptureReference || latestDevotional.title
                : "No devotional yet"
            }
          />

          {/* Members — admins */}
          {isAdmin && (
            <PulseTile
              href="/manage/members"
              icon={Users}
              iconTone="bg-teal/10 text-teal"
              label="Active members"
              value={activeMemberCount}
              hint="Directory & roles"
            />
          )}

          {/* Life Groups — for life group members */}
          {!isAdmin && userData.lifeGroup && (
            <PulseTile
              href="/department/life-groups"
              icon={UsersRound}
              iconTone="bg-emerald-50 text-emerald-600"
              label="My life group"
              value={userData.lifeGroup}
              hint="Devotional & directory"
            />
          )}

          {/* Campus ministry — for students */}
          {!isAdmin && userData.isStudent && (
            <PulseTile
              href="/department/campus-ministry"
              icon={GraduationCap}
              iconTone="bg-indigo-50 text-indigo-600"
              label="Campus ministry"
              value="Open"
              hint="Updates from your campus"
            />
          )}

          {/* Latreou — worship dept or admin */}
          {showLatreouTile && (
            <PulseTile
              href="/latreou"
              icon={Music}
              iconTone="bg-amber-50 text-amber-600"
              label="Latreou planner"
              value="Open"
              hint="Worship cycles & rehearsals"
            />
          )}

          {/* ROPs Camp registration — everyone (public page, parents-facing) */}
          <PulseTile
            href="/rops-camp"
            icon={Tent}
            iconTone="bg-orange-50 text-orange-600"
            label="ROPs Camp"
            value="Register"
            hint="Reserve a place by the fire"
          />

          {/* Affirmations — everyone */}
          <PulseTile
            href="/affirmations"
            icon={Sparkles}
            iconTone="bg-pink-50 text-pink-600"
            label="Affirmations"
            value="Read"
            hint="Encouragement for the team"
          />
        </div>
      </section>

      {/* ── Upcoming + Activity ─────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming events — spans 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-gold" />
                  Upcoming
                </CardTitle>
                <CardDescription>
                  Services, camps, retreats, and meetings on the horizon
                </CardDescription>
              </div>
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
              <ul className="divide-y divide-clay-50">
                {upcomingEvents.map((evt) => {
                  const meta = EVENT_TYPE_META[evt.type] || EVENT_TYPE_META.MEETING;
                  const Icon = meta.icon;
                  return (
                    <li key={evt.id} className="py-3 flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-clay-700 truncate">
                            {evt.title}
                          </p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {meta.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-clay-400 mt-0.5 flex items-center gap-3 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(evt.startDate, "EEE, MMM d")}
                          </span>
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3" />
                            {evt.venue}
                          </span>
                        </p>
                      </div>
                      <Badge variant="gold" className="shrink-0 text-[10px]">
                        {formatDistanceToNow(evt.startDate, { addSuffix: true })}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="py-8 text-center">
                <CalendarDays className="h-10 w-10 text-clay-200 mx-auto mb-3" />
                <p className="text-sm text-clay-400">
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
          </CardContent>
        </Card>

        {/* Side column: Roles needing attention + Activity */}
        <div className="space-y-6">
          {(isAdmin || isDeptLead) && unassignedRoles.length > 0 && (
            <Card className="border-red-200 bg-red-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  Roles needing attention
                </CardTitle>
                <CardDescription>
                  Open seats for the next service
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {unassignedRoles.slice(0, 5).map((role) => (
                    <li
                      key={role.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-clay-600 truncate">
                        {role.name}
                      </span>
                      <Badge variant="outline" className="text-red-600 border-red-200 shrink-0">
                        Open
                      </Badge>
                    </li>
                  ))}
                  {unassignedRoles.length > 5 && (
                    <li className="text-xs text-clay-400 pt-1">
                      +{unassignedRoles.length - 5} more
                    </li>
                  )}
                </ul>
                <Link href="/manage/services" className="block mt-3">
                  <Button variant="destructive" size="sm" className="w-full">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Assign roles
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-5 w-5 text-clay-400" />
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
                <div className="divide-y divide-clay-50">
                  {recentActivity.slice(0, 5).map((notif) => (
                    <ActivityItem key={notif.id} notif={notif} />
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Activity className="h-8 w-8 text-clay-200 mx-auto mb-2" />
                  <p className="text-sm text-clay-400">
                    Nothing new to show.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Service-readiness deep panel (admins/leads only) ───────── */}
      {(isAdmin || isDeptLead) && nextEvent && (
        <section>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-gold" />
                    Next service at a glance
                  </CardTitle>
                  <CardDescription>
                    {nextEvent.title} ·{" "}
                    {format(nextEvent.startDate, "EEE, MMM d")}
                    {nextService?.serviceTime
                      ? ` · ${nextService.serviceTime}`
                      : ""}
                  </CardDescription>
                </div>
                <Link href="/manage/services">
                  <Button variant="outline" size="sm">
                    View full rota
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="flex justify-center md:justify-start">
                  <ReadinessRing
                    filled={isDeptLead ? scopedFilled : filledCount}
                    total={isDeptLead ? scopedTotal : totalRoles}
                    size={140}
                  />
                </div>
                <div className="md:col-span-2 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-display font-bold text-teal">
                      {assignments.filter((a) => a.status === "CONFIRMED").length}
                    </p>
                    <p className="text-xs text-clay-400 uppercase tracking-wider mt-1">
                      Confirmed
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-display font-bold text-gold">
                      {assignments.filter((a) => a.status === "PENDING").length}
                    </p>
                    <p className="text-xs text-clay-400 uppercase tracking-wider mt-1">
                      Pending
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-display font-bold text-red-500">
                      {unassignedCount}
                    </p>
                    <p className="text-xs text-clay-400 uppercase tracking-wider mt-1">
                      Open
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
