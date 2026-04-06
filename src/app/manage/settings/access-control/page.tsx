"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onSnapshot } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Save,
  ArrowLeft,
  RotateCcw,
  Pencil,
  Eye,
  EyeOff,
  Lock,
  Plus,
  X,
  Users,
  Crown,
} from "lucide-react";
import {
  AccessLevel,
  Department,
  FeaturePermissions,
  PagePermissions,
  UserRole,
} from "@/types";
import {
  DEFAULT_FEATURE_PERMISSIONS,
  DEFAULT_PAGE_PERMISSIONS,
  FEATURE_DEFINITIONS,
  PAGE_DEFINITIONS,
} from "@/lib/access-control";
import { roleLabels } from "@/lib/permissions";

const CONFIGURABLE_ROLES: UserRole[] = [
  "ADMIN",
  "DEPARTMENT_LEAD",
  "YOUTH_LEADER",
  "MEMBER",
];

const SELECTABLE_MIN_ROLES: UserRole[] = [
  "ADMIN",
  "DEPARTMENT_LEAD",
  "YOUTH_LEADER",
  "MEMBER",
];

const accessLevelConfig: Record<
  AccessLevel,
  { label: string; color: string; icon: React.ElementType; next: AccessLevel }
> = {
  edit: {
    label: "Edit",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: Pencil,
    next: "view",
  },
  view: {
    label: "View Only",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Eye,
    next: "none",
  },
  none: {
    label: "No Access",
    color: "bg-red-100 text-red-600 border-red-200",
    icon: EyeOff,
    next: "edit",
  },
};

export default function AccessControlPage() {
  return (
    <RoleProtected requiredRole="SUPER_ADMIN">
      <AccessControlContent />
    </RoleProtected>
  );
}

function AccessControlContent() {
  const { toast } = useToast();

  // Page permissions state
  const [permissions, setPermissions] = useState<PagePermissions>(
    DEFAULT_PAGE_PERMISSIONS
  );
  const [originalPermissions, setOriginalPermissions] =
    useState<PagePermissions>(DEFAULT_PAGE_PERMISSIONS);

  // Feature permissions state
  const [featurePermissions, setFeaturePermissions] =
    useState<FeaturePermissions>(DEFAULT_FEATURE_PERMISSIONS);
  const [originalFeaturePermissions, setOriginalFeaturePermissions] =
    useState<FeaturePermissions>(DEFAULT_FEATURE_PERMISSIONS);

  // Departments for the feature permissions UI
  const [departments, setDepartments] = useState<Department[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load departments from Firestore
  useEffect(() => {
    const unsub = onSnapshot(safeCollection("departments"), (snapshot) => {
      const depts = snapshot.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() || new Date(),
        }))
        .sort((a: Department, b: Department) => a.order - b.order) as Department[];
      setDepartments(depts);
    });
    return () => unsub();
  }, []);

  // Load saved config
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/settings/access-control");
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            // Merge page permissions
            if (json.data.pagePermissions) {
              const merged = { ...DEFAULT_PAGE_PERMISSIONS };
              for (const key of Object.keys(json.data.pagePermissions)) {
                if (merged[key]) {
                  merged[key] = {
                    ...merged[key],
                    ...json.data.pagePermissions[key],
                  };
                }
              }
              setPermissions(merged);
              setOriginalPermissions(merged);
            }
            // Merge feature permissions
            if (json.data.featurePermissions) {
              const mergedFp = { ...DEFAULT_FEATURE_PERMISSIONS };
              for (const key of Object.keys(json.data.featurePermissions)) {
                if (mergedFp[key] !== undefined) {
                  mergedFp[key] = {
                    ...mergedFp[key],
                    ...json.data.featurePermissions[key],
                  };
                }
              }
              setFeaturePermissions(mergedFp);
              setOriginalFeaturePermissions(mergedFp);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load access control config:", error);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  // ─── Page permission helpers ───

  const toggleAccess = (pageKey: string, role: UserRole) => {
    setPermissions((prev) => {
      const current = prev[pageKey]?.[role] ?? "none";
      const next = accessLevelConfig[current].next;
      return { ...prev, [pageKey]: { ...prev[pageKey], [role]: next } };
    });
  };

  // ─── Feature permission helpers ───

  const setFeatureMinRole = (featureKey: string, minRole: UserRole) => {
    setFeaturePermissions((prev) => ({
      ...prev,
      [featureKey]: { ...prev[featureKey], minRole },
    }));
  };

  const setFeatureDeptMinRole = (featureKey: string, deptMinRole: UserRole) => {
    setFeaturePermissions((prev) => ({
      ...prev,
      [featureKey]: { ...prev[featureKey], deptMinRole },
    }));
  };

  const addLinkedDept = (
    featureKey: string,
    deptId: string,
    access: "lead" | "member"
  ) => {
    setFeaturePermissions((prev) => {
      const existing = prev[featureKey].linkedDepts;
      if (existing.some((d) => d.deptId === deptId)) return prev;
      return {
        ...prev,
        [featureKey]: {
          ...prev[featureKey],
          linkedDepts: [...existing, { deptId, access }],
        },
      };
    });
  };

  const removeLinkedDept = (featureKey: string, deptId: string) => {
    setFeaturePermissions((prev) => ({
      ...prev,
      [featureKey]: {
        ...prev[featureKey],
        linkedDepts: prev[featureKey].linkedDepts.filter(
          (d) => d.deptId !== deptId
        ),
      },
    }));
  };

  const toggleLinkedDeptAccess = (featureKey: string, deptId: string) => {
    setFeaturePermissions((prev) => ({
      ...prev,
      [featureKey]: {
        ...prev[featureKey],
        linkedDepts: prev[featureKey].linkedDepts.map((d) =>
          d.deptId === deptId
            ? { ...d, access: d.access === "lead" ? "member" : "lead" }
            : d
        ),
      },
    }));
  };

  // ─── Save ───

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/access-control", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagePermissions: permissions,
          featurePermissions,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setOriginalPermissions(permissions);
      setOriginalFeaturePermissions(featurePermissions);
      toast({
        title: "Saved",
        description: "Access control settings updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPermissions(DEFAULT_PAGE_PERMISSIONS);
    setFeaturePermissions(DEFAULT_FEATURE_PERMISSIONS);
  };

  const hasChanges =
    JSON.stringify(permissions) !== JSON.stringify(originalPermissions) ||
    JSON.stringify(featurePermissions) !==
      JSON.stringify(originalFeaturePermissions);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/manage/settings"
            className="text-sm text-clay-500 hover:text-clay-700 flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>
          <h1 className="text-2xl font-display text-clay-700 flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Access Control
          </h1>
          <p className="text-clay-500 mt-1">
            Full control over page permissions and department-specific feature
            access. All changes take effect immediately.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset to Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <>
                <LoadingSpinner />
                <span className="ml-2">Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium text-clay-600">Legend:</span>
            {(["edit", "view", "none"] as AccessLevel[]).map((level) => {
              const config = accessLevelConfig[level];
              const Icon = config.icon;
              return (
                <div key={level} className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={`${config.color} text-xs`}
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                </div>
              );
            })}
            <div className="flex items-center gap-1.5 text-clay-400">
              <Lock className="h-3.5 w-3.5" />
              <span className="text-xs">= Locked (cannot be changed)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Page Permissions ─── */}
      <Card>
        <CardHeader>
          <CardTitle>Page Permissions</CardTitle>
          <CardDescription>
            Click any badge to cycle through Edit → View Only → No Access. The
            Chairperson always has full edit access and cannot be modified.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-clay-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-clay-600 w-64">
                    Page
                  </th>
                  {CONFIGURABLE_ROLES.map((role) => (
                    <th
                      key={role}
                      className="text-center py-3 px-3 text-sm font-semibold text-clay-600"
                    >
                      {roleLabels[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PAGE_DEFINITIONS.map((page) => (
                  <tr
                    key={page.key}
                    className="border-b border-clay-100 hover:bg-clay-50/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-sm text-clay-700">
                        {page.label}
                      </div>
                      <div className="text-xs text-clay-400">
                        {page.description}
                      </div>
                    </td>
                    {CONFIGURABLE_ROLES.map((role) => {
                      const level = permissions[page.key]?.[role] ?? "none";
                      const config = accessLevelConfig[level];
                      const Icon = config.icon;
                      const isLocked = page.lockedRoles?.[role] !== undefined;

                      return (
                        <td key={role} className="py-3 px-3 text-center">
                          {isLocked ? (
                            <Badge
                              variant="outline"
                              className={`${config.color} text-xs opacity-60 cursor-not-allowed`}
                            >
                              <Lock className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          ) : (
                            <button
                              onClick={() => toggleAccess(page.key, role)}
                              className="inline-flex"
                            >
                              <Badge
                                variant="outline"
                                className={`${config.color} text-xs cursor-pointer hover:opacity-80 transition-opacity`}
                              >
                                <Icon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="md:hidden space-y-4">
            {PAGE_DEFINITIONS.map((page) => (
              <div
                key={page.key}
                className="border border-clay-200 rounded-lg p-4 space-y-3"
              >
                <div>
                  <div className="font-medium text-sm text-clay-700">
                    {page.label}
                  </div>
                  <div className="text-xs text-clay-400">{page.description}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CONFIGURABLE_ROLES.map((role) => {
                    const level = permissions[page.key]?.[role] ?? "none";
                    const config = accessLevelConfig[level];
                    const Icon = config.icon;
                    const isLocked = page.lockedRoles?.[role] !== undefined;

                    return (
                      <div key={role} className="space-y-1">
                        <div className="text-[10px] font-medium text-clay-500">
                          {roleLabels[role]}
                        </div>
                        {isLocked ? (
                          <Badge
                            variant="outline"
                            className={`${config.color} text-[10px] opacity-60 cursor-not-allowed w-full justify-center`}
                          >
                            <Lock className="h-2.5 w-2.5 mr-0.5" />
                            {config.label}
                          </Badge>
                        ) : (
                          <button
                            onClick={() => toggleAccess(page.key, role)}
                            className="w-full"
                          >
                            <Badge
                              variant="outline"
                              className={`${config.color} text-[10px] cursor-pointer hover:opacity-80 transition-opacity w-full justify-center`}
                            >
                              <Icon className="h-2.5 w-2.5 mr-0.5" />
                              {config.label}
                            </Badge>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Feature Permissions ─── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-display text-clay-700 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Department Feature Permissions
          </h2>
          <p className="text-sm text-clay-500 mt-1">
            Control department-specific features. For each feature, set the
            minimum role that always has access, then optionally link departments
            so their members or leads can also access it regardless of their
            overall role.
          </p>
        </div>

        {FEATURE_DEFINITIONS.map((feature) => {
          const fp = featurePermissions[feature.key] ?? DEFAULT_FEATURE_PERMISSIONS[feature.key];
          const linkedDeptIds = fp.linkedDepts.map((d) => d.deptId);
          const availableDepts = departments.filter(
            (d) => !linkedDeptIds.includes(d.id)
          );

          return (
            <Card key={feature.key}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{feature.label}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Min Role row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Crown className="h-4 w-4 text-clay-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-clay-700">
                        Minimum role (always has access)
                      </p>
                      <p className="text-xs text-clay-400">
                        Users at or above this role can always use this feature.
                        Chairperson is always included.
                      </p>
                    </div>
                  </div>
                  <Select
                    value={fp.minRole}
                    onValueChange={(v) =>
                      setFeatureMinRole(feature.key, v as UserRole)
                    }
                  >
                    <SelectTrigger className="w-48 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SELECTABLE_MIN_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabels[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dept min role row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Shield className="h-4 w-4 text-clay-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-clay-700">
                        Minimum role for department access
                      </p>
                      <p className="text-xs text-clay-400">
                        Within a linked department, users must have at least this
                        role to gain access.
                      </p>
                    </div>
                  </div>
                  <Select
                    value={fp.deptMinRole}
                    onValueChange={(v) =>
                      setFeatureDeptMinRole(feature.key, v as UserRole)
                    }
                  >
                    <SelectTrigger className="w-48 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SELECTABLE_MIN_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabels[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Linked departments */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-clay-700 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-clay-400" />
                    Linked departments
                    {fp.linkedDepts.length === 0 && (
                      <span className="text-xs font-normal text-clay-400 ml-1">
                        (using built-in defaults — add a department to override)
                      </span>
                    )}
                  </p>

                  {fp.linkedDepts.length > 0 && (
                    <div className="space-y-2">
                      {fp.linkedDepts.map(({ deptId, access }) => {
                        const dept = departments.find((d) => d.id === deptId);
                        return (
                          <div
                            key={deptId}
                            className="flex items-center gap-2 p-2 bg-clay-50 rounded-md border border-clay-100"
                          >
                            <span className="text-sm text-clay-700 flex-1 truncate">
                              {dept?.name ?? deptId}
                            </span>
                            {/* Lead / Member toggle */}
                            <button
                              onClick={() =>
                                toggleLinkedDeptAccess(feature.key, deptId)
                              }
                              className="shrink-0"
                            >
                              <Badge
                                variant="outline"
                                className={
                                  access === "lead"
                                    ? "bg-purple-100 text-purple-700 border-purple-200 text-xs cursor-pointer hover:opacity-80"
                                    : "bg-sky-100 text-sky-700 border-sky-200 text-xs cursor-pointer hover:opacity-80"
                                }
                              >
                                {access === "lead"
                                  ? "Leads only"
                                  : "All members"}
                              </Badge>
                            </button>
                            <button
                              onClick={() =>
                                removeLinkedDept(feature.key, deptId)
                              }
                              className="text-clay-400 hover:text-red-500 transition-colors"
                              aria-label="Remove department"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add department */}
                  {availableDepts.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <Select
                        onValueChange={(deptId) =>
                          addLinkedDept(
                            feature.key,
                            deptId,
                            feature.defaultDeptAccess
                          )
                        }
                        value=""
                      >
                        <SelectTrigger className="flex-1 text-clay-500">
                          <div className="flex items-center gap-1.5">
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add a department…</span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {availableDepts.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sticky save bar when changes exist */}
      {hasChanges && (
        <div className="sticky bottom-0 bg-white border-t border-clay-200 -mx-6 px-6 py-3 flex items-center justify-between shadow-lg">
          <p className="text-sm text-clay-600">You have unsaved changes</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPermissions(originalPermissions);
                setFeaturePermissions(originalFeaturePermissions);
              }}
            >
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <LoadingSpinner />
                  <span className="ml-1">Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
