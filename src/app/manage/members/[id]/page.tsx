"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getDocs, query, orderBy } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Department, UserRole } from "@/types";
import {
  roleLabels,
  canManageMembers,
  canManageDeptMembers,
  canChangeUserRoles,
  canDeleteMembers,
  getAssignableRoles,
} from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LoadingSpinner, PageLoader } from "@/components/shared/LoadingSpinner";
import {
  ArrowLeft,
  Save,
  Trash2,
  Shield,
  UserX,
  UserCheck,
  X,
} from "lucide-react";

// Roles are now filtered dynamically based on caller via getAssignableRoles

interface MemberData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  departmentIds: string[];
  leadsDepartmentIds: string[];
  isActive: boolean;
}

export default function EditMemberPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userData } = useAuth();
  const { toast } = useToast();

  const [member, setMember] = useState<MemberData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("MEMBER");
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [leadsDeptIds, setLeadsDeptIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch member
        const memberRes = await fetch(`/api/members/${id}`);
        if (!memberRes.ok) {
          throw new Error("Member not found");
        }
        const memberData = await memberRes.json();
        const m = memberData.user as MemberData;
        setMember(m);
        setName(m.name);
        setEmail(m.email);
        setPhone(m.phone || "");
        setRole(m.role);
        setSelectedDeptIds(m.departmentIds || []);
        setLeadsDeptIds(m.leadsDepartmentIds || []);
        setIsActive(m.isActive);

        // Fetch departments
        const deptsQuery = query(safeCollection("departments"), orderBy("order"));
        const deptsSnapshot = await getDocs(deptsQuery);
        const deptsData = deptsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            description: data.description || null,
            icon: data.icon || "Users",
            order: data.order || 0,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          } as Department;
        });
        setDepartments(deptsData);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Error",
          description: "Failed to load member data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id, toast]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Enter a valid email address";
    }

    if (phone && !/^[\d\s+()-]{7,20}$/.test(phone)) {
      newErrors.phone = "Enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;
    if (!userData || !member) return;

    setSubmitting(true);

    try {
      const response = await fetch(`/api/members/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          role,
          departmentIds: selectedDeptIds,
          leadsDepartmentIds: leadsDeptIds,
          isActive,
          callerRole: userData.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update member");
      }

      toast({
        title: "Member updated",
        description: `${name} has been updated successfully.`,
        variant: "success",
      });

      router.push("/manage/members");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!userData || !member) return;

    setDeleting(true);

    try {
      const response = await fetch(
        `/api/members/${id}?callerRole=${userData.role}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete member");
      }

      toast({
        title: "Member deleted",
        description: `${member.name} has been removed.`,
        variant: "success",
      });

      router.push("/manage/members");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  function toggleDepartment(deptId: string) {
    setSelectedDeptIds((prev) => {
      const next = prev.includes(deptId)
        ? prev.filter((d) => d !== deptId)
        : [...prev, deptId];
      // Also remove from leads if unchecked from departments
      if (!next.includes(deptId)) {
        setLeadsDeptIds((ld) => ld.filter((d) => d !== deptId));
      }
      return next;
    });
  }

  function toggleLeadsDepartment(deptId: string) {
    setLeadsDeptIds((prev) =>
      prev.includes(deptId)
        ? prev.filter((d) => d !== deptId)
        : [...prev, deptId]
    );
  }

  function handleToggleActive() {
    setIsActive((prev) => !prev);
  }

  const hasAccess = userData && (canManageMembers(userData.role) || canManageDeptMembers(userData.role));
  const canEditRole = userData && canChangeUserRoles(userData.role);
  const canDelete = userData && canDeleteMembers(userData.role);
  const assignableRoles = userData ? getAssignableRoles(userData.role) : [];

  if (loading) {
    return <PageLoader />;
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-700">
          Access Denied
        </h2>
        <p className="text-clay-500 mt-2">
          You do not have permission to edit members.
        </p>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-display font-semibold text-clay-700">
          Member Not Found
        </h2>
        <p className="text-clay-500 mt-2">
          The requested member could not be found.
        </p>
        <Link href="/manage/members" className="mt-4">
          <Button variant="outline">Back to Members</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/manage/members">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
              Edit Member
            </h1>
            <p className="text-clay-500 mt-1">
              Update {member.name}&apos;s profile
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={isActive ? "success" : "destructive"}
            className="text-sm"
          >
            {isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name)
                      setErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  placeholder="Enter full name"
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email)
                      setErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  placeholder="Enter email address"
                  className={errors.email ? "border-red-500" : ""}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (errors.phone)
                      setErrors((prev) => ({ ...prev, phone: "" }));
                  }}
                  placeholder="Enter phone number (optional)"
                  className={errors.phone ? "border-red-500" : ""}
                />
                {errors.phone && (
                  <p className="text-sm text-red-500">{errors.phone}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Role & Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Role & Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Role */}
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                {canEditRole ? (
                  <Select
                    value={role}
                    onValueChange={(value) => setRole(value as UserRole)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabels[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div>
                    <Badge variant="secondary" className="text-sm">
                      {roleLabels[role]}
                    </Badge>
                    <p className="text-xs text-clay-400 mt-1">
                      Only admins and above can change user roles.
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Active/Inactive Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Account Status</Label>
                  <p className="text-sm text-clay-500 mt-1">
                    {isActive
                      ? "This member can sign in and access the system."
                      : "This member is deactivated and cannot sign in."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={isActive ? "outline" : "gold"}
                  size="sm"
                  className="gap-2"
                  onClick={handleToggleActive}
                >
                  {isActive ? (
                    <>
                      <UserX className="h-4 w-4" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4" />
                      Activate
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Departments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Departments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-clay-500">
                Select the departments this member belongs to. You can also
                designate them as a department lead.
              </p>

              {/* Selected departments display */}
              {selectedDeptIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedDeptIds.map((deptId) => {
                    const dept = departments.find((d) => d.id === deptId);
                    const isLead = leadsDeptIds.includes(deptId);
                    return (
                      <Badge
                        key={deptId}
                        variant={isLead ? "gold" : "secondary"}
                        className="gap-1 cursor-pointer"
                        onClick={() => toggleDepartment(deptId)}
                      >
                        {dept?.name || deptId}
                        {isLead && " (Lead)"}
                        <X className="h-3 w-3" />
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Department grid */}
              {departments.length === 0 ? (
                <p className="text-sm text-clay-400">
                  No departments available.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {departments.map((dept) => {
                    const isSelected = selectedDeptIds.includes(dept.id);
                    const isLead = leadsDeptIds.includes(dept.id);
                    return (
                      <div
                        key={dept.id}
                        className={`rounded-lg border px-4 py-3 transition-colors ${
                          isSelected
                            ? "border-gold bg-gold/10"
                            : "border-clay-200 bg-white hover:border-clay-300 hover:bg-clay-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => toggleDepartment(dept.id)}
                            className="flex items-center gap-3 flex-1 text-left"
                          >
                            <div
                              className={`h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected
                                  ? "border-gold bg-gold"
                                  : "border-clay-300"
                              }`}
                            >
                              {isSelected && (
                                <svg
                                  className="h-3 w-3 text-white"
                                  viewBox="0 0 12 12"
                                  fill="none"
                                >
                                  <path
                                    d="M10 3L4.5 8.5L2 6"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>
                            <span
                              className={`text-sm font-medium ${
                                isSelected ? "text-clay-700" : "text-clay-600"
                              }`}
                            >
                              {dept.name}
                            </span>
                          </button>

                          {isSelected && (
                            <button
                              type="button"
                              onClick={() => toggleLeadsDepartment(dept.id)}
                              className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                                isLead
                                  ? "bg-gold text-white border-gold"
                                  : "border-clay-300 text-clay-500 hover:border-gold hover:text-gold"
                              }`}
                            >
                              {isLead ? "Lead" : "Set Lead"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            {/* Delete */}
            <div>
              {canDelete && (
                <Dialog
                  open={showDeleteDialog}
                  onOpenChange={setShowDeleteDialog}
                >
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Member</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete{" "}
                        <strong>{member.name}</strong>? This will permanently
                        remove their account and all associated data. This action
                        cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowDeleteDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="gap-2"
                      >
                        {deleting ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        {deleting ? "Deleting..." : "Delete"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Save / Cancel */}
            <div className="flex items-center gap-3">
              <Link href="/manage/members">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
