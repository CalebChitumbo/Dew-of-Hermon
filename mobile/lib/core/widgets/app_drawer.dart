import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/repositories/pending_counts_repository.dart';
import '../access/access_providers.dart';
import '../auth/auth_providers.dart';
import '../auth/auth_service.dart';
import '../router/nav_config.dart';
import '../theme/app_colors.dart';
import '../theme/app_icons.dart';
import '../theme/app_theme.dart';
import 'common.dart';

/// The grouped navigation drawer — the mobile counterpart of the web sidebar.
/// Groups expand and collapse, and each item whose page key appears in the counts shows its
/// live pending count from `/api/pending-counts`.
class AppDrawer extends ConsumerStatefulWidget {
  const AppDrawer({super.key});

  @override
  ConsumerState<AppDrawer> createState() => _AppDrawerState();
}

class _AppDrawerState extends ConsumerState<AppDrawer> {
  /// Which groups are open. Seeded from the active route so the section
  /// holding the current page starts expanded.
  final Set<String> _expanded = {};
  bool _seeded = false;

  @override
  Widget build(BuildContext context) {
    final access = ref.watch(accessProvider);
    final user = access.user;
    if (user == null) return const Drawer(child: SizedBox.shrink());

    final counts = ref.watch(pendingCountsProvider).valueOrNull ?? const {};
    final location = GoRouterState.of(context).uri.path;

    // A DEPARTMENT_LEAD of "ROPs Camp" reaches the full camp page through the
    // department rule rather than the page table, so force it in; and drop the
    // read-only Camp Status entry for anyone who already has the full page —
    // exactly the extra/hidden key handling the web sidebar does.
    final canManageCamp = access.can('manage_camp_registrations');
    final entries = getVisibleNavEntries(
      access.role,
      access.config.pagePermissions,
      extraIncludeKeys: [
        if (canManageCamp) 'rops_camp',
        if (access.can('view_camp_registrations')) 'rops_camp_status',
      ],
      hiddenKeys: [if (canManageCamp) 'rops_camp_status'],
    );

    if (!_seeded) {
      for (final entry in entries) {
        if (entry is NavGroupEntry &&
            entry.group.items.any((i) => location.startsWith(i.href))) {
          _expanded.add(entry.group.id);
        }
      }
      _seeded = true;
    }

    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            _Header(name: user.name, role: access.role.label, email: user.email),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 12),
                children: [
                  for (final entry in entries)
                    switch (entry) {
                      NavItemEntry(:final item) => _ItemRow(
                          item: item,
                          active: _isActive(location, item.href),
                          badge: counts[item.pageKey] ?? 0,
                          onTap: () => _go(item.href),
                        ),
                      NavGroupEntry(:final group) => _GroupRow(
                          group: group,
                          expanded: _expanded.contains(group.id),
                          location: location,
                          counts: counts,
                          onToggle: () => setState(() {
                            _expanded.contains(group.id)
                                ? _expanded.remove(group.id)
                                : _expanded.add(group.id);
                          }),
                          onSelect: _go,
                        ),
                    },
                ],
              ),
            ),
            const Divider(height: 1),
            _FooterRow(
              icon: AppIcons.profile,
              label: 'My profile',
              onTap: () => _go('/profile'),
            ),
            _FooterRow(
              icon: AppIcons.logout,
              label: 'Sign out',
              destructive: true,
              onTap: () => _signOut(context),
            ),
            const SizedBox(height: 6),
          ],
        ),
      ),
    );
  }

  static bool _isActive(String location, String href) =>
      location == href || location.startsWith('$href/');

  void _go(String href) {
    Navigator.of(context).pop();
    context.go(href);
  }

  Future<void> _signOut(BuildContext context) async {
    final confirmed = await confirmAction(
      context,
      title: 'Sign out?',
      message: 'You will need to sign in again to use the app.',
      confirmLabel: 'Sign out',
      destructive: true,
    );
    if (!confirmed || !context.mounted) return;
    Navigator.of(context).pop();
    await ref.read(authServiceProvider).signOut();
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.name, required this.role, required this.email});

  final String name;
  final String role;
  final String email;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
      decoration: const BoxDecoration(
        color: AppColors.cream,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Image.asset('assets/images/church-logo.png',
                  height: 34,
                  errorBuilder: (_, __, ___) =>
                      const Icon(AppIcons.church, color: AppColors.gold)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Dew of Hermon',
                  style: AppFonts.display(const TextStyle(
                    fontSize: 18,
                    color: AppColors.clay700,
                  )),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            name,
            style: const TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w700,
              color: AppColors.clay700,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            email,
            style: const TextStyle(fontSize: 12, color: AppColors.clay400),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),
          StatusBadge(role, dense: true),
        ],
      ),
    );
  }
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({
    required this.item,
    required this.active,
    required this.onTap,
    this.badge = 0,
    this.indented = false,
  });

  final NavItem item;
  final bool active;
  final VoidCallback onTap;
  final int badge;
  final bool indented;

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.clay700 : AppColors.clay500;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: Material(
        color: active ? AppColors.clay100.withValues(alpha: 0.7) : null,
        borderRadius: BorderRadius.circular(AppRadius.base),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.base),
          child: Padding(
            padding: EdgeInsets.fromLTRB(indented ? 26 : 12, 10, 12, 10),
            child: Row(
              children: [
                Icon(item.icon, size: 18, color: color),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    item.label,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                      color: color,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (badge > 0) _Badge(badge),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _GroupRow extends StatelessWidget {
  const _GroupRow({
    required this.group,
    required this.expanded,
    required this.location,
    required this.counts,
    required this.onToggle,
    required this.onSelect,
  });

  final NavGroup group;
  final bool expanded;
  final String location;
  final Map<String, int> counts;
  final VoidCallback onToggle;
  final void Function(String href) onSelect;

  @override
  Widget build(BuildContext context) {
    // Roll the group's children's badges up onto the collapsed header, so a
    // pending item is never hidden inside a closed section.
    final total = group.items.fold<int>(
        0, (sum, item) => sum + (counts[item.pageKey] ?? 0));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 1),
          child: Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(AppRadius.base),
            child: InkWell(
              onTap: onToggle,
              borderRadius: BorderRadius.circular(AppRadius.base),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                child: Row(
                  children: [
                    Icon(group.icon, size: 18, color: AppColors.clay500),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        group.label,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.clay600,
                        ),
                      ),
                    ),
                    if (!expanded && total > 0) ...[
                      _Badge(total),
                      const SizedBox(width: 8),
                    ],
                    Icon(
                      expanded ? AppIcons.chevronUp : AppIcons.chevronDown,
                      size: 15,
                      color: AppColors.clay300,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (expanded)
          for (final item in group.items)
            _ItemRow(
              item: item,
              indented: true,
              active: location == item.href ||
                  location.startsWith('${item.href}/'),
              badge: counts[item.pageKey] ?? 0,
              onTap: () => onSelect(item.href),
            ),
      ],
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.count);
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      constraints: const BoxConstraints(minWidth: 20),
      decoration: BoxDecoration(
        color: AppColors.gold.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      alignment: Alignment.center,
      child: Text(
        count > 99 ? '99+' : '$count',
        style: const TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          color: AppColors.goldDark,
        ),
      ),
    );
  }
}

class _FooterRow extends StatelessWidget {
  const _FooterRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color = destructive ? AppColors.destructive : AppColors.clay500;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
        child: Row(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 12),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
