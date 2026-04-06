"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import {
  hasMinRole,
  getAssignableRoles,
  roleLabels,
} from "@/lib/permissions";
import {
  canAccessPage,
  canEditPage,
  getPageAccess,
  checkFeatureAccess,
  DEFAULT_FEATURE_MIN_ROLES,
} from "@/lib/access-control";
import {
  AccessLevel,
  DepartmentAccessRule,
  FeatureMinRoles,
  UserRole,
} from "@/types";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  DEPARTMENT_LEAD: 3,
  YOUTH_LEADER: 2,
  MEMBER: 1,
};

/** Check if a role meets the configured minimum for a feature */
function hasFeatureMinRole(
  role: UserRole,
  featureKey: string,
  minRoles: FeatureMinRoles
): boolean {
  if (role === "SUPER_ADMIN") return true;
  const minRole = minRoles[featureKey] ?? "SUPER_ADMIN";
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

export function usePermissions() {
  const { userData } = useAuth();
  const {
    pagePermissions,
    featureMinRoles,
    departmentAccessRules,
  } = useAccessControl();

  const role = userData?.role || "MEMBER";
  const mr = featureMinRoles ?? DEFAULT_FEATURE_MIN_ROLES;

  return {
    role,
    roleLabels,
    hasMinRole: (required: UserRole) => hasMinRole(role, required),

    // Configurable feature permissions (simple role checks)
    canManageMembers: hasFeatureMinRole(role, "manage_members", mr),
    canManageDeptMembers: hasMinRole(role, "DEPARTMENT_LEAD"),
    canAssignAnyRole: hasFeatureMinRole(role, "change_user_roles", mr),
    canAssignOwnDeptRole: hasMinRole(role, "DEPARTMENT_LEAD"),
    canCreateService: hasFeatureMinRole(role, "create_service", mr),
    canViewDashboard: hasMinRole(role, "YOUTH_LEADER"),
    canManageTemplates: hasFeatureMinRole(role, "manage_templates", mr),
    canManageSettings: role === "SUPER_ADMIN",
    canDeleteMembers: hasFeatureMinRole(role, "delete_members", mr),
    canChangeUserRoles: hasFeatureMinRole(role, "change_user_roles", mr),
    canCreateEvents: hasFeatureMinRole(role, "create_events", mr),
    canManageAffirmations: hasFeatureMinRole(role, "manage_affirmations", mr),
    getAssignableRoles: () => getAssignableRoles(role),
    isAdmin: hasMinRole(role, "ADMIN"),
    isSuperAdmin: role === "SUPER_ADMIN",
    isDeptLead: hasMinRole(role, "DEPARTMENT_LEAD"),

    // Access control helpers
    canAccessPage: (pageKey: string) =>
      canAccessPage(pageKey, role, pagePermissions),
    canEditPage: (pageKey: string) =>
      canEditPage(pageKey, role, pagePermissions),
    getPageAccess: (pageKey: string): AccessLevel =>
      getPageAccess(pageKey, role, pagePermissions),
    pagePermissions,

    // Feature permissions with department-based rules
    featureMinRoles: mr,
    departmentAccessRules,
    /**
     * Check feature access considering department membership.
     * Pass a departmentNameToId map (name → Firestore ID) for department rule resolution.
     */
    checkFeatureAccess: (
      featureKey: string,
      userDepartmentIds: string[],
      userLeadsDepartmentIds: string[],
      departmentNameToId: Record<string, string>
    ) =>
      checkFeatureAccess(
        featureKey,
        role,
        userDepartmentIds,
        userLeadsDepartmentIds,
        departmentNameToId,
        { minRoles: mr, rules: departmentAccessRules }
      ),
  };
}
