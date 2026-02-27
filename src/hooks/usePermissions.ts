"use client";

import { useAuth } from "@/contexts/AuthContext";
import {
  hasMinRole,
  canManageMembers,
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
} from "@/lib/permissions";
import { UserRole } from "@/types";

export function usePermissions() {
  const { userData } = useAuth();

  const role = userData?.role || "MEMBER";

  return {
    role,
    hasMinRole: (required: UserRole) => hasMinRole(role, required),
    canManageMembers: canManageMembers(role),
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
    isAdmin: hasMinRole(role, "ADMIN"),
    isSuperAdmin: role === "SUPER_ADMIN",
    isDeptLead: hasMinRole(role, "DEPARTMENT_LEAD"),
  };
}
