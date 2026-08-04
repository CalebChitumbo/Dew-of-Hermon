import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../access/access_providers.dart';
import '../auth/auth_providers.dart';
import '../router/nav_config.dart';
import '../theme/app_colors.dart';
import '../theme/app_icons.dart';
import '../theme/app_theme.dart';
import '../theme/icon_tones.dart';
import '../../data/firestore/streams.dart';
import 'app_drawer.dart';
import 'lux.dart';

/// The signed-in shell: a 56px app bar, the grouped drawer, and the
/// role-dependent bottom bar. Mirrors the web's mobile layout (Header +
/// MobileNav), so an admin, a lead and a member each get the IA they get on
/// the phone browser today.
class AppScaffold extends ConsumerWidget {
  const AppScaffold({
    super.key,
    required this.title,
    required this.body,
    this.actions,
    this.floatingActionButton,
    this.subtitle,
    this.showBottomNav = true,
    this.showDrawer = true,
    this.bottom,
    this.padded = true,
    this.onRefresh,
    this.backgroundColor,
    this.leading,
  });

  final String title;
  final String? subtitle;
  final Widget body;
  final List<Widget>? actions;
  final Widget? floatingActionButton;
  final bool showBottomNav;
  final bool showDrawer;
  final PreferredSizeWidget? bottom;

  /// Wraps [body] in the standard page padding. Turn off for full-bleed
  /// screens (scanners, readers, image heroes).
  final bool padded;

  final Future<void> Function()? onRefresh;
  final Color? backgroundColor;
  final Widget? leading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canPop = context.canPop();

    Widget content = body;
    if (padded) {
      content = Padding(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.page, AppSpacing.lg, AppSpacing.page, 32),
        child: content,
      );
    }
    if (onRefresh != null) {
      content = RefreshIndicator(
        onRefresh: onRefresh!,
        color: AppColors.goldDark,
        backgroundColor: Colors.white,
        child: content,
      );
    }

    return Scaffold(
      backgroundColor: backgroundColor ?? AppColors.cream,
      drawer: showDrawer ? const AppDrawer() : null,
      appBar: AppBar(
        leading: leading ??
            (canPop && !showDrawer
                ? IconButton(
                    icon: const Icon(AppIcons.back),
                    onPressed: () => context.pop(),
                    tooltip: 'Back',
                  )
                : null),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
            if (subtitle != null)
              Text(
                subtitle!,
                style: const TextStyle(
                  fontSize: 11.5,
                  color: AppColors.clay400,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
        actions: [
          ...?actions,
          const _NotificationBell(),
          const SizedBox(width: 4),
        ],
        bottom: bottom,
      ),
      body: SafeArea(top: false, child: content),
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: showBottomNav ? const AppBottomNav() : null,
    );
  }
}

/// A screen that is pushed on top of the shell — no drawer, no bottom bar,
/// just a back arrow. Used for detail and form screens.
class DetailScaffold extends StatelessWidget {
  const DetailScaffold({
    super.key,
    required this.title,
    required this.body,
    this.subtitle,
    this.actions,
    this.floatingActionButton,
    this.bottomBar,
    this.padded = true,
    this.onRefresh,
    this.backgroundColor,
    this.bottom,
  });

  final String title;
  final String? subtitle;
  final Widget body;
  final List<Widget>? actions;
  final Widget? floatingActionButton;

  /// A pinned action bar at the bottom (Approve / Reject, Save…).
  final Widget? bottomBar;
  final bool padded;
  final Future<void> Function()? onRefresh;
  final Color? backgroundColor;
  final PreferredSizeWidget? bottom;

  @override
  Widget build(BuildContext context) {
    Widget content = body;
    if (padded) {
      content = Padding(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.page, AppSpacing.lg, AppSpacing.page, 32),
        child: content,
      );
    }
    if (onRefresh != null) {
      content = RefreshIndicator(
        onRefresh: onRefresh!,
        color: AppColors.goldDark,
        backgroundColor: Colors.white,
        child: content,
      );
    }

    return Scaffold(
      backgroundColor: backgroundColor ?? AppColors.cream,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(AppIcons.back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/dashboard'),
          tooltip: 'Back',
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
            if (subtitle != null)
              Text(
                subtitle!,
                style: const TextStyle(
                  fontSize: 11.5,
                  color: AppColors.clay400,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
        actions: actions,
        bottom: bottom,
      ),
      body: SafeArea(top: false, child: content),
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: bottomBar == null
          ? null
          : Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: bottomBar,
                ),
              ),
            ),
    );
  }
}

/// The role-dependent 5-item bottom bar.
class AppBottomNav extends ConsumerWidget {
  const AppBottomNav({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final access = ref.watch(accessProvider);
    if (!access.signedIn) return const SizedBox.shrink();

    final items = getBottomNavItems(access.role, access.config.pagePermissions);
    if (items.isEmpty) return const SizedBox.shrink();

    final location = GoRouterState.of(context).uri.path;
    var index = items.indexWhere((it) =>
        location == it.href || location.startsWith('${it.href}/'));
    if (index < 0) index = 0;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              for (var i = 0; i < items.length; i++)
                _NavButton(
                  item: items[i],
                  active: i == index,
                  onTap: () => context.go(items[i].href),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.item,
    required this.active,
    required this.onTap,
  });

  final NavItem item;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.goldDark : AppColors.clay400;
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.base),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(item.icon, size: 21, color: color),
              const SizedBox(height: 4),
              Text(
                item.label,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                  color: color,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The bell in the app bar, with an unread count.
class _NotificationBell extends ConsumerWidget {
  const _NotificationBell();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(userOrNullProvider);
    if (user == null) return const SizedBox.shrink();

    final unread = ref.watch(unreadNotificationCountProvider).valueOrNull ?? 0;

    return Stack(
      alignment: Alignment.center,
      children: [
        IconButton(
          icon: const Icon(AppIcons.bell),
          tooltip: 'Notifications',
          onPressed: () => context.push('/notifications'),
        ),
        if (unread > 0)
          Positioned(
            top: 8,
            right: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              constraints: const BoxConstraints(minWidth: 16),
              decoration: BoxDecoration(
                color: AppColors.destructive,
                borderRadius: BorderRadius.circular(AppRadius.pill),
                border: Border.all(color: Colors.white, width: 1.5),
              ),
              alignment: Alignment.center,
              child: Text(
                unread > 99 ? '99+' : '$unread',
                style: const TextStyle(
                  fontSize: 9,
                  height: 1.2,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// A screen the user's role does not reach. Mirrors `RoleProtected.tsx`.
class NoAccessView extends StatelessWidget {
  const NoAccessView({super.key, this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    return EmptyStateLux(
      icon: AppIcons.lock,
      tone: IconTone.clay,
      title: 'Not available to your role',
      description:
          message ?? 'Ask the Chairperson if you need access to this page.',
      action: OutlinedButton(
        onPressed: () => context.go('/dashboard'),
        child: const Text('Back to dashboard'),
      ),
    );
  }
}
