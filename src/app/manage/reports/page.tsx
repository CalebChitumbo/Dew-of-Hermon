"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Users,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Download,
  AlertTriangle,
} from "lucide-react";
import { format, subWeeks } from "date-fns";
import type { ServiceAssignment, User, AppEvent, ReminderLog } from "@/types";

function toDate(val: unknown): Date {
  if (val && typeof val === "object" && "toDate" in val) {
    return (val as { toDate: () => Date }).toDate();
  }
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return new Date();
}

function ReportsContent() {
  const { userData } = useAuth();
  const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [reminderLogs, setReminderLogs] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData) return;

    const fetchData = async () => {
      try {
        // Fetch all assignments
        const assignmentsSnap = await getDocs(
          query(collection(db, "serviceAssignments"), orderBy("createdAt", "desc"))
        );
        setAssignments(
          assignmentsSnap.docs.map((doc) => {
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
              status: data.status,
              emailSent: data.emailSent || false,
              emailSentAt: data.emailSentAt ? toDate(data.emailSentAt) : null,
              confirmedAt: data.confirmedAt ? toDate(data.confirmedAt) : null,
              notes: data.notes || null,
              createdAt: toDate(data.createdAt),
              updatedAt: toDate(data.updatedAt),
            } as ServiceAssignment;
          })
        );

        // Fetch active members
        const membersSnap = await getDocs(
          query(collection(db, "users"), where("isActive", "==", true))
        );
        setMembers(
          membersSnap.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name,
              email: data.email,
              phone: data.phone || null,
              role: data.role,
              departmentIds: data.departmentIds || [],
              leadsDepartmentIds: data.leadsDepartmentIds || [],
              profileImage: data.profileImage || null,
              isActive: data.isActive ?? true,
              createdAt: toDate(data.createdAt),
              updatedAt: toDate(data.updatedAt),
            } as User;
          })
        );

        // Fetch past events
        const eventsSnap = await getDocs(
          query(
            collection(db, "events"),
            where("type", "==", "POTTERS_WHEEL_SERVICE"),
            orderBy("startDate", "desc")
          )
        );
        setEvents(
          eventsSnap.docs.map((doc) => {
            const data = doc.data();
            return {
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
            } as AppEvent;
          })
        );

        // Fetch reminder logs
        const logsSnap = await getDocs(
          query(collection(db, "reminderLogs"), orderBy("sentAt", "desc"))
        );
        setReminderLogs(
          logsSnap.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              serviceId: data.serviceId,
              reminderDay: data.reminderDay,
              sentAt: toDate(data.sentAt),
              recipientCount: data.recipientCount || 0,
              errors: data.errors || null,
            } as ReminderLog;
          })
        );
      } catch (error) {
        console.error("Error fetching report data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userData]);

  // Computed stats
  const totalServices = events.length;
  const totalAssignments = assignments.length;
  const confirmedCount = assignments.filter((a) => a.status === "CONFIRMED").length;
  const declinedCount = assignments.filter((a) => a.status === "DECLINED").length;
  const confirmationRate =
    totalAssignments > 0
      ? Math.round((confirmedCount / totalAssignments) * 100)
      : 0;

  // Member participation frequency
  const memberParticipation = useMemo(() => {
    const counts: Record<string, { name: string; count: number; lastServed: Date | null }> = {};
    assignments.forEach((a) => {
      if (!counts[a.userId]) {
        counts[a.userId] = { name: a.userName, count: 0, lastServed: null };
      }
      counts[a.userId].count++;
      const created = a.createdAt;
      if (!counts[a.userId].lastServed || created > counts[a.userId].lastServed!) {
        counts[a.userId].lastServed = created;
      }
    });
    return Object.entries(counts)
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [assignments]);

  // Members who haven't served recently (4+ weeks)
  const fourWeeksAgo = subWeeks(new Date(), 4);
  const inactiveMembers = useMemo(() => {
    const activeUserIds = new Set(
      assignments
        .filter((a) => a.createdAt >= fourWeeksAgo)
        .map((a) => a.userId)
    );
    return members.filter((m) => !activeUserIds.has(m.id));
  }, [assignments, members, fourWeeksAgo]);

  // Role fill rates
  const roleFillRates = useMemo(() => {
    const roleCount: Record<string, { name: string; total: number; filled: number }> = {};
    assignments.forEach((a) => {
      if (!roleCount[a.roleId]) {
        roleCount[a.roleId] = { name: a.roleName, total: 0, filled: 0 };
      }
      roleCount[a.roleId].total++;
      if (a.status === "CONFIRMED") {
        roleCount[a.roleId].filled++;
      }
    });
    return Object.values(roleCount).sort(
      (a, b) => b.filled / (b.total || 1) - a.filled / (a.total || 1)
    );
  }, [assignments]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ["Name", "Email", "Role", "Service Date", "Status"];
    const rows = assignments.map((a) => [
      a.userName,
      a.userEmail,
      a.roleName,
      format(a.createdAt, "yyyy-MM-dd"),
      a.status,
    ]);

    const csvContent =
      [headers, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `potters-wheel-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
            Reports & Analytics
          </h1>
          <p className="text-sm text-clay-400 mt-1">
            Service history, participation trends, and ministry insights.
          </p>
        </div>
        <Button variant="outline" onClick={handleExportCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
                <CalendarDays className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-clay-700">
                  {totalServices}
                </p>
                <p className="text-xs text-clay-400">Total Services</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal/10">
                <Users className="h-5 w-5 text-teal" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-clay-700">
                  {members.length}
                </p>
                <p className="text-xs text-clay-400">Active Members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-clay-700">
                  {confirmationRate}%
                </p>
                <p className="text-xs text-clay-400">Confirmation Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-clay-700">
                  {totalAssignments}
                </p>
                <p className="text-xs text-clay-400">Total Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Participants */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-clay-400" />
              Top Participants
            </CardTitle>
            <CardDescription>Members with the most service assignments</CardDescription>
          </CardHeader>
          <CardContent>
            {memberParticipation.length === 0 ? (
              <p className="text-sm text-clay-400 text-center py-6">
                No assignment data yet.
              </p>
            ) : (
              <div className="space-y-3">
                {memberParticipation.slice(0, 10).map((member, index) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-clay-400 w-6">
                        {index + 1}.
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-gold-dark text-xs font-bold">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-clay-700">
                          {member.name}
                        </p>
                        {member.lastServed && (
                          <p className="text-xs text-clay-400">
                            Last: {format(member.lastServed, "d MMM yyyy")}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="gold">{member.count} times</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Members Not Served Recently */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Not Served Recently
            </CardTitle>
            <CardDescription>
              Members who have not been assigned in 4+ weeks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inactiveMembers.length === 0 ? (
              <p className="text-sm text-clay-400 text-center py-6">
                All members have been active recently!
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {inactiveMembers.slice(0, 15).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 py-2 border-b border-clay-50 last:border-b-0"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-clay-100 text-clay-500 text-xs font-bold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-clay-700 truncate">
                        {member.name}
                      </p>
                      <p className="text-xs text-clay-400 truncate">
                        {member.email}
                      </p>
                    </div>
                  </div>
                ))}
                {inactiveMembers.length > 15 && (
                  <p className="text-xs text-clay-400 text-center pt-2">
                    +{inactiveMembers.length - 15} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role Assignment Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-clay-400" />
              Role Assignment Breakdown
            </CardTitle>
            <CardDescription>How often each role is confirmed</CardDescription>
          </CardHeader>
          <CardContent>
            {roleFillRates.length === 0 ? (
              <p className="text-sm text-clay-400 text-center py-6">
                No role data yet.
              </p>
            ) : (
              <div className="space-y-3">
                {roleFillRates.map((role) => {
                  const rate =
                    role.total > 0
                      ? Math.round((role.filled / role.total) * 100)
                      : 0;
                  return (
                    <div key={role.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-clay-700 font-medium">
                          {role.name}
                        </span>
                        <span className="text-clay-400">
                          {role.filled}/{role.total} ({rate}%)
                        </span>
                      </div>
                      <div className="h-2 bg-clay-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal rounded-full transition-all duration-500"
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reminder Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-clay-400" />
              Recent Reminder Logs
            </CardTitle>
            <CardDescription>Automated email reminder history</CardDescription>
          </CardHeader>
          <CardContent>
            {reminderLogs.length === 0 ? (
              <p className="text-sm text-clay-400 text-center py-6">
                No reminders sent yet.
              </p>
            ) : (
              <div className="space-y-2">
                {reminderLogs.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2 border-b border-clay-50 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-clay-700">
                        {log.reminderDay} Reminders
                      </p>
                      <p className="text-xs text-clay-400">
                        {format(log.sentAt, "d MMM yyyy, h:mm a")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={log.errors ? "destructive" : "success"}>
                        {log.recipientCount} sent
                      </Badge>
                      {log.errors && (
                        <Badge variant="destructive" className="text-[10px]">
                          Errors
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <RoleProtected requiredRole="ADMIN">
      <ReportsContent />
    </RoleProtected>
  );
}
