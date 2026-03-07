"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { hasMinRole } from "@/lib/permissions";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner, PageLoader } from "@/components/shared/LoadingSpinner";
import {
  CalendarDays,
  MapPin,
  Palette,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ClipboardList,
  Bell,
  UserPlus,
  Activity,
  ArrowRight,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { format, formatDistanceToNow, isAfter, isBefore, addDays } from "date-fns";
import type {
  AppEvent,
  Service,
  ServiceAssignment,
  ServiceRole,
  AssignmentStatus,
  User,
  Notification,
} from "@/types";

// ─── Helper: convert Firestore timestamp to Date ───

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return new Date();
}

// ─── Readiness Ring SVG Component ───

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
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage >= 80) return "#4A9B8E"; // teal
    if (percentage >= 50) return "#C8963E"; // gold
    return "#EF4444"; // red
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        aria-label={`${filled} of ${total} roles filled`}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#F0D0A8"
          strokeWidth={strokeWidth}
          fill="none"
          className="opacity-40"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-display font-bold text-clay-700">
          {filled}/{total}
        </span>
        <span className="text-[10px] text-clay-400 uppercase tracking-wider">
          Roles Filled
        </span>
      </div>
    </div>
  );
}

// ─── Activity Item Component ───

function ActivityItem({
  icon: Icon,
  iconColor,
  title,
  description,
  time,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
  time: Date;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconColor}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-clay-700 truncate">{title}</p>
        <p className="text-xs text-clay-400 truncate">{description}</p>
      </div>
      <span className="text-[11px] text-clay-400 whitespace-nowrap shrink-0">
        {formatDistanceToNow(time, { addSuffix: true })}
      </span>
    </div>
  );
}

// ─── Alert Banner ───

function AlertBanner({
  count,
  serviceDate,
}: {
  count: number;
  serviceDate: Date | null;
}) {
  if (count === 0) return null;

  const daysAway = serviceDate
    ? Math.ceil(
        (serviceDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  const isUrgent = daysAway !== null && daysAway <= 3;

  return (
    <div
      className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${
        isUrgent
          ? "bg-red-50 border-red-200 text-red-800"
          : "bg-yellow-50 border-yellow-200 text-yellow-800"
      }`}
    >
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium">
          {count} role{count !== 1 ? "s" : ""} still unassigned
          {daysAway !== null && daysAway > 0 && (
            <span className="font-normal">
              {" "}
              &mdash; service is {daysAway} day{daysAway !== 1 ? "s" : ""} away
            </span>
          )}
        </p>
      </div>
      <Link href="/manage/services">
        <Button
          size="sm"
          variant={isUrgent ? "destructive" : "gold"}
          className="shrink-0"
        >
          Assign Now
        </Button>
      </Link>
    </div>
  );
}

// ─── Quick Stat Card ───

function QuickStat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-clay-700">{value}</p>
        <p className="text-xs text-clay-400">{label}</p>
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ───

export default function DashboardPage() {
  const { userData } = useAuth();
  const router = useRouter();

  // State for Firestore data
  const [nextEvent, setNextEvent] = useState<AppEvent | null>(null);
  const [nextService, setNextService] = useState<Service | null>(null);
  const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
  const [allRoles, setAllRoles] = useState<ServiceRole[]>([]);
  const [recentActivity, setRecentActivity] = useState<Notification[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Redirect MEMBER role to /my-schedule
  useEffect(() => {
    if (userData && userData.role === "MEMBER") {
      router.push("/my-schedule");
    }
  }, [userData, router]);

  // ─── Fetch the next upcoming event ───
  useEffect(() => {
    if (!userData) return;

    const now = new Date();
    const eventsQuery = query(
      safeCollection("events"),
      where("startDate", ">=", Timestamp.fromDate(now)),
      orderBy("startDate", "asc"),
      limit(1)
    );

    const unsub = onSnapshot(eventsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        setNextEvent({
          id: doc.id,
          title: data.title,
          description: data.description || null,
          type: data.type,
          startDate: toDate(data.startDate),
          endDate: data.endDate ? toDate(data.endDate) : null,
          venue: data.venue,
          isRecurring: data.isRecurring ?? false,
          createdBy: data.createdBy,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        });
      } else {
        setNextEvent(null);
      }
    });

    return unsub;
  }, [userData]);

  // ─── Fetch the next service tied to the next event ───
  useEffect(() => {
    if (!nextEvent) {
      setNextService(null);
      setLoadingData(false);
      return;
    }

    const servicesQuery = query(
      safeCollection("services"),
      where("eventId", "==", nextEvent.id),
      limit(1)
    );

    const unsub = onSnapshot(servicesQuery, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        setNextService({
          id: doc.id,
          eventId: data.eventId,
          theme: data.theme || null,
          serviceTime: data.serviceTime,
          programNotes: data.programNotes || null,
          attendanceCount: data.attendanceCount ?? null,
          isArchived: data.isArchived ?? false,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        });
      } else {
        setNextService(null);
      }
      setLoadingData(false);
    });

    return unsub;
  }, [nextEvent]);

  // ─── Fetch assignments for the next service ───
  useEffect(() => {
    if (!nextService) {
      setAssignments([]);
      return;
    }

    const assignmentsQuery = query(
      safeCollection("serviceAssignments"),
      where("serviceId", "==", nextService.id)
    );

    const unsub = onSnapshot(assignmentsQuery, (snapshot) => {
      const items: ServiceAssignment[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          serviceId: data.serviceId,
          roleId: data.roleId,
          roleName: data.roleName,
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          userPhone: data.userPhone || null,
          status: data.status as AssignmentStatus,
          emailSent: data.emailSent ?? false,
          emailSentAt: data.emailSentAt ? toDate(data.emailSentAt) : null,
          confirmedAt: data.confirmedAt ? toDate(data.confirmedAt) : null,
          notes: data.notes || null,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        };
      });
      setAssignments(items);
    });

    return unsub;
  }, [nextService]);

  // ─── Fetch all service roles ───
  useEffect(() => {
    if (!userData) return;

    const rolesQuery = query(
      safeCollection("serviceRoles"),
      orderBy("order", "asc")
    );

    const unsub = onSnapshot(rolesQuery, (snapshot) => {
      const items: ServiceRole[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          departmentId: data.departmentId,
          description: data.description || null,
          emailSubject: data.emailSubject || "",
          emailBody: data.emailBody || "",
          reminderSchedule: data.reminderSchedule || [],
          arrivalTime: data.arrivalTime || null,
          timeSlot: data.timeSlot || null,
          order: data.order ?? 0,
        };
      });
      setAllRoles(items);
    });

    return unsub;
  }, [userData]);

  // ─── Fetch recent notifications as activity ───
  useEffect(() => {
    if (!userData) return;

    const notifQuery = query(
      safeCollection("notifications"),
      where("userId", "==", userData.id),
      orderBy("createdAt", "desc"),
      limit(8)
    );

    const unsub = onSnapshot(notifQuery, (snapshot) => {
      const items: Notification[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          title: data.title,
          message: data.message,
          type: data.type,
          isRead: data.isRead ?? false,
          link: data.link || null,
          createdAt: toDate(data.createdAt),
        };
      });
      setRecentActivity(items);
    });

    return unsub;
  }, [userData]);

  // ─── Computed values ───

  const totalRoles = allRoles.length || 13;

  const assignmentsByRoleId = useMemo(() => {
    const map = new Map<string, ServiceAssignment>();
    assignments.forEach((a) => map.set(a.roleId, a));
    return map;
  }, [assignments]);

  const filledCount = assignments.length;
  const confirmedCount = assignments.filter(
    (a) => a.status === "CONFIRMED"
  ).length;
  const pendingCount = assignments.filter((a) => a.status === "PENDING").length;
  const declinedCount = assignments.filter(
    (a) => a.status === "DECLINED"
  ).length;
  const unassignedCount = totalRoles - filledCount;

  const unassignedRoles = useMemo(() => {
    return allRoles.filter((role) => !assignmentsByRoleId.has(role.id));
  }, [allRoles, assignmentsByRoleId]);

  // Department filtering for DEPARTMENT_LEAD
  const filteredRoles = useMemo(() => {
    if (!userData) return allRoles;
    if (
      userData.role === "DEPARTMENT_LEAD" &&
      userData.leadsDepartmentIds.length > 0
    ) {
      return allRoles.filter((role) =>
        userData.leadsDepartmentIds.includes(role.departmentId)
      );
    }
    return allRoles;
  }, [allRoles, userData]);

  const filteredAssignments = useMemo(() => {
    if (!userData) return assignments;
    if (
      userData.role === "DEPARTMENT_LEAD" &&
      userData.leadsDepartmentIds.length > 0
    ) {
      const roleIds = new Set(filteredRoles.map((r) => r.id));
      return assignments.filter((a) => roleIds.has(a.roleId));
    }
    return assignments;
  }, [assignments, filteredRoles, userData]);

  const filteredTotalRoles = filteredRoles.length;
  const filteredFilledCount = filteredAssignments.length;
  const filteredUnassignedCount = filteredTotalRoles - filteredFilledCount;

  const getActivityIcon = (
    type: string
  ): {
    icon: React.ElementType;
    color: string;
  } => {
    switch (type) {
      case "assignment":
        return {
          icon: UserPlus,
          color: "bg-teal/10 text-teal",
        };
      case "reminder":
        return {
          icon: Bell,
          color: "bg-gold/10 text-gold-dark",
        };
      case "event":
        return {
          icon: CalendarDays,
          color: "bg-blue-50 text-blue-600",
        };
      case "announcement":
        return {
          icon: Sparkles,
          color: "bg-purple-50 text-purple-600",
        };
      default:
        return {
          icon: Activity,
          color: "bg-clay-100 text-clay-500",
        };
    }
  };

  // ─── Loading / Guard ───

  if (!userData) {
    return <PageLoader />;
  }

  // MEMBER users are redirected to /my-schedule by the useEffect above
  if (userData.role === "MEMBER") {
    return <PageLoader />;
  }

  if (loadingData) {
    return <PageLoader />;
  }

  // ─── Determine which view to render ───
  const isAdmin = hasMinRole(userData.role, "ADMIN");
  const isDeptLead = userData.role === "DEPARTMENT_LEAD";
  const isYouthLeader = userData.role === "YOUTH_LEADER";

  const displayRoles = isAdmin ? allRoles : filteredRoles;
  const displayAssignments = isAdmin ? assignments : filteredAssignments;
  const displayTotal = isAdmin ? totalRoles : filteredTotalRoles;
  const displayFilled = isAdmin ? filledCount : filteredFilledCount;
  const displayUnassigned = isAdmin ? unassignedCount : filteredUnassignedCount;

  // ─── Youth Leader: limited view ───
  if (isYouthLeader) {
    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-display font-bold text-clay-700">
            Welcome, {userData.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-clay-400 mt-1">
            Here is what is coming up for the youth ministry.
          </p>
        </div>

        {/* Next Service Card */}
        {nextEvent ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-gold" />
                Next Service
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-clay-600">
                <CalendarDays className="h-4 w-4 text-clay-400" />
                <span>
                  {format(nextEvent.startDate, "EEEE, MMMM d, yyyy")}
                </span>
              </div>
              {nextService?.serviceTime && (
                <div className="flex items-center gap-2 text-sm text-clay-600">
                  <Clock className="h-4 w-4 text-clay-400" />
                  <span>{nextService.serviceTime}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-clay-600">
                <MapPin className="h-4 w-4 text-clay-400" />
                <span>{nextEvent.venue}</span>
              </div>
              {nextService?.theme && (
                <div className="flex items-center gap-2 text-sm text-clay-600">
                  <Palette className="h-4 w-4 text-clay-400" />
                  <span>{nextService.theme}</span>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Badge variant="gold">
                {formatDistanceToNow(nextEvent.startDate, { addSuffix: true })}
              </Badge>
            </CardFooter>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <CalendarDays className="h-10 w-10 text-clay-300 mx-auto mb-3" />
              <p className="text-sm text-clay-400">
                No upcoming services scheduled.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Readiness at a Glance */}
        {nextService && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Service Readiness</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-4">
                <ReadinessRing filled={filledCount} total={totalRoles} />
              </div>
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <div className="text-center">
                  <span className="block text-lg font-bold text-teal">
                    {confirmedCount}
                  </span>
                  <span className="text-clay-400">Confirmed</span>
                </div>
                <div className="text-center">
                  <span className="block text-lg font-bold text-gold">
                    {pendingCount}
                  </span>
                  <span className="text-clay-400">Pending</span>
                </div>
                <div className="text-center">
                  <span className="block text-lg font-bold text-red-500">
                    {unassignedCount}
                  </span>
                  <span className="text-clay-400">Unassigned</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/my-schedule">
            <Card className="hover:border-teal transition-colors cursor-pointer">
              <CardContent className="py-4 flex flex-col items-center gap-2 text-center">
                <CalendarDays className="h-6 w-6 text-teal" />
                <span className="text-sm font-medium text-clay-700">
                  My Schedule
                </span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/affirmations">
            <Card className="hover:border-gold transition-colors cursor-pointer">
              <CardContent className="py-4 flex flex-col items-center gap-2 text-center">
                <Sparkles className="h-6 w-6 text-gold" />
                <span className="text-sm font-medium text-clay-700">
                  Affirmations
                </span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    );
  }

  // ─── Admin / Dept Lead Dashboard ───

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
            {isDeptLead ? "Department Dashboard" : "Dashboard"}
          </h1>
          <p className="text-sm text-clay-400 mt-1">
            {isDeptLead
              ? "Overview of your department's service readiness."
              : "Overview of the next Potter's Wheel service at a glance."}
          </p>
        </div>
        {isAdmin && (
          <Link href="/manage/services">
            <Button variant="gold" size="sm">
              <ClipboardList className="mr-2 h-4 w-4" />
              Manage Services
            </Button>
          </Link>
        )}
      </div>

      {/* Alerts */}
      {nextEvent && displayUnassigned > 0 && (
        <AlertBanner
          count={displayUnassigned}
          serviceDate={nextEvent.startDate}
        />
      )}

      {/* Top Row: Next Service + Readiness Ring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Service Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-gold" />
                Next Service
              </CardTitle>
              {nextEvent && (
                <Badge variant="gold">
                  {formatDistanceToNow(nextEvent.startDate, {
                    addSuffix: true,
                  })}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {nextEvent ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
                      <CalendarDays className="h-5 w-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-xs text-clay-400 uppercase tracking-wider">
                        Date
                      </p>
                      <p className="text-sm font-medium text-clay-700">
                        {format(nextEvent.startDate, "EEEE, MMMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal/10">
                      <MapPin className="h-5 w-5 text-teal" />
                    </div>
                    <div>
                      <p className="text-xs text-clay-400 uppercase tracking-wider">
                        Venue
                      </p>
                      <p className="text-sm font-medium text-clay-700">
                        {nextEvent.venue}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {nextService?.theme && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                        <Palette className="h-5 w-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-xs text-clay-400 uppercase tracking-wider">
                          Theme
                        </p>
                        <p className="text-sm font-medium text-clay-700">
                          {nextService.theme}
                        </p>
                      </div>
                    </div>
                  )}
                  {nextService?.serviceTime && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                        <Clock className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-clay-400 uppercase tracking-wider">
                          Service Time
                        </p>
                        <p className="text-sm font-medium text-clay-700">
                          {nextService.serviceTime}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <CalendarDays className="h-12 w-12 text-clay-200 mx-auto mb-3" />
                <p className="text-sm text-clay-400">
                  No upcoming services scheduled.
                </p>
                {isAdmin && (
                  <Link href="/manage/services">
                    <Button variant="outline" size="sm" className="mt-4">
                      Create a Service
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Readiness Ring Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Readiness</CardTitle>
            <CardDescription>
              {isDeptLead ? "Your department" : "Overall"} assignment status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center py-2">
              <ReadinessRing
                filled={displayFilled}
                total={displayTotal}
                size={140}
              />
              <div className="grid grid-cols-3 gap-4 mt-5 w-full">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal" />
                    <span className="text-lg font-bold text-clay-700">
                      {isAdmin
                        ? confirmedCount
                        : filteredAssignments.filter(
                            (a) => a.status === "CONFIRMED"
                          ).length}
                    </span>
                  </div>
                  <span className="text-[10px] text-clay-400">Confirmed</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-gold" />
                    <span className="text-lg font-bold text-clay-700">
                      {isAdmin
                        ? pendingCount
                        : filteredAssignments.filter(
                            (a) => a.status === "PENDING"
                          ).length}
                    </span>
                  </div>
                  <span className="text-[10px] text-clay-400">Pending</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <XCircle className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-lg font-bold text-clay-700">
                      {displayUnassigned}
                    </span>
                  </div>
                  <span className="text-[10px] text-clay-400">Open</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row (Admin only) */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4">
              <QuickStat
                label="Confirmed"
                value={confirmedCount}
                icon={CheckCircle2}
                color="bg-teal/10 text-teal"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <QuickStat
                label="Pending"
                value={pendingCount}
                icon={Clock}
                color="bg-gold/10 text-gold-dark"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <QuickStat
                label="Declined"
                value={declinedCount}
                icon={XCircle}
                color="bg-red-50 text-red-500"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <QuickStat
                label="Unassigned"
                value={unassignedCount}
                icon={AlertTriangle}
                color="bg-yellow-50 text-yellow-600"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Row: Assignment Table + Activity Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Assignment Table */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-clay-400" />
                  {isDeptLead ? "Department Roles" : "Quick Assignment View"}
                </CardTitle>
                <CardDescription>
                  {isDeptLead
                    ? "Roles in your department for the next service"
                    : `All ${displayTotal} roles for the next service`}
                </CardDescription>
              </div>
              {isAdmin && nextService && (
                <Link href={`/manage/services`}>
                  <Button variant="ghost" size="sm">
                    View Full Rota
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {displayRoles.length > 0 ? (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-clay-100">
                      <th className="text-left text-xs font-medium text-clay-400 uppercase tracking-wider py-2 px-6">
                        Role
                      </th>
                      <th className="text-left text-xs font-medium text-clay-400 uppercase tracking-wider py-2 px-6">
                        Assigned To
                      </th>
                      <th className="text-left text-xs font-medium text-clay-400 uppercase tracking-wider py-2 px-6">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-clay-50">
                    {displayRoles.map((role) => {
                      const assignment = assignmentsByRoleId.get(role.id);
                      return (
                        <tr
                          key={role.id}
                          className={`hover:bg-clay-50/50 transition-colors ${
                            !assignment ? "bg-red-50/30" : ""
                          }`}
                        >
                          <td className="py-2.5 px-6">
                            <div className="flex items-center gap-2">
                              {role.timeSlot && (
                                <span className="text-[10px] text-clay-400 bg-clay-100 rounded px-1.5 py-0.5">
                                  {role.timeSlot}
                                </span>
                              )}
                              <span className="text-sm font-medium text-clay-700">
                                {role.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-6">
                            {assignment ? (
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/20 text-gold-dark text-[10px] font-bold">
                                  {assignment.userName
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>
                                <span className="text-sm text-clay-600">
                                  {assignment.userName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-clay-300 italic">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-6">
                            <StatusBadge
                              status={
                                assignment ? assignment.status : "UNASSIGNED"
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center">
                <ClipboardList className="h-10 w-10 text-clay-200 mx-auto mb-3" />
                <p className="text-sm text-clay-400">
                  {nextService
                    ? "No roles configured yet."
                    : "Create a service to start assigning roles."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed & Alerts Sidebar */}
        <div className="space-y-6">
          {/* Unassigned Roles Alert Card */}
          {displayUnassigned > 0 && unassignedRoles.length > 0 && isAdmin && (
            <Card className="border-red-200 bg-red-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-red-700">
                  <ShieldAlert className="h-5 w-5" />
                  Needs Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {unassignedRoles.slice(0, 5).map((role) => (
                    <li
                      key={role.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-clay-600">{role.name}</span>
                      <Badge variant="outline" className="text-red-600 border-red-200">
                        Open
                      </Badge>
                    </li>
                  ))}
                  {unassignedRoles.length > 5 && (
                    <li className="text-xs text-clay-400 pt-1">
                      +{unassignedRoles.length - 5} more unassigned roles
                    </li>
                  )}
                </ul>
                <Link href="/manage/services" className="block mt-3">
                  <Button variant="destructive" size="sm" className="w-full">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Assign Roles
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-5 w-5 text-clay-400" />
                  Recent Activity
                </CardTitle>
                <Link href="/notifications">
                  <Button variant="ghost" size="sm" className="text-xs">
                    View All
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="divide-y divide-clay-50">
                  {recentActivity.slice(0, 5).map((notif) => {
                    const { icon, color } = getActivityIcon(notif.type);
                    return (
                      <ActivityItem
                        key={notif.id}
                        icon={icon}
                        iconColor={color}
                        title={notif.title}
                        description={notif.message}
                        time={notif.createdAt}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Activity className="h-8 w-8 text-clay-200 mx-auto mb-2" />
                  <p className="text-sm text-clay-400">
                    No recent activity to show.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
