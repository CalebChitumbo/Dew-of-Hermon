"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  Trash2,
  Users,
  Building2,
  UserCog,
  ChevronDown,
  ChevronRight,
  Check,
  X,
} from "lucide-react";
import {
  AccessLevel,
  DepartmentAccessRule,
  FeatureMinRoles,
  PagePermissions,
  UserRole,
} from "@/types";
import {
  PAGE_DEFINITIONS,
  DEFAULT_PAGE_PERMISSIONS,
  FEATURE_DEFINITIONS,
  DEFAULT_FEATURE_MIN_ROLES,
  DEFAULT_DEPARTMENT_ACCESS_RULES,
  DEPARTMENTAL_MANAGERS,
} from "@/lib/access-control";
import { roleLabels } from "@/lib/permissions";
import { getDocs } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";

const CONFIGURABLE_ROLES: UserRole[] = [
  "VICE_CHAIRPERSON",
  "ADMIN",
  "DEPARTMENT_LEAD",
  "YOUTH_LEADER",
  "MEMBER",
];

const ALL_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "VICE_CHAIRPERSON",
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

interface DepartmentOption {
  id: string;
  name: string;
}

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
  const [featureMinRoles, setFeatureMinRoles] = useState<FeatureMinRoles>(
    DEFAULT_FEATURE_MIN_ROLES
  );
  const [originalFeatureMinRoles, setOriginalFeatureMinRoles] =
    useState<FeatureMinRoles>(DEFAULT_FEATURE_MIN_ROLES);

  // Department access rules state
  const [deptRules, setDeptRules] = useState<DepartmentAccessRule[]>(
    DEFAULT_DEPARTMENT_ACCESS_RULES
  );
  const [originalDeptRules, setOriginalDeptRules] = useState<
    DepartmentAccessRule[]
  >(DEFAULT_DEPARTMENT_ACCESS_RULES);

  // Departments list for dropdowns
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/settings/access-control");
        if (res.ok) {
          const json = await res.json();
          if (json.data?.pagePermissions) {
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
          if (json.data?.featureMinRoles) {
            const merged = {
              ...DEFAULT_FEATURE_MIN_ROLES,
              ...json.data.featureMinRoles,
            };
            setFeatureMinRoles(merged);
            setOriginalFeatureMinRoles(merged);
          }
          if (json.data?.departmentAccessRules) {
            setDeptRules(json.data.departmentAccessRules);
            setOriginalDeptRules(json.data.departmentAccessRules);
          }
        }
      } catch (error) {
        console.error("Failed to load access control config:", error);
      } finally {
        setLoading(false);
      }
    }

    async function loadDepartments() {
      try {
        const snap = await getDocs(safeCollection("departments"));
        const depts: DepartmentOption[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
        }));
        depts.sort((a, b) => a.name.localeCompare(b.name));
        setDepartments(depts);
      } catch (error) {
        console.error("Failed to load departments:", error);
      }
    }

    loadConfig();
    loadDepartments();
  }, []);

  const toggleAccess = (pageKey: string, role: UserRole) => {
    setPermissions((prev) => {
      const current = prev[pageKey]?.[role] ?? "none";
      const next = accessLevelConfig[current].next;
      return {
        ...prev,
        [pageKey]: {
          ...prev[pageKey],
          [role]: next,
        },
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/access-control", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagePermissions: permissions,
          featureMinRoles,
          departmentAccessRules: deptRules,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setOriginalPermissions(permissions);
      setOriginalFeatureMinRoles(featureMinRoles);
      setOriginalDeptRules(deptRules);
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
    setFeatureMinRoles(DEFAULT_FEATURE_MIN_ROLES);
    setDeptRules(DEFAULT_DEPARTMENT_ACCESS_RULES);
  };

  const handleDiscard = () => {
    setPermissions(originalPermissions);
    setFeatureMinRoles(originalFeatureMinRoles);
    setDeptRules(originalDeptRules);
  };

  const hasChanges =
    JSON.stringify(permissions) !== JSON.stringify(originalPermissions) ||
    JSON.stringify(featureMinRoles) !==
      JSON.stringify(originalFeatureMinRoles) ||
    JSON.stringify(deptRules) !== JSON.stringify(originalDeptRules);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
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
            Manage page access, feature permissions, and department-specific
            access rules from one place.
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

      {/* ─── Section 1: Page Permissions ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Page Permissions
          </CardTitle>
          <CardDescription>
            Control which roles can access, view, or edit each page. Click a
            badge to cycle through access levels. The Chairperson always has
            full edit access.
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
                      const isLocked =
                        page.lockedRoles?.[role] !== undefined;

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
                  <div className="text-xs text-clay-400">
                    {page.description}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CONFIGURABLE_ROLES.map((role) => {
                    const level = permissions[page.key]?.[role] ?? "none";
                    const config = accessLevelConfig[level];
                    const Icon = config.icon;
                    const isLocked =
                      page.lockedRoles?.[role] !== undefined;

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

      {/* ─── Section 2: Feature Permissions ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Feature Permissions
          </CardTitle>
          <CardDescription>
            Set the minimum role required for each action. Users at or above the
            selected role can perform the action regardless of department.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeaturePermissionsTable
            featureMinRoles={featureMinRoles}
            onChangeMinRole={(key, role) =>
              setFeatureMinRoles((prev) => ({ ...prev, [key]: role }))
            }
          />
        </CardContent>
      </Card>

      {/* ─── Section 3: Departmental Manager Permissions ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Departmental Manager Permissions
          </CardTitle>
          <CardDescription>
            For each departmental manager, choose what their department lead and
            youth leaders can do. Changes here apply to anyone holding that
            position in the specific department.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DepartmentalManagerPermissions
            rules={deptRules}
            departments={departments}
            onChange={setDeptRules}
          />
        </CardContent>
      </Card>

      {/* ─── Section 4: Department Access Rules (advanced) ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Department Access Rules
            <span className="text-xs font-normal text-clay-400 ml-1">
              (advanced)
            </span>
          </CardTitle>
          <CardDescription>
            Grant additional access to features based on department membership or
            leadership. These rules allow users below the minimum role to access
            features if they belong to specific departments. The simpler
            departmental-manager view above edits the same rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DepartmentRulesEditor
            rules={deptRules}
            departments={departments}
            onChange={setDeptRules}
          />
        </CardContent>
      </Card>

      {/* Sticky save bar */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-clay-200 px-6 py-3 flex items-center justify-between shadow-lg z-50">
          <p className="text-sm text-clay-600">You have unsaved changes</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDiscard}>
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

// ─── Feature Permissions Table ───

function FeaturePermissionsTable({
  featureMinRoles,
  onChangeMinRole,
}: {
  featureMinRoles: FeatureMinRoles;
  onChangeMinRole: (featureKey: string, role: UserRole) => void;
}) {
  const categories = useMemo(() => {
    const catMap = new Map<string, typeof FEATURE_DEFINITIONS>();
    for (const feat of FEATURE_DEFINITIONS) {
      const list = catMap.get(feat.category) ?? [];
      list.push(feat);
      catMap.set(feat.category, list);
    }
    return Array.from(catMap.entries());
  }, []);

  return (
    <div className="space-y-6">
      {categories.map(([category, features]) => (
        <div key={category}>
          <h4 className="text-sm font-semibold text-clay-600 mb-3">
            {category}
          </h4>
          <div className="space-y-2">
            {features.map((feat) => {
              const currentMinRole =
                featureMinRoles[feat.key] ?? "SUPER_ADMIN";
              const isLocked = !!feat.lockedMinRole;

              return (
                <div
                  key={feat.key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 px-3 rounded-lg border border-clay-100 hover:bg-clay-50/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-clay-700">
                      {feat.label}
                    </div>
                    <div className="text-xs text-clay-400">
                      {feat.description}
                    </div>
                  </div>
                  <div className="sm:w-48 flex-shrink-0">
                    {isLocked ? (
                      <div className="flex items-center gap-1.5 text-sm text-clay-400">
                        <Lock className="h-3.5 w-3.5" />
                        <span>{roleLabels[feat.lockedMinRole!]}</span>
                      </div>
                    ) : (
                      <Select
                        value={currentMinRole}
                        onValueChange={(value) =>
                          onChangeMinRole(feat.key, value as UserRole)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {roleLabels[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Department Access Rules Editor ───

const FEATURES_WITH_DEPT_RULES = FEATURE_DEFINITIONS.filter(
  (f) => f.supportsDepartmentRules
);

function DepartmentRulesEditor({
  rules,
  departments,
  onChange,
}: {
  rules: DepartmentAccessRule[];
  departments: DepartmentOption[];
  onChange: (rules: DepartmentAccessRule[]) => void;
}) {
  const [addingForFeature, setAddingForFeature] = useState<string | null>(null);

  const rulesByFeature = useMemo(() => {
    const map = new Map<string, DepartmentAccessRule[]>();
    for (const feat of FEATURES_WITH_DEPT_RULES) {
      map.set(
        feat.key,
        rules.filter((r) => r.featureKey === feat.key)
      );
    }
    return map;
  }, [rules]);

  const removeRule = useCallback(
    (featureKey: string, departmentName: string) => {
      onChange(
        rules.filter(
          (r) =>
            !(
              r.featureKey === featureKey &&
              r.departmentName === departmentName
            )
        )
      );
    },
    [rules, onChange]
  );

  const addRule = useCallback(
    (rule: DepartmentAccessRule) => {
      // Replace if same feature+department exists
      const filtered = rules.filter(
        (r) =>
          !(
            r.featureKey === rule.featureKey &&
            r.departmentName === rule.departmentName
          )
      );
      onChange([...filtered, rule]);
      setAddingForFeature(null);
    },
    [rules, onChange]
  );

  const updateRule = useCallback(
    (
      featureKey: string,
      departmentName: string,
      updates: Partial<DepartmentAccessRule>
    ) => {
      onChange(
        rules.map((r) =>
          r.featureKey === featureKey && r.departmentName === departmentName
            ? { ...r, ...updates }
            : r
        )
      );
    },
    [rules, onChange]
  );

  return (
    <div className="space-y-6">
      {FEATURES_WITH_DEPT_RULES.map((feat) => {
        const featureRules = rulesByFeature.get(feat.key) ?? [];

        return (
          <div
            key={feat.key}
            className="border border-clay-200 rounded-lg overflow-hidden"
          >
            <div className="bg-clay-50 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm text-clay-700">
                  {feat.label}
                </div>
                <div className="text-xs text-clay-400">{feat.description}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setAddingForFeature(
                    addingForFeature === feat.key ? null : feat.key
                  )
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Rule
              </Button>
            </div>

            <div className="divide-y divide-clay-100">
              {featureRules.length === 0 && addingForFeature !== feat.key && (
                <div className="px-4 py-3 text-sm text-clay-400 italic">
                  No department rules. Only users meeting the minimum role can
                  access this feature.
                </div>
              )}

              {featureRules.map((rule) => (
                <DepartmentRuleRow
                  key={`${rule.featureKey}-${rule.departmentName}`}
                  rule={rule}
                  onRemove={() =>
                    removeRule(rule.featureKey, rule.departmentName)
                  }
                  onUpdate={(updates) =>
                    updateRule(
                      rule.featureKey,
                      rule.departmentName,
                      updates
                    )
                  }
                />
              ))}

              {addingForFeature === feat.key && (
                <AddRuleForm
                  featureKey={feat.key}
                  departments={departments}
                  existingDeptNames={featureRules.map((r) => r.departmentName)}
                  onAdd={addRule}
                  onCancel={() => setAddingForFeature(null)}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DepartmentRuleRow({
  rule,
  onRemove,
  onUpdate,
}: {
  rule: DepartmentAccessRule;
  onRemove: () => void;
  onUpdate: (updates: Partial<DepartmentAccessRule>) => void;
}) {
  return (
    <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-clay-700">
          {rule.departmentName}
        </div>
        <div className="text-xs text-clay-400">
          {rule.requiresLeadership
            ? "Must lead this department"
            : "Must be a member of this department"}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Membership type toggle */}
        <Select
          value={rule.requiresLeadership ? "leads" : "member"}
          onValueChange={(v) =>
            onUpdate({ requiresLeadership: v === "leads" })
          }
        >
          <SelectTrigger className="h-7 text-xs w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member of</SelectItem>
            <SelectItem value="leads">Leads</SelectItem>
          </SelectContent>
        </Select>

        {/* Role filter */}
        <RoleFilterSelect
          allowedRoles={rule.allowedRoles}
          onChange={(roles) => onUpdate({ allowedRoles: roles })}
        />

        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function RoleFilterSelect({
  allowedRoles,
  onChange,
}: {
  allowedRoles: UserRole[];
  onChange: (roles: UserRole[]) => void;
}) {
  const toggleRole = (role: UserRole) => {
    if (allowedRoles.includes(role)) {
      onChange(allowedRoles.filter((r) => r !== role));
    } else {
      onChange([...allowedRoles, role]);
    }
  };

  const label =
    allowedRoles.length === 0
      ? "Any role"
      : allowedRoles.map((r) => roleLabels[r]).join(", ");

  return (
    <div className="relative group">
      <button
        className="h-7 px-2 text-xs border border-clay-200 rounded-md bg-white hover:bg-clay-50 transition-colors max-w-48 truncate"
        title={label}
      >
        {label.length > 24 ? label.slice(0, 24) + "..." : label}
      </button>
      <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-clay-200 rounded-lg shadow-lg p-2 min-w-48 hidden group-focus-within:block group-hover:block">
        <div className="text-[10px] font-medium text-clay-500 px-2 py-1">
          Restrict to specific roles (empty = any)
        </div>
        {(
          [
            "DEPARTMENT_LEAD",
            "YOUTH_LEADER",
            "MEMBER",
          ] as UserRole[]
        ).map((role) => (
          <button
            key={role}
            onClick={() => toggleRole(role)}
            className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-clay-50 flex items-center gap-2 ${
              allowedRoles.includes(role)
                ? "text-clay-700 font-medium"
                : "text-clay-400"
            }`}
          >
            <div
              className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${
                allowedRoles.includes(role)
                  ? "bg-clay-700 border-clay-700"
                  : "border-clay-300"
              }`}
            >
              {allowedRoles.includes(role) && (
                <svg
                  className="h-2.5 w-2.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
            {roleLabels[role]}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddRuleForm({
  featureKey,
  departments,
  existingDeptNames,
  onAdd,
  onCancel,
}: {
  featureKey: string;
  departments: DepartmentOption[];
  existingDeptNames: string[];
  onAdd: (rule: DepartmentAccessRule) => void;
  onCancel: () => void;
}) {
  const [deptName, setDeptName] = useState("");
  const [requiresLeadership, setRequiresLeadership] = useState(false);

  const availableDepts = departments.filter(
    (d) => !existingDeptNames.includes(d.name)
  );

  return (
    <div className="px-4 py-3 bg-clay-50/50">
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-clay-600 block mb-1">
            Department
          </label>
          <Select value={deptName} onValueChange={setDeptName}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select department..." />
            </SelectTrigger>
            <SelectContent>
              {availableDepts.map((dept) => (
                <SelectItem key={dept.id} value={dept.name}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:w-36">
          <label className="text-xs font-medium text-clay-600 block mb-1">
            Access type
          </label>
          <Select
            value={requiresLeadership ? "leads" : "member"}
            onValueChange={(v) => setRequiresLeadership(v === "leads")}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member of</SelectItem>
              <SelectItem value="leads">Leads</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-8"
            disabled={!deptName}
            onClick={() =>
              onAdd({
                featureKey,
                departmentName: deptName,
                requiresLeadership,
                allowedRoles: [],
              })
            }
          >
            Add
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Departmental Manager Permissions ───
//
// Department-centric view of the same DepartmentAccessRule list edited by the
// advanced "Department Access Rules" section. For each managed department it
// renders one row per feature with two checkboxes — one for the department
// lead, one for the youth leaders inside that department. Toggling a checkbox
// adds or removes the matching DepartmentAccessRule.

type DeptManagerRole = "DEPARTMENT_LEAD" | "YOUTH_LEADER";

const DEPT_MANAGER_FEATURES = FEATURE_DEFINITIONS.filter(
  (f) => f.supportsDepartmentRules
);

/**
 * Returns true if the existing rule list already grants `role` access to
 * `featureKey` within `departmentName`. Handles all the shapes a saved rule
 * can take (empty allowedRoles = any role, requiresLeadership variations,
 * combined allowedRoles arrays, etc.).
 */
function isRoleGrantedByRules(
  rules: DepartmentAccessRule[],
  featureKey: string,
  departmentName: string,
  role: DeptManagerRole
): boolean {
  for (const rule of rules) {
    if (rule.featureKey !== featureKey) continue;
    if (rule.departmentName !== departmentName) continue;
    // Youth leaders are never department leaders, so a leadership-required
    // rule cannot grant them access.
    if (role === "YOUTH_LEADER" && rule.requiresLeadership) continue;
    if (rule.allowedRoles.length === 0) return true;
    if (rule.allowedRoles.includes(role)) return true;
  }
  return false;
}

/**
 * Surgically remove a role's grant for (feature, department) from the rule
 * list. Existing rules that also grant other roles are preserved (the role is
 * just trimmed out of allowedRoles). Rules whose allowedRoles would become
 * empty are dropped entirely.
 */
function revokeRoleFromRules(
  rules: DepartmentAccessRule[],
  featureKey: string,
  departmentName: string,
  role: DeptManagerRole
): DepartmentAccessRule[] {
  const next: DepartmentAccessRule[] = [];

  for (const rule of rules) {
    if (
      rule.featureKey !== featureKey ||
      rule.departmentName !== departmentName
    ) {
      next.push(rule);
      continue;
    }

    if (role === "YOUTH_LEADER" && rule.requiresLeadership) {
      // Doesn't grant youth leaders anyway.
      next.push(rule);
      continue;
    }

    if (
      rule.allowedRoles.length > 0 &&
      !rule.allowedRoles.includes(role)
    ) {
      // Doesn't grant the role being revoked.
      next.push(rule);
      continue;
    }

    if (rule.allowedRoles.length === 0) {
      // "Any role" rule — replace with an explicit list excluding `role`.
      const remaining: UserRole[] = (
        ["DEPARTMENT_LEAD", "YOUTH_LEADER", "MEMBER"] as UserRole[]
      ).filter((r) => r !== role);
      next.push({ ...rule, allowedRoles: remaining });
      continue;
    }

    const remaining = rule.allowedRoles.filter((r) => r !== role);
    if (remaining.length > 0) {
      next.push({ ...rule, allowedRoles: remaining });
    }
    // else drop the rule
  }

  return next;
}

/**
 * Add a canonical rule granting `role` access to `featureKey` for
 * `departmentName`. Idempotent — if the rule list already grants the role
 * access (via any shape of rule), the list is returned unchanged.
 */
function grantRoleInRules(
  rules: DepartmentAccessRule[],
  featureKey: string,
  departmentName: string,
  role: DeptManagerRole
): DepartmentAccessRule[] {
  if (isRoleGrantedByRules(rules, featureKey, departmentName, role)) {
    return rules;
  }
  return [
    ...rules,
    {
      featureKey,
      departmentName,
      requiresLeadership: role === "DEPARTMENT_LEAD",
      allowedRoles: [role],
    },
  ];
}

function DepartmentalManagerPermissions({
  rules,
  departments,
  onChange,
}: {
  rules: DepartmentAccessRule[];
  departments: DepartmentOption[];
  onChange: (rules: DepartmentAccessRule[]) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const knownDeptNames = useMemo(
    () => new Set(departments.map((d) => d.name)),
    [departments]
  );

  // Group features by category for readability inside each department card.
  const featuresByCategory = useMemo(() => {
    const map = new Map<string, typeof DEPT_MANAGER_FEATURES>();
    for (const feat of DEPT_MANAGER_FEATURES) {
      const list = map.get(feat.category) ?? [];
      list.push(feat);
      map.set(feat.category, list);
    }
    return Array.from(map.entries());
  }, []);

  const toggleExpanded = (deptName: string) =>
    setExpanded((prev) => ({ ...prev, [deptName]: !prev[deptName] }));

  const toggleRole = useCallback(
    (
      featureKey: string,
      departmentName: string,
      role: DeptManagerRole,
      nextValue: boolean
    ) => {
      onChange(
        nextValue
          ? grantRoleInRules(rules, featureKey, departmentName, role)
          : revokeRoleFromRules(rules, featureKey, departmentName, role)
      );
    },
    [rules, onChange]
  );

  return (
    <div className="space-y-3">
      {DEPARTMENTAL_MANAGERS.map((manager) => {
        const deptName = manager.departmentName;
        const displayName = manager.displayName ?? manager.departmentName;
        const isExpanded = expanded[deptName] ?? false;
        const departmentExists = knownDeptNames.has(deptName);

        // Show a quick summary count of granted (feature × role) pairs so
        // the admin gets a sense of how locked-down each department is
        // without expanding it.
        let leadCount = 0;
        let youthCount = 0;
        for (const feat of DEPT_MANAGER_FEATURES) {
          if (isRoleGrantedByRules(rules, feat.key, deptName, "DEPARTMENT_LEAD"))
            leadCount++;
          if (isRoleGrantedByRules(rules, feat.key, deptName, "YOUTH_LEADER"))
            youthCount++;
        }

        return (
          <div
            key={deptName}
            className="border border-clay-200 rounded-lg overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleExpanded(deptName)}
              className="w-full px-4 py-3 bg-clay-50 hover:bg-clay-100 transition-colors flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-clay-500 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-clay-500 flex-shrink-0" />
                )}
                <div className="text-left min-w-0">
                  <div className="font-medium text-sm text-clay-700 truncate">
                    {displayName}
                  </div>
                  {!departmentExists && (
                    <div className="text-[11px] text-amber-600">
                      Department record not found in Firestore — run the
                      seed-departmental-managers script.
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className="text-[10px] bg-white">
                  Lead: {leadCount}
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-white">
                  Youth Leaders: {youthCount}
                </Badge>
              </div>
            </button>

            {isExpanded && (
              <div className="divide-y divide-clay-100">
                {featuresByCategory.map(([category, features]) => (
                  <div key={category} className="px-4 py-3">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wide text-clay-500 mb-2">
                      {category}
                    </h5>
                    <div className="space-y-1.5">
                      {features.map((feat) => {
                        const leadAllowed = isRoleGrantedByRules(
                          rules,
                          feat.key,
                          deptName,
                          "DEPARTMENT_LEAD"
                        );
                        const youthAllowed = isRoleGrantedByRules(
                          rules,
                          feat.key,
                          deptName,
                          "YOUTH_LEADER"
                        );

                        return (
                          <div
                            key={feat.key}
                            className="flex flex-col sm:flex-row sm:items-center gap-2 py-1.5 px-2 rounded hover:bg-clay-50/60"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-clay-700">
                                {feat.label}
                              </div>
                              <div className="text-[11px] text-clay-400">
                                {feat.description}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                              <RoleToggle
                                label="Lead"
                                checked={leadAllowed}
                                onChange={(v) =>
                                  toggleRole(
                                    feat.key,
                                    deptName,
                                    "DEPARTMENT_LEAD",
                                    v
                                  )
                                }
                              />
                              <RoleToggle
                                label="Youth Leaders"
                                checked={youthAllowed}
                                onChange={(v) =>
                                  toggleRole(
                                    feat.key,
                                    deptName,
                                    "YOUTH_LEADER",
                                    v
                                  )
                                }
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RoleToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const Icon = checked ? Check : X;
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-1.5 h-7 px-2 rounded-md border text-xs transition-colors ${
        checked
          ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
          : "bg-white border-clay-200 text-clay-400 hover:bg-clay-50"
      }`}
      aria-pressed={checked}
    >
      <Icon className="h-3 w-3" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
