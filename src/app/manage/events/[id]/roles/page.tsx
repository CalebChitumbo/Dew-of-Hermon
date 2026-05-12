"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Timestamp } from "firebase/firestore";
import { safeDoc } from "@/lib/firebase";
import { getDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { AppEvent, EventDepartmentRole, User, EventType } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  ArrowLeft,
  Shield,
  UserPlus,
  UserMinus,
  Search,
  CheckCircle2,
  Users,
  Calendar,
  MapPin,
  Clock,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { hasMinRole } from "@/lib/permissions";

// ─── Constants ───

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  POTTERS_WHEEL_SERVICE: "Potter's Wheel Service",
  ROPS_CAMP: "ROPS Camp",
  RETREAT: "Retreat",
  MEETING: "Meeting",
  SPECIAL_EVENT: "Special Event",
  OUTREACH: "Outreach",
};

// Fixed display order for department sections
const DEPT_ORDER = [
  "Media & Technical",
  "Hospitality",
  "Transport & Logistics",
  "Youth Ablaze",
];

// ─── Helpers ───

function parseFirestoreDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string") return parseISO(val);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (val && typeof val === "object" && "seconds" in (val as any)) {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  return new Date();
}

function progressColor(pct: number): string {
  if (pct >= 75) return "bg-green-500";
  if (pct >= 50) return "bg-yellow-400";
  if (pct >= 25) return "bg-orange-400";
  return "bg-red-400";
}

function progressTextColor(pct: number): string {
  if (pct >= 75) return "text-green-700";
  if (pct >= 50) return "text-yellow-700";
  if (pct >= 25) return "text-orange-700";
  return "text-red-700";
}

function progressBg(pct: number): string {
  if (pct >= 75) return "bg-green-50 border-green-200";
  if (pct >= 50) return "bg-yellow-50 border-yellow-200";
  if (pct >= 25) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

// ─── Types ───

interface DeptSection {
  departmentId: string;
  departmentName: string;
  roles: EventDepartmentRole[];
}

interface AssignTarget {
  roleId: string;
  roleName: string;
  departmentName: string;
  departmentId: string;
  currentUserId: string | null;
}

interface CoreAssignTarget {
  index: number;
  roleName: string;
  currentUserName: string | null;
}

// ─── Component ───

export default function EventRoleBoardPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const { userData } = useAuth();
  const { toast } = useToast();

  const [event, setEvent] = useState<AppEvent | null>(null);
  const [deptSections, setDeptSections] = useState<DeptSection[]>([]);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [coreAssignTarget, setCoreAssignTarget] = useState<CoreAssignTarget | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [generatingRoles, setGeneratingRoles] = useState(false);

  // Access control: DEPARTMENT_LEAD+ can view this page
  const hasAccess = userData ? hasMinRole(userData.role, "DEPARTMENT_LEAD") : false;
  const isAdmin = userData ? hasMinRole(userData.role, "ADMIN") : false;

  // Events & Fellowship Manager check (DEPARTMENT_LEAD who leads E&F dept)
  // We derive this from whether the user is ADMIN+ or a DEPARTMENT_LEAD
  // (fine-grained E&F check is enforced server-side on assignment; here we show the full board)
  const canAssignAny = isAdmin;
  const canAssignDept = (departmentId: string) =>
    isAdmin ||
    (userData?.role === "DEPARTMENT_LEAD" &&
      (userData?.leadsDepartmentIds || []).includes(departmentId));

  // ─── Data fetching ───

  const fetchData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      // Fetch event doc
      const eventRef = safeDoc("events", eventId);
      const eventSnap = await getDoc(eventRef);
      if (!eventSnap.exists()) {
        setLoading(false);
        return;
      }
      const d = eventSnap.data()!;
      setEvent({
        id: eventSnap.id,
        title: d.title,
        description: d.description || null,
        type: d.type as EventType,
        startDate: parseFirestoreDate(d.startDate),
        endDate: d.endDate ? parseFirestoreDate(d.endDate) : null,
        venue: d.venue || "",
        isRecurring: d.isRecurring || false,
        createdBy: d.createdBy || "",
        lifeGroupTarget: d.lifeGroupTarget || null,
        approvalStatus: d.approvalStatus || "APPROVED",
        approvalComments: d.approvalComments || null,
        approvedBy: d.approvedBy || null,
        approvedAt: d.approvedAt ? parseFirestoreDate(d.approvedAt) : null,
        createdByDepartmentId: d.createdByDepartmentId || null,
        coreRoles: d.coreRoles || [],
        createdAt: parseFirestoreDate(d.createdAt),
        updatedAt: parseFirestoreDate(d.updatedAt),
      });

      // Fetch department roles via API
      const rolesRes = await fetch(`/api/events/${eventId}/department-roles`);
      if (rolesRes.ok) {
        const { roles } = await rolesRes.json();

        // Group by department, preserving DEPT_ORDER
        const byDept = new Map<string, DeptSection>();
        for (const role of roles as EventDepartmentRole[]) {
          if (!byDept.has(role.departmentId)) {
            byDept.set(role.departmentId, {
              departmentId: role.departmentId,
              departmentName: role.departmentName,
              roles: [],
            });
          }
          byDept.get(role.departmentId)!.roles.push(role);
        }

        // Sort sections by DEPT_ORDER, then alphabetically for any unlisted depts
        const sections = Array.from(byDept.values()).sort((a, b) => {
          const ai = DEPT_ORDER.indexOf(a.departmentName);
          const bi = DEPT_ORDER.indexOf(b.departmentName);
          if (ai === -1 && bi === -1)
            return a.departmentName.localeCompare(b.departmentName);
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });

        setDeptSections(sections);
      }

      // Fetch active users for assignment picker via API (avoids Firestore client-side permission issues)
      const membersRes = await fetch(`/api/events/${eventId}/assignable-members`);
      if (membersRes.ok) {
        const { users } = await membersRes.json();
        setActiveUsers(
          users.map((u: User & { createdAt: string; updatedAt: string }) => ({
            ...u,
            createdAt: new Date(u.createdAt),
            updatedAt: new Date(u.updatedAt),
          }))
        );
      } else {
        const errData = await membersRes.json().catch(() => ({}));
        throw new Error(
          errData.error || `Failed to load members (${membersRes.status})`
        );
      }
    } catch (err) {
      console.error("Failed to load role board data:", err);
      toast({
        title: "Error",
        description: "Failed to load role board. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Assignment ───

  async function handleAssign(user: User) {
    if (!assignTarget) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/events/${eventId}/department-roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: assignTarget.roleId,
          assignedUserId: user.id,
          assignedUserName: user.name,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Assignment failed");
      }

      // Optimistic update
      setDeptSections((prev) =>
        prev.map((section) => ({
          ...section,
          roles: section.roles.map((r) =>
            r.id === assignTarget.roleId
              ? { ...r, assignedUserId: user.id, assignedUserName: user.name }
              : r
          ),
        }))
      );

      toast({
        title: "Role assigned",
        description: `${user.name} assigned as ${assignTarget.roleName}.`,
        variant: "success",
      });
      setAssignTarget(null);
      setUserSearch("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  }

  async function handleGenerateRoles() {
    if (!eventId) return;
    setGeneratingRoles(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/department-roles/generate`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate roles");
      }
      if (data.alreadyExisted) {
        toast({
          title: "Roles already exist",
          description: "Department roles are already set up for this event.",
        });
      } else if (data.created > 0) {
        const missing = (data.missingDepartments as string[]) || [];
        toast({
          title: `Created ${data.created} role${data.created === 1 ? "" : "s"}`,
          description:
            missing.length > 0
              ? `Skipped ${missing.length} missing department${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. Ask an admin to add these in Departments.`
              : "Department roles are now ready to be assigned.",
          variant: "success",
        });
      } else {
        const missing = (data.missingDepartments as string[]) || [];
        toast({
          title: "No roles were created",
          description:
            missing.length > 0
              ? `None of the role-template departments exist yet: ${missing.join(", ")}. Add them in Departments first.`
              : "No role templates were found.",
          variant: "destructive",
        });
      }
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setGeneratingRoles(false);
    }
  }

  async function handleClear(roleId: string, roleName: string) {
    try {
      const res = await fetch(`/api/events/${eventId}/department-roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId,
          assignedUserId: null,
          assignedUserName: null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to clear assignment");
      }

      // Optimistic update
      setDeptSections((prev) =>
        prev.map((section) => ({
          ...section,
          roles: section.roles.map((r) =>
            r.id === roleId
              ? { ...r, assignedUserId: null, assignedUserName: null }
              : r
          ),
        }))
      );

      toast({
        title: "Assignment cleared",
        description: `${roleName} is now unassigned.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  }

  // ─── Core Role Assignment ───

  async function handleCoreAssign(user: User) {
    if (!coreAssignTarget || !event) return;
    setAssigning(true);
    try {
      const updatedCoreRoles = event.coreRoles.map((role, i) =>
        i === coreAssignTarget.index
          ? { ...role, assignedUserId: user.id, assignedUserName: user.name }
          : role
      );

      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coreRoles: updatedCoreRoles }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to assign core role");
      }

      setEvent((prev) =>
        prev ? { ...prev, coreRoles: updatedCoreRoles } : prev
      );

      toast({
        title: "Core role assigned",
        description: `${user.name} assigned as ${coreAssignTarget.roleName}.`,
        variant: "success",
      });
      setCoreAssignTarget(null);
      setUserSearch("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  }

  async function handleCoreClear(index: number, roleName: string) {
    if (!event) return;
    try {
      const updatedCoreRoles = event.coreRoles.map((role, i) =>
        i === index
          ? { ...role, assignedUserId: null, assignedUserName: null }
          : role
      );

      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coreRoles: updatedCoreRoles }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to clear core role");
      }

      setEvent((prev) =>
        prev ? { ...prev, coreRoles: updatedCoreRoles } : prev
      );

      toast({
        title: "Assignment cleared",
        description: `${roleName} is now unassigned.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  }

  // ─── Derived stats ───

  const allRoles = deptSections.flatMap((s) => s.roles);
  const coreRoles = event?.coreRoles || [];
  const totalRoles = coreRoles.length + allRoles.length;
  const filledCoreRoles = coreRoles.filter((r) => r.assignedUserId || r.assignedUserName).length;
  const filledDeptRoles = allRoles.filter((r) => r.assignedUserId).length;
  const totalFilled = filledCoreRoles + filledDeptRoles;
  const overallPct = totalRoles > 0 ? Math.round((totalFilled / totalRoles) * 100) : 0;

  // For department role assignment, only show members of that department.
  const deptFilteredUsers = activeUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (!assignTarget?.departmentId) return false;
    return (u.departmentIds || []).includes(assignTarget.departmentId);
  });

  // For core role assignment, show all active members.
  const coreFilteredUsers = activeUsers.filter((u) => {
    return (
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
    );
  });

  // ─── Access guard ───

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-700">
          Access Denied
        </h2>
        <p className="text-clay-500 mt-2">
          Department Lead access or higher is required to view role boards.
        </p>
        <Link href="/calendar" className="mt-4">
          <Button variant="outline">Back to Calendar</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-display font-semibold text-clay-700">
          Event not found
        </h2>
        <Link href="/calendar" className="mt-4">
          <Button variant="outline">Back to Calendar</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/calendar">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-900 truncate">
            Role Board
          </h1>
          <p className="text-sm text-clay-500 mt-0.5 truncate">{event.title}</p>
        </div>
        <Badge variant="outline" className="text-xs hidden sm:block">
          {EVENT_TYPE_LABELS[event.type] || event.type}
        </Badge>
      </div>

      {/* Event Info */}
      <Card className="border-clay-200">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4 text-sm text-clay-600">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-clay-400" />
              <span>{format(event.startDate, "EEE, d MMM yyyy")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-clay-400" />
              <span>{format(event.startDate, "h:mm a")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-clay-400" />
              <span>{event.venue}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overall Progress */}
      <Card className={cn("border", progressBg(overallPct))}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-clay-500" />
              <span className="text-sm font-medium text-clay-700">
                Overall Role Completion
              </span>
            </div>
            <span
              className={cn(
                "text-sm font-bold",
                progressTextColor(overallPct)
              )}
            >
              {totalFilled} / {totalRoles} filled ({overallPct}%)
            </span>
          </div>
          <div className="w-full bg-clay-200 rounded-full h-2.5">
            <div
              className={cn(
                "h-2.5 rounded-full transition-all duration-500",
                progressColor(overallPct)
              )}
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Core Roles */}
      {coreRoles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#C8963E]" />
              Core Roles
              <Badge variant="outline" className="text-xs ml-auto font-normal">
                {filledCoreRoles} / {coreRoles.length} filled
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {coreRoles.map((role, idx) => {
                const isFilled = !!(role.assignedUserId || role.assignedUserName);
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2.5 gap-2",
                      isFilled
                        ? "border-green-200 bg-green-50"
                        : "border-clay-200 bg-clay-50"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-clay-500">{role.role}</p>
                      {isFilled ? (
                        <p className="text-sm font-medium text-clay-800 truncate">
                          {role.assignedUserName}
                        </p>
                      ) : (
                        <p className="text-sm text-clay-400 italic">
                          Unassigned
                        </p>
                      )}
                    </div>
                    {isAdmin ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-clay-500 hover:text-clay-700"
                          onClick={() => {
                            setCoreAssignTarget({
                              index: idx,
                              roleName: role.role,
                              currentUserName: role.assignedUserName,
                            });
                            setUserSearch("");
                          }}
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1" />
                          {isFilled ? "Change" : "Assign"}
                        </Button>
                        {isFilled && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleCoreClear(idx, role.role)}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ) : isFilled ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-clay-300 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Department Role Sections */}
      {deptSections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-clay-300 mx-auto mb-3" />
            {event.approvalStatus !== "APPROVED" ? (
              <p className="text-clay-500">
                Department roles will appear here once the event is approved.
              </p>
            ) : (
              <>
                <p className="text-clay-600 font-medium">
                  No department roles set up for this event yet.
                </p>
                <p className="text-sm text-clay-400 mt-1 max-w-md mx-auto">
                  This usually means the role-template departments
                  (e.g.&nbsp;Media&nbsp;&amp; Technical, Hospitality) aren&apos;t
                  configured under those exact names. Admins can regenerate
                  them below.
                </p>
                {isAdmin && (
                  <Button
                    variant="gold"
                    size="sm"
                    className="mt-4"
                    onClick={handleGenerateRoles}
                    disabled={generatingRoles}
                  >
                    {generatingRoles ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    Generate department roles
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        deptSections.map((section) => {
          const filled = section.roles.filter((r) => r.assignedUserId).length;
          const total = section.roles.length;
          const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
          const canAssign = canAssignAny || canAssignDept(section.departmentId);

          return (
            <Card key={section.departmentId}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-clay-700">{section.departmentName}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        progressTextColor(pct)
                      )}
                    >
                      {filled}/{total}
                    </span>
                    <div className="w-16 bg-clay-200 rounded-full h-1.5">
                      <div
                        className={cn(
                          "h-1.5 rounded-full",
                          progressColor(pct)
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {section.roles.map((role) => {
                    const isFilled = !!role.assignedUserId;
                    return (
                      <div
                        key={role.id}
                        className={cn(
                          "flex items-center justify-between rounded-lg border px-3 py-2.5 gap-2",
                          isFilled
                            ? "border-green-200 bg-green-50"
                            : "border-clay-200 bg-white"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-clay-500 truncate">
                            {role.role}
                          </p>
                          {isFilled ? (
                            <p className="text-sm font-medium text-clay-800 truncate">
                              {role.assignedUserName}
                            </p>
                          ) : (
                            <p className="text-sm text-clay-400 italic">
                              Unassigned
                            </p>
                          )}
                        </div>
                        {canAssign && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-clay-500 hover:text-clay-700"
                              onClick={() => {
                                setAssignTarget({
                                  roleId: role.id,
                                  roleName: role.role,
                                  departmentName: section.departmentName,
                                  departmentId: section.departmentId,
                                  currentUserId: role.assignedUserId,
                                });
                                setUserSearch("");
                              }}
                            >
                              <UserPlus className="h-3.5 w-3.5 mr-1" />
                              {isFilled ? "Change" : "Assign"}
                            </Button>
                            {isFilled && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-red-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() =>
                                  handleClear(role.id, role.role)
                                }
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                        {!canAssign && isFilled && (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        )}
                        {!canAssign && !isFilled && (
                          <div className="h-4 w-4 rounded-full border-2 border-clay-300 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Assignment Dialog (Department Roles) */}
      <Dialog
        open={!!assignTarget}
        onOpenChange={(open) => {
          if (!open) {
            setAssignTarget(null);
            setUserSearch("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Assigning:{" "}
              <span className="font-medium text-clay-800">
                {assignTarget?.roleName}
              </span>{" "}
              &mdash; {assignTarget?.departmentName}
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-400" />
            <Input
              placeholder="Search by name or email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 -mx-1 px-1">
            {deptFilteredUsers.length === 0 ? (
              <p className="text-sm text-clay-400 text-center py-6">
                No members found in this department
              </p>
            ) : (
              deptFilteredUsers.map((user) => {
                const isCurrentAssignee =
                  user.id === assignTarget?.currentUserId;
                return (
                  <button
                    key={user.id}
                    onClick={() => handleAssign(user)}
                    disabled={assigning}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      isCurrentAssignee
                        ? "bg-green-50 border border-green-200"
                        : "hover:bg-clay-50 border border-transparent"
                    )}
                  >
                    <div className="h-8 w-8 rounded-full bg-[#C8963E]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-[#C8963E]">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-clay-800 truncate">
                        {user.name}
                        {isCurrentAssignee && (
                          <span className="ml-2 text-xs text-green-600 font-normal">
                            (currently assigned)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-clay-400 truncate">
                        {user.email}
                      </p>
                    </div>
                    {assigning ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <UserPlus className="h-4 w-4 text-clay-300 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignTarget(null);
                setUserSearch("");
              }}
              disabled={assigning}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog (Core Roles) */}
      <Dialog
        open={!!coreAssignTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCoreAssignTarget(null);
            setUserSearch("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Core Role</DialogTitle>
            <DialogDescription>
              Assigning:{" "}
              <span className="font-medium text-clay-800">
                {coreAssignTarget?.roleName}
              </span>{" "}
              &mdash; Core Role
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-400" />
            <Input
              placeholder="Search by name or email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 -mx-1 px-1">
            {coreFilteredUsers.length === 0 ? (
              <p className="text-sm text-clay-400 text-center py-6">
                No members found
              </p>
            ) : (
              coreFilteredUsers.map((user) => {
                const isCurrentAssignee =
                  user.name === coreAssignTarget?.currentUserName;
                return (
                  <button
                    key={user.id}
                    onClick={() => handleCoreAssign(user)}
                    disabled={assigning}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      isCurrentAssignee
                        ? "bg-green-50 border border-green-200"
                        : "hover:bg-clay-50 border border-transparent"
                    )}
                  >
                    <div className="h-8 w-8 rounded-full bg-[#C8963E]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-[#C8963E]">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-clay-800 truncate">
                        {user.name}
                        {isCurrentAssignee && (
                          <span className="ml-2 text-xs text-green-600 font-normal">
                            (currently assigned)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-clay-400 truncate">
                        {user.email}
                      </p>
                    </div>
                    {assigning ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <UserPlus className="h-4 w-4 text-clay-300 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCoreAssignTarget(null);
                setUserSearch("");
              }}
              disabled={assigning}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
