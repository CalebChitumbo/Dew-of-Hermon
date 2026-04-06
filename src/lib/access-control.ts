import {
  AccessLevel,
  FeatureDefinition,
  FeaturePermission,
  FeaturePermissions,
  PageDefinition,
  PagePermissions,
  UserRole,
} from "@/types";
import { hasMinRole } from "@/lib/permissions";

/**
 * All configurable pages in the system.
 * Settings page is excluded — always SUPER_ADMIN only.
 */
export const PAGE_DEFINITIONS: PageDefinition[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Overview with stats and summaries",
    route: "/dashboard",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "departments",
    label: "Departments",
    description: "View and manage departments",
    route: "/departments",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "members",
    label: "Members",
    description: "View and manage church members",
    route: "/manage/members",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "services",
    label: "Services & Rotas",
    description: "Service management and role assignments",
    route: "/manage/services",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "calendar",
    label: "Calendar",
    description: "Event calendar view",
    route: "/calendar",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "events_create",
    label: "Create Event",
    description: "Create new events",
    route: "/manage/events/new",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "events_approvals",
    label: "Event Approvals",
    description: "Approve or reject event requests",
    route: "/manage/events/approvals",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "campus_ministry",
    label: "Campus Ministry",
    description: "Campus ministry activities and follow-ups",
    route: "/department/campus-ministry",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "life_groups",
    label: "Life Groups",
    description: "Life group management and directory",
    route: "/department/life-groups",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "discipleship",
    label: "Discipleship",
    description: "Follow-up pipeline and discipleship tracking",
    route: "/department/discipleship",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "affirmations",
    label: "Affirmations",
    description: "View and manage affirmations",
    route: "/affirmations",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "manage_affirmations",
    label: "Manage Affirmations",
    description: "Create and edit affirmations",
    route: "/manage/affirmations",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "templates",
    label: "Email Templates",
    description: "Manage email notification templates",
    route: "/manage/templates",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "reports",
    label: "Reports",
    description: "Analytics and reporting dashboard",
    route: "/manage/reports",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
];

/** The default permissions that match the current hardcoded behavior */
export const DEFAULT_PAGE_PERMISSIONS: PagePermissions = {
  dashboard: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "view",
    YOUTH_LEADER: "view",
    MEMBER: "none",
  },
  departments: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "view",
    YOUTH_LEADER: "none",
    MEMBER: "none",
  },
  members: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "view",
    YOUTH_LEADER: "none",
    MEMBER: "none",
  },
  services: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "view",
    YOUTH_LEADER: "view",
    MEMBER: "none",
  },
  calendar: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "view",
    YOUTH_LEADER: "view",
    MEMBER: "view",
  },
  events_create: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "edit",
    YOUTH_LEADER: "none",
    MEMBER: "none",
  },
  events_approvals: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "view",
    YOUTH_LEADER: "none",
    MEMBER: "none",
  },
  campus_ministry: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "view",
    YOUTH_LEADER: "view",
    MEMBER: "view",
  },
  life_groups: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "view",
    YOUTH_LEADER: "view",
    MEMBER: "view",
  },
  discipleship: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "view",
    YOUTH_LEADER: "view",
    MEMBER: "view",
  },
  affirmations: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "view",
    YOUTH_LEADER: "view",
    MEMBER: "view",
  },
  manage_affirmations: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "none",
    YOUTH_LEADER: "none",
    MEMBER: "none",
  },
  templates: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "none",
    YOUTH_LEADER: "none",
    MEMBER: "none",
  },
  reports: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "none",
    YOUTH_LEADER: "none",
    MEMBER: "none",
  },
};

const ALL_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "DEPARTMENT_LEAD",
  "YOUTH_LEADER",
  "MEMBER",
];

/**
 * Get the access level for a role on a page, respecting locked roles.
 * Falls back to defaults if no custom config exists.
 */
export function getPageAccess(
  pageKey: string,
  role: UserRole,
  customPermissions?: PagePermissions | null
): AccessLevel {
  // SUPER_ADMIN always has edit access
  if (role === "SUPER_ADMIN") return "edit";

  const pageDef = PAGE_DEFINITIONS.find((p) => p.key === pageKey);
  if (!pageDef) return "none";

  // Check locked roles first
  if (pageDef.lockedRoles?.[role]) {
    return pageDef.lockedRoles[role]!;
  }

  // Use custom permissions if available, else defaults
  const permissions = customPermissions ?? DEFAULT_PAGE_PERMISSIONS;
  return permissions[pageKey]?.[role] ?? "none";
}

/**
 * Find the page key for a given route path.
 */
export function getPageKeyFromRoute(pathname: string): string | null {
  // Exact match first
  const exact = PAGE_DEFINITIONS.find((p) => p.route === pathname);
  if (exact) return exact.key;

  // Prefix match (e.g. /manage/members/123 → members)
  const prefixMatch = PAGE_DEFINITIONS
    .filter((p) => pathname.startsWith(p.route + "/"))
    .sort((a, b) => b.route.length - a.route.length)[0];

  return prefixMatch?.key ?? null;
}

/**
 * Check if a role can see a page in navigation (view or edit).
 */
export function canAccessPage(
  pageKey: string,
  role: UserRole,
  customPermissions?: PagePermissions | null
): boolean {
  const access = getPageAccess(pageKey, role, customPermissions);
  return access === "edit" || access === "view";
}

/**
 * Check if a role can edit (not just view) a page.
 */
export function canEditPage(
  pageKey: string,
  role: UserRole,
  customPermissions?: PagePermissions | null
): boolean {
  return getPageAccess(pageKey, role, customPermissions) === "edit";
}

/**
 * Merge saved permissions with defaults for any new pages
 * that may have been added since the config was last saved.
 */
export function mergeWithDefaults(
  saved: PagePermissions
): PagePermissions {
  const merged = { ...DEFAULT_PAGE_PERMISSIONS };
  for (const pageKey of Object.keys(saved)) {
    if (merged[pageKey]) {
      merged[pageKey] = { ...merged[pageKey], ...saved[pageKey] };
    }
  }
  return merged;
}

// ─── Feature Permissions ───────────────────────────────────────────────────

/**
 * Definitions for the department-specific features that can be configured.
 * These replace the previously hardcoded department-name lookups in permissions.ts.
 */
export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    key: "approve_events",
    label: "Approve Events",
    description:
      "Who can approve or reject event requests. Link a department whose leads should also have approval access.",
    defaultDeptAccess: "lead",
    defaultDeptMinRole: "DEPARTMENT_LEAD",
  },
  {
    key: "submit_follow_up",
    label: "Submit Follow-Up Cards",
    description:
      "Who can submit follow-up cards for new contacts and visitors. Link departments whose members should have access.",
    defaultDeptAccess: "member",
    defaultDeptMinRole: "MEMBER",
  },
  {
    key: "manage_follow_ups",
    label: "Manage Follow-Up Pipeline",
    description:
      "Who can view and update all follow-up pipeline cards. Link a department whose leads should have management access.",
    defaultDeptAccess: "lead",
    defaultDeptMinRole: "DEPARTMENT_LEAD",
  },
  {
    key: "submit_life_group_lead",
    label: "Submit Life Group Leads",
    description:
      "Who can submit life group follow-up leads via the Life Groups page. Link a department and set the minimum role required.",
    defaultDeptAccess: "member",
    defaultDeptMinRole: "YOUTH_LEADER",
  },
];

/**
 * Default feature permissions — only ADMIN+ by default (no dept overrides).
 * When no config is saved, the backend falls back to legacy name-based lookups
 * so existing behaviour is preserved until the Chairperson configures this.
 */
export const DEFAULT_FEATURE_PERMISSIONS: FeaturePermissions = {
  approve_events: {
    minRole: "ADMIN",
    linkedDepts: [],
    deptMinRole: "DEPARTMENT_LEAD",
  },
  submit_follow_up: {
    minRole: "ADMIN",
    linkedDepts: [],
    deptMinRole: "MEMBER",
  },
  manage_follow_ups: {
    minRole: "ADMIN",
    linkedDepts: [],
    deptMinRole: "DEPARTMENT_LEAD",
  },
  submit_life_group_lead: {
    minRole: "ADMIN",
    linkedDepts: [],
    deptMinRole: "YOUTH_LEADER",
  },
};

/**
 * Merge saved feature permissions with defaults for any new features.
 */
export function mergeFeaturePermissionsWithDefaults(
  saved: FeaturePermissions
): FeaturePermissions {
  const merged: FeaturePermissions = { ...DEFAULT_FEATURE_PERMISSIONS };
  for (const key of Object.keys(saved)) {
    if (merged[key]) {
      merged[key] = { ...merged[key], ...saved[key] };
    } else {
      merged[key] = saved[key];
    }
  }
  return merged;
}

/**
 * Client-side feature permission check using the stored config.
 * Falls back to DEFAULT_FEATURE_PERMISSIONS when no config is provided.
 *
 * NOTE: When linkedDepts is empty (unconfigured), this returns false for
 * non-minRole users. The server-side helpers handle the legacy fallback.
 */
export function checkFeaturePermission(
  featureKey: string,
  userRole: UserRole,
  userDeptIds: string[],
  userLeadsDeptIds: string[],
  featurePermissions: FeaturePermissions | null
): boolean {
  const config: FeaturePermission | undefined =
    featurePermissions?.[featureKey] ?? DEFAULT_FEATURE_PERMISSIONS[featureKey];

  if (!config) return false;
  if (hasMinRole(userRole, config.minRole)) return true;
  if (!hasMinRole(userRole, config.deptMinRole)) return false;

  for (const { deptId, access } of config.linkedDepts) {
    if (access === "lead" && userLeadsDeptIds.includes(deptId)) return true;
    if (access === "member" && userDeptIds.includes(deptId)) return true;
  }

  return false;
}
