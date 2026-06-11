import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../affirmations/affirmations_screen.dart';
import '../camp/camp_screen.dart';
import '../events/event_detail_screen.dart';
import '../fundraising/order_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    required this.onSeeSchedule,
    required this.onSeeCalendar,
  });

  final VoidCallback onSeeSchedule;
  final VoidCallback onSeeCalendar;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  MyAssignment? _nextAssignment;
  bool _loadingAssignment = true;

  @override
  void initState() {
    super.initState();
    _loadNextAssignment();
  }

  Future<void> _loadNextAssignment() async {
    final api = context.read<ApiClient>();
    try {
      final data = await api.getJson('/api/my-assignments');
      final list = (data['assignments'] as List? ?? [])
          .whereType<Map>()
          .map((m) => MyAssignment.fromJson(m.cast<String, dynamic>()))
          .toList();
      final today = DateTime.now().subtract(const Duration(hours: 24));
      list.retainWhere(
          (a) => a.serviceDate == null || a.serviceDate!.isAfter(today));
      list.sort((a, b) {
        final ad = a.serviceDate, bd = b.serviceDate;
        if (ad == null && bd == null) return 0;
        if (ad == null) return -1;
        if (bd == null) return 1;
        return ad.compareTo(bd);
      });
      if (mounted) {
        setState(() {
          _nextAssignment = list.isEmpty ? null : list.first;
          _loadingAssignment = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingAssignment = false);
    }
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<AuthService>().profile;
    if (profile == null) return const SizedBox.shrink();

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadNextAssignment,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            children: [
              _Hero(profile: profile, greeting: _greeting()),
              const SizedBox(height: 20),
              _MyNextCard(
                loading: _loadingAssignment,
                assignment: _nextAssignment,
                onOpenSchedule: widget.onSeeSchedule,
              ),
              const SizedBox(height: 24),
              const SectionHeader('This week'),
              _DevotionalCard(),
              const SizedBox(height: 24),
              const SectionHeader('Ministry pulse'),
              const _QuickActions(),
              const SizedBox(height: 24),
              SectionHeader(
                'Upcoming events',
                trailing: TextButton(
                  onPressed: widget.onSeeCalendar,
                  child: const Text('Calendar'),
                ),
              ),
              _UpcomingEvents(lifeGroup: profile.lifeGroup),
              const SizedBox(height: 24),
              const SectionHeader('Recent activity'),
              _RecentActivity(uid: profile.id),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Hero ────────────────────────────────────────────────────────────────

class _Hero extends StatelessWidget {
  const _Hero({required this.profile, required this.greeting});

  final UserProfile profile;
  final String greeting;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: PWColors.clay200.withValues(alpha: 0.7)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            PWColors.cream,
            Colors.white,
            PWColors.gold.withValues(alpha: 0.08),
          ],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: PWColors.gold,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                DateFormat('EEEE, MMMM d').format(DateTime.now()),
                style: textTheme.labelSmall?.copyWith(
                  color: PWColors.clay400,
                  letterSpacing: 1.6,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '$greeting, ${profile.firstName}',
            style: textTheme.headlineMedium,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: PWColors.gold.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  profile.roleLabel,
                  style: textTheme.labelSmall?.copyWith(
                    color: PWColors.goldDark,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (profile.lifeGroup != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: PWColors.clay200),
                  ),
                  child: Text(
                    '${profile.lifeGroup} life group',
                    style: textTheme.labelSmall
                        ?.copyWith(color: PWColors.clay600),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── My Next ─────────────────────────────────────────────────────────────

class _MyNextCard extends StatelessWidget {
  const _MyNextCard({
    required this.loading,
    required this.assignment,
    required this.onOpenSchedule,
  });

  final bool loading;
  final MyAssignment? assignment;
  final VoidCallback onOpenSchedule;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final a = assignment;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: PWColors.gold.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.inbox_outlined,
                      size: 18, color: PWColors.goldDark),
                ),
                const SizedBox(width: 10),
                Text('My Next', style: textTheme.titleMedium),
                const Spacer(),
                TextButton(
                  onPressed: onOpenSchedule,
                  child: const Text('Full schedule'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 18),
                child: Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              )
            else if (a == null)
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: PWColors.teal.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(Icons.auto_awesome,
                        color: PWColors.teal),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "You're free right now.",
                          style: textTheme.bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        Text(
                          'No upcoming role assignments.',
                          style: textTheme.bodySmall
                              ?.copyWith(color: PWColors.clay400),
                        ),
                      ],
                    ),
                  ),
                ],
              )
            else ...[
              Text(
                [
                  if (a.serviceDate != null)
                    DateFormat('EEE, MMM d').format(a.serviceDate!),
                  if (a.serviceTime != null) a.serviceTime!,
                ].join(' · '),
                style: textTheme.labelSmall?.copyWith(
                  color: PWColors.clay400,
                  letterSpacing: 1.4,
                ),
              ),
              const SizedBox(height: 4),
              Text(a.roleName, style: textTheme.titleLarge),
              if (a.eventTitle != null || a.venue != null) ...[
                const SizedBox(height: 2),
                Text(
                  [a.eventTitle, a.venue].whereType<String>().join(' · '),
                  style:
                      textTheme.bodySmall?.copyWith(color: PWColors.clay500),
                ),
              ],
              const SizedBox(height: 12),
              Row(
                children: [
                  StatusBadge(status: a.status),
                  const Spacer(),
                  FilledButton(
                    onPressed: onOpenSchedule,
                    style: FilledButton.styleFrom(
                      backgroundColor: PWColors.gold,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 18, vertical: 10),
                    ),
                    child: Text(a.isPending ? 'Respond' : 'View'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─── Quick actions ───────────────────────────────────────────────────────

class _QuickActions extends StatelessWidget {
  const _QuickActions();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ActionTile(
            icon: Icons.cabin_outlined,
            iconColor: const Color(0xFFEA580C),
            iconBg: const Color(0xFFFFEDD5),
            label: 'ROPs Camp',
            hint: 'Register',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const CampScreen()),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ActionTile(
            icon: Icons.outdoor_grill_outlined,
            iconColor: const Color(0xFFDC2626),
            iconBg: const Color(0xFFFEE2E2),
            label: 'Braai orders',
            hint: 'Order food',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                  builder: (_) => const FundraisingOrderScreen()),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ActionTile(
            icon: Icons.auto_awesome,
            iconColor: const Color(0xFFDB2777),
            iconBg: const Color(0xFFFCE7F3),
            label: 'Affirmations',
            hint: 'Read',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                  builder: (_) => const AffirmationsScreen()),
            ),
          ),
        ),
      ],
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.label,
    required this.hint,
    required this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String label;
  final String hint;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 19, color: iconColor),
              ),
              const SizedBox(height: 10),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: textTheme.labelMedium?.copyWith(
                  color: PWColors.clay700,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                hint,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: textTheme.labelSmall
                    ?.copyWith(color: PWColors.clay400),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Devotional ──────────────────────────────────────────────────────────

class _DevotionalCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('devotionals')
          .orderBy('weekStartDate', descending: true)
          .limit(1)
          .snapshots(),
      builder: (context, snapshot) {
        final docs = snapshot.data?.docs ?? const [];
        if (docs.isEmpty) {
          return const Card(
            child: EmptyState(
              icon: Icons.menu_book_outlined,
              title: 'No devotional yet',
              subtitle: 'This week’s devotional will appear here.',
            ),
          );
        }
        final devotional =
            Devotional.fromMap(docs.first.id, docs.first.data());
        return Card(
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => showModalBottomSheet<void>(
              context: context,
              isScrollControlled: true,
              showDragHandle: true,
              backgroundColor: PWColors.cream,
              builder: (_) => _DevotionalSheet(devotional: devotional),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF3E8FF),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(Icons.menu_book_outlined,
                        color: Color(0xFF7C3AED)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "This week's devotional",
                          style: textTheme.labelSmall?.copyWith(
                            color: PWColors.clay400,
                            letterSpacing: 1.4,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          devotional.title,
                          style: textTheme.titleMedium,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (devotional.scriptureReference != null)
                          Text(
                            devotional.scriptureReference!,
                            style: textTheme.bodySmall
                                ?.copyWith(color: PWColors.goldDark),
                          ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: PWColors.clay300),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _DevotionalSheet extends StatelessWidget {
  const _DevotionalSheet({required this.devotional});

  final Devotional devotional;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      builder: (context, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
        children: [
          Text(devotional.title, style: textTheme.headlineSmall),
          if (devotional.scriptureReference != null) ...[
            const SizedBox(height: 4),
            Text(
              devotional.scriptureReference!,
              style: textTheme.bodyMedium?.copyWith(
                color: PWColors.goldDark,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
          const SizedBox(height: 6),
          Text(
            'By ${devotional.authorName}',
            style: textTheme.bodySmall?.copyWith(color: PWColors.clay400),
          ),
          const Divider(height: 28),
          Text(
            devotional.content,
            style: textTheme.bodyMedium?.copyWith(height: 1.6),
          ),
        ],
      ),
    );
  }
}

// ─── Upcoming events ─────────────────────────────────────────────────────

class _UpcomingEvents extends StatelessWidget {
  const _UpcomingEvents({required this.lifeGroup});

  final String? lifeGroup;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('events')
          .where('startDate',
              isGreaterThanOrEqualTo: Timestamp.fromDate(DateTime.now()))
          .orderBy('startDate')
          .limit(10)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Card(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
          );
        }
        final events = (snapshot.data?.docs ?? const [])
            .map((d) => AppEvent.fromMap(d.id, d.data()))
            .where((e) => e.isApproved)
            .take(5)
            .toList();
        if (events.isEmpty) {
          return const Card(
            child: EmptyState(
              icon: Icons.event_outlined,
              title: 'Nothing scheduled yet',
              subtitle: 'Upcoming events will show up here.',
            ),
          );
        }
        return Card(
          child: Column(
            children: [
              for (final (i, event) in events.indexed) ...[
                if (i > 0) const Divider(height: 1),
                _EventRow(event: event),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _EventRow extends StatelessWidget {
  const _EventRow({required this.event});

  final AppEvent event;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return InkWell(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => EventDetailScreen(event: event)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 48,
              padding: const EdgeInsets.symmetric(vertical: 6),
              decoration: BoxDecoration(
                color: PWColors.cream,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: PWColors.clay200.withValues(alpha: 0.7)),
              ),
              child: Column(
                children: [
                  Text(
                    DateFormat('MMM').format(event.startDate).toUpperCase(),
                    style: textTheme.labelSmall?.copyWith(
                      color: PWColors.goldDark,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                    ),
                  ),
                  Text(
                    DateFormat('d').format(event.startDate),
                    style: textTheme.titleMedium
                        ?.copyWith(color: PWColors.clay700),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.title,
                    style: textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      EventTypeChip(
                          type: event.type, label: event.typeLabel),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          event.venue,
                          style: textTheme.bodySmall
                              ?.copyWith(color: PWColors.clay400),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: PWColors.clay300),
          ],
        ),
      ),
    );
  }
}

// ─── Recent activity ─────────────────────────────────────────────────────

class _RecentActivity extends StatelessWidget {
  const _RecentActivity({required this.uid});

  final String uid;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('notifications')
          .where('userId', isEqualTo: uid)
          .orderBy('createdAt', descending: true)
          .limit(6)
          .snapshots(),
      builder: (context, snapshot) {
        final items = (snapshot.data?.docs ?? const [])
            .map((d) => AppNotification.fromMap(d.id, d.data()))
            .toList();
        if (items.isEmpty) {
          return const Card(
            child: EmptyState(
              icon: Icons.notifications_none,
              title: 'No activity yet',
              subtitle: 'Assignments and announcements will appear here.',
            ),
          );
        }
        return Card(
          child: Column(
            children: [
              for (final (i, n) in items.indexed) ...[
                if (i > 0) const Divider(height: 1),
                ListTile(
                  leading: _activityIcon(n.type),
                  title: Text(
                    n.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Text(
                    n.message,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.bodySmall
                        ?.copyWith(color: PWColors.clay400),
                  ),
                  trailing: Text(
                    _relative(n.createdAt),
                    style: textTheme.labelSmall
                        ?.copyWith(color: PWColors.clay400),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  static Widget _activityIcon(String type) {
    final (icon, fg, bg) = switch (type) {
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
    return Container(
      width: 38,
      height: 38,
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Icon(icon, size: 18, color: fg),
    );
  }

  static String _relative(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) return 'now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return DateFormat('MMM d').format(date);
  }
}
