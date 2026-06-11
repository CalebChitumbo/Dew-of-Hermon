import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final uid = context.watch<AuthService>().profile?.id;
    if (uid == null) return const SizedBox.shrink();

    final query = FirebaseFirestore.instance
        .collection('notifications')
        .where('userId', isEqualTo: uid)
        .orderBy('createdAt', descending: true)
        .limit(50);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () => _markAllRead(uid),
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: query.snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final docs = snapshot.data?.docs ?? const [];
          if (docs.isEmpty) {
            return const EmptyState(
              icon: Icons.notifications_none,
              title: "You're all caught up",
              subtitle: 'Reminders, assignments and announcements from the '
                  'team will land here.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            itemCount: docs.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final doc = docs[i];
              final n = AppNotification.fromMap(doc.id, doc.data());
              return _NotificationCard(
                notification: n,
                onTap: () {
                  if (!n.isRead) {
                    doc.reference.update({'isRead': true});
                  }
                },
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _markAllRead(String uid) async {
    final snapshot = await FirebaseFirestore.instance
        .collection('notifications')
        .where('userId', isEqualTo: uid)
        .where('isRead', isEqualTo: false)
        .get();
    final batch = FirebaseFirestore.instance.batch();
    for (final doc in snapshot.docs) {
      batch.update(doc.reference, {'isRead': true});
    }
    await batch.commit();
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final n = notification;
    final (icon, fg, bg) = switch (n.type) {
      'assignment' => (
          Icons.person_add_alt,
          PWColors.tealDark,
          const Color(0xFFE2F3F0)
        ),
      'reminder' => (
          Icons.notifications_outlined,
          PWColors.goldDark,
          const Color(0xFFFCF0DC)
        ),
      'event' => (
          Icons.event_outlined,
          const Color(0xFF2563EB),
          const Color(0xFFDBEAFE)
        ),
      _ => (
          Icons.auto_awesome,
          const Color(0xFF7C3AED),
          const Color(0xFFF3E8FF)
        ),
    };

    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: n.isRead
              ? PWColors.clay200.withValues(alpha: 0.7)
              : PWColors.gold.withValues(alpha: 0.6),
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 18, color: fg),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            n.title,
                            style: textTheme.bodyMedium?.copyWith(
                              fontWeight:
                                  n.isRead ? FontWeight.w500 : FontWeight.w700,
                            ),
                          ),
                        ),
                        if (!n.isRead)
                          Container(
                            width: 8,
                            height: 8,
                            margin: const EdgeInsets.only(left: 8, top: 4),
                            decoration: const BoxDecoration(
                              color: PWColors.gold,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      n.message,
                      style: textTheme.bodySmall
                          ?.copyWith(color: PWColors.clay500, height: 1.4),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      DateFormat('MMM d, HH:mm').format(n.createdAt),
                      style: textTheme.labelSmall
                          ?.copyWith(color: PWColors.clay300),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
