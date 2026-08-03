/// 1:1 port of `src/lib/access-control.ts` — the single source of truth for
/// page permissions, feature minimum roles, and department-based access rules.
/// Keep in lock-step with the web app when it changes.
library;

import '../models/misc.dart'
    show DepartmentAccessRule, FeatureMinRoles, PagePermissions;
import '../models/user.dart';

class PageDefinition {
  final String key;
  final String label;
  final String description;
  final String route;
  final Map<String, String>? lockedRoles;

  const PageDefinition({
    required this.key,
    required this.label,
    required this.description,
    required this.route,
    this.lockedRoles,
  });
}

const List<PageDefinition> pageDefinitions = [
  PageDefinition(
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Overview with stats and summaries',
    route: '/dashboard',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'departments',
    label: 'Departments',
    description: 'View and manage departments',
    route: '/departments',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'members',
    label: 'Members',
    description: 'View and manage church members',
    route: '/manage/members',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'department_join_requests',
    label: 'Department Join Requests',
    description:
        'Manager recommendations and Chairperson approvals for members requesting to join a department',
    route: '/manage/department-requests',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'services',
    label: 'Services & Rotas',
    description: 'Service management and role assignments',
    route: '/manage/services',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'calendar',
    label: 'Calendar',
    description: 'Event calendar view',
    route: '/calendar',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'events_create',
    label: 'Create Event',
    description: 'Create new events',
    route: '/manage/events/new',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'events_approvals',
    label: 'Event Approvals',
    description: 'Approve or reject event requests',
    route: '/manage/events/approvals',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'event_reports_submit',
    label: 'Event Reports (Submit)',
    description: 'Submit post-event reports for events you initiated',
    route: '/manage/events/reports',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'event_reports_review',
    label: 'Event Report Reviews',
    description:
        'Review post-event reports submitted by event initiators',
    route: '/manage/events/reports/review',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'campus_ministry',
    label: 'Campus Ministry',
    description: 'Campus ministry activities and follow-ups',
    route: '/department/campus-ministry',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'life_groups',
    label: 'Life Groups',
    description: 'Life group management and directory',
    route: '/department/life-groups',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'discipleship',
    label: 'Discipleship',
    description: 'Follow-up pipeline and discipleship tracking',
    route: '/department/discipleship',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'affirmations',
    label: 'Affirmations',
    description: 'View and manage affirmations',
    route: '/affirmations',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'manage_affirmations',
    label: 'Manage Affirmations',
    description: 'Create and edit affirmations',
    route: '/manage/affirmations',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'templates',
    label: 'Email Templates',
    description: 'Manage email notification templates',
    route: '/manage/templates',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'reports',
    label: 'Reports',
    description: 'Analytics and reporting dashboard',
    route: '/manage/reports',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'latreou',
    label: 'Latreuo',
    description:
        'Worship cycle planner — songs, uniforms, rehearsals, and PDF export',
    route: '/latreou',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'rops_camp',
    label: 'ROPs Camp',
    description:
        'Manage Rites of Passage camp registrations and payments',
    route: '/manage/rops-camp',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'rops_camp_status',
    label: 'ROPs Camp Status',
    description:
        'Read-only camp numbers and camper list for department leads (no medical or contact details)',
    route: '/manage/rops-camp/status',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'fundraising',
    label: 'Fundraising',
    description:
        'Plan fundraising activities and assign braai responsibilities',
    route: '/manage/fundraising',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'transport_requests',
    label: 'Transport Requests',
    description:
        'Transport coordinator queue: cost incoming transport requests for approved events',
    route: '/manage/transport/requests',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'accounts_approvals',
    label: 'Accounts Approvals (Treasurer)',
    description:
        'Treasurer queue: confirm funds availability for transport and event budget requests',
    route: '/manage/finance/approvals',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'media_requests',
    label: 'Media Requests',
    description:
        'Media coordinator queue: confirm event media and assign Sound, Publicity, and Coverage',
    route: '/manage/media/requests',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'food_requests',
    label: 'Food Requests',
    description:
        'Food Logistics queue: plan catering and confirm food provision for events',
    route: '/manage/food/requests',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'talents',
    label: 'Talent Showcase',
    description:
        'Members put their talents forward for leadership to review and slot into opportunities',
    route: '/talents',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
  PageDefinition(
    key: 'manage_talents',
    label: 'Talent Submissions',
    description:
        'Leadership queue: review talent submissions, build the talent pool, and slot members into opportunities',
    route: '/manage/talents',
    lockedRoles: {UserRole.superAdmin: 'edit'},
  ),
];

/// role → access level, for each page key ('edit' | 'view' | 'none').
const PagePermissions defaultPagePermissions = {
  'dashboard': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'view',
    UserRole.youthLeader: 'view',
    UserRole.member: 'view',
  },
  'departments': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'view',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'members': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'view',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'department_join_requests': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'edit',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'services': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'view',
    UserRole.youthLeader: 'view',
    UserRole.member: 'none',
  },
  'calendar': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'view',
    UserRole.youthLeader: 'view',
    UserRole.member: 'view',
  },
  'events_create': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'edit',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'events_approvals': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'view',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'event_reports_submit': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'edit',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'event_reports_review': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'view',
    UserRole.admin: 'view',
    UserRole.departmentLead: 'none',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'campus_ministry': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'view',
    UserRole.youthLeader: 'view',
    UserRole.member: 'view',
  },
  'life_groups': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'view',
    UserRole.youthLeader: 'view',
    UserRole.member: 'view',
  },
  'discipleship': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'view',
    UserRole.youthLeader: 'view',
    UserRole.member: 'view',
  },
  'affirmations': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'view',
    UserRole.youthLeader: 'view',
    UserRole.member: 'view',
  },
  'manage_affirmations': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'none',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'templates': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'none',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'reports': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'none',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'latreou': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'view',
    UserRole.youthLeader: 'view',
    UserRole.member: 'view',
  },
  'rops_camp': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'none',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'rops_camp_status': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'none',
    UserRole.admin: 'none',
    UserRole.departmentLead: 'view',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'fundraising': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'none',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'transport_requests': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'none',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'accounts_approvals': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'none',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'media_requests': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'none',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'food_requests': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'none',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
  'talents': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'view',
    UserRole.youthLeader: 'view',
    UserRole.member: 'view',
  },
  'manage_talents': {
    UserRole.superAdmin: 'edit',
    UserRole.viceChairperson: 'edit',
    UserRole.admin: 'edit',
    UserRole.departmentLead: 'none',
    UserRole.youthLeader: 'none',
    UserRole.member: 'none',
  },
};

class FeatureDefinition {
  final String key;
  final String label;
  final String description;
  final String category;
  final String? lockedMinRole;
  final bool supportsDepartmentRules;

  const FeatureDefinition({
    required this.key,
    required this.label,
    required this.description,
    required this.category,
    this.lockedMinRole,
    required this.supportsDepartmentRules,
  });
}

const List<FeatureDefinition> featureDefinitions = [
  FeatureDefinition(
    key: 'create_events',
    label: 'Create Events',
    description: 'Create new events',
    category: 'Events',
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: 'approve_events',
    label: 'Approve Events (Events Lead)',
    description:
        'Events Lead: dispatch stakeholder requests and pass events to the Vice Chairperson once all confirmations are in',
    category: 'Events',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'vice_chair_approve_events',
    label: 'Vice Chair Event Approval',
    description:
        'Second-tier approval of events that have passed Events Lead review',
    category: 'Events',
    lockedMinRole: UserRole.viceChairperson,
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: 'chair_approve_events',
    label: 'Chair Event Approval (Final)',
    description:
        'Final approval that publishes the event to the calendar and notifies members',
    category: 'Events',
    lockedMinRole: UserRole.superAdmin,
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: 'submit_event_report',
    label: 'Submit Event Reports',
    description: 'Submit post-event reports for events you initiated',
    category: 'Events',
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: 'review_event_reports',
    label: 'Review Event Reports',
    description:
        'Mark post-event reports as reviewed or request changes from event initiators',
    category: 'Events',
    lockedMinRole: UserRole.superAdmin,
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: 'submit_follow_up',
    label: 'Submit Follow-Up Cards',
    description: 'Create follow-up cards for new contacts',
    category: 'Follow-Up',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'manage_follow_ups',
    label: 'Manage Follow-Up Cards',
    description: 'Update status and assign follow-up cards',
    category: 'Follow-Up',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'view_assigned_follow_ups',
    label: 'View Assigned Follow-Up Cards',
    description: 'See and update only the follow-up cards assigned to you',
    category: 'Follow-Up',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'approve_follow_up',
    label: 'Approve Follow-Up Submissions',
    description:
        'Review and approve follow-up cards submitted by youth leaders before they reach the discipleship team',
    category: 'Follow-Up',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'manage_devotionals',
    label: 'Manage Campus Devotionals',
    description:
        'Post and edit the weekly devotional focus shown to all campuses',
    category: 'Campus Ministry',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'manage_life_group_devotionals',
    label: 'Manage Life Group Devotionals',
    description:
        'Post and edit the weekly devotional focus shown to all life groups',
    category: 'Life Groups',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'submit_life_group_lead',
    label: 'Life Group Lead Reports',
    description: 'Submit life group follow-up reports',
    category: 'Life Groups',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'manage_members',
    label: 'Manage Members',
    description: 'Add and edit church members',
    category: 'Members',
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: 'delete_members',
    label: 'Delete Members',
    description: 'Remove members from the system',
    category: 'Members',
    lockedMinRole: UserRole.superAdmin,
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: 'change_user_roles',
    label: 'Change User Roles',
    description: 'Assign or change member roles',
    category: 'Members',
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: 'create_service',
    label: 'Create Services',
    description: 'Create and manage service rotas',
    category: 'Services',
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: 'manage_templates',
    label: 'Manage Email Templates',
    description: 'Create and edit email templates',
    category: 'Communication',
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: 'manage_affirmations',
    label: 'Manage Affirmations',
    description: 'Create and edit affirmations',
    category: 'Content',
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: 'manage_departments',
    label: 'Manage Departments',
    description: 'Create and configure departments',
    category: 'Admin',
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: 'manage_institutions',
    label: 'Manage Institutions',
    description: 'Manage institution list',
    category: 'Admin',
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: 'manage_settings',
    label: 'Manage Settings',
    description: 'Access system settings',
    category: 'Admin',
    lockedMinRole: UserRole.superAdmin,
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: 'latreou_access',
    label: 'Use Latreuo Planner',
    description:
        'Plan worship cycles and export the team document via the Latreuo tab',
    category: 'Worship',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'view_camp_registrations',
    label: 'View ROPs Camp Registration Status',
    description:
        'See how the camp is filling up — totals, payments, spots left, and camper names with their church/school (no medical notes or contact details)',
    category: 'ROPs Camp',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'manage_camp_registrations',
    label: 'Manage ROPs Camp Registrations',
    description:
        'View, mark paid/unpaid, and edit registrations for the Rites of Passage camp',
    category: 'ROPs Camp',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'camp_pass_admissions',
    label: 'Camp Exit Passes — Admissions',
    description:
        'Log walk-up requests to leave camp and give the first sign-off before it goes to the Camp Manager',
    category: 'ROPs Camp',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'camp_pass_manager',
    label: 'Camp Exit Passes — Camp Manager',
    description:
        "Second sign-off on a camper's request to leave camp, before it reaches the Chairperson",
    category: 'ROPs Camp',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'camp_pass_chair',
    label: 'Camp Exit Passes — Chairperson',
    description:
        'Final approval, which issues the QR gate pass. Nothing scannable exists until this sign-off',
    category: 'ROPs Camp',
    supportsDepartmentRules: false,
  ),
  FeatureDefinition(
    key: 'scan_camp_passes',
    label: 'Scan Camp Passes at the Gate',
    description:
        'Scan approved exit passes at the camp gate to sign campers out and back in (scan-only access)',
    category: 'ROPs Camp',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'serve_camp_meals',
    label: 'Serve Camp Meals',
    description:
        'Scan camper meal badges at the serving line to tick them off the meal register (scan-only access)',
    category: 'ROPs Camp',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'manage_communications',
    label: 'Manage Communications',
    description:
        'Post announcements, manage publicity, and run the social media calendar',
    category: 'Media',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'view_communications_reports',
    label: 'View Communications Reports',
    description:
        'See engagement metrics, scheduled posts, and communications summaries',
    category: 'Media',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'manage_fundraising',
    label: 'Manage Fundraising',
    description:
        'Run fundraising campaigns, record pledges, and update donor information',
    category: 'Fundraising',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'plan_fundraising_braai',
    label: 'Plan Fundraising Braai',
    description:
        'Plan Sunday fundraising braais and assign team responsibilities',
    category: 'Fundraising',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'manage_fundraising_orders',
    label: 'Manage Fundraising Orders',
    description:
        "View incoming Potter's Shockers orders and update payment / preparation status",
    category: 'Fundraising',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'view_fundraising_reports',
    label: 'View Fundraising Reports',
    description:
        'View campaign totals, donor lists, and contribution summaries',
    category: 'Fundraising',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'manage_transport_logistics',
    label: 'Manage Transport Logistics',
    description:
        'Plan transport for services, events, and outreach; record vehicle assignments',
    category: 'Transport & Logistics',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'view_transport_assignments',
    label: 'View Transport Assignments',
    description: 'See planned transport rotas and pickup lists for events',
    category: 'Transport & Logistics',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'manage_food_logistics',
    label: 'Manage Food Logistics',
    description:
        'Plan meals, manage catering vendors, and track food provision for events and camps',
    category: 'Food Logistics',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'view_food_logistics',
    label: 'View Food Logistics',
    description: 'View meal plans, headcounts, and catering schedules',
    category: 'Food Logistics',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'approve_accounts',
    label: 'Approve Accounts',
    description:
        'Treasurer: confirm funds availability for transport requests and event budget requests',
    category: 'Finance',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'manage_media',
    label: 'Manage Event Media',
    description:
        'Media coordinator: confirm event media requests and assign Sound, Publicity, and Coverage roles',
    category: 'Media',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'view_media_reports',
    label: 'View Media Assignments',
    description:
        'See media role assignments and coverage schedules for events',
    category: 'Media',
    supportsDepartmentRules: true,
  ),
  FeatureDefinition(
    key: 'confirm_food',
    label: 'Confirm Event Food',
    description:
        'Food Logistics: plan catering, request catering funds, and confirm food provision for events',
    category: 'Food Logistics',
    supportsDepartmentRules: true,
  ),
];

const FeatureMinRoles defaultFeatureMinRoles = {
  'approve_events': UserRole.admin,
  'vice_chair_approve_events': UserRole.viceChairperson,
  'chair_approve_events': UserRole.superAdmin,
  'submit_event_report': UserRole.departmentLead,
  'review_event_reports': UserRole.superAdmin,
  'submit_follow_up': UserRole.admin,
  'manage_follow_ups': UserRole.admin,
  'view_assigned_follow_ups': UserRole.admin,
  'approve_follow_up': UserRole.admin,
  'manage_devotionals': UserRole.admin,
  'manage_life_group_devotionals': UserRole.admin,
  'submit_life_group_lead': UserRole.admin,
  'manage_members': UserRole.admin,
  'delete_members': UserRole.superAdmin,
  'change_user_roles': UserRole.admin,
  'create_service': UserRole.admin,
  'create_events': UserRole.departmentLead,
  'manage_templates': UserRole.admin,
  'manage_affirmations': UserRole.admin,
  'manage_departments': UserRole.admin,
  'manage_institutions': UserRole.admin,
  'manage_settings': UserRole.superAdmin,
  'latreou_access': UserRole.admin,
  'view_camp_registrations': UserRole.departmentLead,
  'manage_camp_registrations': UserRole.admin,
  'camp_pass_admissions': UserRole.admin,
  'camp_pass_manager': UserRole.admin,
  'camp_pass_chair': UserRole.superAdmin,
  'scan_camp_passes': UserRole.admin,
  'serve_camp_meals': UserRole.admin,
  'manage_communications': UserRole.admin,
  'view_communications_reports': UserRole.admin,
  'manage_fundraising': UserRole.admin,
  'view_fundraising_reports': UserRole.admin,
  'plan_fundraising_braai': UserRole.admin,
  'manage_fundraising_orders': UserRole.admin,
  'manage_transport_logistics': UserRole.admin,
  'view_transport_assignments': UserRole.admin,
  'manage_food_logistics': UserRole.admin,
  'view_food_logistics': UserRole.admin,
  'approve_accounts': UserRole.admin,
  'manage_media': UserRole.admin,
  'view_media_reports': UserRole.admin,
  'confirm_food': UserRole.admin,
};

const List<DepartmentAccessRule> defaultDepartmentAccessRules = [
  DepartmentAccessRule(
    featureKey: 'approve_events',
    departmentName: 'Events & Fellowship',
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: 'submit_follow_up',
    departmentName: 'Campus Ministry',
    requiresLeadership: false,
    allowedRoles: [],
  ),
  DepartmentAccessRule(
    featureKey: 'submit_follow_up',
    departmentName: 'Life Groups',
    requiresLeadership: false,
    allowedRoles: [],
  ),
  DepartmentAccessRule(
    featureKey: 'manage_follow_ups',
    departmentName: 'Discipleship & Follow-Up',
    requiresLeadership: true,
    allowedRoles: [],
  ),
  DepartmentAccessRule(
    featureKey: 'view_assigned_follow_ups',
    departmentName: 'Discipleship & Follow-Up',
    requiresLeadership: false,
    allowedRoles: [UserRole.youthLeader, UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: 'submit_life_group_lead',
    departmentName: 'Life Groups',
    requiresLeadership: false,
    allowedRoles: [UserRole.departmentLead, UserRole.youthLeader],
  ),
  DepartmentAccessRule(
    featureKey: 'approve_follow_up',
    departmentName: 'Campus Ministry',
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: 'approve_follow_up',
    departmentName: 'Life Groups',
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: 'manage_devotionals',
    departmentName: 'Campus Ministry',
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: 'manage_life_group_devotionals',
    departmentName: 'Life Groups',
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: 'latreou_access',
    departmentName: 'Worship & Music',
    requiresLeadership: false,
    allowedRoles: [],
  ),
  DepartmentAccessRule(
    featureKey: 'manage_camp_registrations',
    departmentName: 'ROPs Camp',
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: 'camp_pass_admissions',
    departmentName: 'ROPs Camp',
    requiresLeadership: false,
    allowedRoles: [],
  ),
  DepartmentAccessRule(
    featureKey: 'camp_pass_manager',
    departmentName: 'ROPs Camp',
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: 'scan_camp_passes',
    departmentName: 'ROPs Camp',
    requiresLeadership: false,
    allowedRoles: [],
  ),
  DepartmentAccessRule(
    featureKey: 'scan_camp_passes',
    departmentName: 'Ushering & Protocol',
    requiresLeadership: false,
    allowedRoles: [],
  ),
  DepartmentAccessRule(
    featureKey: 'serve_camp_meals',
    departmentName: 'ROPs Camp',
    requiresLeadership: false,
    allowedRoles: [],
  ),
  DepartmentAccessRule(
    featureKey: 'serve_camp_meals',
    departmentName: 'Food Logistics',
    requiresLeadership: false,
    allowedRoles: [],
  ),
  DepartmentAccessRule(
    featureKey: 'manage_communications',
    departmentName: 'Media',
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: 'view_communications_reports',
    departmentName: 'Media',
    requiresLeadership: false,
    allowedRoles: [UserRole.departmentLead, UserRole.youthLeader],
  ),
  DepartmentAccessRule(
    featureKey: 'manage_fundraising',
    departmentName: 'Fundraising',
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: 'view_fundraising_reports',
    departmentName: 'Fundraising',
    requiresLeadership: false,
    allowedRoles: [UserRole.departmentLead, UserRole.youthLeader],
  ),
  DepartmentAccessRule(
    featureKey: 'plan_fundraising_braai',
    departmentName: 'Fundraising',
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: 'manage_fundraising_orders',
    departmentName: 'Fundraising',
    requiresLeadership: false,
    allowedRoles: [],
  ),
  DepartmentAccessRule(
    featureKey: 'manage_transport_logistics',
    departmentName: 'Transport & Logistics',
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: 'view_transport_assignments',
    departmentName: 'Transport & Logistics',
    requiresLeadership: false,
    allowedRoles: [UserRole.departmentLead, UserRole.youthLeader],
  ),
  DepartmentAccessRule(
    featureKey: 'manage_food_logistics',
    departmentName: 'Food Logistics',
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: 'view_food_logistics',
    departmentName: 'Food Logistics',
    requiresLeadership: false,
    allowedRoles: [UserRole.departmentLead, UserRole.youthLeader],
  ),
  DepartmentAccessRule(
    featureKey: 'approve_accounts',
    departmentName: 'Finance',
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: 'manage_media',
    departmentName: 'Media',
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
  DepartmentAccessRule(
    featureKey: 'view_media_reports',
    departmentName: 'Media',
    requiresLeadership: false,
    allowedRoles: [UserRole.departmentLead, UserRole.youthLeader],
  ),
  DepartmentAccessRule(
    featureKey: 'confirm_food',
    departmentName: 'Food Logistics',
    requiresLeadership: true,
    allowedRoles: [UserRole.departmentLead],
  ),
];

/// Departmental managers tracked in the Super Admin role management UI.
const List<({String departmentName, String? displayName})>
    departmentalManagers = [
  (departmentName: 'Discipleship & Follow-Up', displayName: 'Discipleship'),
  (departmentName: 'Events & Fellowship', displayName: null),
  (departmentName: 'Media', displayName: null),
  (departmentName: 'Fundraising', displayName: null),
  (departmentName: 'Transport & Logistics', displayName: null),
  (departmentName: 'Life Groups', displayName: null),
  (departmentName: 'Campus Ministry', displayName: null),
  (departmentName: 'Food Logistics', displayName: null),
  (departmentName: 'Finance', displayName: 'Finance (Treasurer)'),
];

/// Access level for a role on a page, respecting locked roles.
String getPageAccess(
  String pageKey,
  String role, [
  PagePermissions? customPermissions,
]) {
  if (role == UserRole.superAdmin) return 'edit';

  PageDefinition? pageDef;
  for (final p in pageDefinitions) {
    if (p.key == pageKey) {
      pageDef = p;
      break;
    }
  }
  if (pageDef == null) return 'none';

  final locked = pageDef.lockedRoles?[role];
  if (locked != null) return locked;

  final permissions = customPermissions ?? defaultPagePermissions;
  return permissions[pageKey]?[role] ?? 'none';
}

bool canAccessPage(
  String pageKey,
  String role, [
  PagePermissions? customPermissions,
]) {
  final access = getPageAccess(pageKey, role, customPermissions);
  return access == 'edit' || access == 'view';
}

bool canEditPage(
  String pageKey,
  String role, [
  PagePermissions? customPermissions,
]) =>
    getPageAccess(pageKey, role, customPermissions) == 'edit';

/// Merge saved permissions with defaults for any new pages.
PagePermissions mergeWithDefaults(PagePermissions saved) {
  final merged = <String, Map<String, String>>{
    for (final e in defaultPagePermissions.entries)
      e.key: Map<String, String>.from(e.value),
  };
  for (final pageKey in saved.keys) {
    if (merged.containsKey(pageKey)) {
      merged[pageKey] = {...merged[pageKey]!, ...saved[pageKey]!};
    }
  }
  return merged;
}

FeatureMinRoles mergeFeatureMinRoles(FeatureMinRoles saved) =>
    {...defaultFeatureMinRoles, ...saved};

List<DepartmentAccessRule> mergeDepartmentAccessRules(
    List<DepartmentAccessRule> saved) {
  final coveredFeatures = saved.map((r) => r.featureKey).toSet();
  final missingDefaults = defaultDepartmentAccessRules
      .where((r) => !coveredFeatures.contains(r.featureKey));
  return [...saved, ...missingDefaults];
}

/// Whether a user can use a feature — min-role check first, then
/// department-based rules (needs the department name→id map).
bool checkFeatureAccess(
  String featureKey,
  String userRole,
  List<String> userDepartmentIds,
  List<String> userLeadsDepartmentIds,
  Map<String, String> departmentNameToId, {
  FeatureMinRoles? minRoles,
  List<DepartmentAccessRule>? rules,
}) {
  if (userRole == UserRole.superAdmin) return true;

  final effectiveMinRoles = minRoles ?? defaultFeatureMinRoles;
  final effectiveRules = rules ?? defaultDepartmentAccessRules;

  final minRole = effectiveMinRoles[featureKey] ?? UserRole.superAdmin;
  final userRank = UserRole.hierarchy[userRole] ?? 0;
  final minRank = UserRole.hierarchy[minRole] ?? 7;
  if (userRank >= minRank) return true;

  for (final rule in effectiveRules) {
    if (rule.featureKey != featureKey) continue;
    final deptId = departmentNameToId[rule.departmentName];
    if (deptId == null) continue;

    final hasMembership = rule.requiresLeadership
        ? userLeadsDepartmentIds.contains(deptId)
        : userDepartmentIds.contains(deptId);
    if (!hasMembership) continue;

    if (rule.allowedRoles.isEmpty || rule.allowedRoles.contains(userRole)) {
      return true;
    }
  }

  return false;
}
