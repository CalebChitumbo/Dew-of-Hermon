// GENERATED FROM src/lib/access-control.ts — keep the two in step.
//
// Line-for-line port of the web's access-control tables and the three merge
// functions. The semantics are identical: SUPER_ADMIN always wins, locked
// roles override saved config, and unknown page/feature keys deny.

import '../../data/models/enums.dart';

/// Metadata about a configurable page.
class PageDefinition {
  const PageDefinition({
    required this.key,
    required this.label,
    required this.description,
    required this.route,
    this.lockedRoles = const {},
  });

  final String key;
  final String label;
  final String description;
  final String route;

  /// Roles that can never lose access (e.g. SUPER_ADMIN always has edit).
  final Map<UserRole, AccessLevel> lockedRoles;
}

/// Metadata about a configurable feature permission.
class FeatureDefinition {
  const FeatureDefinition({
    required this.key,
    required this.label,
    required this.description,
    required this.category,
    this.lockedMinRole,
    required this.supportsDepartmentRules,
  });

  final String key;
  final String label;
  final String description;
  final String category;

  /// If set, the minimum role cannot be lowered below this.
  final UserRole? lockedMinRole;

  /// Whether this feature supports department-based access rules.
  final bool supportsDepartmentRules;
}

/// A department-based rule granting a feature to users in a department.
class DepartmentAccessRule {
  const DepartmentAccessRule({
    required this.featureKey,
    required this.departmentName,
    required this.requiresLeadership,
    this.allowedRoles = const [],
  });

  factory DepartmentAccessRule.fromMap(Map<String, dynamic> map) {
    return DepartmentAccessRule(
      featureKey: (map['featureKey'] ?? '').toString(),
      departmentName: (map['departmentName'] ?? '').toString(),
      requiresLeadership: map['requiresLeadership'] == true,
      allowedRoles: (map['allowedRoles'] is List)
          ? (map['allowedRoles'] as List)
              .map((e) => UserRole.fromWire(e))
              .toList()
          : const <UserRole>[],
    );
  }

  final String featureKey;
  final String departmentName;

  /// true = the user must lead this department; false = membership is enough.
  final bool requiresLeadership;

  /// If non-empty, only these roles get department-based access.
  final List<UserRole> allowedRoles;

  Map<String, dynamic> toMap() => {
        'featureKey': featureKey,
        'departmentName': departmentName,
        'requiresLeadership': requiresLeadership,
        'allowedRoles': allowedRoles.map((r) => r.wire).toList(),
      };
}

/// A department whose lead is treated as a departmental manager in the
/// Super Admin role-management UI.
class DepartmentalManager {
  const DepartmentalManager(this.departmentName, [this.displayName]);
  final String departmentName;
  final String? displayName;
  String get label => displayName ?? departmentName;
}

typedef PagePermissions = Map<String, Map<UserRole, AccessLevel>>;
typedef FeatureMinRoles = Map<String, UserRole>;

/// All configurable pages in the system. Settings is excluded — it is
/// always SUPER_ADMIN only.
const List<PageDefinition> kPageDefinitions = [
  PageDefinition(
    key: "dashboard",
    label: "Dashboard",
    description: "Overview with stats and summaries",
    route: "/dashboard",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "departments",
    label: "Departments",
    description: "View and manage departments",
    route: "/departments",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "members",
    label: "Members",
    description: "View and manage church members",
    route: "/manage/members",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "department_join_requests",
    label: "Department Join Requests",
    description: "Manager recommendations and Chairperson approvals for members requesting to join a department",
    route: "/manage/department-requests",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "services",
    label: "Services & Rotas",
    description: "Service management and role assignments",
    route: "/manage/services",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "calendar",
    label: "Calendar",
    description: "Event calendar view",
    route: "/calendar",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "events_create",
    label: "Create Event",
    description: "Create new events",
    route: "/manage/events/new",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "events_approvals",
    label: "Event Approvals",
    description: "Approve or reject event requests",
    route: "/manage/events/approvals",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "event_reports_submit",
    label: "Event Reports (Submit)",
    description: "Submit post-event reports for events you initiated",
    route: "/manage/events/reports",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "event_reports_review",
    label: "Event Report Reviews",
    description: "Review post-event reports submitted by event initiators",
    route: "/manage/events/reports/review",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "campus_ministry",
    label: "Campus Ministry",
    description: "Campus ministry activities and follow-ups",
    route: "/department/campus-ministry",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "life_groups",
    label: "Life Groups",
    description: "Life group management and directory",
    route: "/department/life-groups",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "discipleship",
    label: "Discipleship",
    description: "Follow-up pipeline and discipleship tracking",
    route: "/department/discipleship",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "affirmations",
    label: "Affirmations",
    description: "View and manage affirmations",
    route: "/affirmations",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "manage_affirmations",
    label: "Manage Affirmations",
    description: "Create and edit affirmations",
    route: "/manage/affirmations",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "templates",
    label: "Email Templates",
    description: "Manage email notification templates",
    route: "/manage/templates",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "reports",
    label: "Reports",
    description: "Analytics and reporting dashboard",
    route: "/manage/reports",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "latreou",
    label: "Latreuo",
    description: "Worship cycle planner — songs, uniforms, rehearsals, and PDF export",
    route: "/latreou",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "rops_camp",
    label: "ROPs Camp",
    description: "Manage Rites of Passage camp registrations and payments",
    route: "/manage/rops-camp",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "rops_camp_status",
    label: "ROPs Camp Status",
    description: "Read-only camp numbers and camper list for department leads (no medical or contact details)",
    route: "/manage/rops-camp/status",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "fundraising",
    label: "Fundraising",
    description: "Plan fundraising activities and assign braai responsibilities",
    route: "/manage/fundraising",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "transport_requests",
    label: "Transport Requests",
    description: "Transport coordinator queue: cost incoming transport requests for approved events",
    route: "/manage/transport/requests",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "accounts_approvals",
    label: "Accounts Approvals (Treasurer)",
    description: "Treasurer queue: confirm funds availability for transport and event budget requests",
    route: "/manage/finance/approvals",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "media_requests",
    label: "Media Requests",
    description: "Media coordinator queue: confirm event media and assign Sound, Publicity, and Coverage",
    route: "/manage/media/requests",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "food_requests",
    label: "Food Requests",
    description: "Food Logistics queue: plan catering and confirm food provision for events",
    route: "/manage/food/requests",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "talents",
    label: "Talent Showcase",
    description: "Members put their talents forward for leadership to review and slot into opportunities",
    route: "/talents",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
  PageDefinition(
    key: "manage_talents",
    label: "Talent Submissions",
    description: "Leadership queue: review talent submissions, build the talent pool, and slot members into opportunities",
    route: "/manage/talents",
    lockedRoles: {UserRole.superAdmin: AccessLevel.edit},
  ),
];

/// The default permissions that match the web's hardcoded behaviour.
final PagePermissions kDefaultPagePermissions = {
  "dashboard": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.view,
    UserRole.youthLeader: AccessLevel.view,
    UserRole.member: AccessLevel.view,
  },
  "departments": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.view,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "members": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.view,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "department_join_requests": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.edit,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "services": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.view,
    UserRole.youthLeader: AccessLevel.view,
    UserRole.member: AccessLevel.none,
  },
  "calendar": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.view,
    UserRole.youthLeader: AccessLevel.view,
    UserRole.member: AccessLevel.view,
  },
  "events_create": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.edit,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "events_approvals": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.view,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "event_reports_submit": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.edit,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "event_reports_review": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.view,
    UserRole.admin: AccessLevel.view,
    UserRole.departmentLead: AccessLevel.none,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "campus_ministry": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.view,
    UserRole.youthLeader: AccessLevel.view,
    UserRole.member: AccessLevel.view,
  },
  "life_groups": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.view,
    UserRole.youthLeader: AccessLevel.view,
    UserRole.member: AccessLevel.view,
  },
  "discipleship": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.view,
    UserRole.youthLeader: AccessLevel.view,
    UserRole.member: AccessLevel.view,
  },
  "affirmations": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.view,
    UserRole.youthLeader: AccessLevel.view,
    UserRole.member: AccessLevel.view,
  },
  "manage_affirmations": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.none,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "templates": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.none,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "reports": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.none,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "latreou": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.view,
    UserRole.youthLeader: AccessLevel.view,
    UserRole.member: AccessLevel.view,
  },
  "rops_camp": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.none,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "rops_camp_status": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.none,
    UserRole.admin: AccessLevel.none,
    UserRole.departmentLead: AccessLevel.view,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "fundraising": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.none,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "transport_requests": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.none,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "accounts_approvals": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.none,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "media_requests": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.none,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "food_requests": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.none,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
  "talents": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.view,
    UserRole.youthLeader: AccessLevel.view,
    UserRole.member: AccessLevel.view,
  },
  "manage_talents": {
    UserRole.superAdmin: AccessLevel.edit,
    UserRole.viceChairperson: AccessLevel.edit,
    UserRole.admin: AccessLevel.edit,
    UserRole.departmentLead: AccessLevel.none,
    UserRole.youthLeader: AccessLevel.none,
    UserRole.member: AccessLevel.none,
  },
};

/// All configurable feature permissions — what actions users can perform,
/// beyond page access.
const List<FeatureDefinition> kFeatureDefinitions = [
  FeatureDefinition(
    key: "create_events",
    label: "Create Events",
    description: "Create new events",
    category: "Events",
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: "approve_events",
    label: "Approve Events (Events Lead)",
    description: "Events Lead: dispatch stakeholder requests and pass events to the Vice Chairperson once all confirmations are in",
    category: "Events",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "vice_chair_approve_events",
    label: "Vice Chair Event Approval",
    description: "Second-tier approval of events that have passed Events Lead review",
    category: "Events",
    lockedMinRole: UserRole.viceChairperson,
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: "chair_approve_events",
    label: "Chair Event Approval (Final)",
    description: "Final approval that publishes the event to the calendar and notifies members",
    category: "Events",
    lockedMinRole: UserRole.superAdmin,
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: "submit_event_report",
    label: "Submit Event Reports",
    description: "Submit post-event reports for events you initiated",
    category: "Events",
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: "review_event_reports",
    label: "Review Event Reports",
    description: "Mark post-event reports as reviewed or request changes from event initiators",
    category: "Events",
    lockedMinRole: UserRole.superAdmin,
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: "submit_follow_up",
    label: "Submit Follow-Up Cards",
    description: "Create follow-up cards for new contacts",
    category: "Follow-Up",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "manage_follow_ups",
    label: "Manage Follow-Up Cards",
    description: "Update status and assign follow-up cards",
    category: "Follow-Up",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "view_assigned_follow_ups",
    label: "View Assigned Follow-Up Cards",
    description: "See and update only the follow-up cards assigned to you",
    category: "Follow-Up",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "approve_follow_up",
    label: "Approve Follow-Up Submissions",
    description: "Review and approve follow-up cards submitted by youth leaders before they reach the discipleship team",
    category: "Follow-Up",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "manage_devotionals",
    label: "Manage Campus Devotionals",
    description: "Post and edit the weekly devotional focus shown to all campuses",
    category: "Campus Ministry",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "manage_life_group_devotionals",
    label: "Manage Life Group Devotionals",
    description: "Post and edit the weekly devotional focus shown to all life groups",
    category: "Life Groups",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "submit_life_group_lead",
    label: "Life Group Lead Reports",
    description: "Submit life group follow-up reports",
    category: "Life Groups",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "manage_members",
    label: "Manage Members",
    description: "Add and edit church members",
    category: "Members",
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: "delete_members",
    label: "Delete Members",
    description: "Remove members from the system",
    category: "Members",
    lockedMinRole: UserRole.superAdmin,
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: "change_user_roles",
    label: "Change User Roles",
    description: "Assign or change member roles",
    category: "Members",
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: "create_service",
    label: "Create Services",
    description: "Create and manage service rotas",
    category: "Services",
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: "manage_templates",
    label: "Manage Email Templates",
    description: "Create and edit email templates",
    category: "Communication",
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: "manage_affirmations",
    label: "Manage Affirmations",
    description: "Create and edit affirmations",
    category: "Content",
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: "manage_departments",
    label: "Manage Departments",
    description: "Create and configure departments",
    category: "Admin",
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: "manage_institutions",
    label: "Manage Institutions",
    description: "Manage institution list",
    category: "Admin",
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: "manage_settings",
    label: "Manage Settings",
    description: "Access system settings",
    category: "Admin",
    lockedMinRole: UserRole.superAdmin,
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: "latreou_access",
    label: "Use Latreuo Planner",
    description: "Plan worship cycles and export the team document via the Latreuo tab",
    category: "Worship",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "view_camp_registrations",
    label: "View ROPs Camp Registration Status",
    description: "See how the camp is filling up — totals, payments, spots left, and camper names with their church/school (no medical notes or contact details)",
    category: "ROPs Camp",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "manage_camp_registrations",
    label: "Manage ROPs Camp Registrations",
    description: "View, mark paid/unpaid, and edit registrations for the Rites of Passage camp",
    category: "ROPs Camp",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "camp_pass_admissions",
    label: "Camp Exit Passes — Admissions",
    description: "Log walk-up requests to leave camp and give the first sign-off before it goes to the Camp Manager",
    category: "ROPs Camp",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "camp_pass_manager",
    label: "Camp Exit Passes — Camp Manager",
    description: "Second sign-off on a camper's request to leave camp, before it reaches the Chairperson",
    category: "ROPs Camp",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "camp_pass_chair",
    label: "Camp Exit Passes — Chairperson",
    description: "Final approval, which issues the QR gate pass. Nothing scannable exists until this sign-off",
    category: "ROPs Camp",
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: "scan_camp_passes",
    label: "Scan Camp Passes at the Gate",
    description: "Scan approved exit passes at the camp gate to sign campers out and back in (scan-only access)",
    category: "ROPs Camp",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "serve_camp_meals",
    label: "Serve Camp Meals",
    description: "Scan camper meal badges at the serving line to tick them off the meal register (scan-only access)",
    category: "ROPs Camp",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "manage_communications",
    label: "Manage Communications",
    description: "Post announcements, manage publicity, and run the social media calendar",
    category: "Media",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "view_communications_reports",
    label: "View Communications Reports",
    description: "See engagement metrics, scheduled posts, and communications summaries",
    category: "Media",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "manage_fundraising",
    label: "Manage Fundraising",
    description: "Run fundraising campaigns, record pledges, and update donor information",
    category: "Fundraising",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "plan_fundraising_braai",
    label: "Plan Fundraising Braai",
    description: "Plan Sunday fundraising braais and assign team responsibilities",
    category: "Fundraising",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "manage_fundraising_orders",
    label: "Manage Fundraising Orders",
    description: "View incoming Potter's Shockers orders and update payment / preparation status",
    category: "Fundraising",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "view_fundraising_reports",
    label: "View Fundraising Reports",
    description: "View campaign totals, donor lists, and contribution summaries",
    category: "Fundraising",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "manage_transport_logistics",
    label: "Manage Transport Logistics",
    description: "Plan transport for services, events, and outreach; record vehicle assignments",
    category: "Transport & Logistics",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "view_transport_assignments",
    label: "View Transport Assignments",
    description: "See planned transport rotas and pickup lists for events",
    category: "Transport & Logistics",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "manage_food_logistics",
    label: "Manage Food Logistics",
    description: "Plan meals, manage catering vendors, and track food provision for events and camps",
    category: "Food Logistics",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "view_food_logistics",
    label: "View Food Logistics",
    description: "View meal plans, headcounts, and catering schedules",
    category: "Food Logistics",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "approve_accounts",
    label: "Approve Accounts",
    description: "Treasurer: confirm funds availability for transport requests and event budget requests",
    category: "Finance",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "manage_media",
    label: "Manage Event Media",
    description: "Media coordinator: confirm event media requests and assign Sound, Publicity, and Coverage roles",
    category: "Media",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "view_media_reports",
    label: "View Media Assignments",
    description: "See media role assignments and coverage schedules for events",
    category: "Media",
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: "confirm_food",
    label: "Confirm Event Food",
    description: "Food Logistics: plan catering, request catering funds, and confirm food provision for events",
    category: "Food Logistics",
    supportsDepartmentRules: true,
  ),
];

/// Default minimum role for each feature.
final FeatureMinRoles kDefaultFeatureMinRoles = {
  "approve_events": UserRole.admin,
  "vice_chair_approve_events": UserRole.viceChairperson,
  "chair_approve_events": UserRole.superAdmin,
  "submit_event_report": UserRole.departmentLead,
  "review_event_reports": UserRole.superAdmin,
  "submit_follow_up": UserRole.admin,
  "manage_follow_ups": UserRole.admin,
  "view_assigned_follow_ups": UserRole.admin,
  "approve_follow_up": UserRole.admin,
  "manage_devotionals": UserRole.admin,
  "manage_life_group_devotionals": UserRole.admin,
  "submit_life_group_lead": UserRole.admin,
  "manage_members": UserRole.admin,
  "delete_members": UserRole.superAdmin,
  "change_user_roles": UserRole.admin,
  "create_service": UserRole.admin,
  "create_events": UserRole.departmentLead,
  "manage_templates": UserRole.admin,
  "manage_affirmations": UserRole.admin,
  "manage_departments": UserRole.admin,
  "manage_institutions": UserRole.admin,
  "manage_settings": UserRole.superAdmin,
  "latreou_access": UserRole.admin,
  "view_camp_registrations": UserRole.departmentLead,
  "manage_camp_registrations": UserRole.admin,
  "camp_pass_admissions": UserRole.admin,
  "camp_pass_manager": UserRole.admin,
  "camp_pass_chair": UserRole.superAdmin,
  "scan_camp_passes": UserRole.admin,
  "serve_camp_meals": UserRole.admin,
  "manage_communications": UserRole.admin,
  "view_communications_reports": UserRole.admin,
  "manage_fundraising": UserRole.admin,
  "view_fundraising_reports": UserRole.admin,
  "plan_fundraising_braai": UserRole.admin,
  "manage_fundraising_orders": UserRole.admin,
  "manage_transport_logistics": UserRole.admin,
  "view_transport_assignments": UserRole.admin,
  "manage_food_logistics": UserRole.admin,
  "view_food_logistics": UserRole.admin,
  "approve_accounts": UserRole.admin,
  "manage_media": UserRole.admin,
  "view_media_reports": UserRole.admin,
  "confirm_food": UserRole.admin,
};

/// Default department access rules.
const List<DepartmentAccessRule> kDefaultDepartmentAccessRules = [
  DepartmentAccessRule(
    featureKey: "approve_events",
    departmentName: "Events & Fellowship",
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: "submit_follow_up",
    departmentName: "Campus Ministry",
    requiresLeadership: false,
  ),
  DepartmentAccessRule(
    featureKey: "submit_follow_up",
    departmentName: "Life Groups",
    requiresLeadership: false,
  ),
  DepartmentAccessRule(
    featureKey: "manage_follow_ups",
    departmentName: "Discipleship & Follow-Up",
    requiresLeadership: true,
  ),
  DepartmentAccessRule(
    featureKey: "view_assigned_follow_ups",
    departmentName: "Discipleship & Follow-Up",
    requiresLeadership: false,
    allowedRoles: [UserRole.youthLeader, UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: "submit_life_group_lead",
    departmentName: "Life Groups",
    requiresLeadership: false,
    allowedRoles: [UserRole.departmentLead, UserRole.youthLeader],
  ),
  DepartmentAccessRule(
    featureKey: "approve_follow_up",
    departmentName: "Campus Ministry",
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: "approve_follow_up",
    departmentName: "Life Groups",
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: "manage_devotionals",
    departmentName: "Campus Ministry",
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: "manage_life_group_devotionals",
    departmentName: "Life Groups",
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: "latreou_access",
    departmentName: "Worship & Music",
    requiresLeadership: false,
  ),
  DepartmentAccessRule(
    featureKey: "manage_camp_registrations",
    departmentName: "ROPs Camp",
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: "camp_pass_admissions",
    departmentName: "ROPs Camp",
    requiresLeadership: false,
  ),
  DepartmentAccessRule(
    featureKey: "camp_pass_manager",
    departmentName: "ROPs Camp",
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: "scan_camp_passes",
    departmentName: "ROPs Camp",
    requiresLeadership: false,
  ),
  DepartmentAccessRule(
    featureKey: "scan_camp_passes",
    departmentName: "Ushering & Protocol",
    requiresLeadership: false,
  ),
  DepartmentAccessRule(
    featureKey: "serve_camp_meals",
    departmentName: "ROPs Camp",
    requiresLeadership: false,
  ),
  DepartmentAccessRule(
    featureKey: "serve_camp_meals",
    departmentName: "Food Logistics",
    requiresLeadership: false,
  ),
  DepartmentAccessRule(
    featureKey: "manage_communications",
    departmentName: "Media",
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: "view_communications_reports",
    departmentName: "Media",
    requiresLeadership: false,
    allowedRoles: [UserRole.departmentLead, UserRole.youthLeader],
  ),
  DepartmentAccessRule(
    featureKey: "manage_fundraising",
    departmentName: "Fundraising",
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: "view_fundraising_reports",
    departmentName: "Fundraising",
    requiresLeadership: false,
    allowedRoles: [UserRole.departmentLead, UserRole.youthLeader],
  ),
  DepartmentAccessRule(
    featureKey: "plan_fundraising_braai",
    departmentName: "Fundraising",
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: "manage_fundraising_orders",
    departmentName: "Fundraising",
    requiresLeadership: false,
  ),
  DepartmentAccessRule(
    featureKey: "manage_transport_logistics",
    departmentName: "Transport & Logistics",
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: "view_transport_assignments",
    departmentName: "Transport & Logistics",
    requiresLeadership: false,
    allowedRoles: [UserRole.departmentLead, UserRole.youthLeader],
  ),
  DepartmentAccessRule(
    featureKey: "manage_food_logistics",
    departmentName: "Food Logistics",
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: "view_food_logistics",
    departmentName: "Food Logistics",
    requiresLeadership: false,
    allowedRoles: [UserRole.departmentLead, UserRole.youthLeader],
  ),
  DepartmentAccessRule(
    featureKey: "approve_accounts",
    departmentName: "Finance",
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: "manage_media",
    departmentName: "Media",
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: "view_media_reports",
    departmentName: "Media",
    requiresLeadership: false,
    allowedRoles: [UserRole.departmentLead, UserRole.youthLeader],
  ),
  DepartmentAccessRule(
    featureKey: "confirm_food",
    departmentName: "Food Logistics",
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
];

/// Departments tracked in the Super Admin role-management UI, in the order
/// the Chairperson listed them.
const List<DepartmentalManager> kDepartmentalManagers = [
  DepartmentalManager("Discipleship & Follow-Up", "Discipleship"),
  DepartmentalManager("Events & Fellowship"),
  DepartmentalManager("Media"),
  DepartmentalManager("Fundraising"),
  DepartmentalManager("Transport & Logistics"),
  DepartmentalManager("Life Groups"),
  DepartmentalManager("Campus Ministry"),
  DepartmentalManager("Food Logistics"),
  DepartmentalManager("Finance", "Finance (Treasurer)"),
];
