import 'package:flutter/material.dart';

import '../access/access_control.dart';
import '../models/misc.dart' show PagePermissions;
import '../models/user.dart';

/// Port of `src/components/layout/nav-config.ts` — the grouped sidebar tree
/// and the visibility rules for every account type.

class NavItem {
  final String label;
  final String href;
  final IconData icon;

  /// Page key used for access control lookup. null = uses its own guard.
  final String? pageKey;

  const NavItem({
    required this.label,
    required this.href,
    required this.icon,
    this.pageKey,
  });
}

class NavGroup {
  final String id;
  final String label;
  final IconData icon;
  final List<NavItem> items;

  const NavGroup({
    required this.id,
    required this.label,
    required this.icon,
    required this.items,
  });
}

sealed class NavEntry {
  const NavEntry();
}

class NavEntryItem extends NavEntry {
  final NavItem item;
  const NavEntryItem(this.item);
}

class NavEntryGroup extends NavEntry {
  final NavGroup group;
  const NavEntryGroup(this.group);
}

// ─── Standalone items shown above the groups ───
const List<NavItem> _topItems = [
  NavItem(
      label: 'Dashboard',
      href: '/dashboard',
      icon: Icons.space_dashboard_outlined,
      pageKey: 'dashboard'),
  NavItem(
      label: 'My Schedule',
      href: '/my-schedule',
      icon: Icons.calendar_month_outlined,
      pageKey: null),
  NavItem(
      label: 'Bible',
      href: '/bible',
      icon: Icons.menu_book_outlined,
      pageKey: null),
];

/// Everything to do with running the weekly church service.
const NavGroup _pottersWheel = NavGroup(
  id: 'potters-will',
  label: "Potter's Wheel",
  icon: Icons.church_outlined,
  items: [
    NavItem(
        label: 'Services & Rotas',
        href: '/manage/services',
        icon: Icons.assignment_outlined,
        pageKey: 'services'),
    NavItem(
        label: 'Latreuo',
        href: '/latreou',
        icon: Icons.music_note_outlined,
        pageKey: 'latreou'),
  ],
);

const NavGroup _events = NavGroup(
  id: 'events',
  label: 'Events',
  icon: Icons.date_range_outlined,
  items: [
    NavItem(
        label: 'Calendar',
        href: '/calendar',
        icon: Icons.calendar_today_outlined,
        pageKey: 'calendar'),
    NavItem(
        label: 'Create Event',
        href: '/manage/events/new',
        icon: Icons.event_outlined,
        pageKey: 'events_create'),
    NavItem(
        label: 'Event Approvals',
        href: '/manage/events/approvals',
        icon: Icons.fact_check_outlined,
        pageKey: 'events_approvals'),
    NavItem(
        label: 'Event Reports',
        href: '/manage/events/reports',
        icon: Icons.description_outlined,
        pageKey: 'event_reports_submit'),
  ],
);

const NavGroup _ministries = NavGroup(
  id: 'ministries',
  label: 'Ministries',
  icon: Icons.volunteer_activism_outlined,
  items: [
    NavItem(
        label: 'Departments',
        href: '/departments',
        icon: Icons.apartment_outlined,
        pageKey: 'departments'),
    NavItem(
        label: 'Join Requests',
        href: '/manage/department-requests',
        icon: Icons.person_add_alt_outlined,
        pageKey: 'department_join_requests'),
    NavItem(
        label: 'Campus Ministry',
        href: '/department/campus-ministry',
        icon: Icons.school_outlined,
        pageKey: 'campus_ministry'),
    NavItem(
        label: 'Life Groups',
        href: '/department/life-groups',
        icon: Icons.groups_outlined,
        pageKey: 'life_groups'),
    NavItem(
        label: 'Discipleship',
        href: '/department/discipleship',
        icon: Icons.favorite_outline,
        pageKey: 'discipleship'),
  ],
);

/// Stakeholder coordinator queues for approved events.
const NavGroup _requests = NavGroup(
  id: 'requests',
  label: 'Requests',
  icon: Icons.inbox_outlined,
  items: [
    NavItem(
        label: 'Transport Requests',
        href: '/manage/transport/requests',
        icon: Icons.directions_bus_outlined,
        pageKey: 'transport_requests'),
    NavItem(
        label: 'Media Requests',
        href: '/manage/media/requests',
        icon: Icons.movie_outlined,
        pageKey: 'media_requests'),
    NavItem(
        label: 'Food Requests',
        href: '/manage/food/requests',
        icon: Icons.restaurant_outlined,
        pageKey: 'food_requests'),
    NavItem(
        label: 'Accounts Approvals',
        href: '/manage/finance/approvals',
        icon: Icons.payments_outlined,
        pageKey: 'accounts_approvals'),
    NavItem(
        label: 'Talent Submissions',
        href: '/manage/talents',
        icon: Icons.mic_outlined,
        pageKey: 'manage_talents'),
  ],
);

// ─── Standalone items shown below the main groups ───
const List<NavItem> _midItems = [
  NavItem(
      label: 'Members',
      href: '/manage/members',
      icon: Icons.people_outline,
      pageKey: 'members'),
  NavItem(
      label: 'ROPs Camp',
      href: '/manage/rops-camp',
      icon: Icons.cabin_outlined,
      pageKey: 'rops_camp'),
  NavItem(
      label: 'Camp Status',
      href: '/manage/rops-camp/status',
      icon: Icons.cabin_outlined,
      pageKey: 'rops_camp_status'),
  NavItem(
      label: 'Fundraising',
      href: '/manage/fundraising',
      icon: Icons.local_fire_department_outlined,
      pageKey: 'fundraising'),
  NavItem(
      label: 'Affirmations',
      href: '/affirmations',
      icon: Icons.auto_awesome_outlined,
      pageKey: 'affirmations'),
  NavItem(
      label: 'Talent Showcase',
      href: '/talents',
      icon: Icons.star_outline,
      pageKey: 'talents'),
];

/// Admin tooling — shown last. Settings is SUPER_ADMIN only.
const NavGroup _admin = NavGroup(
  id: 'admin',
  label: 'Admin',
  icon: Icons.verified_user_outlined,
  items: [
    NavItem(
        label: 'Templates',
        href: '/manage/templates',
        icon: Icons.mail_outline,
        pageKey: 'templates'),
    NavItem(
        label: 'Reports',
        href: '/manage/reports',
        icon: Icons.bar_chart_outlined,
        pageKey: 'reports'),
    NavItem(
        label: 'Settings',
        href: '/manage/settings',
        icon: Icons.settings_outlined,
        pageKey: null),
  ],
);

/// Roles that get their personal "My Schedule" link.
const List<String> _scheduleRoles = [
  UserRole.member,
  UserRole.youthLeader,
  UserRole.departmentLead,
];

bool _shouldShow(
  NavItem item,
  String role,
  PagePermissions pagePermissions,
  Set<String> extraSet,
  Set<String> hiddenSet,
) {
  if (item.pageKey != null && hiddenSet.contains(item.pageKey)) return false;

  // Settings is always SUPER_ADMIN only.
  if (item.href == '/manage/settings') return role == UserRole.superAdmin;

  // My Schedule is the personal view for non-admin roles.
  if (item.href == '/my-schedule') return _scheduleRoles.contains(role);

  // Bible is a shared devotional resource — visible to every role.
  if (item.href == '/bible') return true;

  if (item.pageKey == null) return false;

  return canAccessPage(item.pageKey!, role, pagePermissions) ||
      extraSet.contains(item.pageKey);
}

/// Single source of truth for the grouped drawer contents a role sees —
/// port of `getVisibleNavEntries`.
List<NavEntry> getVisibleNavEntries(
  String role,
  PagePermissions pagePermissions, {
  List<String> extraIncludeKeys = const [],
  List<String> hiddenKeys = const [],
}) {
  final extraSet = extraIncludeKeys.toSet();
  final hiddenSet = hiddenKeys.toSet();
  bool show(NavItem item) =>
      _shouldShow(item, role, pagePermissions, extraSet, hiddenSet);

  final entries = <NavEntry>[];

  void pushItems(List<NavItem> items) {
    for (final item in items) {
      if (show(item)) entries.add(NavEntryItem(item));
    }
  }

  void pushGroup(NavGroup group) {
    final items = group.items.where(show).toList();
    if (items.isNotEmpty) {
      entries.add(NavEntryGroup(NavGroup(
        id: group.id,
        label: group.label,
        icon: group.icon,
        items: items,
      )));
    }
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
