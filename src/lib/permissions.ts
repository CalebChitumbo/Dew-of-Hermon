import { UserRole } from "@/types";

const roleHierarchy: Record<UserRole, number> = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  DEPARTMENT_LEAD: 3,
  YOUTH_LEADER: 2,
  MEMBER: 1,
};

const ALL_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "DEPARTMENT_LEAD",
  "YOUTH_LEADER",
  "MEMBER",
];

export function hasMinRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export function canManageMembers(userRole: UserRole): boolean {
  return hasMinRole(userRole, "ADMIN");
}

/** DEPARTMENT_LEAD can manage members within their own departments */
export function canManageDeptMembers(userRole: UserRole): boolean {
  return hasMinRole(userRole, "DEPARTMENT_LEAD");
}

export function canAssignAnyRole(userRole: UserRole): boolean {
  return hasMinRole(userRole, "ADMIN");
}

export function canAssignOwnDeptRole(userRole: UserRole): boolean {
  return hasMinRole(userRole, "DEPARTMENT_LEAD");
}

export function canCreateService(userRole: UserRole): boolean {
  return hasMinRole(userRole, "ADMIN");
}

export function canViewDashboard(userRole: UserRole): boolean {
  return hasMinRole(userRole, "YOUTH_LEADER");
}

export function canManageTemplates(userRole: UserRole): boolean {
  return hasMinRole(userRole, "ADMIN");
}

export function canManageSettings(userRole: UserRole): boolean {
  return userRole === "SUPER_ADMIN";
}

export function canDeleteMembers(userRole: UserRole): boolean {
  return hasMinRole(userRole, "ADMIN");
}

export function canChangeUserRoles(userRole: UserRole): boolean {
  return hasMinRole(userRole, "ADMIN");
}

/**
 * Returns the list of roles that a given caller role is allowed to assign.
 * Users can only assign roles at or below their own level.
 * SUPER_ADMIN can assign all roles. ADMIN can assign ADMIN and below.
 * DEPARTMENT_LEAD can assign DEPARTMENT_LEAD and below.
 */
export function getAssignableRoles(callerRole: UserRole): UserRole[] {
  const callerLevel = roleHierarchy[callerRole];
  return ALL_ROLES.filter((r) => roleHierarchy[r] <= callerLevel);
}

export function canCreateEvents(userRole: UserRole): boolean {
  return hasMinRole(userRole, "ADMIN");
}

export function canManageAffirmations(userRole: UserRole): boolean {
  return hasMinRole(userRole, "ADMIN");
}

export const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: "Chairperson",
  ADMIN: "Secretary / Admin",
  DEPARTMENT_LEAD: "Department Lead",
  YOUTH_LEADER: "Youth Leader",
  MEMBER: "Member",
};
