import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/firestore/streams.dart';
import '../../data/models/enums.dart';
import '../../data/models/event.dart';
import '../../data/repositories/service_repository.dart';

/// A duty joined to the service and event it belongs to, so a row renders
/// without further reads.
class ScheduledDuty {
  const ScheduledDuty({
    required this.assignment,
    this.serviceDate,
    this.serviceTheme,
    this.venue,
  });

  final ServiceAssignment assignment;
  final DateTime? serviceDate;
  final String? serviceTheme;
  final String? venue;

  bool get isUpcoming =>
      serviceDate == null ||
      !serviceDate!.isBefore(D.startOfDay(DateTime.now()));
}

/// The member's own duties, live from Firestore, joined to their services.
final myDutiesProvider = StreamProvider<List<ScheduledDuty>>((ref) {
  final user = ref.watch(userOrNullProvider);
  if (user == null) return Stream.value(const <ScheduledDuty>[]);

  return db
      .collection('serviceAssignments')
      .where('userId', isEqualTo: user.id)
      .snapshots()
      .asyncMap((snap) async {
    final assignments = mapDocs(snap, ServiceAssignment.fromMap);
    if (assignments.isEmpty) return const <ScheduledDuty>[];

    // Join each duty to its service and that service's event. Firestore's
    // whereIn takes 30 ids at a time, and a member never has more than a
    // handful of live duties, so one batched pass is plenty.
    final serviceIds = assignments.map((a) => a.serviceId).toSet().toList();
    final services = <String, Service>{};
    final events = <String, AppEvent>{};

    for (var i = 0; i < serviceIds.length; i += 30) {
      final batch = serviceIds.skip(i).take(30).toList();
      final snap = await db
          .collection('services')
          .where(FieldPath.documentId, whereIn: batch)
          .get();
      for (final doc in snap.docs) {
        services[doc.id] = Service.fromMap({...doc.data(), 'id': doc.id});
      }
    }

    final eventIds =
        services.values.map((s) => s.eventId).where((e) => e.isNotEmpty).toSet().toList();
    for (var i = 0; i < eventIds.length; i += 30) {
      final batch = eventIds.skip(i).take(30).toList();
      final snap = await db
          .collection('events')
          .where(FieldPath.documentId, whereIn: batch)
          .get();
      for (final doc in snap.docs) {
        events[doc.id] = AppEvent.fromMap({...doc.data(), 'id': doc.id});
      }
    }

    final duties = assignments.map((a) {
      final service = services[a.serviceId];
      final event = service == null ? null : events[service.eventId];
      return ScheduledDuty(
        assignment: a,
        serviceDate: event?.startDate,
        serviceTheme: service?.theme ?? event?.title,
        venue: event?.venue,
      );
    }).toList()
      ..sort((a, b) {
        if (a.serviceDate == null) return 1;
        if (b.serviceDate == null) return -1;
        return a.serviceDate!.compareTo(b.serviceDate!);
      });

    return duties;
  }).handleError((_) => <ScheduledDuty>[]);
});

/// My schedule — the member's own duties, and the one action that matters on
/// each: confirm, or say they cannot make it.
class MyScheduleScreen extends ConsumerWidget {
  const MyScheduleScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myDutiesProvider);

    return AppScaffold(
      title: 'My schedule',
      onRefresh: () async => ref.invalidate(myDutiesProvider),
      actions: [
        IconButton(
          icon: const Icon(AppIcons.history),
          tooltip: 'History',
          onPressed: () => context.push('/my-schedule/history'),
        ),
      ],
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(myDutiesProvider),
        ),
        data: (duties) {
          final upcoming = duties.where((d) => d.isUpcoming).toList();
          final awaiting = upcoming
              .where((d) =>
                  d.assignment.status == AssignmentStatus.pending ||
                  d.assignment.status == AssignmentStatus.noResponse)
              .toList();

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              if (awaiting.isNotEmpty) ...[
                NoticeCard(
                  tone: IconTone.amber,
                  icon: AppIcons.clock,
                  title: awaiting.length == 1
                      ? 'One duty needs your answer'
                      : '${awaiting.length} duties need your answer',
                  message: 'Confirming lets the rota be finalised — and lets '
                      'someone else be asked if you cannot make it.',
                ),
                const SizedBox(height: 18),
              ],

              LuxCard(
                onTap: () => context.push('/my-schedule/availability'),
                child: Row(
                  children: [
                    const IconChip(AppIcons.calendarDays,
                        tone: IconTone.periwinkle),
                    const SizedBox(width: 13),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'When you are away',
                            style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w600,
                              color: AppColors.clay700,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Mark the Sundays you cannot serve, so the rota '
                            'never asks.',
                            style: TextStyle(
                                fontSize: 12,
                                height: 1.4,
                                color: AppColors.clay400),
                          ),
                        ],
                      ),
                    ),
                    const Icon(AppIcons.chevronRight,
                        size: 17, color: AppColors.clay300),
                  ],
                ),
              ),
              const SizedBox(height: 22),

              SectionHeading(
                title: 'Coming up',
                icon: AppIcons.clipboardCheck,
                tone: IconTone.gold,
                subtitle: upcoming.isEmpty
                    ? 'Nothing scheduled'
                    : '${upcoming.length} '
                        '${upcoming.length == 1 ? 'duty' : 'duties'}',
              ),
              const SizedBox(height: 12),

              if (upcoming.isEmpty)
                const EmptyStateLux(
                  icon: AppIcons.clipboard,
                  tone: IconTone.sage,
                  title: 'Nothing on your rota',
                  description: 'When a department lead assigns you a role, it '
                      'appears here and you get an email.',
                )
              else
                for (final duty in upcoming)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: DutyCard(duty: duty),
                  ),
            ],
          );
        },
      ),
    );
  }
}

class DutyCard extends ConsumerStatefulWidget {
  const DutyCard({super.key, required this.duty, this.readOnly = false});

  final ScheduledDuty duty;
  final bool readOnly;

  @override
  ConsumerState<DutyCard> createState() => _DutyCardState();
}

class _DutyCardState extends ConsumerState<DutyCard> {
  bool _busy = false;

  Future<void> _respond(AssignmentStatus status) async {
    String? notes;
    if (status == AssignmentStatus.declined) {
      notes = await promptForText(
        context,
        title: 'Cannot make it?',
        hint: 'A short note for the lead (optional)',
        confirmLabel: 'Decline',
      );
      if (notes == null) return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(serviceRepositoryProvider).setAssignmentStatus(
            serviceId: widget.duty.assignment.serviceId,
            assignmentId: widget.duty.assignment.id,
            status: status,
            notes: notes,
          );
      if (mounted) {
        context.showSuccess(status == AssignmentStatus.confirmed
            ? "Confirmed — see you there."
            : 'Declined. The lead has been told.');
      }
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final duty = widget.duty;
    final a = duty.assignment;
    final needsAnswer = a.status == AssignmentStatus.pending ||
        a.status == AssignmentStatus.noResponse;

    return LuxCard(
      border: needsAnswer && !widget.readOnly
          ? AppColors.gold.withValues(alpha: 0.35)
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconChip(AppIcons.clipboard,
                  tone: _tone(a.status), size: 44),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      a.roleName,
                      style: AppFonts.display(const TextStyle(
                        fontSize: 18,
                        height: 1.2,
                        color: AppColors.clay700,
                      )),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      [
                        if (duty.serviceDate != null)
                          D.dayMedium(duty.serviceDate),
                        if (duty.serviceTheme != null) duty.serviceTheme!,
                        if (duty.venue != null) duty.venue!,
                      ].join(' · '),
                      style: const TextStyle(
                          fontSize: 12.5, color: AppColors.clay400),
                    ),
                  ],
                ),
              ),
              StatusBadge(a.status.label, tone: _tone(a.status), dense: true),
            ],
          ),

          if ((a.notes ?? '').isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              a.notes!,
              style: const TextStyle(
                  fontSize: 13, height: 1.45, color: AppColors.clay500),
            ),
          ],

          if (!widget.readOnly && duty.isUpcoming) ...[
            const SizedBox(height: 16),
            if (needsAnswer)
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _busy
                          ? null
                          : () => _respond(AssignmentStatus.declined),
                      icon: const Icon(AppIcons.close, size: 15),
                      label: const Text("Can't make it"),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.destructive,
                        side: BorderSide(
                            color: AppColors.destructive
                                .withValues(alpha: 0.3)),
                        minimumSize: const Size(0, 44),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: PrimaryButton(
                      label: "I'll be there",
                      icon: AppIcons.check,
                      loading: _busy,
                      onPressed: () => _respond(AssignmentStatus.confirmed),
                    ),
                  ),
                ],
              )
            else if (a.status == AssignmentStatus.confirmed)
              OutlinedButton.icon(
                onPressed:
                    _busy ? null : () => _respond(AssignmentStatus.declined),
                icon: const Icon(AppIcons.close, size: 15),
                label: const Text('Something has come up'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.clay500,
                  minimumSize: const Size(0, 42),
                ),
              )
            else
              OutlinedButton.icon(
                onPressed:
                    _busy ? null : () => _respond(AssignmentStatus.confirmed),
                icon: const Icon(AppIcons.check, size: 15),
                label: const Text('Actually, I can make it'),
                style: OutlinedButton.styleFrom(minimumSize: const Size(0, 42)),
              ),
          ],
        ],
      ),
    );
  }

  static IconTone _tone(AssignmentStatus status) => switch (status) {
        AssignmentStatus.confirmed => IconTone.emerald,
        AssignmentStatus.declined => IconTone.rose,
        AssignmentStatus.pending => IconTone.amber,
        AssignmentStatus.noResponse => IconTone.clay,
      };
}

/// Past duties — the record of what someone has actually served on.
class ScheduleHistoryScreen extends ConsumerWidget {
  const ScheduleHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myDutiesProvider);

    return DetailScaffold(
      title: 'Serving history',
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: '$e'),
        data: (duties) {
          final past = duties.where((d) => !d.isUpcoming).toList().reversed
              .toList();
          final served = past
              .where((d) => d.assignment.status == AssignmentStatus.confirmed)
              .length;

          if (past.isEmpty) {
            return const EmptyStateLux(
              icon: AppIcons.history,
              tone: IconTone.sage,
              title: 'No history yet',
              description: 'Once a service you served on is past, it is kept '
                  'here.',
            );
          }

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              StatStripLux(items: [
                StripItem(
                  icon: AppIcons.checkCircle,
                  tone: IconTone.emerald,
                  label: 'Served',
                  value: '$served',
                ),
                StripItem(
                  icon: AppIcons.clipboard,
                  tone: IconTone.clay,
                  label: 'Assigned',
                  value: '${past.length}',
                ),
              ]),
              const SizedBox(height: 20),
              for (final duty in past)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: DutyCard(duty: duty, readOnly: true),
                ),
            ],
          );
        },
      ),
    );
  }
}
