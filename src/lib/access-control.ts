import { AccessLevel, PageDefinition, PagePermissions, UserRole } from "@/types";

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
