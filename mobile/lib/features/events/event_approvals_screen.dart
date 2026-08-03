import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/money.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/firestore/streams.dart';
import '../../data/models/enums.dart';
import '../../data/models/event.dart';
import '../../data/repositories/service_repository.dart';
import '../calendar/calendar_screen.dart' show eventIcon, eventTone;
import '../calendar/event_detail_sheet.dart';

/// Events still moving through the approval chain, live.
final pendingEventsProvider = StreamProvider<List<AppEvent>>((ref) {
  return collectionStream(
    db.collection('events').where('approvalStatus', whereIn: const [
      'DRAFT',
      'PENDING_DISPATCH',
      'PENDING_STAKEHOLDERS',
      'PENDING_VICE_CHAIR',
      'PENDING_CHAIR',
      'CHANGES_REQUESTED',
    ]),
    AppEvent.fromMap,
    sort: (a, b) => a.startDate.compareTo(b.startDate),
  ).handleError((_) => <AppEvent>[]);
});

/// The approval chain: Events Lead dispatches the stakeholder requests and
/// passes the event up, the Vice Chairperson signs, then the Chairperson —
/// whose approval publishes it to the calendar.
///
/// Each card offers only the action for the stage the event is actually at,
/// and only to someone who holds that stage's permission.
class EventApprovalsScreen extends ConsumerStatefulWidget {
  const EventApprovalsScreen({super.key});

  @override
  ConsumerState<EventApprovalsScreen> createState() =>
      _EventApprovalsScreenState();
}

class _EventApprovalsScreenState extends ConsumerState<EventApprovalsScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(pendingEventsProvider);
    final access = ref.watch(accessProvider);

    return AppScaffold(
      title: 'Event approvals',
      onRefresh: () async => ref.invalidate(pendingEventsProvider),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(pendingEventsProvider),
        ),
        data: (events) {
          // "Mine to act on" is the useful default — an approvals queue that
          // shows work for other people is a queue nobody trusts.
          final mine =
              events.where((e) => _canActOn(access, e.approvalStatus)).toList();
          final shown = _tab == 0 ? mine : events;

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              SegmentedTabs(
                tabs: const ['Yours to sign', 'Everything'],
                selected: _tab,
                counts: {0: mine.length, 1: events.length},
                onSelect: (i) => setState(() => _tab = i),
              ),
              const SizedBox(height: 18),
              if (shown.isEmpty)
                EmptyStateLux(
                  icon: AppIcons.clipboardCheck,
                  tone: IconTone.emerald,
                  title: _tab == 0 ? 'Nothing needs you' : 'Nothing pending',
                  description: _tab == 0
                      ? 'Every event waiting is with someone else in the '
                          'chain.'
                      : 'Approved events are on the calendar.',
                )
              else
                for (final event in shown)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _ApprovalCard(event: event),
                  ),
            ],
          );
        },
      ),
    );
  }

  static bool _canActOn(Access access, EventApprovalStatus status) =>
      switch (status) {
        EventApprovalStatus.pendingDispatch ||
        EventApprovalStatus.pendingStakeholders =>
          access.can('approve_events'),
        EventApprovalStatus.pendingViceChair =>
          access.can('vice_chair_approve_events'),
        EventApprovalStatus.pendingChair =>
          access.can('chair_approve_events'),
        _ => false,
      };
}

class _ApprovalCard extends ConsumerStatefulWidget {
  const _ApprovalCard({required this.event});

  final AppEvent event;

  @override
  ConsumerState<_ApprovalCard> createState() => _ApprovalCardState();
}

class _ApprovalCardState extends ConsumerState<_ApprovalCard> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action, String success) async {
    setState(() => _busy = true);
    try {
      await action();
      ref.invalidate(pendingEventsProvider);
      if (mounted) context.showSuccess(success);
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _dispatch() async {
    final ok = await confirmAction(
      context,
      title: 'Send the stakeholder requests?',
      message: 'Transport, Media, Food and the Treasurer are asked for what '
          'this event needs. They can then confirm or decline.',
      confirmLabel: 'Dispatch',
    );
    if (!ok) return;
    await _run(
      () => ref.read(eventRepositoryProvider).dispatch(widget.event.id),
      'Requests sent to the stakeholders.',
    );
  }

  Future<void> _approve(bool isTier) async {
    final e = widget.event;
    final isChair = e.approvalStatus == EventApprovalStatus.pendingChair;
    final ok = await confirmAction(
      context,
      title: isChair ? 'Publish this event?' : 'Pass it up?',
      message: isChair
          ? 'Final approval puts it on the calendar and notifies members.'
          : 'This sends the event to the next signatory.',
      confirmLabel: isChair ? 'Approve and publish' : 'Approve',
    );
    if (!ok) return;

    await _run(
      () => isTier
          ? ref
              .read(eventRepositoryProvider)
              .tierApprove(e.id, action: 'APPROVE')
          : ref.read(eventRepositoryProvider).approve(e.id),
      isChair ? 'Approved — it is on the calendar.' : 'Passed up the chain.',
    );
  }

  Future<void> _reject(bool isTier, {required bool changesOnly}) async {
    final comments = await promptForText(
      context,
      title: changesOnly ? 'What needs changing?' : 'Turn this down?',
      hint: 'The person who raised it sees this',
      confirmLabel: changesOnly ? 'Send back' : 'Turn down',
      required: true,
    );
    if (comments == null || comments.isEmpty) return;

    final e = widget.event;
    await _run(
      () => isTier
          ? ref.read(eventRepositoryProvider).tierApprove(
                e.id,
                action: changesOnly ? 'CHANGES_REQUESTED' : 'REJECT',
                comments: comments,
              )
          : changesOnly
              ? ref
                  .read(eventRepositoryProvider)
                  .requestChanges(e.id, comments: comments)
              : ref
                  .read(eventRepositoryProvider)
                  .reject(e.id, comments: comments),
      changesOnly ? 'Sent back for changes.' : 'Turned down.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final e = widget.event;
    final access = ref.watch(accessProvider);
    final status = e.approvalStatus;

    final isLeadStage = status == EventApprovalStatus.pendingDispatch ||
        status == EventApprovalStatus.pendingStakeholders;
    final isTierStage = status == EventApprovalStatus.pendingViceChair ||
        status == EventApprovalStatus.pendingChair;

    final canAct = switch (status) {
      EventApprovalStatus.pendingDispatch ||
      EventApprovalStatus.pendingStakeholders =>
        access.can('approve_events'),
      EventApprovalStatus.pendingViceChair =>
        access.can('vice_chair_approve_events'),
      EventApprovalStatus.pendingChair => access.can('chair_approve_events'),
      _ => false,
    };

    return LuxCard(
      onTap: () => showEventDetail(context, e),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconChip(eventIcon(e.type), tone: eventTone(e.type), size: 44),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      e.title,
                      style: AppFonts.display(const TextStyle(
                        fontSize: 17,
                        height: 1.2,
                        color: AppColors.clay700,
                      )),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${D.dayMedium(e.startDate)} · ${e.venue}',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.clay400),
                    ),
                  ],
                ),
              ),
              StatusBadge(status.label,
                  tone: switch (status) {
                    EventApprovalStatus.changesRequested => IconTone.rose,
                    EventApprovalStatus.draft => IconTone.clay,
                    _ => IconTone.amber,
                  },
                  dense: true),
            ],
          ),

          const SizedBox(height: 12),
          _ChainStrip(status: status),

          if (e.stakeholderNeeds.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 7,
              runSpacing: 7,
              children: [
                for (final need in e.stakeholderNeeds)
                  StatusBadge(need, tone: IconTone.periwinkle, dense: true),
              ],
            ),
          ],

          if (e.budgetRequested && e.budgetAmount != null) ...[
            const SizedBox(height: 10),
            Text(
              'Budget asked: '
              '${Money.format(e.budgetAmount, e.budgetCurrency)}'
              '${e.budgetPurpose == null ? '' : ' — ${e.budgetPurpose}'}',
              style: const TextStyle(fontSize: 12.5, color: AppColors.clay500),
            ),
          ],

          if ((e.approvalComments ?? '').isNotEmpty) ...[
            const SizedBox(height: 12),
            NoticeCard(
              tone: IconTone.rose,
              icon: AppIcons.info,
              title: 'Changes asked for',
              message: e.approvalComments!,
            ),
          ],

          if (canAct) ...[
            const SizedBox(height: 16),
            if (status == EventApprovalStatus.pendingDispatch)
              PrimaryButton(
                label: 'Send stakeholder requests',
                icon: AppIcons.send,
                loading: _busy,
                onPressed: _dispatch,
              )
            else
              Column(
                children: [
                  DecisionRow(
                    busy: _busy,
                    approveLabel: status == EventApprovalStatus.pendingChair
                        ? 'Approve & publish'
                        : 'Approve',
                    onApprove: () => _approve(isTierStage),
                    onDecline: () =>
                        _reject(isTierStage, changesOnly: false),
                  ),
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: _busy
                        ? null
                        : () => _reject(isTierStage, changesOnly: true),
                    icon: const Icon(AppIcons.edit, size: 14),
                    label: const Text('Ask for changes'),
                    style: TextButton.styleFrom(
                        foregroundColor: AppColors.clay500),
                  ),
                ],
              ),
            if (isLeadStage &&
                status == EventApprovalStatus.pendingStakeholders) ...[
              const SizedBox(height: 4),
              TextButton.icon(
                onPressed: () =>
                    context.push('/manage/events/${e.id}/roles'),
                icon: const Icon(AppIcons.users, size: 14),
                label: const Text('Assign roles'),
                style:
                    TextButton.styleFrom(foregroundColor: AppColors.goldDark),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

/// Approve / turn down, as a row.
class DecisionRow extends StatelessWidget {
  const DecisionRow({
    super.key,
    required this.onApprove,
    required this.onDecline,
    this.approveLabel = 'Approve',
    this.declineLabel = 'Turn down',
    this.busy = false,
  });

  final VoidCallback onApprove;
  final VoidCallback onDecline;
  final String approveLabel;
  final String declineLabel;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: busy ? null : onDecline,
            icon: const Icon(AppIcons.xCircle, size: 15),
            label: Text(declineLabel),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.destructive,
              side: BorderSide(
                  color: AppColors.destructive.withValues(alpha: 0.3)),
              minimumSize: const Size(0, 44),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: PrimaryButton(
            label: approveLabel,
            icon: AppIcons.check,
            loading: busy,
            onPressed: onApprove,
          ),
        ),
      ],
    );
  }
}

/// The four stages drawn as a strip, so it is obvious where an event is.
class _ChainStrip extends StatelessWidget {
  const _ChainStrip({required this.status});

  final EventApprovalStatus status;

  static const _stages = [
    ('Dispatch', EventApprovalStatus.pendingDispatch),
    ('Stakeholders', EventApprovalStatus.pendingStakeholders),
    ('Vice Chair', EventApprovalStatus.pendingViceChair),
    ('Chairperson', EventApprovalStatus.pendingChair),
  ];

  @override
  Widget build(BuildContext context) {
    final currentIndex =
        _stages.indexWhere((s) => s.$2 == status);

    return Row(
      children: [
        for (var i = 0; i < _stages.length; i++) ...[
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: currentIndex < 0
                        ? AppColors.clay100
                        : i < currentIndex
                            ? AppColors.teal
                            : i == currentIndex
                                ? AppColors.gold
                                : AppColors.clay100,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  _stages[i].$1,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight:
                        i == currentIndex ? FontWeight.w700 : FontWeight.w500,
                    color: i == currentIndex
                        ? AppColors.goldDark
                        : AppColors.clay300,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          if (i != _stages.length - 1) const SizedBox(width: 5),
        ],
      ],
    );
  }
}
