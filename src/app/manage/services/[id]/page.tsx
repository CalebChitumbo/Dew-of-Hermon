"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  documentId,
} from "firebase/firestore";
import { safeCollection, safeDoc } from "@/lib/firebase";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useAuth } from "@/contexts/AuthContext";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { LoadingSpinner, PageLoader } from "@/components/shared/LoadingSpinner";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import {
  Bell,
  Calendar,
  MapPin,
  Clock,
  UserPlus,
  UserMinus,
  Search,
  CheckCircle2,
  ClipboardList,
  AlertTriangle,
  Users,
  Shield,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import { canAssignAnyRole } from "@/lib/permissions";
import {
  Service,
  AppEvent,
  ServiceAssignment,
  ServiceRole,
  Department,
  User,
  AssignmentStatus,
} from "@/types";

// ─── Types ───

interface ServiceData extends Service {
  event: AppEvent | null;
}

interface RoleWithAssignment extends ServiceRole {
  departmentName: string;
  assignment: ServiceAssignment | null;
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
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(filled / total, 1);
  const offset = circumference - ratio * circumference;

  let strokeColor = "#ef4444"; // red
  if (ratio >= 1) strokeColor = "#22c55e"; // green
  else if (ratio >= 0.7) strokeColor = "#14b8a6"; // teal
  else if (ratio >= 0.4) strokeColor = "#d4a017"; // gold

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e0d8"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-display font-bold text-clay-700">
          {filled}/{total}
        </span>
        <span className="text-xs text-clay-500">roles filled</span>
      </div>
    </div>
  );
}

// ─── Department Group Colors ───

const departmentColors: Record<string, string> = {
  Worship: "border-l-purple-400 bg-purple-50/30",
  Technical: "border-l-blue-400 bg-blue-50/30",
  Ministry: "border-l-green-400 bg-green-50/30",
  Hospitality: "border-l-orange-400 bg-orange-50/30",
  Admin: "border-l-clay-400 bg-clay-50/30",
  default: "border-l-clay-300 bg-white/70",
};

function getDeptColor(deptName: string): string {
  for (const [key, value] of Object.entries(departmentColors)) {
    if (deptName.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return departmentColors.default;
}

// ─── Member Selector Dialog ───

interface MemberSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (userId: string) => void;
  members: User[];
  departments: Department[];
  assignedUserIds: Set<string>;
  roleName: string;
  loading: boolean;
}

function MemberSelector({
  open,
  onClose,
  onSelect,
  members,
  departments,
  assignedUserIds,
  roleName,
  loading,
}: MemberSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const deptMap = useMemo(() => {
    const map: Record<string, string> = {};
    departments.forEach((d) => {
      map[d.id] = d.name;
    });
    return map;
  }, [departments]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return members
      .filter((m) => m.isActive)
      .filter((m) => {
        if (!q) return true;
        return (
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.departmentIds.some((dId) =>
            deptMap[dId]?.toLowerCase().includes(q)
          )
        );
      })
      .sort((a, b) => {
        // Show available members first, assigned ones last
        const aAssigned = assignedUserIds.has(a.id);
        const bAssigned = assignedUserIds.has(b.id);
        if (aAssigned !== bAssigned) return aAssigned ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
  }, [members, searchQuery, assignedUserIds, deptMap]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Member</DialogTitle>
          <DialogDescription>
            Select a member to assign as <strong>{roleName}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-400" />
          <Input
            placeholder="Search by name, email, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {/* Member list */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1 min-h-0 max-h-[400px]">
          {loading ? (
            <div className="py-8 text-center">
              <LoadingSpinner size="md" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="h-8 w-8 text-clay-300 mx-auto mb-2" />
              <p className="text-sm text-clay-500">No members found</p>
            </div>
          ) : (
            filteredMembers.map((member) => {
              const isAssigned = assignedUserIds.has(member.id);

              return (
                <button
                  key={member.id}
                  onClick={() => {
                    if (!isAssigned) onSelect(member.id);
                  }}
                  disabled={isAssigned}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    isAssigned
                      ? "opacity-50 cursor-not-allowed bg-clay-50 border-clay-200"
                      : "hover:bg-teal/5 hover:border-teal/30 border-clay-200 cursor-pointer"
                  }`}
                  title={
                    isAssigned
                      ? "This member is already assigned to a role in this service"
                      : `Assign ${member.name}`
                  }
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-clay-700">
                        {member.name}
                      </p>
                      <p className="text-xs text-clay-500">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isAssigned && (
                        <Badge variant="secondary" className="text-[10px]">
                          Assigned
                        </Badge>
                      )}
                    </div>
                  </div>
                  {member.departmentIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {member.departmentIds.map((dId) => (
                        <Badge
                          key={dId}
                          variant="gold"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {deptMap[dId] || dId}
                        </Badge>
                      ))}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Role Card ───

interface RoleCardProps {
  role: RoleWithAssignment;
  onAssign: (roleId: string) => void;
  onRemove: (assignmentId: string) => void;
  isRemoving: string | null;
  canDelete: boolean;
  canAssign: boolean;
}

function RoleCard({ role, onAssign, onRemove, isRemoving, canDelete, canAssign }: RoleCardProps) {
  const assignment = role.assignment;
  const status: AssignmentStatus | "UNASSIGNED" = assignment
    ? assignment.status
    : "UNASSIGNED";

  return (
    <div
      className={`rounded-lg border-l-4 border border-clay-100/70 p-4 transition-colors ${getDeptColor(
        role.departmentName
      )}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm text-clay-700 truncate">
              {role.name}
            </h4>
            <StatusBadge status={status} />
          </div>
          <p className="text-xs text-clay-500 mb-2">{role.departmentName}</p>
          {assignment ? (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-clay-200 flex items-center justify-center text-xs font-medium text-clay-600">
                {assignment.userName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-clay-700 truncate">
                  {assignment.userName}
                </p>
                <p className="text-xs text-clay-400 truncate">
                  {assignment.userEmail}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-clay-400 italic">Unassigned</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          {assignment ? (
            canDelete ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRemove(assignment.id)}
                disabled={isRemoving === assignment.id}
                className="gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                {isRemoving === assignment.id ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <UserMinus className="h-3 w-3" />
                )}
                Remove
              </Button>
            ) : null
          ) : canAssign ? (
            <Button
              variant="teal"
              size="sm"
              onClick={() => onAssign(role.id)}
              className="gap-1 text-xs"
            >
              <UserPlus className="h-3 w-3" />
              Assign
            </Button>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-clay-400"
              title={`Only the ${role.departmentName} head or an admin can assign this role.`}
            >
              <Lock className="h-3 w-3" />
              {role.departmentName} head
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Assignment Board ───

function AssignmentBoardContent() {
  const params = useParams();
  const serviceId = params.id as string;
  const { userData } = useAuth();
  const isSuperAdmin = userData?.role === "SUPER_ADMIN";
  // ADMIN+ can staff any role; a department head only staffs the departments
  // they lead. Mirrors the server-side scoping on the assignment API.
  const isAdminAssigner = userData ? canAssignAnyRole(userData.role) : false;
  const myLeadDeptIds = useMemo(
    () => new Set(userData?.leadsDepartmentIds || []),
    [userData]
  );
  const { toast } = useToast();

  // State
  const [service, setService] = useState<ServiceData | null>(null);
  const [roles, setRoles] = useState<ServiceRole[]>([]);
  const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);

  // Dialog state
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderConfirmOpen, setReminderConfirmOpen] = useState(false);

  // ─── Load service data (real-time) ───

  useEffect(() => {
    if (!serviceId) return;

    // Listen to service doc
    const unsubService = onSnapshot(
      safeDoc("services", serviceId),
      async (snapshot) => {
        if (!snapshot.exists()) {
          setService(null);
          setLoading(false);
          return;
        }

        const data = snapshot.data();
        let event: AppEvent | null = null;

        // Fetch linked event
        if (data.eventId) {
          const { getDoc } = await import("firebase/firestore");
          const eventDoc = await getDoc(safeDoc("events", data.eventId));
          if (eventDoc.exists()) {
            const eData = eventDoc.data();
            event = {
              id: eventDoc.id,
              title: eData.title,
              description: eData.description || null,
              type: eData.type,
              startDate: eData.startDate?.toDate?.() || new Date(),
              endDate: eData.endDate?.toDate?.() || null,
              venue: eData.venue,
              isRecurring: eData.isRecurring || false,
              createdBy: eData.createdBy,
              lifeGroupTarget: eData.lifeGroupTarget || null,
              approvalStatus: eData.approvalStatus || "APPROVED",
              approvalComments: eData.approvalComments || null,
              approvedBy: eData.approvedBy || null,
              approvedAt: eData.approvedAt?.toDate?.() || null,
              createdByDepartmentId: eData.createdByDepartmentId || null,
              coreRoles: eData.coreRoles || [],
              speaker: eData.speaker || null,
              objective: eData.objective || null,
              isPaid: eData.isPaid || false,
              attendanceFee: eData.attendanceFee ?? null,
              attendanceFeeCurrency: eData.attendanceFeeCurrency || null,
              transportRequired: eData.transportRequired || false,
              transportNeeds: eData.transportNeeds || null,
              transportRequestId: eData.transportRequestId || null,
              budgetRequested: eData.budgetRequested || false,
              budgetAmount: eData.budgetAmount ?? null,
              budgetCurrency: eData.budgetCurrency || null,
              budgetPurpose: eData.budgetPurpose || null,
              budgetRequestId: eData.budgetRequestId || null,
              mediaRequired: eData.mediaRequired || false,
              mediaNeeds: eData.mediaNeeds || null,
              mediaRequestId: eData.mediaRequestId || null,
              foodRequired: eData.foodRequired || false,
              foodNeeds: eData.foodNeeds || null,
              foodRequestId: eData.foodRequestId || null,
              viceChairApprovedBy: eData.viceChairApprovedBy || null,
              viceChairApprovedAt: eData.viceChairApprovedAt?.toDate?.() || null,
              chairApprovedBy: eData.chairApprovedBy || null,
              chairApprovedAt: eData.chairApprovedAt?.toDate?.() || null,
              createdAt: eData.createdAt?.toDate?.() || new Date(),
              updatedAt: eData.updatedAt?.toDate?.() || new Date(),
            };
          }
        }

        setService({
          id: snapshot.id,
          eventId: data.eventId,
          theme: data.theme || null,
          serviceTime: data.serviceTime,
          programNotes: data.programNotes || null,
          attendanceCount: data.attendanceCount || null,
          isArchived: data.isArchived || false,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          event,
        });

        setLoading(false);
      }
    );

    return () => unsubService();
  }, [serviceId]);

  // ─── Load roles ───

  useEffect(() => {
    const rolesRef = safeCollection("serviceRoles");
    const rolesQuery = query(rolesRef, orderBy("order"));

    const unsubRoles = onSnapshot(rolesQuery, (snapshot) => {
      const rolesData = snapshot.docs.map((doc) => {
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
          order: data.order || 0,
        } as ServiceRole;
      });
      setRoles(rolesData);
    });

    return () => unsubRoles();
  }, []);

  // ─── Load assignments (API with real-time fallback) ───

  const fetchAssignmentsViaApi = useCallback(async () => {
    try {
      const res = await fetch(`/api/services/${serviceId}/assignments`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const assignmentsData = (data.assignments || []).map(
        (a: Record<string, unknown>) => ({
          ...a,
          emailSentAt: a.emailSentAt ? new Date(a.emailSentAt as string) : null,
          confirmedAt: a.confirmedAt ? new Date(a.confirmedAt as string) : null,
          createdAt: a.createdAt ? new Date(a.createdAt as string) : new Date(),
          updatedAt: a.updatedAt ? new Date(a.updatedAt as string) : new Date(),
        })
      ) as ServiceAssignment[];
      setAssignments(assignmentsData);
    } catch (err) {
      console.error("Error fetching assignments via API:", err);
    }
  }, [serviceId]);

  useEffect(() => {
    if (!serviceId) return;

    // Always load via API first (bypasses Firestore rules)
    fetchAssignmentsViaApi();

    // Then try real-time listener for live updates
    const assignmentsRef = safeCollection("serviceAssignments");
    const assignmentsQuery = query(
      assignmentsRef,
      where("serviceId", "==", serviceId)
    );

    const unsubAssignments = onSnapshot(
      assignmentsQuery,
      (snapshot) => {
        const assignmentsData = snapshot.docs.map((doc) => {
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
            emailSentAt: data.emailSentAt?.toDate?.() || null,
            confirmedAt: data.confirmedAt?.toDate?.() || null,
            notes: data.notes || null,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          } as ServiceAssignment;
        });
        setAssignments(assignmentsData);
      },
      (error) => {
        // Real-time listener failed (likely Firestore rules not deployed)
        // Data is already loaded via API, so just log the error
        console.warn("Real-time assignment listener unavailable:", error.message);
      }
    );

    return () => unsubAssignments();
  }, [serviceId, fetchAssignmentsViaApi]);

  // ─── Load departments ───

  useEffect(() => {
    const deptRef = safeCollection("departments");
    const deptQuery = query(deptRef, orderBy("order"));

    const unsubDept = onSnapshot(deptQuery, (snapshot) => {
      const deptData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          description: data.description || null,
          icon: data.icon || "",
          order: data.order || 0,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } as Department;
      });
      setDepartments(deptData);
    });

    return () => unsubDept();
  }, []);

  // ─── Load members when dialog opens ───

  const loadMembers = useCallback(async () => {
    if (members.length > 0) return;
    setMembersLoading(true);
    try {
      const membersRef = safeCollection("users");
      const membersQuery = query(
        membersRef,
        where("isActive", "==", true)
      );
      const snapshot = await getDocs(membersQuery);
      const membersData = snapshot.docs
        .map((doc) => {
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
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          } as User;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      setMembers(membersData);
    } catch (error) {
      console.error("Error loading members:", error);
      toast({
        title: "Error",
        description: "Failed to load members list",
        variant: "destructive",
      });
    } finally {
      setMembersLoading(false);
    }
  }, [members.length, toast]);

  // ─── Computed data ───

  const departmentMap = useMemo(() => {
    const map: Record<string, string> = {};
    departments.forEach((d) => {
      map[d.id] = d.name;
    });
    return map;
  }, [departments]);

  const assignmentsByRoleId = useMemo(() => {
    const map: Record<string, ServiceAssignment> = {};
    assignments.forEach((a) => {
      map[a.roleId] = a;
    });
    return map;
  }, [assignments]);

  const assignedUserIds = useMemo(() => {
    return new Set(assignments.map((a) => a.userId));
  }, [assignments]);

  const rolesWithAssignments: RoleWithAssignment[] = useMemo(() => {
    return roles.map((role) => ({
      ...role,
      departmentName: departmentMap[role.departmentId] || "General",
      assignment: assignmentsByRoleId[role.id] || null,
    }));
  }, [roles, departmentMap, assignmentsByRoleId]);

  // Group roles by department, surfacing the departments this head leads first
  // so they land straight on the roles they're responsible for.
  const departmentGroups = useMemo(() => {
    const groups: {
      deptId: string;
      deptName: string;
      roles: RoleWithAssignment[];
      isMine: boolean;
    }[] = [];
    const indexByDept: Record<string, number> = {};
    rolesWithAssignments.forEach((role) => {
      if (indexByDept[role.departmentId] === undefined) {
        indexByDept[role.departmentId] = groups.length;
        groups.push({
          deptId: role.departmentId,
          deptName: role.departmentName,
          roles: [],
          isMine: !isAdminAssigner && myLeadDeptIds.has(role.departmentId),
        });
      }
      groups[indexByDept[role.departmentId]].roles.push(role);
    });
    // Stable sort keeps the original order within each tier.
    return groups.sort((a, b) =>
      a.isMine === b.isMine ? 0 : a.isMine ? -1 : 1
    );
  }, [rolesWithAssignments, isAdminAssigner, myLeadDeptIds]);

  // The role names this head is responsible for (for the orientation banner).
  const myRoleNames = useMemo(
    () =>
      departmentGroups
        .filter((g) => g.isMine)
        .flatMap((g) => g.roles.map((r) => r.name)),
    [departmentGroups]
  );

  const filledCount = assignments.length;
  const totalRoles = roles.length || 13;

  // ─── Handlers ───

  const handleOpenAssignDialog = useCallback(
    (roleId: string) => {
      setSelectedRoleId(roleId);
      setSelectorOpen(true);
      loadMembers();
    },
    [loadMembers]
  );

  const handleAssign = useCallback(
    async (userId: string) => {
      if (!selectedRoleId || !userData) return;

      setAssigning(true);
      try {
        const response = await fetchWithAuth(
          `/api/services/${serviceId}/assignments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roleId: selectedRoleId, userId }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to create assignment");
        }

        toast({
          title: "Assignment created",
          description: `${result.assignment.userName} has been assigned as ${result.assignment.roleName}.`,
          variant: "success",
        });

        setSelectorOpen(false);
        setSelectedRoleId(null);
        // Refresh assignments in case real-time listener isn't active
        fetchAssignmentsViaApi();
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to create assignment";
        toast({
          title: "Assignment failed",
          description: message,
          variant: "destructive",
        });
      } finally {
        setAssigning(false);
      }
    },
    [selectedRoleId, serviceId, userData, toast, fetchAssignmentsViaApi]
  );

  const handleRemoveAssignment = useCallback(
    async (assignmentId: string) => {
      if (!userData) return;

      setRemovingId(assignmentId);
      try {
        const response = await fetchWithAuth(
          `/api/services/${serviceId}/assignments/${assignmentId}`,
          { method: "DELETE" }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to remove assignment");
        }

        toast({
          title: "Assignment removed",
          description: "The role assignment has been removed.",
        });
        // Refresh assignments in case real-time listener isn't active
        fetchAssignmentsViaApi();
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to remove assignment";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      } finally {
        setRemovingId(null);
      }
    },
    [serviceId, userData, toast, fetchAssignmentsViaApi]
  );

  const handleSendReminder = useCallback(async () => {
    if (!userData) return;

    setSendingReminder(true);
    setReminderConfirmOpen(false);
    try {
      const response = await fetchWithAuth(`/api/services/${serviceId}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to send reminders");
      }

      if (result.errors > 0 && result.sent === 0) {
        // All emails failed
        const detail = result.errorDetails?.[0] || "Check email configuration.";
        toast({
          title: "Reminders failed to send",
          description: `Could not send to any of the ${result.total || "assigned"} member(s). ${detail}`,
          variant: "destructive",
        });
      } else if (result.errors > 0) {
        // Some emails failed
        toast({
          title: "Some reminders failed",
          description: `Sent to ${result.sent} member${result.sent !== 1 ? "s" : ""}, but ${result.errors} failed.${result.errorDetails?.[0] ? ` ${result.errorDetails[0]}` : ""}`,
          variant: "destructive",
        });
      } else if (result.sent === 0) {
        // No emails were sent (e.g. all declined)
        const reason = result.skipped > 0
          ? `All ${result.skipped} assignment(s) have been declined.`
          : "No eligible members to notify.";
        toast({
          title: "No reminders sent",
          description: reason,
        });
      } else {
        toast({
          title: "Reminders sent",
          description: `Notification reminders sent to ${result.sent} assigned member${result.sent !== 1 ? "s" : ""}.`,
          variant: "success",
        });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to send reminders";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSendingReminder(false);
    }
  }, [serviceId, userData, toast]);

  // ─── Render ───

  if (loading) return <PageLoader />;

  if (!service) {
    return (
      <EmptyState
        icon={AlertTriangle}
        tone="clay"
        title="Service Not Found"
        description="This service may have been deleted or the link is invalid."
        action={
          <Link href="/manage/services">
            <Button variant="outline">Back to Services</Button>
          </Link>
        }
        className="min-h-[60vh] justify-center"
      />
    );
  }

  const eventDate = service.event?.startDate
    ? new Date(service.event.startDate as unknown as string)
    : null;

  const selectedRole = selectedRoleId
    ? rolesWithAssignments.find((r) => r.id === selectedRoleId)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        backHref="/manage/services"
        icon={Calendar}
        tone="sage"
        title={service.theme || "Service"}
        description={
          <span className="flex flex-wrap items-center gap-3">
            {eventDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(eventDate, "EEEE, d MMMM yyyy")}
              </span>
            )}
            {service.event?.venue && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {service.event.venue}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {service.serviceTime}
            </span>
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setReminderConfirmOpen(true)}
              disabled={sendingReminder || assignments.length === 0}
            >
              {sendingReminder ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {sendingReminder ? "Sending..." : "Remind"}
              </span>
            </Button>
            <Link href={`/manage/services/${serviceId}/checklist`}>
              <Button variant="outline" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Checklist</span>
              </Button>
            </Link>
          </>
        }
      />

      {/* Readiness Ring + Stats */}
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ReadinessRing filled={filledCount} total={totalRoles} />
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center sm:text-left">
                <p className="text-2xl font-display font-bold text-green-600">
                  {assignments.filter((a) => a.status === "CONFIRMED").length}
                </p>
                <p className="text-xs text-clay-500">Confirmed</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-2xl font-display font-bold text-gold">
                  {assignments.filter((a) => a.status === "PENDING").length}
                </p>
                <p className="text-xs text-clay-500">Pending</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-2xl font-display font-bold text-red-500">
                  {assignments.filter((a) => a.status === "DECLINED").length}
                </p>
                <p className="text-xs text-clay-500">Declined</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-2xl font-display font-bold text-clay-400">
                  {totalRoles - filledCount}
                </p>
                <p className="text-xs text-clay-500">Unassigned</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Department-head orientation */}
      {!isAdminAssigner && myRoleNames.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-teal/30 bg-teal/[0.06] p-4">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-teal-dark" />
          <p className="text-sm text-clay-600">
            You&apos;re assigning for{" "}
            <span className="font-semibold text-clay-700">
              {myRoleNames.join(", ")}
            </span>
            . Other departments are filled by their own heads.
          </p>
        </div>
      )}

      {/* Roles by Department */}
      {roles.length === 0 ? (
        <EmptyState
          icon={Shield}
          tone="clay"
          title="No Roles Defined"
          description="Service roles have not been set up yet. Please contact an administrator to configure the 13 service roles in the system settings."
        />
      ) : (
        <div className="space-y-6">
          {departmentGroups.map((group) => (
            <div
              key={group.deptId}
              className={
                group.isMine
                  ? "rounded-2xl border border-teal/30 bg-teal/[0.04] p-4"
                  : undefined
              }
            >
              <SectionHeading
                className="mb-3"
                actions={
                  <div className="flex items-center gap-2">
                    {group.isMine && (
                      <Badge className="border border-teal/30 bg-teal/10 text-[10px] font-medium text-teal-dark">
                        Your department
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {group.roles.filter((r) => r.assignment).length}/
                      {group.roles.length}
                    </Badge>
                  </div>
                }
              >
                {group.deptName}
              </SectionHeading>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.roles.map((role) => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    onAssign={handleOpenAssignDialog}
                    onRemove={handleRemoveAssignment}
                    isRemoving={removingId}
                    canDelete={isSuperAdmin}
                    canAssign={isAdminAssigner || myLeadDeptIds.has(role.departmentId)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reminder Confirmation Dialog */}
      <Dialog
        open={reminderConfirmOpen}
        onOpenChange={(o) => !o && setReminderConfirmOpen(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Reminders</DialogTitle>
            <DialogDescription>
              This will send a notification reminder (email and in-app) to all{" "}
              {assignments.filter((a) => a.status !== "DECLINED").length} assigned
              member{assignments.filter((a) => a.status !== "DECLINED").length !== 1 ? "s" : ""}{" "}
              for this service. Declined assignments will be skipped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setReminderConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="teal" onClick={handleSendReminder}>
              <Bell className="h-4 w-4 mr-2" />
              Send Reminders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Selector Dialog */}
      <MemberSelector
        open={selectorOpen}
        onClose={() => {
          setSelectorOpen(false);
          setSelectedRoleId(null);
        }}
        onSelect={handleAssign}
        members={members}
        departments={departments}
        assignedUserIds={assignedUserIds}
        roleName={selectedRole?.name || ""}
        loading={membersLoading || assigning}
      />
    </div>
  );
}

export default function ServiceAssignmentBoardPage() {
  return (
    <RoleProtected requiredRole="DEPARTMENT_LEAD">
      <div className="min-h-screen bg-cream">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <AssignmentBoardContent />
        </div>
      </div>
    </RoleProtected>
  );
}
