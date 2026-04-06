"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import {
  hasMinRole,
  canManageMembers,
  canManageDeptMembers,
  canAssignAnyRole,
  canAssignOwnDeptRole,
  canCreateService,
  canViewDashboard,
  canManageTemplates,
  canManageSettings,
  canDeleteMembers,
  canChangeUserRoles,
  canCreateEvents,
  canManageAffirmations,
  getAssignableRoles,
} from "@/lib/permissions";
import {
  canAccessPage,
  canEditPage,
  checkFeaturePermission,
  getPageAccess,
} from "@/lib/access-control";
import { AccessLevel, UserRole } from "@/types";

export function usePermissions() {
  const { userData } = useAuth();
  const { pagePermissions, featurePermissions } = useAccessControl();

  const role = userData?.role || "MEMBER";
  const deptIds = userData?.departmentIds || [];
  const leadsDeptIds = userData?.leadsDepartmentIds || [];

  return {
    role,
    hasMinRole: (required: UserRole) => hasMinRole(role, required),
    canManageMembers: canManageMembers(role),
    canManageDeptMembers: canManageDeptMembers(role),
    canAssignAnyRole: canAssignAnyRole(role),
    canAssignOwnDeptRole: canAssignOwnDeptRole(role),
    canCreateService: canCreateService(role),
    canViewDashboard: canViewDashboard(role),
    canManageTemplates: canManageTemplates(role),
    canManageSettings: canManageSettings(role),
    canDeleteMembers: canDeleteMembers(role),
    canChangeUserRoles: canChangeUserRoles(role),
    canCreateEvents: canCreateEvents(role),
    canManageAffirmations: canManageAffirmations(role),
    getAssignableRoles: () => getAssignableRoles(role),
    isAdmin: hasMinRole(role, "ADMIN"),
    isSuperAdmin: role === "SUPER_ADMIN",
    isDeptLead: hasMinRole(role, "DEPARTMENT_LEAD"),

    // Page access helpers
    canAccessPage: (pageKey: string) =>
      canAccessPage(pageKey, role, pagePermissions),
    canEditPage: (pageKey: string) =>
      canEditPage(pageKey, role, pagePermissions),
    getPageAccess: (pageKey: string): AccessLevel =>
      getPageAccess(pageKey, role, pagePermissions),
    pagePermissions,

    // Feature permission helpers (department-specific)
    canApproveEvents: checkFeaturePermission(
      "approve_events",
      role,
      deptIds,
      leadsDeptIds,
      featurePermissions
    ),
    canSubmitFollowUp: checkFeaturePermission(
      "submit_follow_up",
      role,
      deptIds,
      leadsDeptIds,
      featurePermissions
    ),
    canManageFollowUps: checkFeaturePermission(
      "manage_follow_ups",
      role,
      deptIds,
      leadsDeptIds,
      featurePermissions
    ),
    canSubmitLifeGroupLead: checkFeaturePermission(
      "submit_life_group_lead",
      role,
      deptIds,
      leadsDeptIds,
      featurePermissions
    ),
    featurePermissions,
  };
}
