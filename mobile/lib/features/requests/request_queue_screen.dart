import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
import '../../data/models/enums.dart';
import '../../data/models/requests.dart';
import '../../data/repositories/request_repository.dart';
import 'request_action_sheets.dart';

final transportQueueProvider =
    FutureProvider<List<TransportRequest>>((ref) {
  return ref.watch(requestRepositoryProvider).transport();
});

final mediaQueueProvider = FutureProvider<List<MediaRequest>>((ref) {
  return ref.watch(requestRepositoryProvider).media();
});

final foodQueueProvider = FutureProvider<List<FoodRequest>>((ref) {
  return ref.watch(requestRepositoryProvider).food();
});

final budgetQueueProvider = FutureProvider<List<BudgetRequest>>((ref) {
  return ref.watch(requestRepositoryProvider).budgets();
});

/// The shared shell every stakeholder queue uses: pending first, then the
/// settled ones, with the one action that moves each request along.
class _QueueShell extends StatefulWidget {
  const _QueueShell({
    required this.title,
    required this.pending,
    required this.settled,
    required this.emptyTitle,
    required this.emptyBody,
    required this.icon,
    required this.tone,
    this.onRefresh,
  });

  final String title;
  final List<Widget> pending;
  final List<Widget> settled;
  final String emptyTitle;
  final String emptyBody;
  final IconData icon;
  final IconTone tone;
  final Future<void> Function()? onRefresh;

  @override
  State<_QueueShell> createState() => _QueueShellState();
}

class _QueueShellState extends State<_QueueShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final shown = _tab == 0 ? widget.pending : widget.settled;

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        SegmentedTabs(
          tabs: const ['Waiting', 'Settled'],
          selected: _tab,
          counts: {0: widget.pending.length},
          onSelect: (i) => setState(() => _tab = i),
        ),
        const SizedBox(height: 18),
        if (shown.isEmpty)
          EmptyStateLux(
            icon: widget.icon,
            tone: widget.tone,
            title: _tab == 0 ? widget.emptyTitle : 'Nothing settled yet',
            description:
                _tab == 0 ? widget.emptyBody : 'Decided requests are kept here.',
          )
        else
          for (final card in shown)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: card,
            ),
      ],
    );
  }
}

/// The card body every request shares — the event it belongs to, when it is,
/// and what was asked for.
class RequestCard extends StatefulWidget {
  const RequestCard({
    super.key,
    required this.title,
    required this.eventDate,
    required this.statusLabel,
    required this.statusTone,
    required this.icon,
    required this.tone,
    this.need,
    this.details = const [],
    this.actions,
    this.history = const [],
  });

  final String title;
  final DateTime eventDate;
  final String statusLabel;
  final IconTone statusTone;
  final IconData icon;
  final IconTone tone;
  final String? need;
  final List<Widget> details;
  final Widget? actions;
  final List<String> history;

  @override
  State<RequestCard> createState() => _RequestCardState();
}

class _RequestCardState extends State<RequestCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final soon = D.daysUntil(widget.eventDate);

    return LuxCard(
      onTap: widget.details.isEmpty && widget.history.isEmpty
          ? null
          : () => setState(() => _expanded = !_expanded),
      border: soon >= 0 && soon <= 7
          ? AppColors.gold.withValues(alpha: 0.3)
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconChip(widget.icon, tone: widget.tone, size: 44),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.title,
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
                      '${D.dayMedium(widget.eventDate)} · '
                      '${D.relative(widget.eventDate)}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight:
                            soon >= 0 && soon <= 7 ? FontWeight.w700 : null,
                        color: soon >= 0 && soon <= 7
                            ? AppColors.goldDark
                            : AppColors.clay400,
                      ),
                    ),
                  ],
                ),
              ),
              StatusBadge(widget.statusLabel,
                  tone: widget.statusTone, dense: true),
            ],
          ),

          if (widget.need != null && widget.need!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              widget.need!,
              style: const TextStyle(
                  fontSize: 13, height: 1.5, color: AppColors.clay500),
              maxLines: _expanded ? 8 : 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],

          if (_expanded) ...[
            if (widget.details.isNotEmpty) ...[
              const SizedBox(height: 12),
              const LuxDivider(indent: 0),
              const SizedBox(height: 4),
              ...widget.details,
            ],
            if (widget.history.isNotEmpty) ...[
              const SizedBox(height: 12),
              for (final line in widget.history)
                Padding(
                  padding: const EdgeInsets.only(bottom: 5),
                  child: Text(
                    line,
                    style: const TextStyle(
                        fontSize: 11.5,
                        height: 1.45,
                        color: AppColors.clay400),
                  ),
                ),
            ],
          ],

          if (widget.actions != null) ...[
            const SizedBox(height: 16),
            widget.actions!,
          ],
        ],
      ),
    );
  }
}

/// Approve / decline pair, sized for a thumb.
class DecisionButtons extends StatelessWidget {
  const DecisionButtons({
    super.key,
    required this.onApprove,
    required this.onDecline,
    this.approveLabel = 'Approve',
    this.declineLabel = 'Decline',
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

List<String> historyLines(List<dynamic> entries) => [
      for (final e in entries.take(5))
        '${D.dateTime(e.changedAt as DateTime)} · ${e.changedByName} · '
        '${e.status}'
        '${(e.comments as String?) == null || (e.comments as String).isEmpty ? '' : ' — ${e.comments}'}',
    ];

// ─── Transport ───

class TransportQueueScreen extends ConsumerWidget {
  const TransportQueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(transportQueueProvider);

    return AppScaffold(
      title: 'Transport requests',
      onRefresh: () async => ref.invalidate(transportQueueProvider),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(transportQueueProvider),
        ),
        data: (requests) => _QueueShell(
          title: 'Transport',
          icon: AppIcons.transport,
          tone: IconTone.blue,
          emptyTitle: 'Nothing to cost',
          emptyBody: 'When an approved event needs transport, it lands here '
              'for you to price.',
          pending: [
            for (final r in requests.where((r) => r.isPending))
              _TransportCard(request: r),
          ],
          settled: [
            for (final r in requests.where((r) => !r.isPending))
              _TransportCard(request: r),
          ],
        ),
      ),
    );
  }
}

class _TransportCard extends ConsumerStatefulWidget {
  const _TransportCard({required this.request});

  final TransportRequest request;

  @override
  ConsumerState<_TransportCard> createState() => _TransportCardState();
}

class _TransportCardState extends ConsumerState<_TransportCard> {
  bool _busy = false;

  Future<void> _price() async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => TransportDetailsSheet(request: widget.request),
    );
    if (saved == true) ref.invalidate(transportQueueProvider);
  }

  Future<void> _decide(String action) async {
    String? comments;
    if (action != 'APPROVE') {
      comments = await promptForText(
        context,
        title: action == 'REJECT' ? 'Turn this down?' : 'What needs changing?',
        hint: 'The coordinator sees this',
        confirmLabel: action == 'REJECT' ? 'Turn down' : 'Send back',
        required: true,
      );
      if (comments == null || comments.isEmpty) return;
    }

    setState(() => _busy = true);
    try {
      await ref
          .read(requestRepositoryProvider)
          .decideTransport(widget.request.id,
              action: action, comments: comments);
      ref.invalidate(transportQueueProvider);
      if (mounted) context.showSuccess('Recorded.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.request;
    final access = ref.watch(accessProvider);
    final canCost = access.can('manage_transport_logistics');
    final canDecide = access.can('approve_accounts');

    return RequestCard(
      title: r.eventTitle,
      eventDate: r.eventStartDate,
      statusLabel: r.status.label,
      statusTone: _tone(r.status),
      icon: AppIcons.transport,
      tone: IconTone.blue,
      need: r.needsDescription,
      details: [
        if (r.vehicleType != null)
          DetailRow(
            label: 'Vehicle',
            value: '${r.vehicleCount ?? 1} × ${r.vehicleType}',
            icon: AppIcons.transport,
          ),
        if (r.estimatedCost != null)
          DetailRow(
            label: 'Estimated',
            value: Money.format(r.estimatedCost, r.currency),
            icon: AppIcons.money,
          ),
        if (r.pickupLocation != null)
          DetailRow(
            label: 'Pick up',
            value: '${r.pickupLocation}'
                '${r.pickupTime == null ? '' : ' · ${D.dateTime(r.pickupTime)}'}',
            icon: AppIcons.mapPin,
          ),
        if (r.dropoffLocation != null)
          DetailRow(
            label: 'Drop off',
            value: r.dropoffLocation!,
            icon: AppIcons.mapPin,
          ),
        if (r.coordinatorNotes != null)
          DetailRow(
            label: 'Notes',
            value: r.coordinatorNotes!,
            icon: AppIcons.info,
          ),
        if (r.treasurerComments != null)
          DetailRow(
            label: 'Treasurer',
            value: '${r.treasurerName ?? ''} — ${r.treasurerComments}',
            icon: AppIcons.money,
          ),
      ],
      history: historyLines(r.statusHistory),
      actions: r.awaitingDetails && canCost
          ? PrimaryButton(
              label: 'Price this job',
              icon: AppIcons.edit,
              loading: _busy,
              onPressed: _price,
            )
          : r.status == TransportRequestStatus.pendingTreasurer && canDecide
              ? DecisionButtons(
                  busy: _busy,
                  approveLabel: 'Funds available',
                  declineLabel: 'Turn down',
                  onApprove: () => _decide('APPROVE'),
                  onDecline: () => _decide('REJECT'),
                )
              : null,
    );
  }

  static IconTone _tone(TransportRequestStatus status) => switch (status) {
        TransportRequestStatus.approved => IconTone.emerald,
        TransportRequestStatus.rejectedTreasurer => IconTone.rose,
        TransportRequestStatus.cancelled => IconTone.clay,
        _ => IconTone.amber,
      };
}

// ─── Media ───

class MediaQueueScreen extends ConsumerWidget {
  const MediaQueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(mediaQueueProvider);

    return AppScaffold(
      title: 'Media requests',
      onRefresh: () async => ref.invalidate(mediaQueueProvider),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(mediaQueueProvider),
        ),
        data: (requests) => _QueueShell(
          title: 'Media',
          icon: AppIcons.media,
          tone: IconTone.lavender,
          emptyTitle: 'Nothing to cover',
          emptyBody: 'Events needing sound, publicity or coverage appear here.',
          pending: [
            for (final r in requests.where((r) => r.isPending))
              _MediaCard(request: r),
          ],
          settled: [
            for (final r in requests.where((r) => !r.isPending))
              _MediaCard(request: r),
          ],
        ),
      ),
    );
  }
}

class _MediaCard extends ConsumerStatefulWidget {
  const _MediaCard({required this.request});

  final MediaRequest request;

  @override
  ConsumerState<_MediaCard> createState() => _MediaCardState();
}

class _MediaCardState extends ConsumerState<_MediaCard> {
  bool _busy = false;

  Future<void> _confirm() async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => MediaAssignSheet(request: widget.request),
    );
    if (saved == true) ref.invalidate(mediaQueueProvider);
  }

  Future<void> _decline() async {
    final comments = await promptForText(
      context,
      title: 'Cannot cover this?',
      hint: 'Why — the event initiator sees this',
      confirmLabel: 'Decline',
      required: true,
    );
    if (comments == null || comments.isEmpty) return;

    setState(() => _busy = true);
    try {
      await ref
          .read(requestRepositoryProvider)
          .declineMedia(widget.request.id, comments: comments);
      ref.invalidate(mediaQueueProvider);
      if (mounted) context.showSuccess('Declined.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.request;
    final canAct = ref.watch(accessProvider).can('manage_media');

    return RequestCard(
      title: r.eventTitle,
      eventDate: r.eventStartDate,
      statusLabel: r.status.label,
      statusTone: switch (r.status) {
        MediaRequestStatus.confirmed => IconTone.emerald,
        MediaRequestStatus.declined => IconTone.rose,
        MediaRequestStatus.cancelled => IconTone.clay,
        _ => IconTone.amber,
      },
      icon: AppIcons.media,
      tone: IconTone.lavender,
      need: r.needsDescription,
      details: [
        if (r.soundUserName != null)
          DetailRow(
              label: 'Sound', value: r.soundUserName!, icon: AppIcons.mic),
        if (r.publicityUserName != null)
          DetailRow(
              label: 'Publicity',
              value: r.publicityUserName!,
              icon: AppIcons.megaphone),
        if (r.coverageUserName != null)
          DetailRow(
              label: 'Coverage',
              value: r.coverageUserName!,
              icon: AppIcons.camera),
        if (r.coordinatorNotes != null)
          DetailRow(
              label: 'Notes', value: r.coordinatorNotes!, icon: AppIcons.info),
      ],
      history: historyLines(r.statusHistory),
      actions: r.isPending && canAct
          ? DecisionButtons(
              busy: _busy,
              approveLabel: 'Assign the team',
              declineLabel: 'Cannot cover',
              onApprove: _confirm,
              onDecline: _decline,
            )
          : null,
    );
  }
}

// ─── Food ───

class FoodQueueScreen extends ConsumerWidget {
  const FoodQueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(foodQueueProvider);

    return AppScaffold(
      title: 'Food requests',
      onRefresh: () async => ref.invalidate(foodQueueProvider),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(foodQueueProvider),
        ),
        data: (requests) => _QueueShell(
          title: 'Food',
          icon: AppIcons.food,
          tone: IconTone.amber,
          emptyTitle: 'Nothing to cater',
          emptyBody: 'Events needing food appear here for you to plan.',
          pending: [
            for (final r in requests.where((r) => r.isPending))
              _FoodCard(request: r),
          ],
          settled: [
            for (final r in requests.where((r) => !r.isPending))
              _FoodCard(request: r),
          ],
        ),
      ),
    );
  }
}

class _FoodCard extends ConsumerStatefulWidget {
  const _FoodCard({required this.request});

  final FoodRequest request;

  @override
  ConsumerState<_FoodCard> createState() => _FoodCardState();
}

class _FoodCardState extends ConsumerState<_FoodCard> {
  bool _busy = false;

  Future<void> _confirm() async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => FoodPlanSheet(request: widget.request),
    );
    if (saved == true) ref.invalidate(foodQueueProvider);
  }

  Future<void> _decline() async {
    final comments = await promptForText(
      context,
      title: 'Cannot cater this?',
      hint: 'Why — the event initiator sees this',
      confirmLabel: 'Decline',
      required: true,
    );
    if (comments == null || comments.isEmpty) return;

    setState(() => _busy = true);
    try {
      await ref
          .read(requestRepositoryProvider)
          .declineFood(widget.request.id, comments: comments);
      ref.invalidate(foodQueueProvider);
      if (mounted) context.showSuccess('Declined.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.request;
    final canAct = ref.watch(accessProvider).can('confirm_food');

    return RequestCard(
      title: r.eventTitle,
      eventDate: r.eventStartDate,
      statusLabel: r.status.label,
      statusTone: switch (r.status) {
        FoodRequestStatus.confirmed => IconTone.emerald,
        FoodRequestStatus.declined => IconTone.rose,
        FoodRequestStatus.cancelled => IconTone.clay,
        _ => IconTone.amber,
      },
      icon: AppIcons.food,
      tone: IconTone.amber,
      need: r.needsDescription,
      details: [
        if (r.headcount != null)
          DetailRow(
              label: 'Headcount',
              value: '${r.headcount}',
              icon: AppIcons.users),
        if (r.menuPlan != null)
          DetailRow(
              label: 'Menu', value: r.menuPlan!, icon: AppIcons.utensils),
        if (r.budgetRequestId != null)
          const DetailRow(
            label: 'Budget',
            value: 'Catering funds requested from the Treasurer',
            icon: AppIcons.money,
          ),
        if (r.coordinatorNotes != null)
          DetailRow(
              label: 'Notes', value: r.coordinatorNotes!, icon: AppIcons.info),
      ],
      history: historyLines(r.statusHistory),
      actions: r.isPending && canAct
          ? DecisionButtons(
              busy: _busy,
              approveLabel: 'Plan the catering',
              declineLabel: 'Cannot cater',
              onApprove: _confirm,
              onDecline: _decline,
            )
          : null,
    );
  }
}

// ─── Accounts (Treasurer) ───

class AccountsQueueScreen extends ConsumerStatefulWidget {
  const AccountsQueueScreen({super.key});

  @override
  ConsumerState<AccountsQueueScreen> createState() =>
      _AccountsQueueScreenState();
}

class _AccountsQueueScreenState extends ConsumerState<AccountsQueueScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final budgets = ref.watch(budgetQueueProvider);
    final transport = ref.watch(transportQueueProvider);

    return AppScaffold(
      title: 'Accounts approvals',
      onRefresh: () async {
        ref.invalidate(budgetQueueProvider);
        ref.invalidate(transportQueueProvider);
      },
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          SegmentedTabs(
            tabs: const ['Budgets', 'Transport'],
            selected: _tab,
            counts: {
              0: (budgets.valueOrNull ?? const [])
                  .where((b) => b.isPending)
                  .length,
              1: (transport.valueOrNull ?? const [])
                  .where((t) =>
                      t.status == TransportRequestStatus.pendingTreasurer)
                  .length,
            },
            onSelect: (i) => setState(() => _tab = i),
          ),
          const SizedBox(height: 18),
          if (_tab == 0)
            budgets.when(
              loading: () => const LoadingView(),
              error: (e, _) => ErrorView(message: '$e'),
              data: (list) {
                final pending = list.where((b) => b.isPending).toList();
                final settled = list.where((b) => !b.isPending).toList();
                if (list.isEmpty) {
                  return const EmptyStateLux(
                    icon: AppIcons.money,
                    tone: IconTone.emerald,
                    title: 'No budget requests',
                    description: 'Requests for event funds appear here.',
                  );
                }
                return Column(
                  children: [
                    for (final b in [...pending, ...settled])
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _BudgetCard(request: b),
                      ),
                  ],
                );
              },
            )
          else
            transport.when(
              loading: () => const LoadingView(),
              error: (e, _) => ErrorView(message: '$e'),
              data: (list) {
                final relevant = list
                    .where((t) =>
                        t.status != TransportRequestStatus.pendingDetails)
                    .toList();
                if (relevant.isEmpty) {
                  return const EmptyStateLux(
                    icon: AppIcons.transport,
                    tone: IconTone.blue,
                    title: 'Nothing costed yet',
                    description: 'Transport requests reach you once the '
                        'coordinator has priced them.',
                  );
                }
                return Column(
                  children: [
                    for (final t in relevant)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _TransportCard(request: t),
                      ),
                  ],
                );
              },
            ),
        ],
      ),
    );
  }
}

class _BudgetCard extends ConsumerStatefulWidget {
  const _BudgetCard({required this.request});

  final BudgetRequest request;

  @override
  ConsumerState<_BudgetCard> createState() => _BudgetCardState();
}

class _BudgetCardState extends ConsumerState<_BudgetCard> {
  bool _busy = false;

  Future<void> _decide(String action) async {
    final r = widget.request;
    double? approved;
    String? comments;

    if (action == 'APPROVE') {
      final entered = await promptForText(
        context,
        title: 'Approve how much?',
        hint: 'Leave blank to approve '
            '${Money.format(r.requestedAmount, r.currency)} in full',
        confirmLabel: 'Approve',
        maxLines: 1,
      );
      if (entered == null) return;
      if (entered.isNotEmpty) {
        approved =
            double.tryParse(entered.replaceAll(RegExp(r'[^0-9.]'), ''));
        if (approved == null) {
          if (mounted) context.showError('That does not look like an amount.');
          return;
        }
      }
    } else {
      comments = await promptForText(
        context,
        title: action == 'REJECT' ? 'Turn this down?' : 'What needs changing?',
        hint: 'The requester sees this',
        confirmLabel: action == 'REJECT' ? 'Turn down' : 'Send back',
        required: true,
      );
      if (comments == null || comments.isEmpty) return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(requestRepositoryProvider).decideBudget(
            r.id,
            action: action,
            comments: comments,
            approvedAmount: approved,
          );
      ref.invalidate(budgetQueueProvider);
      if (mounted) context.showSuccess('Recorded.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.request;
    final canAct = ref.watch(accessProvider).can('approve_accounts');

    return RequestCard(
      title: r.eventTitle,
      eventDate: r.eventStartDate,
      statusLabel: r.status.label,
      statusTone: switch (r.status) {
        BudgetRequestStatus.approved => IconTone.emerald,
        BudgetRequestStatus.rejected => IconTone.rose,
        BudgetRequestStatus.cancelled => IconTone.clay,
        _ => IconTone.amber,
      },
      icon: AppIcons.money,
      tone: IconTone.emerald,
      need: r.purpose,
      details: [
        DetailRow(
          label: 'Requested',
          value: Money.format(r.requestedAmount, r.currency),
          icon: AppIcons.wallet,
        ),
        if (r.approvedAmount != null)
          DetailRow(
            label: 'Approved',
            value: Money.format(r.approvedAmount, r.currency),
            icon: AppIcons.checkCircle,
          ),
        DetailRow(
          label: 'Asked by',
          value: r.requestedByName,
          icon: AppIcons.user,
        ),
        if (r.treasurerComments != null)
          DetailRow(
            label: 'Treasurer',
            value: '${r.treasurerName ?? ''} — ${r.treasurerComments}',
            icon: AppIcons.info,
          ),
      ],
      history: historyLines(r.statusHistory),
      actions: r.isPending && canAct
          ? DecisionButtons(
              busy: _busy,
              approveLabel: 'Funds available',
              declineLabel: 'Turn down',
              onApprove: () => _decide('APPROVE'),
              onDecline: () => _decide('REJECT'),
            )
          : null,
    );
  }
}
