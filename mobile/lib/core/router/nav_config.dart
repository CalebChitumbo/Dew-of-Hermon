import 'package:flutter/widgets.dart';
import '../theme/app_icons.dart';

import '../../data/models/enums.dart';
import '../access/access_control.dart';

/// Port of `src/components/layout/nav-config.ts` — the single source of truth
/// for what a given role sees in the drawer. Groups with no visible items are
/// dropped, exactly as on the web.

class NavItem {
  const NavItem({
    required this.label,
    required this.href,
    required this.icon,
    this.pageKey,
  });

  final String label;
  final String href;
  final IconData icon;

  /// The page key used for access-control lookup. Null means the item has its
  /// own guard (see `_shouldShow`). Doubles as the key into
  /// `/api/pending-counts` for this item's badge.
  final String? pageKey;
}

/// A collapsible section grouping related items under one heading.
class NavGroup {
  const NavGroup({
    required this.id,
    required this.label,
    required this.icon,
    required this.items,
  });

  final String id;
  final String label;
  final IconData icon;
  final List<NavItem> items;

  NavGroup withItems(List<NavItem> next) =>
      NavGroup(id: id, label: label, icon: icon, items: next);
}

/// An entry is either a standalone link or a collapsible group.
sealed class NavEntry {
  const NavEntry();
}

class NavItemEntry extends NavEntry {
  const NavItemEntry(this.item);
  final NavItem item;
}

class NavGroupEntry extends NavEntry {
  const NavGroupEntry(this.group);
  final NavGroup group;
}

// ─── Standalone items shown above the groups ───
const List<NavItem> _topItems = [
  NavItem(
      label: 'Dashboard',
      href: '/dashboard',
      icon: AppIcons.dashboard,
      pageKey: 'dashboard'),
  // My Schedule: members/leads only — handled by the role check in _shouldShow.
  NavItem(
      label: 'My Schedule',
      href: '/my-schedule',
      icon: AppIcons.calendarDays),
  // Bible: available to every signed-in user — handled in _shouldShow.
  NavItem(label: 'Bible', href: '/bible', icon: AppIcons.bible),
];

/// Everything to do with running the weekly church service.
const NavGroup _pottersWheel = NavGroup(
  id: 'potters-will',
  label: "Potter's Wheel",
  icon: AppIcons.church,
  items: [
    NavItem(
        label: 'Services & Rotas',
        href: '/manage/services',
        icon: AppIcons.clipboard,
        pageKey: 'services'),
    NavItem(
        label: 'Latreuo',
        href: '/latreou',
        icon: AppIcons.music,
        pageKey: 'latreou'),
  ],
);

const NavGroup _events = NavGroup(
  id: 'events',
  label: 'Events',
  icon: AppIcons.calendarRange,
  items: [
    NavItem(
        label: 'Calendar',
        href: '/calendar',
        icon: AppIcons.calendar,
        pageKey: 'calendar'),
    NavItem(
        label: 'Create Event',
        href: '/manage/events/new',
        icon: AppIcons.calendarPlus,
        pageKey: 'events_create'),
    NavItem(
        label: 'Event Approvals',
        href: '/manage/events/approvals',
        icon: AppIcons.clipboardCheck,
        pageKey: 'events_approvals'),
    NavItem(
        label: 'Event Reports',
        href: '/manage/events/reports',
        icon: AppIcons.fileText,
        pageKey: 'event_reports_submit'),
  ],
);

const NavGroup _ministries = NavGroup(
  id: 'ministries',
  label: 'Ministries',
  icon: AppIcons.ministries,
  items: [
    NavItem(
        label: 'Departments',
        href: '/departments',
        icon: AppIcons.department,
        pageKey: 'departments'),
    NavItem(
        label: 'Join Requests',
        href: '/manage/department-requests',
        icon: AppIcons.userPlus,
        pageKey: 'department_join_requests'),
    NavItem(
        label: 'Campus Ministry',
        href: '/department/campus-ministry',
        icon: AppIcons.graduation,
        pageKey: 'campus_ministry'),
    NavItem(
        label: 'Life Groups',
        href: '/department/life-groups',
        icon: AppIcons.usersRound,
        pageKey: 'life_groups'),
    NavItem(
        label: 'Discipleship',
        href: '/department/discipleship',
        icon: AppIcons.heart,
        pageKey: 'discipleship'),
  ],
);

/// Stakeholder coordinator queues for approved events.
const NavGroup _requests = NavGroup(
  id: 'requests',
  label: 'Requests',
  icon: AppIcons.inbox,
  items: [
    NavItem(
        label: 'Transport Requests',
        href: '/manage/transport/requests',
        icon: AppIcons.transport,
        pageKey: 'transport_requests'),
    NavItem(
        label: 'Media Requests',
        href: '/manage/media/requests',
        icon: AppIcons.media,
        pageKey: 'media_requests'),
    NavItem(
        label: 'Food Requests',
        href: '/manage/food/requests',
        icon: AppIcons.food,
        pageKey: 'food_requests'),
    NavItem(
        label: 'Accounts Approvals',
        href: '/manage/finance/approvals',
        icon: AppIcons.money,
        pageKey: 'accounts_approvals'),
    NavItem(
        label: 'Talent Submissions',
        href: '/manage/talents',
        icon: AppIcons.mic,
        pageKey: 'manage_talents'),
  ],
);

// ─── Standalone items shown below the main groups ───
const List<NavItem> _midItems = [
  NavItem(
      label: 'Members',
      href: '/manage/members',
      icon: AppIcons.users,
      pageKey: 'members'),
  NavItem(
      label: 'ROPs Camp',
      href: '/manage/rops-camp',
      icon: AppIcons.tent,
      pageKey: 'rops_camp'),
  // Read-only camp numbers for department leads. Hidden from anyone who has
  // the full camp page above, so it never doubles up.
  NavItem(
      label: 'Camp Status',
      href: '/manage/rops-camp/status',
      icon: AppIcons.tent,
      pageKey: 'rops_camp_status'),
  NavItem(
      label: 'Fundraising',
      href: '/manage/fundraising',
      icon: AppIcons.flame,
      pageKey: 'fundraising'),
  NavItem(
      label: 'Affirmations',
      href: '/affirmations',
      icon: AppIcons.sparkles,
      pageKey: 'affirmations'),
  NavItem(
      label: 'Talent Showcase',
      href: '/talents',
      icon: AppIcons.star,
      pageKey: 'talents'),
];

/// Admin tooling — shown last. Settings is SUPER_ADMIN only.
const NavGroup _admin = NavGroup(
  id: 'admin',
  label: 'Admin',
  icon: AppIcons.admin,
  items: [
    NavItem(
        label: 'Templates',
        href: '/manage/templates',
        icon: AppIcons.mail,
        pageKey: 'templates'),
    NavItem(
        label: 'Reports',
        href: '/manage/reports',
        icon: AppIcons.reports,
        pageKey: 'reports'),
    NavItem(
        label: 'Settings', href: '/manage/settings', icon: AppIcons.settings),
  ],
);

/// Roles that get their personal "My Schedule" link.
const List<UserRole> _scheduleRoles = [
  UserRole.member,
  UserRole.youthLeader,
  UserRole.departmentLead,
];

bool _shouldShow(
  NavItem item,
  UserRole role,
  PagePermissions pagePermissions,
  Set<String> extra,
  Set<String> hidden,
) {
  // A caller-supplied hide wins over every rule below — it is how a page that
  // is redundant for this user gets dropped.
  if (item.pageKey != null && hidden.contains(item.pageKey)) return false;

  // Settings is always SUPER_ADMIN only.
  if (item.href == '/manage/settings') return role == UserRole.superAdmin;

  // My Schedule is the personal view for non-admin roles.
  if (item.href == '/my-schedule') return _scheduleRoles.contains(role);

  // Bible is a shared devotional resource — visible to every role.
  if (item.href == '/bible') return true;

  // Anything else without a page key has no guard of its own — hide it.
  if (item.pageKey == null) return false;

  return canAccessPage(item.pageKey!, role, pagePermissions) ||
      extra.contains(item.pageKey);
}

/// The grouped drawer contents a given role sees.
///
/// [extraIncludeKeys] force-includes page keys that [pagePermissions] would
/// exclude (e.g. a DEPARTMENT_LEAD of "ROPs Camp" gaining /manage/rops-camp
/// via a department rule). [hiddenKeys] drops keys that would otherwise show.
List<NavEntry> getVisibleNavEntries(
  UserRole role,
  PagePermissions pagePermissions, {
  List<String> extraIncludeKeys = const [],
  List<String> hiddenKeys = const [],
}) {
  final extra = extraIncludeKeys.toSet();
  final hidden = hiddenKeys.toSet();
  bool show(NavItem item) =>
      _shouldShow(item, role, pagePermissions, extra, hidden);

  final entries = <NavEntry>[];

  void pushItems(List<NavItem> items) {
    for (final item in items) {
      if (show(item)) entries.add(NavItemEntry(item));
    }
  }

  void pushGroup(NavGroup group) {
    final items = group.items.where(show).toList();
    if (items.isNotEmpty) entries.add(NavGroupEntry(group.withItems(items)));
  }

  pushItems(_topItems);
  pushGroup(_pottersWheel);
  pushGroup(_events);
  pushGroup(_ministries);
  pushGroup(_requests);
  pushItems(_midItems);
  pushGroup(_admin);

  return entries;
}

// ─── Bottom navigation (mobile IA, ported from MobileNav.tsx) ───

/// Priority-ordered bottom-bar items per role tier. Items with no page key
/// are always shown.
const List<NavItem> _adminBottom = [
  NavItem(
      label: 'Dashboard',
      href: '/dashboard',
      icon: AppIcons.dashboard,
      pageKey: 'dashboard'),
  NavItem(
      label: 'Members',
      href: '/manage/members',
      icon: AppIcons.users,
      pageKey: 'members'),
  NavItem(
      label: 'Calendar',
      href: '/calendar',
      icon: AppIcons.calendar,
      pageKey: 'calendar'),
  NavItem(label: 'Bible', href: '/bible', icon: AppIcons.bible),
  NavItem(label: 'Profile', href: '/profile', icon: AppIcons.profile),
];

const List<NavItem> _leadBottom = [
  NavItem(
      label: 'Dashboard',
      href: '/dashboard',
      icon: AppIcons.dashboard,
      pageKey: 'dashboard'),
  NavItem(
      label: 'Services',
      href: '/manage/services',
      icon: AppIcons.clipboard,
      pageKey: 'services'),
  NavItem(
      label: 'Calendar',
      href: '/calendar',
      icon: AppIcons.calendar,
      pageKey: 'calendar'),
  NavItem(label: 'Bible', href: '/bible', icon: AppIcons.bible),
  NavItem(label: 'Profile', href: '/profile', icon: AppIcons.profile),
];

const List<NavItem> _memberBottom = [
  NavItem(
      label: 'Schedule',
      href: '/my-schedule',
      icon: AppIcons.calendarDays),
  NavItem(label: 'Bible', href: '/bible', icon: AppIcons.bible),
  NavItem(
      label: 'Calendar',
      href: '/calendar',
      icon: AppIcons.calendar,
      pageKey: 'calendar'),
  NavItem(
      label: 'Notes',
      href: '/affirmations',
      icon: AppIcons.sparkles,
      pageKey: 'affirmations'),
  NavItem(label: 'Profile', href: '/profile', icon: AppIcons.profile),
];

/// The five bottom-bar destinations for a role, filtered by access control.
List<NavItem> getBottomNavItems(
    UserRole role, PagePermissions pagePermissions) {
  final candidates = switch (role) {
    UserRole.superAdmin || UserRole.admin || UserRole.viceChairperson =>
      _adminBottom,
    UserRole.departmentLead => _leadBottom,
    _ => _memberBottom,
  };
  return candidates
      .where((item) =>
          item.pageKey == null ||
          canAccessPage(item.pageKey!, role, pagePermissions))
      .toList();
}
