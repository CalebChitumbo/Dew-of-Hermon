import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../access/access_provider.dart';
import '../auth/auth_provider.dart';
import '../nav/nav_config.dart';
import '../services/pending_counts_provider.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../widgets/shared.dart';

/// The signed-in scaffold — port of `Header.tsx` + `SidebarNav.tsx`:
/// a white top bar (logo, "Dew of Hermon", notification bell) and a drawer
/// with the grouped collapsible nav, pending-count pills, mobile shortcuts,
/// and the user card + sign-out footer.
class AppShell extends StatelessWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            Image.asset(
              'assets/images/church-logo.png',
              height: 28,
              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
            ),
            const SizedBox(width: 8),
            Text('Dew of Hermon', style: AppText.display(size: 15)),
          ],
        ),
        actions: const [
          NotificationBell(),
          SizedBox(width: 4),
        ],
      ),
      drawer: const AppDrawer(),
      body: child,
    );
  }
}

class AppDrawer extends StatefulWidget {
  const AppDrawer({super.key});

  @override
  State<AppDrawer> createState() => _AppDrawerState();
}

class _AppDrawerState extends State<AppDrawer> {
  static const _storageKey = 'dew:sidebar-open-groups';
  Map<String, bool> _openGroups = {};
  bool _restored = false;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getStringList(_storageKey) ?? [];
      if (!mounted) return;
      setState(() {
        _openGroups = {for (final id in raw) id: true};
        _restored = true;
      });
    } catch (_) {
      setState(() => _restored = true);
    }
  }

  Future<void> _toggleGroup(String id) async {
    setState(() => _openGroups[id] = !(_openGroups[id] ?? false));
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(
        _storageKey,
        _openGroups.entries.where((e) => e.value).map((e) => e.key).toList(),
      );
    } catch (_) {/* ignore unavailable storage */}
  }

  bool _isActive(String location, String href) =>
      location == href || location.startsWith('$href/');

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final accessControl = context.watch<AccessControlProvider>();
    final features = context.watch<FeatureAccessProvider>();
    final counts = context.watch<PendingCountsProvider>().counts;
    final userData = auth.userData;

    if (userData == null) return const Drawer();

    // Feature-based extras, mirroring Header.tsx.
    final extraKeys = <String>[
      if (features.canManageCamp) 'rops_camp',
      if (features.canViewCampStatus) 'rops_camp_status',
      if (features.canPlanBraai) 'fundraising',
      if (features.canManageTransport) 'transport_requests',
      if (features.canApproveAccounts) 'accounts_approvals',
      if (features.canManageMedia) 'media_requests',
      if (features.canConfirmFood) 'food_requests',
    ];
    // The full camp page is a superset of the status page — show one or the other.
    final hiddenKeys = features.canManageCamp ? ['rops_camp_status'] : <String>[];

    final entries = getVisibleNavEntries(
      userData.role,
      accessControl.pagePermissions,
      extraIncludeKeys: extraKeys,
      hiddenKeys: hiddenKeys,
    );

    final location = GoRouterState.of(context).uri.path;

    // The group containing the current page auto-expands.
    final openGroups = Map<String, bool>.from(_openGroups);
    for (final entry in entries) {
      if (entry is NavEntryGroup &&
          entry.group.items.any((i) => _isActive(location, i.href))) {
        openGroups[entry.group.id] = true;
      }
    }

    int countFor(NavItem item) =>
        item.pageKey == null ? 0 : (counts[item.pageKey] ?? 0);

    return Drawer(
      width: 288,
      child: SafeArea(
        child: Column(
          children: [
            // Header row: logo + name + close
            Container(
              height: 56,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: const BoxDecoration(
                border:
                    Border(bottom: BorderSide(color: AppColors.clay100)),
              ),
              child: Row(
                children: [
                  Image.asset(
                    'assets/images/church-logo.png',
                    height: 34,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child:
                        Text('Dew of Hermon', style: AppText.display(size: 16)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            // Nav
            Expanded(
              child: !_restored
                  ? const SizedBox.shrink()
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        for (final entry in entries)
                          switch (entry) {
                            NavEntryItem(:final item) => _NavLink(
                                item: item,
                                active: _isActive(location, item.href),
                                count: countFor(item),
                              ),
                            NavEntryGroup(:final group) => _NavGroupTile(
                                group: group,
                                open: openGroups[group.id] ?? false,
                                location: location,
                                counts: counts,
                                onToggle: () => _toggleGroup(group.id),
                              ),
                          },
                        const SizedBox(height: 8),
                        const Divider(),
                        const SizedBox(height: 8),
                        _NavLink(
                          item: const NavItem(
                              label: 'Notifications',
                              href: '/notifications',
                              icon: Icons.notifications_none),
                          active: _isActive(location, '/notifications'),
                          count: 0,
                        ),
                        _NavLink(
                          item: const NavItem(
                              label: 'Profile',
                              href: '/profile',
                              icon: Icons.account_circle_outlined),
                          active: _isActive(location, '/profile'),
                          count: 0,
                        ),
                      ],
                    ),
            ),
            // Footer: user card + sign out
            Container(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.clay100)),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      UserAvatar(name: userData.name),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              userData.name,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.body(
                                  size: 14, weight: FontWeight.w500),
                            ),
                            Text(
                              userData.role.replaceAll('_', ' '),
                              style: AppText.body(
                                  size: 12, color: AppColors.clay400),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        final auth = context.read<AuthProvider>();
                        Navigator.of(context).pop();
                        await auth.signOut();
                      },
                      icon: const Icon(Icons.logout, size: 16),
                      label: const Text('Sign Out'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A small red pill showing how many items need attention.
class _NavBadge extends StatelessWidget {
  final int count;
  const _NavBadge({required this.count});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 20),
      height: 20,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.red500,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        count > 99 ? '99+' : '$count',
        style:
            AppText.body(size: 10, weight: FontWeight.w700, color: Colors.white),
      ),
    );
  }
}

class _NavLink extends StatelessWidget {
  final NavItem item;
  final bool active;
  final int count;
  final bool nested;

  const _NavLink({
    required this.item,
    required this.active,
    required this.count,
    this.nested = false,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? AppColors.clay100 : Colors.transparent,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () {
          Navigator.of(context).pop();
          context.go(item.href);
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Icon(item.icon,
                  size: nested ? 18 : 20,
                  color: active ? AppColors.clay700 : AppColors.clay500),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  item.label,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 14,
                    weight: FontWeight.w500,
                    color: active ? AppColors.clay700 : AppColors.clay500,
                  ),
                ),
              ),
              if (count > 0) _NavBadge(count: count),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavGroupTile extends StatelessWidget {
  final NavGroup group;
  final bool open;
  final String location;
  final Map<String, int> counts;
  final VoidCallback onToggle;

  const _NavGroupTile({
    required this.group,
    required this.open,
    required this.location,
    required this.counts,
    required this.onToggle,
  });

  bool _isActive(String href) =>
      location == href || location.startsWith('$href/');

  @override
  Widget build(BuildContext context) {
    final hasActiveChild = group.items.any((i) => _isActive(i.href));
    final groupCount = group.items.fold<int>(
      0,
      (sum, item) => sum + (item.pageKey == null ? 0 : (counts[item.pageKey] ?? 0)),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Material(
          color: hasActiveChild && !open
              ? AppColors.clay50
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          child: InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: onToggle,
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  Icon(group.icon,
                      size: 20,
                      color: hasActiveChild
                          ? AppColors.clay700
                          : AppColors.clay500),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      group.label,
                      style: AppText.body(
                        size: 14,
                        weight: FontWeight.w500,
                        color: hasActiveChild
                            ? AppColors.clay700
                            : AppColors.clay500,
                      ),
                    ),
                  ),
                  if (!open && groupCount > 0) ...[
                    _NavBadge(count: groupCount),
                    const SizedBox(width: 6),
                  ],
                  AnimatedRotation(
                    turns: open ? 0 : -0.25,
                    duration: const Duration(milliseconds: 200),
                    child: const Icon(Icons.keyboard_arrow_down,
                        size: 16, color: AppColors.clay400),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (open)
          Padding(
            padding: const EdgeInsets.only(left: 16, top: 4),
            child: Container(
              decoration: const BoxDecoration(
                border: Border(
                  left: BorderSide(color: AppColors.clay100),
                ),
              ),
              padding: const EdgeInsets.only(left: 8),
              child: Column(
                children: [
                  for (final item in group.items)
                    _NavLink(
                      item: item,
                      active: _isActive(item.href),
                      count: item.pageKey == null
                          ? 0
                          : (counts[item.pageKey] ?? 0),
                      nested: true,
                    ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
