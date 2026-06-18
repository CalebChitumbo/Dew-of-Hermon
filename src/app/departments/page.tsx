"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onSnapshot } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { hasMinRole } from "@/lib/permissions";
import { Department, User } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  EmptyStateLux,
  DecorImage,
  luxSurface,
  luxSurfaceHover,
} from "@/components/shared/lux";
import { iconTones } from "@/lib/icon-tones";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Users,
  Search,
  Plus,
  UserCog,
  Shield,
  ArrowRight,
  UserX,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const AVATAR_TONES = [
  "bg-gold/15 text-gold-dark",
  "bg-teal/10 text-teal-dark",
  "bg-[#E6EDE4] text-[#6E8A6C]",
  "bg-[#E6E8F6] text-[#6E74B8]",
  "bg-[#F6E6EA] text-[#BC7488]",
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function AvatarStack({ members }: { members: User[] }) {
  if (members.length === 0) return null;
  const shown = members.slice(0, 4);
  const extra = members.length - shown.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((m, i) => (
          <span
            key={m.id}
            title={m.name}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-white",
              AVATAR_TONES[i % AVATAR_TONES.length]
            )}
          >
            {initialsOf(m.name)}
          </span>
        ))}
        {extra > 0 && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-clay-100 text-[10px] font-bold text-clay-500 ring-2 ring-white">
            +{extra}
          </span>
        )}
      </div>
    </div>
  );
}

function StripCell({
  icon: Icon,
  tone,
  value,
  label,
  hint,
  highlight = false,
}: {
  icon: React.ElementType;
  tone: keyof typeof iconTones;
  value: React.ReactNode;
  label: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div className="relative min-w-0 flex-1 p-5 md:p-6">
      <div className="flex items-center justify-between">
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset ring-white/50", iconTones[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        {highlight && (
          <span aria-hidden className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_0_4px_rgba(248,113,113,0.18)]" />
        )}
      </div>
      <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-clay-400">{label}</p>
      <p className="mt-1 font-display text-[1.7rem] font-bold leading-none text-clay-700">{value}</p>
      <p className="mt-2 truncate text-xs text-clay-400">{hint}</p>
    </div>
  );
}

export default function DepartmentsPage() {
  return (
    <RoleProtected requiredRole="DEPARTMENT_LEAD">
      <DepartmentsContent />
    </RoleProtected>
  );
}

function DepartmentsContent() {
  const { userData } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Admin dialogs
  const [createDeptOpen, setCreateDeptOpen] = useState(false);
  const [assignLeadOpen, setAssignLeadOpen] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [newDept, setNewDept] = useState({ name: "", description: "", icon: "" });
  const [selectedUserId, setSelectedUserId] = useState("");
  const [saving, setSaving] = useState(false);

  const isAdmin = userData ? hasMinRole(userData.role, "ADMIN") : false;

  useEffect(() => {
    const unsub = onSnapshot(safeCollection("departments"), (snapshot) => {
      const depts = snapshot.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() || new Date(),
        }))
        .sort((a, b) => (a as Department).order - (b as Department).order) as Department[];

      if (isAdmin) {
        setDepartments(depts);
      } else if (userData) {
        setDepartments(depts.filter((d) => userData.leadsDepartmentIds?.includes(d.id)));
      }
      setLoading(false);
    });

    return () => unsub();
  }, [isAdmin, userData?.leadsDepartmentIds?.join(",")]);

  useEffect(() => {
    const unsub = onSnapshot(safeCollection("users"), (snapshot) => {
      const users = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() || new Date(),
      })) as User[];
      setMembers(users.filter((u) => u.isActive));
    });

    return () => unsub();
  }, []);

  const getDeptMembers = (deptId: string) =>
    members.filter((m) => m.departmentIds?.includes(deptId));
  const getMemberCount = (deptId: string) => getDeptMembers(deptId).length;
  const getLeads = (deptId: string) =>
    members.filter((m) => m.leadsDepartmentIds?.includes(deptId));

  const filteredDepartments = departments.filter(
    (d) =>
      !searchQuery ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateDept = async () => {
    if (!newDept.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDept),
      });
      if (res.ok) {
        setCreateDeptOpen(false);
        setNewDept({ name: "", description: "", icon: "" });
      }
    } catch (error) {
      console.error("Error creating department:", error);
    }
    setSaving(false);
  };

  const handleAssignLead = async () => {
    if (!selectedDeptId || !selectedUserId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: selectedDeptId,
          action: "assignLead",
          userId: selectedUserId,
        }),
      });
      if (res.ok) {
        setAssignLeadOpen(false);
        setSelectedDeptId("");
        setSelectedUserId("");
      }
    } catch (error) {
      console.error("Error assigning lead:", error);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // ─── Stats ───
  const totalDepts = departments.length;
  const withoutLead = departments.filter((d) => getLeads(d.id).length === 0).length;
  const teamMembers = members.filter((m) => (m.departmentIds?.length ?? 0) > 0).length;
  const coverage = totalDepts > 0 ? Math.round(((totalDepts - withoutLead) / totalDepts) * 100) : 0;

  return (
    <div className="space-y-7">
      <PageHeader
        backHref="/dashboard"
        icon={Building2}
        tone="sage"
        title="Departments"
        description={isAdmin ? "Manage all youth ministry departments" : "Your departments"}
        actions={
          isAdmin ? (
            <>
              <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setAssignLeadOpen(true)}>
                <UserCog className="h-4 w-4" />
                Assign Lead
              </Button>
              <Button variant="gold" className="gap-2 rounded-xl shadow-sm" onClick={() => setCreateDeptOpen(true)}>
                <Plus className="h-4 w-4" />
                New Department
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Stats strip with soft church-interior atmosphere */}
      {isAdmin && (
        <div className={cn("relative overflow-hidden", luxSurface)}>
          <DecorImage
            src="/images/dashboard/asset-church-interior-wide.png"
            className="absolute inset-0 h-full w-full object-cover opacity-[0.10]"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-white/92 via-white/85 to-white/75"
          />
          <div className="relative flex flex-col divide-y divide-clay-100/80 sm:grid sm:grid-cols-2 sm:divide-y-0 lg:flex lg:flex-row lg:[&>*]:border-l lg:[&>*]:border-clay-100/80 lg:[&>*:first-child]:border-l-0">
            <StripCell icon={Building2} tone="sage" value={totalDepts} label="Active Departments" hint="currently running" />
            <StripCell icon={Users} tone="teal" value={teamMembers} label="Team Members" hint="across all teams" />
            <StripCell
              icon={UserX}
              tone="amber"
              value={withoutLead}
              label="Without Lead"
              hint="need a lead assigned"
              highlight={withoutLead > 0}
            />
            <StripCell icon={ShieldCheck} tone="gold" value={`${coverage}%`} label="Coverage" hint="departments with a lead" />
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-400" />
        <Input
          placeholder="Search departments..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-11 rounded-xl pl-10"
        />
      </div>

      {/* Department Grid */}
      {filteredDepartments.length === 0 ? (
        <div className={cn(luxSurface)}>
          <EmptyStateLux
            icon={Building2}
            tone="sage"
            title={searchQuery ? "No departments found" : "No departments yet"}
            description={
              searchQuery
                ? "No departments match your search. Try a different term."
                : "No departments have been created yet."
            }
            action={
              isAdmin && !searchQuery ? (
                <Button variant="gold" className="gap-2 rounded-xl" onClick={() => setCreateDeptOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New Department
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDepartments.map((dept) => {
            const deptMembers = getDeptMembers(dept.id);
            const memberCount = deptMembers.length;
            const leads = getLeads(dept.id);

            return (
              <Link
                key={dept.id}
                href={`/departments/${dept.id}`}
                className={cn("group relative flex flex-col overflow-hidden p-5", luxSurface, luxSurfaceHover)}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E6EDE4] text-xl ring-1 ring-inset ring-white/50">
                    {dept.icon || <Building2 className="h-5 w-5 text-[#6E8A6C]" />}
                  </span>
                  {leads.length > 0 ? (
                    <Badge variant="outline" className="gap-1 border-clay-200 text-xs">
                      <Shield className="h-3 w-3 text-gold-dark" />
                      {leads.map((l) => l.name.split(" ")[0]).join(", ")}
                    </Badge>
                  ) : (
                    <Badge className="border-transparent bg-amber-50 text-xs text-amber-600">No Lead</Badge>
                  )}
                </div>

                <h3 className="mt-4 font-display text-lg font-semibold text-clay-700">{dept.name}</h3>
                {dept.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-clay-500">{dept.description}</p>
                )}

                <div className="mt-auto flex items-center justify-between pt-5">
                  <div className="flex items-center gap-2.5">
                    {memberCount > 0 ? (
                      <AvatarStack members={deptMembers} />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-clay-50 text-clay-300 ring-2 ring-white">
                        <Users className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <span className="text-sm text-clay-500">
                      {memberCount} member{memberCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream/70 text-clay-300 transition-all group-hover:bg-gold/15 group-hover:text-gold-dark">
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Department Dialog */}
      <Dialog open={createDeptOpen} onOpenChange={setCreateDeptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Department</DialogTitle>
            <DialogDescription>Add a new department to the youth ministry</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="deptName">Department Name</Label>
              <Input
                id="deptName"
                placeholder="e.g. Outreach & Evangelism"
                value={newDept.name}
                onChange={(e) => setNewDept((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="deptDesc">Description (optional)</Label>
              <Input
                id="deptDesc"
                placeholder="Brief description of the department"
                value={newDept.description}
                onChange={(e) => setNewDept((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="deptIcon">Icon (emoji, optional)</Label>
              <Input
                id="deptIcon"
                placeholder="e.g. 🎯"
                value={newDept.icon}
                onChange={(e) => setNewDept((prev) => ({ ...prev, icon: e.target.value }))}
                className="w-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDeptOpen(false)}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleCreateDept} disabled={!newDept.name.trim() || saving}>
              {saving ? <LoadingSpinner size="sm" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Department Lead Dialog */}
      <Dialog open={assignLeadOpen} onOpenChange={setAssignLeadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Department Lead</DialogTitle>
            <DialogDescription>
              Select a department and a member to assign as the department manager
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Department</Label>
              <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.icon} {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Member</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select member..." />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedDeptId && (
              <div className="rounded-md bg-clay-50 p-3">
                <p className="mb-1 text-xs text-clay-500">Current leads:</p>
                {getLeads(selectedDeptId).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {getLeads(selectedDeptId).map((l) => (
                      <Badge key={l.id} variant="outline" className="text-xs">
                        {l.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-clay-400">No leads assigned</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignLeadOpen(false)}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleAssignLead} disabled={!selectedDeptId || !selectedUserId || saving}>
              {saving ? <LoadingSpinner size="sm" /> : "Assign Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
