"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDocs, query, orderBy } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Department, UserRole } from "@/types";
import { roleLabels, canManageMembers, getAssignableRoles } from "@/lib/permissions";
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
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ArrowLeft, Save, Shield, X } from "lucide-react";

// Roles are filtered dynamically based on caller via getAssignableRoles

export default function NewMemberPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("MEMBER");
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchDepartments() {
      try {
        const deptsQuery = query(safeCollection("departments"), orderBy("order"));
        const snapshot = await getDocs(deptsQuery);
        const deptsData = snapshot.docs.map((doc) => {
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
        console.error("Error fetching departments:", error);
      } finally {
        setLoadingDepts(false);
      }
    }

    fetchDepartments();
  }, []);

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
    if (!userData) return;

    setSubmitting(true);

    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          role,
          departmentIds: selectedDeptIds,
          callerRole: userData.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create member");
      }

      toast({
        title: "Member created",
        description: `${name} has been added successfully. Temporary password: ${data.tempPassword}`,
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

  function toggleDepartment(deptId: string) {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId)
        ? prev.filter((id) => id !== deptId)
        : [...prev, deptId]
    );
  }

  const hasAccess = userData && canManageMembers(userData.role);
  const assignableRoles = userData ? getAssignableRoles(userData.role) : [];

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-700">
          Access Denied
        </h2>
        <p className="text-clay-500 mt-2">
          You do not have permission to add members.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link href="/manage/members">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
            Add New Member
          </h1>
          <p className="text-clay-500 mt-1">
            Create a new member account
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Member Details</CardTitle>
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
                  if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
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

            <Separator />

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
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
            </div>

            <Separator />

            {/* Department Multi-Select */}
            <div className="space-y-3">
              <Label>Departments</Label>
              <p className="text-sm text-clay-500">
                Select the departments this member belongs to.
              </p>

              {loadingDepts ? (
                <LoadingSpinner size="sm" />
              ) : departments.length === 0 ? (
                <p className="text-sm text-clay-400">
                  No departments available. Create departments first.
                </p>
              ) : (
                <>
                  {/* Selected departments */}
                  {selectedDeptIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedDeptIds.map((deptId) => {
                        const dept = departments.find((d) => d.id === deptId);
                        return (
                          <Badge
                            key={deptId}
                            variant="gold"
                            className="gap-1 cursor-pointer"
                            onClick={() => toggleDepartment(deptId)}
                          >
                            {dept?.name || deptId}
                            <X className="h-3 w-3" />
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  {/* Department grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {departments.map((dept) => {
                      const isSelected = selectedDeptIds.includes(dept.id);
                      return (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => toggleDepartment(dept.id)}
                          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                            isSelected
                              ? "border-gold bg-gold/10 text-clay-700"
                              : "border-clay-200 bg-white text-clay-600 hover:border-clay-300 hover:bg-clay-50"
                          }`}
                        >
                          <div
                            className={`h-4 w-4 rounded border-2 flex items-center justify-center ${
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
                          <span className="text-sm font-medium">
                            {dept.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6">
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
            {submitting ? "Creating..." : "Create Member"}
          </Button>
        </div>
      </form>
    </div>
  );
}
