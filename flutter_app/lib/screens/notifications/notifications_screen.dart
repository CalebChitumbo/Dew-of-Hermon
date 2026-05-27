import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../providers/auth_provider.dart';
import '../../services/firestore_service.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).value;
    if (user == null) {
      return const Center(child: Text('Sign in to view notifications.'));
    }

    final stream = ref
        .watch(firestoreServiceProvider)
        .watchNotificationsForUser(user.uid);

    return StreamBuilder(
      stream: stream,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) {
          return Center(child: Text('Failed to load: ${snap.error}'));
        }
        final notifications = snap.data ?? const [];
        if (notifications.isEmpty) {
          return const Center(child: Text('No notifications yet.'));
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: notifications.length,
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemBuilder: (context, i) {
            final n = notifications[i];
            return ListTile(
              leading: Icon(
                n.isRead ? Icons.notifications_none : Icons.notifications_active,
                color: n.isRead ? null : Theme.of(context).colorScheme.primary,
              ),
              title: Text(
                n.title,
                style: TextStyle(
                  fontWeight: n.isRead ? FontWeight.normal : FontWeight.w600,
                ),
              ),
              subtitle: Text(n.message),
              trailing: Text(
                DateFormat.MMMd().format(n.createdAt),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              onTap: n.isRead
                  ? null
                  : () => ref
                      .read(firestoreServiceProvider)
                      .markNotificationRead(n.id),
            );
          },
        );
      },
    );
  }
}
