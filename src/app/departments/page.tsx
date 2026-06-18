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
import { EmptyState } from "@/components/shared/EmptyState";
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
} from "lucide-react";

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
        setDepartments(
          depts.filter((d) => userData.leadsDepartmentIds?.includes(d.id))
        );
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

  const getMemberCount = (deptId: string) =>
    members.filter((m) => m.departmentIds?.includes(deptId)).length;

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

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/dashboard"
        icon={Building2}
        tone="sage"
        title="Departments"
        description={
          isAdmin
            ? "Manage all youth ministry departments"
            : "Your departments"
        }
        actions={
          isAdmin ? (
            <>
              <Button variant="outline" onClick={() => setAssignLeadOpen(true)}>
                <UserCog className="mr-2 h-4 w-4" />
                Assign Lead
              </Button>
              <Button variant="gold" onClick={() => setCreateDeptOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Department
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-400" />
        <Input
          placeholder="Search departments..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Department Grid */}
      {filteredDepartments.length === 0 ? (
        <EmptyState
          icon={Building2}
          tone="clay"
          title="No Departments Found"
          description={
            searchQuery
              ? "No departments match your search"
              : "No departments have been created yet"
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDepartments.map((dept) => {
            const memberCount = getMemberCount(dept.id);
            const leads = getLeads(dept.id);

            return (
              <Link
                key={dept.id}
                href={`/departments/${dept.id}`}
                className="group block rounded-2xl border border-clay-100/70 bg-white/70 p-5 transition-all hover:bg-white hover:shadow-[0_8px_24px_-16px_rgba(91,58,41,0.18)]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6EDE4] text-xl">
                    {dept.icon || <Building2 className="h-5 w-5 text-[#6E8A6C]" />}
                  </span>
                  {leads.length > 0 ? (
                    <Badge variant="outline" className="text-xs">
                      <Shield className="mr-1 h-3 w-3" />
                      {leads.map((l) => l.name.split(" ")[0]).join(", ")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      No Lead
                    </Badge>
                  )}
                </div>
                <h3 className="mt-4 font-display font-semibold text-clay-700">
                  {dept.name}
                </h3>
                {dept.description && (
                  <p className="mt-1 text-sm text-clay-500 line-clamp-2">
                    {dept.description}
                  </p>
                )}
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-clay-500 group-hover:text-gold-dark transition-colors">
                  <Users className="h-4 w-4" />
                  {memberCount} member{memberCount !== 1 ? "s" : ""}
                </p>
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
            <DialogDescription>
              Add a new department to the youth ministry
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="deptName">Department Name</Label>
              <Input
                id="deptName"
                placeholder="e.g. Outreach & Evangelism"
                value={newDept.name}
                onChange={(e) =>
                  setNewDept((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="deptDesc">Description (optional)</Label>
              <Input
                id="deptDesc"
                placeholder="Brief description of the department"
                value={newDept.description}
                onChange={(e) =>
                  setNewDept((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="deptIcon">Icon (emoji, optional)</Label>
              <Input
                id="deptIcon"
                placeholder="e.g. 🎯"
                value={newDept.icon}
                onChange={(e) =>
                  setNewDept((prev) => ({ ...prev, icon: e.target.value }))
                }
                className="w-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDeptOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="gold"
              onClick={handleCreateDept}
              disabled={!newDept.name.trim() || saving}
            >
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
              <div className="bg-clay-50 rounded-md p-3">
                <p className="text-xs text-clay-500 mb-1">Current leads:</p>
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
            <Button
              variant="gold"
              onClick={handleAssignLead}
              disabled={!selectedDeptId || !selectedUserId || saving}
            >
              {saving ? <LoadingSpinner size="sm" /> : "Assign Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
