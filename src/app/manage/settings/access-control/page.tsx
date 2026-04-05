"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { AccessLevel, PagePermissions, UserRole } from "@/types";
import {
  PAGE_DEFINITIONS,
  DEFAULT_PAGE_PERMISSIONS,
} from "@/lib/access-control";
import { roleLabels } from "@/lib/permissions";

const CONFIGURABLE_ROLES: UserRole[] = [
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
  const [permissions, setPermissions] = useState<PagePermissions>(
    DEFAULT_PAGE_PERMISSIONS
  );
  const [originalPermissions, setOriginalPermissions] =
    useState<PagePermissions>(DEFAULT_PAGE_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/settings/access-control");
        if (res.ok) {
          const json = await res.json();
          if (json.data?.pagePermissions) {
            // Merge with defaults for any new pages
            const merged = { ...DEFAULT_PAGE_PERMISSIONS };
            for (const key of Object.keys(json.data.pagePermissions)) {
              if (merged[key]) {
                merged[key] = { ...merged[key], ...json.data.pagePermissions[key] };
              }
            }
            setPermissions(merged);
            setOriginalPermissions(merged);
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
        body: JSON.stringify({ pagePermissions: permissions }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setOriginalPermissions(permissions);
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
  };

  const hasChanges =
    JSON.stringify(permissions) !== JSON.stringify(originalPermissions);

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
            Customise which roles can access, view, or edit each page. Click a
            badge to cycle through: Edit, View Only, and No Access.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset to Defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
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
                <div
                  key={level}
                  className="flex items-center gap-1.5"
                >
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

      {/* Permissions Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Page Permissions</CardTitle>
          <CardDescription>
            Click on any badge to cycle its access level. The Chairperson role
            always has full edit access and cannot be modified.
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

      {/* Sticky save bar when changes exist */}
      {hasChanges && (
        <div className="sticky bottom-0 bg-white border-t border-clay-200 -mx-6 px-6 py-3 flex items-center justify-between shadow-lg">
          <p className="text-sm text-clay-600">
            You have unsaved changes
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPermissions(originalPermissions)}
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
