import {
  AccessLevel,
  DepartmentAccessRule,
  FeatureDefinition,
  FeatureMinRoles,
  PageDefinition,
  PagePermissions,
  UserRole,
} from "@/types";

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
    key: "event_reports_submit",
    label: "Event Reports (Submit)",
    description: "Submit post-event reports for events you initiated",
    route: "/manage/events/reports",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "event_reports_review",
    label: "Event Report Reviews",
    description: "Review post-event reports submitted by event initiators",
    route: "/manage/events/reports/review",
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
  {
    key: "latreou",
    label: "Latreou",
    description: "Worship cycle planner — songs, uniforms, rehearsals, and PDF export",
    route: "/latreou",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "rops_camp",
    label: "ROPs Camp",
    description: "Manage Rites of Passage camp registrations and payments",
    route: "/manage/rops-camp",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "fundraising",
    label: "Fundraising",
    description: "Plan fundraising activities and assign braai responsibilities",
    route: "/manage/fundraising",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "transport_requests",
    label: "Transport Requests",
    description:
      "Transport coordinator queue: cost incoming transport requests for approved events",
    route: "/manage/transport/requests",
    lockedRoles: { SUPER_ADMIN: "edit" },
  },
  {
    key: "transport_approvals",
    label: "Transport Approvals (Treasurer)",
    description:
      "Treasurer queue: confirm funds availability for costed transport requests",
    route: "/manage/finance/transport-approvals",
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
    MEMBER: "view",
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
  event_reports_submit: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "edit",
    YOUTH_LEADER: "none",
    MEMBER: "none",
  },
  event_reports_review: {
    SUPER_ADMIN: "edit",
    ADMIN: "view",
    DEPARTMENT_LEAD: "none",
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
  latreou: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "view",
    YOUTH_LEADER: "view",
    MEMBER: "view",
  },
  rops_camp: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "none",
    YOUTH_LEADER: "none",
    MEMBER: "none",
  },
  fundraising: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "none",
    YOUTH_LEADER: "none",
    MEMBER: "none",
  },
  transport_requests: {
    SUPER_ADMIN: "edit",
    ADMIN: "edit",
    DEPARTMENT_LEAD: "none",
    YOUTH_LEADER: "none",
    MEMBER: "none",
  },
  transport_approvals: {
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

// ─── Feature Permissions ───

/**
 * All configurable feature permissions in the system.
 * These define what actions users can perform, beyond page access.
 */
export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  // Events
  {
    key: "create_events",
    label: "Create Events",
    description: "Create new events",
    category: "Events",
    supportsDepartmentRules: false,
  },
  {
    key: "approve_events",
    label: "Approve Events",
    description: "Approve or reject event requests",
    category: "Events",
    supportsDepartmentRules: true,
  },
  {
    key: "submit_event_report",
    label: "Submit Event Reports",
    description: "Submit post-event reports for events you initiated",
    category: "Events",
    supportsDepartmentRules: false,
  },
  {
    key: "review_event_reports",
    label: "Review Event Reports",
    description:
      "Mark post-event reports as reviewed or request changes from event initiators",
    category: "Events",
    lockedMinRole: "SUPER_ADMIN",
    supportsDepartmentRules: false,
  },
  // Follow-Up
  {
    key: "submit_follow_up",
    label: "Submit Follow-Up Cards",
    description: "Create follow-up cards for new contacts",
    category: "Follow-Up",
    supportsDepartmentRules: true,
  },
  {
    key: "manage_follow_ups",
    label: "Manage Follow-Up Cards",
    description: "Update status and assign follow-up cards",
    category: "Follow-Up",
    supportsDepartmentRules: true,
  },
  {
    key: "view_assigned_follow_ups",
    label: "View Assigned Follow-Up Cards",
    description: "See and update only the follow-up cards assigned to you",
    category: "Follow-Up",
    supportsDepartmentRules: true,
  },
  {
    key: "approve_follow_up",
    label: "Approve Follow-Up Submissions",
    description:
      "Review and approve follow-up cards submitted by youth leaders before they reach the discipleship team",
    category: "Follow-Up",
    supportsDepartmentRules: true,
  },
  {
    key: "manage_devotionals",
    label: "Manage Campus Devotionals",
    description:
      "Post and edit the weekly devotional focus shown to all campuses",
    category: "Campus Ministry",
    supportsDepartmentRules: true,
  },
  {
    key: "manage_life_group_devotionals",
    label: "Manage Life Group Devotionals",
    description:
      "Post and edit the weekly devotional focus shown to all life groups",
    category: "Life Groups",
    supportsDepartmentRules: true,
  },
  {
    key: "submit_life_group_lead",
    label: "Life Group Lead Reports",
    description: "Submit life group follow-up reports",
    category: "Life Groups",
    supportsDepartmentRules: true,
  },
  // Members
  {
    key: "manage_members",
    label: "Manage Members",
    description: "Add and edit church members",
    category: "Members",
    supportsDepartmentRules: false,
  },
  {
    key: "delete_members",
    label: "Delete Members",
    description: "Remove members from the system",
    category: "Members",
    supportsDepartmentRules: false,
  },
  {
    key: "change_user_roles",
    label: "Change User Roles",
    description: "Assign or change member roles",
    category: "Members",
    supportsDepartmentRules: false,
  },
  // Services
  {
    key: "create_service",
    label: "Create Services",
    description: "Create and manage service rotas",
    category: "Services",
    supportsDepartmentRules: false,
  },
  // Content & Communication
  {
    key: "manage_templates",
    label: "Manage Email Templates",
    description: "Create and edit email templates",
    category: "Communication",
    supportsDepartmentRules: false,
  },
  {
    key: "manage_affirmations",
    label: "Manage Affirmations",
    description: "Create and edit affirmations",
    category: "Content",
    supportsDepartmentRules: false,
  },
  // Admin
  {
    key: "manage_departments",
    label: "Manage Departments",
    description: "Create and configure departments",
    category: "Admin",
    supportsDepartmentRules: false,
  },
  {
    key: "manage_institutions",
    label: "Manage Institutions",
    description: "Manage institution list",
    category: "Admin",
    supportsDepartmentRules: false,
  },
  {
    key: "manage_settings",
    label: "Manage Settings",
    description: "Access system settings",
    category: "Admin",
    lockedMinRole: "SUPER_ADMIN",
    supportsDepartmentRules: false,
  },
  {
    key: "latreou_access",
    label: "Use Latreou Planner",
    description:
      "Plan worship cycles and export the team document via the Latreou tab",
    category: "Worship",
    supportsDepartmentRules: true,
  },
  {
    key: "manage_camp_registrations",
    label: "Manage ROPs Camp Registrations",
    description:
      "View, mark paid/unpaid, and edit registrations for the Rites of Passage camp",
    category: "ROPs Camp",
    supportsDepartmentRules: true,
  },
  // Departmental Manager scopes — used by the Super Admin per-department UI to
  // grant viewing/management rights to specific department leads and youth
  // leaders. Pages can opt into these checks as they're built out.
  {
    key: "manage_communications",
    label: "Manage Communications & Media",
    description:
      "Post announcements, manage publicity, and run the social media calendar",
    category: "Communications & Media",
    supportsDepartmentRules: true,
  },
  {
    key: "view_communications_reports",
    label: "View Communications Reports",
    description:
      "See engagement metrics, scheduled posts, and communications summaries",
    category: "Communications & Media",
    supportsDepartmentRules: true,
  },
  {
    key: "manage_fundraising",
    label: "Manage Fundraising",
    description:
      "Run fundraising campaigns, record pledges, and update donor information",
    category: "Fundraising",
    supportsDepartmentRules: true,
  },
  {
    key: "plan_fundraising_braai",
    label: "Plan Fundraising Braai",
    description:
      "Plan Sunday fundraising braais and assign team responsibilities",
    category: "Fundraising",
    supportsDepartmentRules: true,
  },
  {
    key: "view_fundraising_reports",
    label: "View Fundraising Reports",
    description: "View campaign totals, donor lists, and contribution summaries",
    category: "Fundraising",
    supportsDepartmentRules: true,
  },
  {
    key: "manage_transport_logistics",
    label: "Manage Transport Logistics",
    description:
      "Plan transport for services, events, and outreach; record vehicle assignments",
    category: "Transport & Logistics",
    supportsDepartmentRules: true,
  },
  {
    key: "view_transport_assignments",
    label: "View Transport Assignments",
    description: "See planned transport rotas and pickup lists for events",
    category: "Transport & Logistics",
    supportsDepartmentRules: true,
  },
  {
    key: "manage_food_logistics",
    label: "Manage Food Logistics",
    description:
      "Plan meals, manage catering vendors, and track food provision for events and camps",
    category: "Food Logistics",
    supportsDepartmentRules: true,
  },
  {
    key: "view_food_logistics",
    label: "View Food Logistics",
    description: "View meal plans, headcounts, and catering schedules",
    category: "Food Logistics",
    supportsDepartmentRules: true,
  },
  {
    key: "approve_transport_budget",
    label: "Approve Transport Budget",
    description:
      "Confirm funds availability for transport requests submitted by the Transport Coordinator",
    category: "Finance",
    supportsDepartmentRules: true,
  },
];

/** Default minimum role for each feature (matches current hardcoded behavior) */
export const DEFAULT_FEATURE_MIN_ROLES: FeatureMinRoles = {
  approve_events: "ADMIN",
  submit_event_report: "DEPARTMENT_LEAD",
  review_event_reports: "SUPER_ADMIN",
  submit_follow_up: "ADMIN",
  manage_follow_ups: "ADMIN",
  view_assigned_follow_ups: "ADMIN",
  approve_follow_up: "ADMIN",
  manage_devotionals: "ADMIN",
  manage_life_group_devotionals: "ADMIN",
  submit_life_group_lead: "ADMIN",
  manage_members: "ADMIN",
  delete_members: "ADMIN",
  change_user_roles: "ADMIN",
  create_service: "ADMIN",
  create_events: "DEPARTMENT_LEAD",
  manage_templates: "ADMIN",
  manage_affirmations: "ADMIN",
  manage_departments: "ADMIN",
  manage_institutions: "ADMIN",
  manage_settings: "SUPER_ADMIN",
  latreou_access: "ADMIN",
  manage_camp_registrations: "ADMIN",
  manage_communications: "ADMIN",
  view_communications_reports: "ADMIN",
  manage_fundraising: "ADMIN",
  view_fundraising_reports: "ADMIN",
  plan_fundraising_braai: "ADMIN",
  manage_transport_logistics: "ADMIN",
  view_transport_assignments: "ADMIN",
  manage_food_logistics: "ADMIN",
  view_food_logistics: "ADMIN",
  approve_transport_budget: "ADMIN",
};

/** Default department access rules (matches current hardcoded behavior) */
export const DEFAULT_DEPARTMENT_ACCESS_RULES: DepartmentAccessRule[] = [
  {
    featureKey: "approve_events",
    departmentName: "Events & Fellowship",
    requiresLeadership: true,
    allowedRoles: ["DEPARTMENT_LEAD"],
  },
  {
    featureKey: "submit_follow_up",
    departmentName: "Campus Ministry",
    requiresLeadership: false,
    allowedRoles: [],
  },
  {
    featureKey: "submit_follow_up",
    departmentName: "Life Groups",
    requiresLeadership: false,
    allowedRoles: [],
  },
  {
    featureKey: "manage_follow_ups",
    departmentName: "Discipleship & Follow-Up",
    requiresLeadership: true,
    allowedRoles: [],
  },
  {
    featureKey: "view_assigned_follow_ups",
    departmentName: "Discipleship & Follow-Up",
    requiresLeadership: false,
    allowedRoles: ["YOUTH_LEADER", "DEPARTMENT_LEAD"],
  },
  {
    featureKey: "submit_life_group_lead",
    departmentName: "Life Groups",
    requiresLeadership: false,
    allowedRoles: ["DEPARTMENT_LEAD", "YOUTH_LEADER"],
  },
  {
    featureKey: "approve_follow_up",
    departmentName: "Campus Ministry",
    requiresLeadership: true,
    allowedRoles: ["DEPARTMENT_LEAD"],
  },
  {
    featureKey: "approve_follow_up",
    departmentName: "Life Groups",
    requiresLeadership: true,
    allowedRoles: ["DEPARTMENT_LEAD"],
  },
  {
    featureKey: "manage_devotionals",
    departmentName: "Campus Ministry",
    requiresLeadership: true,
    allowedRoles: ["DEPARTMENT_LEAD"],
  },
  {
    featureKey: "manage_life_group_devotionals",
    departmentName: "Life Groups",
    requiresLeadership: true,
    allowedRoles: ["DEPARTMENT_LEAD"],
  },
  {
    featureKey: "latreou_access",
    departmentName: "Worship & Music",
    requiresLeadership: false,
    allowedRoles: [],
  },
  {
    featureKey: "manage_camp_registrations",
    departmentName: "ROPs Camp",
    requiresLeadership: true,
    allowedRoles: ["DEPARTMENT_LEAD"],
  },
  // Defaults for departmental-manager scopes — the lead of each department gets
  // management rights for that department, and youth leaders in the same
  // department get the corresponding view-only rights. Super Admin can adjust
  // any of these from the Department Manager Permissions section.
  {
    featureKey: "manage_communications",
    departmentName: "Communications & Media",
    requiresLeadership: true,
    allowedRoles: ["DEPARTMENT_LEAD"],
  },
  {
    featureKey: "view_communications_reports",
    departmentName: "Communications & Media",
    requiresLeadership: false,
    allowedRoles: ["DEPARTMENT_LEAD", "YOUTH_LEADER"],
  },
  {
    featureKey: "manage_fundraising",
    departmentName: "Fundraising",
    requiresLeadership: true,
    allowedRoles: ["DEPARTMENT_LEAD"],
  },
  {
    featureKey: "view_fundraising_reports",
    departmentName: "Fundraising",
    requiresLeadership: false,
    allowedRoles: ["DEPARTMENT_LEAD", "YOUTH_LEADER"],
  },
  {
    featureKey: "plan_fundraising_braai",
    departmentName: "Fundraising",
    requiresLeadership: true,
    allowedRoles: ["DEPARTMENT_LEAD"],
  },
  {
    featureKey: "manage_transport_logistics",
    departmentName: "Transport & Logistics",
    requiresLeadership: true,
    allowedRoles: ["DEPARTMENT_LEAD"],
  },
  {
    featureKey: "view_transport_assignments",
    departmentName: "Transport & Logistics",
    requiresLeadership: false,
    allowedRoles: ["DEPARTMENT_LEAD", "YOUTH_LEADER"],
  },
  {
    featureKey: "manage_food_logistics",
    departmentName: "Food Logistics",
    requiresLeadership: true,
    allowedRoles: ["DEPARTMENT_LEAD"],
  },
  {
    featureKey: "view_food_logistics",
    departmentName: "Food Logistics",
    requiresLeadership: false,
    allowedRoles: ["DEPARTMENT_LEAD", "YOUTH_LEADER"],
  },
  {
    featureKey: "approve_transport_budget",
    departmentName: "Finance",
    requiresLeadership: true,
    allowedRoles: ["DEPARTMENT_LEAD"],
  },
];

/**
 * The "Departmental Managers" tracked in the Super Admin role management UI.
 * Each entry refers to a department whose lead is treated as a departmental
 * manager; the Super Admin can configure what that lead and the youth leaders
 * inside the department are allowed to access.
 *
 * Order matches the list provided by the Chairperson.
 */
export const DEPARTMENTAL_MANAGERS: ReadonlyArray<{
  /** Department name as stored in Firestore (and used in DepartmentAccessRule). */
  departmentName: string;
  /** Optional friendlier label for the UI; falls back to departmentName. */
  displayName?: string;
}> = [
  { departmentName: "Discipleship & Follow-Up", displayName: "Discipleship" },
  { departmentName: "Events & Fellowship" },
  { departmentName: "Communications & Media" },
  { departmentName: "Fundraising" },
  { departmentName: "Transport & Logistics" },
  { departmentName: "Life Groups" },
  { departmentName: "Campus Ministry" },
  { departmentName: "Food Logistics" },
  { departmentName: "Finance", displayName: "Finance (Treasurer)" },
];

const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  DEPARTMENT_LEAD: 3,
  YOUTH_LEADER: 2,
  MEMBER: 1,
};

/**
 * Check if a user has access to a feature, considering both
 * the minimum role and any department-based access rules.
 *
 * @param departmentNameToId - Map of department name → Firestore ID
 */
export function checkFeatureAccess(
  featureKey: string,
  userRole: UserRole,
  userDepartmentIds: string[],
  userLeadsDepartmentIds: string[],
  departmentNameToId: Record<string, string>,
  config?: {
    minRoles?: FeatureMinRoles;
    rules?: DepartmentAccessRule[];
  }
): boolean {
  // SUPER_ADMIN always has access
  if (userRole === "SUPER_ADMIN") return true;

  const minRoles = config?.minRoles ?? DEFAULT_FEATURE_MIN_ROLES;
  const rules = config?.rules ?? DEFAULT_DEPARTMENT_ACCESS_RULES;

  // Check minimum role
  const minRole = minRoles[featureKey] ?? "SUPER_ADMIN";
  if (ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole]) return true;

  // Check department-based access rules
  const featureRules = rules.filter((r) => r.featureKey === featureKey);
  for (const rule of featureRules) {
    const deptId = departmentNameToId[rule.departmentName];
    if (!deptId) continue;

    const hasMembership = rule.requiresLeadership
      ? userLeadsDepartmentIds.includes(deptId)
      : userDepartmentIds.includes(deptId);

    if (!hasMembership) continue;

    // Check allowed roles (empty array = any role qualifies)
    if (
      rule.allowedRoles.length === 0 ||
      rule.allowedRoles.includes(userRole)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Merge saved feature min roles with defaults for any new features.
 */
export function mergeFeatureMinRoles(
  saved: FeatureMinRoles
): FeatureMinRoles {
  return { ...DEFAULT_FEATURE_MIN_ROLES, ...saved };
}

/**
 * Merge saved department access rules with defaults for any feature that
 * isn't yet covered by saved rules. Saved rules win for features they
 * already cover (so an admin's customizations are never overwritten), but
 * features added in code after the last save still get their defaults.
 */
export function mergeDepartmentAccessRules(
  saved: DepartmentAccessRule[]
): DepartmentAccessRule[] {
  const coveredFeatures = new Set(saved.map((r) => r.featureKey));
  const missingDefaults = DEFAULT_DEPARTMENT_ACCESS_RULES.filter(
    (r) => !coveredFeatures.has(r.featureKey)
  );
  return [...saved, ...missingDefaults];
}
