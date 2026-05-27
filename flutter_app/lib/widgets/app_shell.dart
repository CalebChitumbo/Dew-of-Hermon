import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';

class AppShell extends ConsumerWidget {
  const AppShell({required this.child, super.key});

  final Widget child;

  static const _tabs = <_Tab>[
    _Tab('/dashboard', Icons.home_outlined, Icons.home, 'Home'),
    _Tab('/my-schedule', Icons.event_note_outlined, Icons.event_note, 'Schedule'),
    _Tab('/calendar', Icons.calendar_today_outlined, Icons.calendar_today, 'Calendar'),
    _Tab('/affirmations', Icons.favorite_outline, Icons.favorite, 'Affirmations'),
    _Tab('/profile', Icons.person_outline, Icons.person, 'Profile'),
  ];

  int _indexForLocation(String location) {
    for (var i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].path)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).matchedLocation;
    final currentIndex = _indexForLocation(location);
    final userAsync = ref.watch(currentUserDocProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dew of Hermon'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            tooltip: 'Notifications',
            onPressed: () => context.go('/notifications'),
          ),
          if (userAsync.value?.isAdmin ?? false)
            IconButton(
              icon: const Icon(Icons.dashboard_customize_outlined),
              tooltip: 'Manage',
              onPressed: () => context.go('/departments'),
            ),
        ],
      ),
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (i) => context.go(_tabs[i].path),
        destinations: [
          for (final t in _tabs)
            NavigationDestination(
              icon: Icon(t.icon),
              selectedIcon: Icon(t.selectedIcon),
              label: t.label,
            ),
        ],
      ),
    );
  }
}

class _Tab {
  const _Tab(this.path, this.icon, this.selectedIcon, this.label);
  final String path;
  final IconData icon;
  final IconData selectedIcon;
  final String label;
}
