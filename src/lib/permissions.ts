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
  return userRole === "SUPER_ADMIN";
}

/**
 * Catch-all gate for destructive deletions (Braai events, ROPs registrations,
 * Braai orders, devotionals, services, follow-up cards, etc.). Restricted to
 * the Chairperson (SUPER_ADMIN) so other roles can manage records but cannot
 * permanently remove them.
 */
export function canDelete(userRole: UserRole): boolean {
  return userRole === "SUPER_ADMIN";
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
  return hasMinRole(userRole, "DEPARTMENT_LEAD");
}

export function canManageAffirmations(userRole: UserRole): boolean {
  return hasMinRole(userRole, "ADMIN");
}

export function canManageDepartmentTasks(userRole: UserRole): boolean {
  return hasMinRole(userRole, "DEPARTMENT_LEAD");
}

export function canManageDepartments(userRole: UserRole): boolean {
  return hasMinRole(userRole, "ADMIN");
}

/**
 * Events & Fellowship Manager (DEPARTMENT_LEAD of Events & Fellowship dept) or ADMIN+
 * can approve events.
 */
export function canApproveEvents(
  userRole: UserRole,
  leadsDepartmentIds: string[],
  eventsFellowshipDeptId: string
): boolean {
  if (hasMinRole(userRole, "ADMIN")) return true;
  return (
    userRole === "DEPARTMENT_LEAD" &&
    leadsDepartmentIds.includes(eventsFellowshipDeptId)
  );
}

/**
 * Members of Campus Ministry or Life Groups departments can submit follow-up cards.
 */
export function canSubmitFollowUp(
  userRole: UserRole,
  departmentIds: string[],
  campusMinistryDeptId: string,
  lifeGroupsDeptId: string
): boolean {
  if (hasMinRole(userRole, "ADMIN")) return true;
  return (
    departmentIds.includes(campusMinistryDeptId) ||
    departmentIds.includes(lifeGroupsDeptId)
  );
}

/**
 * Discipleship & Follow-Up dept lead or ADMIN+ can manage follow-up cards.
 */
export function canManageFollowUps(
  userRole: UserRole,
  leadsDepartmentIds: string[],
  discipleshipDeptId: string
): boolean {
  if (hasMinRole(userRole, "ADMIN")) return true;
  return leadsDepartmentIds.includes(discipleshipDeptId);
}

/**
 * Life Group leaders (DEPARTMENT_LEAD or YOUTH_LEADER in Life Groups dept)
 * can submit life group follow-up leads.
 */
export function canSubmitLifeGroupLead(
  userRole: UserRole,
  departmentIds: string[],
  lifeGroupsDeptId: string
): boolean {
  if (hasMinRole(userRole, "ADMIN")) return true;
  return (
    (userRole === "DEPARTMENT_LEAD" || userRole === "YOUTH_LEADER") &&
    departmentIds.includes(lifeGroupsDeptId)
  );
}

/**
 * Only ADMIN+ can manage institutions.
 */
export function canManageInstitutions(userRole: UserRole): boolean {
  return hasMinRole(userRole, "ADMIN");
}

export const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: "Chairperson",
  ADMIN: "Secretary / Admin",
  DEPARTMENT_LEAD: "Department Lead",
  YOUTH_LEADER: "Youth Leader",
  MEMBER: "Member",
};
