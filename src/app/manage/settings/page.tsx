"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Settings,
  Building2,
  Shield,
  Plus,
  Pencil,
  Trash2,
  Save,
} from "lucide-react";
import type { Department, ServiceRole } from "@/types";

function SettingsContent() {
  const { userData } = useAuth();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<ServiceRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Department dialog state
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState("");
  const [deptDescription, setDeptDescription] = useState("");
  const [deptIcon, setDeptIcon] = useState("");
  const [deptOrder, setDeptOrder] = useState(0);
  const [deptSaving, setDeptSaving] = useState(false);

  // Role dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<ServiceRole | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDeptId, setRoleDeptId] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [roleArrivalTime, setRoleArrivalTime] = useState("");
  const [roleTimeSlot, setRoleTimeSlot] = useState("");
  const [roleOrder, setRoleOrder] = useState(0);
  const [roleSaving, setRoleSaving] = useState(false);

  // Load departments
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "departments"), orderBy("order")),
      (snapshot) => {
        setDepartments(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name,
              description: data.description || null,
              icon: data.icon || "",
              order: data.order || 0,
              createdAt: data.createdAt?.toDate?.() || new Date(),
            } as Department;
          })
        );
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  // Load service roles
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "serviceRoles"), orderBy("order")),
      (snapshot) => {
        setRoles(
          snapshot.docs.map((doc) => {
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
          })
        );
      }
    );
    return unsub;
  }, []);

  // Department handlers
  const openDeptDialog = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setDeptName(dept.name);
      setDeptDescription(dept.description || "");
      setDeptIcon(dept.icon);
      setDeptOrder(dept.order);
    } else {
      setEditingDept(null);
      setDeptName("");
      setDeptDescription("");
      setDeptIcon("");
      setDeptOrder(departments.length + 1);
    }
    setDeptDialogOpen(true);
  };

  const saveDepartment = async () => {
    if (!deptName.trim()) return;
    setDeptSaving(true);
    try {
      const data = {
        name: deptName.trim(),
        description: deptDescription.trim() || null,
        icon: deptIcon.trim() || "📋",
        order: deptOrder,
      };

      if (editingDept) {
        await updateDoc(doc(db, "departments", editingDept.id), data);
        toast({ title: "Department updated", variant: "success" });
      } else {
        await addDoc(collection(db, "departments"), {
          ...data,
          createdAt: new Date(),
        });
        toast({ title: "Department created", variant: "success" });
      }
      setDeptDialogOpen(false);
    } catch (error) {
      console.error("Error saving department:", error);
      toast({
        title: "Error",
        description: "Failed to save department",
        variant: "destructive",
      });
    } finally {
      setDeptSaving(false);
    }
  };

  const deleteDepartment = async (deptId: string) => {
    if (!confirm("Are you sure you want to delete this department?")) return;
    try {
      await deleteDoc(doc(db, "departments", deptId));
      toast({ title: "Department deleted" });
    } catch (error) {
      console.error("Error deleting department:", error);
      toast({
        title: "Error",
        description: "Failed to delete department",
        variant: "destructive",
      });
    }
  };

  // Role handlers
  const openRoleDialog = (role?: ServiceRole) => {
    if (role) {
      setEditingRole(role);
      setRoleName(role.name);
      setRoleDeptId(role.departmentId);
      setRoleDescription(role.description || "");
      setRoleArrivalTime(role.arrivalTime || "");
      setRoleTimeSlot(role.timeSlot || "");
      setRoleOrder(role.order);
    } else {
      setEditingRole(null);
      setRoleName("");
      setRoleDeptId(departments[0]?.id || "");
      setRoleDescription("");
      setRoleArrivalTime("");
      setRoleTimeSlot("");
      setRoleOrder(roles.length + 1);
    }
    setRoleDialogOpen(true);
  };

  const saveRole = async () => {
    if (!roleName.trim() || !roleDeptId) return;
    setRoleSaving(true);
    try {
      const data = {
        name: roleName.trim(),
        departmentId: roleDeptId,
        description: roleDescription.trim() || null,
        arrivalTime: roleArrivalTime.trim() || null,
        timeSlot: roleTimeSlot.trim() || null,
        order: roleOrder,
      };

      if (editingRole) {
        await updateDoc(doc(db, "serviceRoles", editingRole.id), data);
        toast({ title: "Role updated", variant: "success" });
      } else {
        await addDoc(collection(db, "serviceRoles"), {
          ...data,
          emailSubject: `{{Role}} Assignment - Potter's Wheel | {{ServiceDate}}`,
          emailBody: `Greetings {{Name}}\n\nYou have been assigned as {{Role}} at Potter's Wheel Service.\n\nDate: {{ServiceDate}}\nVenue: {{Venue}}\nTheme: {{Theme}}\n\nPlease confirm your availability.\n\nGod bless!\nDew of Hermon Youth Ministry`,
          reminderSchedule: ["THURSDAY"],
        });
        toast({ title: "Role created", variant: "success" });
      }
      setRoleDialogOpen(false);
    } catch (error) {
      console.error("Error saving role:", error);
      toast({
        title: "Error",
        description: "Failed to save role",
        variant: "destructive",
      });
    } finally {
      setRoleSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  const deptMap: Record<string, string> = {};
  departments.forEach((d) => { deptMap[d.id] = d.name; });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
          Settings
        </h1>
        <p className="text-sm text-clay-400 mt-1">
          Manage departments, service roles, and system configuration.
        </p>
      </div>

      {/* Departments Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-clay-400" />
                Departments
              </CardTitle>
              <CardDescription>
                Manage ministry departments
              </CardDescription>
            </div>
            <Button variant="gold" size="sm" onClick={() => openDeptDialog()} className="gap-1">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <p className="text-sm text-clay-400 text-center py-6">
              No departments configured yet.
            </p>
          ) : (
            <div className="space-y-2">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className="flex items-center justify-between py-3 px-4 rounded-lg border border-clay-100 hover:bg-clay-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{dept.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-clay-700">
                        {dept.name}
                      </p>
                      {dept.description && (
                        <p className="text-xs text-clay-400">{dept.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeptDialog(dept)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteDepartment(dept.id)}
                      className="text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Roles Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-clay-400" />
                Service Roles
              </CardTitle>
              <CardDescription>
                Manage the 13 Potter&apos;s Wheel service roles
              </CardDescription>
            </div>
            <Button variant="gold" size="sm" onClick={() => openRoleDialog()} className="gap-1">
              <Plus className="h-4 w-4" />
              Add Role
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <p className="text-sm text-clay-400 text-center py-6">
              No roles configured yet. Run the seed script to populate defaults.
            </p>
          ) : (
            <div className="space-y-2">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center justify-between py-3 px-4 rounded-lg border border-clay-100 hover:bg-clay-50/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-clay-700">
                        {role.name}
                      </p>
                      <Badge variant="gold" className="text-[10px]">
                        {deptMap[role.departmentId] || "Unknown"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {role.arrivalTime && (
                        <span className="text-xs text-clay-400">
                          Arrive: {role.arrivalTime}
                        </span>
                      )}
                      {role.timeSlot && (
                        <span className="text-xs text-clay-400">
                          Slot: {role.timeSlot}
                        </span>
                      )}
                      <span className="text-xs text-clay-400">
                        Reminders: {role.reminderSchedule.join(", ")}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openRoleDialog(role)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department Dialog */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDept ? "Edit Department" : "Add Department"}
            </DialogTitle>
            <DialogDescription>
              {editingDept
                ? "Update the department details."
                : "Create a new ministry department."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deptName">Name</Label>
              <Input
                id="deptName"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="e.g., Worship & Music"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deptDesc">Description</Label>
              <Textarea
                id="deptDesc"
                value={deptDescription}
                onChange={(e) => setDeptDescription(e.target.value)}
                placeholder="Brief description..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deptIcon">Icon (emoji)</Label>
                <Input
                  id="deptIcon"
                  value={deptIcon}
                  onChange={(e) => setDeptIcon(e.target.value)}
                  placeholder="e.g., 🎵"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deptOrder">Display Order</Label>
                <Input
                  id="deptOrder"
                  type="number"
                  value={deptOrder}
                  onChange={(e) => setDeptOrder(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeptDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={saveDepartment} disabled={deptSaving} className="gap-2">
              <Save className="h-4 w-4" />
              {deptSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRole ? "Edit Service Role" : "Add Service Role"}
            </DialogTitle>
            <DialogDescription>
              Configure a Potter&apos;s Wheel service role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roleName">Role Name</Label>
              <Input
                id="roleName"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g., Moderator"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleDept">Department</Label>
              <select
                id="roleDept"
                value={roleDeptId}
                onChange={(e) => setRoleDeptId(e.target.value)}
                className="w-full rounded-md border border-clay-200 px-3 py-2 text-sm"
              >
                <option value="">Select department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.icon} {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleDesc">Description</Label>
              <Textarea
                id="roleDesc"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="Brief description..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roleArrival">Arrival Time</Label>
                <Input
                  id="roleArrival"
                  value={roleArrivalTime}
                  onChange={(e) => setRoleArrivalTime(e.target.value)}
                  placeholder="e.g., 9:30 AM"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roleSlot">Time Slot</Label>
                <Input
                  id="roleSlot"
                  value={roleTimeSlot}
                  onChange={(e) => setRoleTimeSlot(e.target.value)}
                  placeholder="e.g., 11:45 AM - 12:25 PM"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleOrder">Display Order</Label>
              <Input
                id="roleOrder"
                type="number"
                value={roleOrder}
                onChange={(e) => setRoleOrder(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={saveRole} disabled={roleSaving} className="gap-2">
              <Save className="h-4 w-4" />
              {roleSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RoleProtected requiredRole="SUPER_ADMIN">
      <SettingsContent />
    </RoleProtected>
  );
}
