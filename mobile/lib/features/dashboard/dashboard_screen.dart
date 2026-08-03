import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/access/access_providers.dart';
import '../../core/auth/auth_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/camp.dart';
import '../../data/models/enums.dart';
import '../../data/models/event.dart';
import '../../data/repositories/pending_counts_repository.dart';
import 'dashboard_providers.dart';

/// The signed-in home. A warm greeting, what is next on the calendar, the
/// queues waiting on this user, and the shortcuts their role reaches.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  static String greeting(DateTime now) {
    if (now.hour < 12) return 'Good morning';
    if (now.hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(userOrNullProvider);
    final access = ref.watch(accessProvider);
    final upcoming = ref.watch(upcomingEventsProvider).valueOrNull ?? const [];
    final counts = ref.watch(pendingCountsProvider).valueOrNull ?? const {};
    final myAssignments =
        ref.watch(myUpcomingAssignmentsProvider).valueOrNull ?? const [];

    if (user == null) {
      return const AppScaffold(title: 'Dashboard', body: LoadingView());
    }

    final nextEvent = upcoming.isEmpty ? null : upcoming.first;
    final totalPending = counts.values.fold<int>(0, (a, b) => a + b);

    return AppScaffold(
      title: 'Dashboard',
      onRefresh: () async {
        ref.invalidate(upcomingEventsProvider);
        ref.invalidate(pendingCountsProvider);
        ref.invalidate(myUpcomingAssignmentsProvider);
      },
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          _Hero(
            greeting: greeting(DateTime.now()),
            firstName: user.firstName,
            roleLabel: access.role.label,
            nextEvent: nextEvent,
          ),
          const SizedBox(height: 20),

          if (totalPending > 0) ...[
            const SectionHeading(
              title: 'Waiting on you',
              icon: AppIcons.inbox,
              tone: IconTone.amber,
            ),
            const SizedBox(height: 12),
            _PendingQueues(counts: counts),
            const SizedBox(height: 24),
          ],

          if (myAssignments.isNotEmpty) ...[
            SectionHeading(
              title: 'Your next duties',
              icon: AppIcons.clipboardCheck,
              tone: IconTone.periwinkle,
              action: TextButton(
                onPressed: () => context.go('/my-schedule'),
                child: const Text('All'),
              ),
            ),
            const SizedBox(height: 12),
            LuxCard(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(
                children: [
                  for (var i = 0; i < myAssignments.length; i++) ...[
                    if (i > 0) const LuxDivider(),
                    LuxTile(
                      title: myAssignments[i].roleName,
                      subtitle: myAssignments[i].serviceLabel,
                      icon: AppIcons.clipboard,
                      tone: IconTone.gold,
                      dense: true,
                      trailing: StatusBadge.forStatus(
                        myAssignments[i].status.wire,
                        label: myAssignments[i].status.label,
                        dense: true,
                      ),
                      onTap: () => context.go('/my-schedule'),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],

          const _CampCountdown(),

          SectionHeading(
            title: 'Coming up',
            icon: AppIcons.calendar,
            tone: IconTone.teal,
            action: access.canView('calendar')
                ? TextButton(
                    onPressed: () => context.go('/calendar'),
                    child: const Text('Calendar'),
                  )
                : null,
          ),
          const SizedBox(height: 12),
          if (upcoming.isEmpty)
            const LuxCard(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 10),
                child: Text(
                  'Nothing on the calendar yet. Approved events show up here.',
                  style: TextStyle(
                      fontSize: 13.5, height: 1.5, color: AppColors.clay400),
                ),
              ),
            )
          else
            LuxCard(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(
                children: [
                  for (var i = 0; i < upcoming.length && i < 5; i++) ...[
                    if (i > 0) const LuxDivider(),
                    _EventTile(event: upcoming[i]),
                  ],
                ],
              ),
            ),
          const SizedBox(height: 24),

          const SectionHeading(
            title: 'Quick actions',
            icon: AppIcons.layers,
            tone: IconTone.lavender,
          ),
          const SizedBox(height: 12),
          _QuickActions(
            access: access,
            leadsAnything:
                (user?.leadsDepartmentIds ?? const []).isNotEmpty,
          ),
        ],
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({
    required this.greeting,
    required this.firstName,
    required this.roleLabel,
    this.nextEvent,
  });

  final String greeting;
  final String firstName;
  final String roleLabel;
  final AppEvent? nextEvent;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.lux),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF3E2518), AppColors.clay700, Color(0xFF6B462F)],
        ),
        boxShadow: AppColors.luxShadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Positioned(
            right: -40,
            top: -30,
            child: Opacity(
              opacity: 0.10,
              child: Image.asset(
                'assets/images/dashboard/leaf-accent.png',
                height: 160,
                errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                greeting.toUpperCase(),
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 2.1,
                  color: AppColors.goldLight.withValues(alpha: 0.9),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                firstName,
                style: AppFonts.display(const TextStyle(
                  fontSize: 32,
                  height: 1.05,
                  color: AppColors.cream,
                )),
              ),
              const SizedBox(height: 10),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.cream.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  roleLabel,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.cream.withValues(alpha: 0.9),
                  ),
                ),
              ),
              if (nextEvent != null) ...[
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(13),
                  decoration: BoxDecoration(
                    color: AppColors.cream.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    border: Border.all(
                        color: AppColors.cream.withValues(alpha: 0.12)),
                  ),
                  child: Row(
                    children: [
                      Icon(AppIcons.calendar,
                          size: 16,
                          color: AppColors.goldLight.withValues(alpha: 0.9)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              nextEvent!.title,
                              style: const TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.cream,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${D.dayMedium(nextEvent!.startDate)} · '
                              '${D.relative(nextEvent!.startDate)}',
                              style: TextStyle(
                                fontSize: 11.5,
                                color: AppColors.cream.withValues(alpha: 0.65),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _PendingQueues extends StatelessWidget {
  const _PendingQueues({required this.counts});

  final Map<String, int> counts;

  /// Page key → (label, route, icon, tone) for every queue the API counts.
  static const Map<String, (String, String, IconData, IconTone)> _meta = {
    'events_approvals': (
      'Event approvals',
      '/manage/events/approvals',
      AppIcons.clipboardCheck,
      IconTone.gold
    ),
    'event_reports_submit': (
      'Event reports',
      '/manage/events/reports',
      AppIcons.fileText,
      IconTone.periwinkle
    ),
    'department_join_requests': (
      'Join requests',
      '/manage/department-requests',
      AppIcons.userPlus,
      IconTone.sage
    ),
    'campus_ministry': (
      'Campus follow-ups',
      '/department/campus-ministry',
      AppIcons.graduation,
      IconTone.lavender
    ),
    'discipleship': (
      'Discipleship',
      '/department/discipleship',
      AppIcons.heart,
      IconTone.blush
    ),
    'transport_requests': (
      'Transport',
      '/manage/transport/requests',
      AppIcons.transport,
      IconTone.blue
    ),
    'media_requests': (
      'Media',
      '/manage/media/requests',
      AppIcons.media,
      IconTone.lavender
    ),
    'food_requests': (
      'Food',
      '/manage/food/requests',
      AppIcons.food,
      IconTone.amber
    ),
    'accounts_approvals': (
      'Accounts',
      '/manage/finance/approvals',
      AppIcons.money,
      IconTone.emerald
    ),
    'rops_camp': ('ROPs Camp', '/manage/rops-camp', AppIcons.tent, IconTone.teal),
    'manage_talents': (
      'Talents',
      '/manage/talents',
      AppIcons.mic,
      IconTone.rose
    ),
  };

  @override
  Widget build(BuildContext context) {
    final items = <StripItem>[];
    for (final entry in _meta.entries) {
      final count = counts[entry.key] ?? 0;
      if (count == 0) continue;
      final (label, route, icon, tone) = entry.value;
      items.add(StripItem(
        icon: icon,
        tone: tone,
        label: label,
        value: '$count',
        hint: count == 1 ? '1 waiting' : '$count waiting',
        highlight: true,
        onTap: () => context.go(route),
      ));
    }
    if (items.isEmpty) return const SizedBox.shrink();
    return StatStripLux(items: items);
  }
}

/// The camp countdown — shown from a month out until camp ends, because
/// during that window it is the thing everyone is thinking about.
class _CampCountdown extends ConsumerWidget {
  const _CampCountdown();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final access = ref.watch(accessProvider);
    final camp = getCamp(kDefaultCampId);
    final start = camp?.start;
    final end = camp?.end;
    if (camp == null || start == null || end == null) {
      return const SizedBox.shrink();
    }

    final days = D.daysUntil(start);
    final over = DateTime.now().isAfter(D.endOfDay(end));
    if (over || days > 30) return const SizedBox.shrink();

    final running = days <= 0;
    final canManage = access.can('manage_camp_registrations');
    final canView = access.can('view_camp_registrations');

    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: LuxCard(
        onTap: canManage
            ? () => context.go('/manage/rops-camp')
            : canView
                ? () => context.go('/manage/rops-camp/status')
                : () => context.push('/rops-camp'),
        accent: AppColors.teal,
        child: Row(
          children: [
            const IconChip(AppIcons.tent, tone: IconTone.teal, size: 48),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    camp.name,
                    style: AppFonts.display(const TextStyle(
                      fontSize: 18,
                      color: AppColors.clay700,
                    )),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    running
                        ? 'Camp is running · ${D.range(start, end)}'
                        : days == 1
                            ? 'Tomorrow · ${camp.venue ?? ''}'
                            : '$days days to go · ${D.range(start, end)}',
                    style: const TextStyle(
                        fontSize: 12.5, color: AppColors.clay400),
                  ),
                ],
              ),
            ),
            const Icon(AppIcons.chevronRight,
                size: 17, color: AppColors.clay300),
          ],
        ),
      ),
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({required this.event});

  final AppEvent event;

  static (IconData, IconTone) _meta(EventType type) => switch (type) {
        EventType.pottersWheelService => (AppIcons.church, IconTone.gold),
        EventType.ropsCamp => (AppIcons.tent, IconTone.teal),
        EventType.retreat => (AppIcons.church, IconTone.lavender),
        EventType.specialEvent => (AppIcons.sparkles, IconTone.blue),
        EventType.meeting => (AppIcons.users, IconTone.clay),
        EventType.outreach => (AppIcons.heart, IconTone.emerald),
      };

  @override
  Widget build(BuildContext context) {
    final (icon, tone) = _meta(event.type);
    return LuxTile(
      title: event.title,
      subtitle: '${D.dayMedium(event.startDate)} · ${event.venue}',
      icon: icon,
      tone: tone,
      dense: true,
      trailing: Text(
        D.relative(event.startDate),
        style: const TextStyle(fontSize: 11.5, color: AppColors.clay400),
      ),
      onTap: () => context.go('/calendar'),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.access, required this.leadsAnything});

  final Access access;

  /// Whether this person leads a department, which gates the recommend tile.
  final bool leadsAnything;

  @override
  Widget build(BuildContext context) {
    final tiles = <Widget>[];

    void add(String label, String route, IconData icon, IconTone tone,
        {bool when = true}) {
      if (!when) return;
      tiles.add(_ActionTile(
        label: label,
        icon: icon,
        tone: tone,
        onTap: () => context.go(route),
      ));
    }

    add('Bible', '/bible', AppIcons.bible, IconTone.periwinkle);
    add('My schedule', '/my-schedule', AppIcons.calendarDays, IconTone.gold,
        when: access.role != UserRole.superAdmin &&
            access.role != UserRole.admin &&
            access.role != UserRole.viceChairperson);
    add('Services', '/manage/services', AppIcons.clipboard, IconTone.sage,
        when: access.canView('services'));
    add('Create event', '/manage/events/new', AppIcons.calendarPlus,
        IconTone.blue,
        when: access.canView('events_create'));
    add('Members', '/manage/members', AppIcons.users, IconTone.lavender,
        when: access.canView('members'));
    add('Affirmations', '/affirmations', AppIcons.sparkles, IconTone.blush,
        when: access.canView('affirmations'));
    add('Latreuo', '/latreou', AppIcons.music, IconTone.amber,
        when: access.canView('latreou'));
    add('Talents', '/talents', AppIcons.star, IconTone.rose,
        when: access.canView('talents'));
    // A member with one department lands straight on its board, so this is
    // the only place the two self-service department routes are offered.
    add('Join a department', '/department/join', AppIcons.userPlus,
        IconTone.lavender);
    add('Recommend', '/department/recommend', AppIcons.handshake,
        IconTone.teal,
        when: leadsAnything);
    add('Fundraising', '/manage/fundraising', AppIcons.flame, IconTone.gold,
        when: access.canView('fundraising'));

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 11,
      crossAxisSpacing: 11,
      childAspectRatio: 2.4,
      children: tiles,
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.label,
    required this.icon,
    required this.tone,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final IconTone tone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      onTap: onTap,
      radius: 18,
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
      child: Row(
        children: [
          IconChip(icon, tone: tone, size: 36),
          const SizedBox(width: 11),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.clay700,
                height: 1.25,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
