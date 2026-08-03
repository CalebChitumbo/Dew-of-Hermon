import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/firestore/streams.dart';
import '../../data/models/enums.dart';
import '../../data/models/notification.dart';

/// The user's notification feed, live. Read directly from Firestore so a new
/// arrival appears without a poll; marking read goes through the API route.
final notificationsProvider = StreamProvider<List<AppNotification>>((ref) {
  final user = ref.watch(userOrNullProvider);
  if (user == null) return Stream.value(const <AppNotification>[]);
  return collectionStream(
    db
        .collection('notifications')
        .where('userId', isEqualTo: user.id)
        .orderBy('createdAt', descending: true)
        .limit(100),
    AppNotification.fromMap,
  ).handleError((_) => <AppNotification>[]);
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(notificationsProvider);
    final items = async.valueOrNull ?? const <AppNotification>[];
    final unread = items.where((n) => !n.isRead).length;

    return DetailScaffold(
      title: 'Notifications',
      subtitle: unread > 0 ? '$unread unread' : null,
      padded: false,
      actions: [
        if (unread > 0)
          TextButton(
            onPressed: () => _markAllRead(context, ref),
            child: const Text('Mark all read'),
          ),
      ],
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(notificationsProvider),
        ),
        data: (list) {
          if (list.isEmpty) {
            return const EmptyStateLux(
              icon: AppIcons.bell,
              tone: IconTone.periwinkle,
              title: 'Nothing yet',
              description:
                  'Reminders, assignments and announcements will appear here.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            itemCount: list.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, i) => _NotificationCard(
              notification: list[i],
              onTap: () => _open(context, ref, list[i]),
            ),
          );
        },
      ),
    );
  }

  Future<void> _open(
      BuildContext context, WidgetRef ref, AppNotification n) async {
    if (!n.isRead) {
      // Fire and forget — the Firestore stream flips the row the moment the
      // write lands, and a failure here must not block navigation.
      unawaitedMarkRead(ref, n.id);
    }
    final link = n.link;
    if (link != null && link.startsWith('/')) {
      context.push(link);
    }
  }

  Future<void> _markAllRead(BuildContext context, WidgetRef ref) async {
    try {
      await ref
          .read(apiClientProvider)
          .put('/api/notifications', body: {'markAllRead': true});
    } on ApiException catch (e) {
      if (context.mounted) context.showError(e.message);
    }
  }
}

void unawaitedMarkRead(WidgetRef ref, String notificationId) {
  ref
      .read(apiClientProvider)
      .put('/api/notifications', body: {'notificationId': notificationId})
      .catchError((_) => null);
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  static IconData _icon(NotificationType type) => switch (type) {
        NotificationType.reminder => AppIcons.clock,
        NotificationType.assignment => AppIcons.clipboardCheck,
        NotificationType.event => AppIcons.calendar,
        NotificationType.announcement => AppIcons.megaphone,
      };

  static IconTone _tone(NotificationType type) => switch (type) {
        NotificationType.reminder => IconTone.amber,
        NotificationType.assignment => IconTone.periwinkle,
        NotificationType.event => IconTone.teal,
        NotificationType.announcement => IconTone.gold,
      };

  @override
  Widget build(BuildContext context) {
    final unread = !notification.isRead;
    return LuxCard(
      onTap: onTap,
      radius: 18,
      padding: const EdgeInsets.all(14),
      color: unread ? Colors.white : AppColors.cream.withValues(alpha: 0.55),
      border: unread ? AppColors.gold.withValues(alpha: 0.28) : null,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconChip(_icon(notification.type),
              tone: _tone(notification.type), size: 40),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        notification.title,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight:
                              unread ? FontWeight.w700 : FontWeight.w600,
                          color: AppColors.clay700,
                          height: 1.3,
                        ),
                      ),
                    ),
                    if (unread)
                      Container(
                        margin: const EdgeInsets.only(left: 8, top: 5),
                        height: 8,
                        width: 8,
                        decoration: const BoxDecoration(
                          color: AppColors.gold,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  notification.message,
                  style: const TextStyle(
                    fontSize: 13,
                    height: 1.45,
                    color: AppColors.clay500,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Text(
                      D.relative(notification.createdAt),
                      style: const TextStyle(
                          fontSize: 11.5, color: AppColors.clay300),
                    ),
                    if (notification.link != null) ...[
                      const Spacer(),
                      const Text(
                        'Open',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.goldDark,
                        ),
                      ),
                      const SizedBox(width: 3),
                      const Icon(AppIcons.forward,
                          size: 11, color: AppColors.goldDark),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
