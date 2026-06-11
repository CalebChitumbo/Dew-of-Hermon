import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../services/push_service.dart';
import 'calendar/calendar_screen.dart';
import 'dashboard/dashboard_screen.dart';
import 'notifications/notifications_screen.dart';
import 'profile/profile_screen.dart';
import 'schedule/my_schedule_screen.dart';

/// Bottom-tab shell shown once the user is signed in.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;
  String? _pushRegisteredFor;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Register this device for push once per signed-in user. Best-effort —
    // it silently no-ops until FCM is configured for the platform.
    final auth = context.watch<AuthService>();
    final uid = auth.profile?.id;
    if (uid != null && uid != _pushRegisteredFor) {
      _pushRegisteredFor = uid;
      context.read<PushService>().register(uid);
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = context.watch<AuthService>().profile?.id;

    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          DashboardScreen(
            onSeeSchedule: () => setState(() => _index = 2),
            onSeeCalendar: () => setState(() => _index = 1),
          ),
          const CalendarScreen(),
          const MyScheduleScreen(),
          const NotificationsScreen(),
          const ProfileScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          const NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            selectedIcon: Icon(Icons.calendar_month),
            label: 'Calendar',
          ),
          const NavigationDestination(
            icon: Icon(Icons.volunteer_activism_outlined),
            selectedIcon: Icon(Icons.volunteer_activism),
            label: 'Serve',
          ),
          NavigationDestination(
            icon: _NotificationsIcon(uid: uid, selected: false),
            selectedIcon: _NotificationsIcon(uid: uid, selected: true),
            label: 'Alerts',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

class _NotificationsIcon extends StatelessWidget {
  const _NotificationsIcon({required this.uid, required this.selected});

  final String? uid;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final icon = Icon(
      selected ? Icons.notifications : Icons.notifications_outlined,
    );
    if (uid == null) return icon;

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('notifications')
          .where('userId', isEqualTo: uid)
          .where('isRead', isEqualTo: false)
          .limit(99)
          .snapshots(),
      builder: (context, snapshot) {
        final count = snapshot.data?.size ?? 0;
        if (count == 0) return icon;
        return Badge.count(count: count, child: icon);
      },
    );
  }
}
