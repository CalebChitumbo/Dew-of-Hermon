import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/fundraising/fundraising_menu.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/money.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/enums.dart';
import '../../data/models/fundraising.dart';
import '../../data/models/user.dart';
import '../../data/repositories/fundraising_repository.dart';
import 'fundraising_hub_screen.dart' show braaisProvider;

final braaiProvider =
    FutureProvider.family<BraaiEvent?, String>((ref, id) {
  return ref.watch(fundraisingRepositoryProvider).braai(id);
});

final braaiAssignmentsProvider =
    FutureProvider.family<List<BraaiAssignment>, String>((ref, id) {
  return ref.watch(fundraisingRepositoryProvider).assignments(id);
});

final braaiOrdersProvider =
    FutureProvider.family<List<FundraisingOrder>, String>((ref, id) {
  return ref.watch(fundraisingRepositoryProvider).orders(id);
});

final fundraisingTeamProvider = FutureProvider<List<AppUser>>((ref) {
  return ref.watch(fundraisingRepositoryProvider).teamMembers();
});

/// One braai: the duty roster and the orders desk.
/// Mirrors `/manage/fundraising/braai/[id]`.
class BraaiDetailScreen extends ConsumerStatefulWidget {
  const BraaiDetailScreen({super.key, required this.braaiId});

  final String braaiId;

  @override
  ConsumerState<BraaiDetailScreen> createState() => _BraaiDetailScreenState();
}

class _BraaiDetailScreenState extends ConsumerState<BraaiDetailScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final access = ref.watch(accessProvider);
    final canPlan = access.can('plan_fundraising_braai');
    final canOrders = access.can('manage_fundraising_orders');
    final braaiAsync = ref.watch(braaiProvider(widget.braaiId));

    if (!canPlan && !canOrders) {
      return const DetailScaffold(title: 'Braai', body: NoAccessView());
    }

    // Whichever tab this person actually holds — a Fundraising member who
    // only works the counter should land on Orders, not an empty roster.
    final tabs = <String>[
      if (canPlan) 'Roster',
      if (canOrders) 'Orders',
    ];
    final showing = tabs[_tab.clamp(0, tabs.length - 1)];

    return DetailScaffold(
      title: braaiAsync.valueOrNull?.title ?? 'Braai',
      subtitle: braaiAsync.valueOrNull == null
          ? null
          : D.long(braaiAsync.valueOrNull!.eventDate),
      onRefresh: () async {
        ref.invalidate(braaiProvider(widget.braaiId));
        ref.invalidate(braaiAssignmentsProvider(widget.braaiId));
        ref.invalidate(braaiOrdersProvider(widget.braaiId));
      },
      actions: [
        if (canPlan)
          PopupMenuButton<String>(
            icon: const Icon(AppIcons.menu, size: 20),
            color: Colors.white,
            onSelected: (value) => switch (value) {
              'archive' => _archive(context),
              'delete' => _delete(context),
              _ => null,
            },
            itemBuilder: (_) => [
              const PopupMenuItem(
                value: 'archive',
                child: Text('Archive this braai'),
              ),
              if (access.role == UserRole.superAdmin)
                const PopupMenuItem(
                  value: 'delete',
                  child: Text('Delete this braai',
                      style: TextStyle(color: AppColors.destructive)),
                ),
            ],
          ),
      ],
      body: braaiAsync.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(braaiProvider(widget.braaiId)),
        ),
        data: (braai) {
          if (braai == null) {
            return const EmptyStateLux(
              icon: AppIcons.alert,
              tone: IconTone.rose,
              title: 'Braai not found',
              description: 'It may have been deleted.',
            );
          }

          return Column(
            children: [
              if ((braai.venue ?? '').isNotEmpty ||
                  (braai.notes ?? '').isNotEmpty) ...[
                LuxCard(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if ((braai.venue ?? '').isNotEmpty)
                        DetailRow(
                          label: 'Venue',
                          value: braai.venue!,
                          icon: AppIcons.mapPin,
                        ),
                      if ((braai.notes ?? '').isNotEmpty)
                        DetailRow(
                          label: 'Notes',
                          value: braai.notes!,
                          icon: AppIcons.fileText,
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
              if (tabs.length > 1) ...[
                SegmentedTabs(
                  tabs: tabs,
                  selected: _tab.clamp(0, tabs.length - 1),
                  onSelect: (i) => setState(() => _tab = i),
                ),
                const SizedBox(height: 16),
              ],
              Expanded(
                child: showing == 'Roster'
                    ? _RosterTab(braaiId: widget.braaiId)
                    : _OrdersTab(braaiId: widget.braaiId),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _archive(BuildContext context) async {
    final ok = await confirmAction(
      context,
      title: 'Archive this braai?',
      message: 'It stops accepting orders and drops off the planning list. '
          'The roster and orders are kept.',
      confirmLabel: 'Archive',
    );
    if (!ok) return;
    try {
      await ref
          .read(fundraisingRepositoryProvider)
          .updateBraai(widget.braaiId, isArchived: true);
      ref.invalidate(braaisProvider);
      ref.invalidate(braaiProvider(widget.braaiId));
      if (mounted) context.showSuccess('Archived.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    }
  }

  Future<void> _delete(BuildContext context) async {
    final ok = await confirmAction(
      context,
      title: 'Delete this braai?',
      message: 'The braai, its roster and its orders all go. This cannot be '
          'undone — archive it instead if you just want it out of the way.',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!ok) return;
    try {
      await ref.read(fundraisingRepositoryProvider).deleteBraai(widget.braaiId);
      ref.invalidate(braaisProvider);
      if (mounted) {
        Navigator.of(context).pop();
        context.showSuccess('Deleted.');
      }
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    }
  }
}

// ─── Roster ───

class _RosterTab extends ConsumerWidget {
  const _RosterTab({required this.braaiId});

  final String braaiId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assignmentsAsync = ref.watch(braaiAssignmentsProvider(braaiId));
    final teamAsync = ref.watch(fundraisingTeamProvider);

    return assignmentsAsync.when(
      loading: () => const LoadingView(),
      error: (e, _) => ErrorView(
        message: '$e',
        onRetry: () => ref.invalidate(braaiAssignmentsProvider(braaiId)),
      ),
      data: (assignments) {
        final byKey = <String, BraaiAssignment>{
          for (final a in assignments) a.responsibilityKey: a,
        };
        final confirmed = assignments
            .where((a) => a.status == AssignmentStatus.confirmed)
            .length;
        final declined = assignments
            .where((a) => a.status == AssignmentStatus.declined)
            .length;
        final pending = assignments.length - confirmed - declined;
        final open = kBraaiTotalResponsibilities - assignments.length;

        final team = teamAsync.valueOrNull ?? const <AppUser>[];

        return ListView(
          padding: EdgeInsets.zero,
          children: [
            StatStripLux(
              columns: 4,
              items: [
                StripItem(
                  icon: AppIcons.checkCircle,
                  tone: IconTone.sage,
                  label: 'Confirmed',
                  value: '$confirmed',
                ),
                StripItem(
                  icon: AppIcons.clock,
                  tone: IconTone.gold,
                  label: 'Pending',
                  value: '$pending',
                ),
                StripItem(
                  icon: AppIcons.xCircle,
                  tone: IconTone.blush,
                  label: 'Declined',
                  value: '$declined',
                ),
                StripItem(
                  icon: AppIcons.users,
                  tone: IconTone.clay,
                  label: 'Open',
                  value: '$open',
                ),
              ],
            ),
            const SizedBox(height: 20),

            if (teamAsync.hasValue && team.isEmpty) ...[
              NoticeCard(
                tone: IconTone.amber,
                icon: AppIcons.alert,
                title: 'No Fundraising team members yet',
                message: 'Ask your Chairperson to create a department called '
                    '"$kFundraisingDepartmentName" and add members to it, so '
                    'you can assign responsibilities here.',
              ),
              const SizedBox(height: 20),
            ],

            for (final phase in BraaiPhase.values) ...[
              SectionHeading(
                title: phase.label,
                icon: phase == BraaiPhase.preparation
                    ? AppIcons.listTodo
                    : AppIcons.flame,
                tone: phase == BraaiPhase.preparation
                    ? IconTone.periwinkle
                    : IconTone.gold,
              ),
              const SizedBox(height: 12),
              for (final duty in kBraaiResponsibilities
                  .where((r) => r.phase == phase.wire))
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _DutyRow(
                    braaiId: braaiId,
                    duty: duty,
                    assignment: byKey[duty.key],
                    team: team,
                    takenUserIds: {
                      for (final a in assignments) a.userId,
                    },
                  ),
                ),
              const SizedBox(height: 14),
            ],
          ],
        );
      },
    );
  }
}

class _DutyRow extends ConsumerStatefulWidget {
  const _DutyRow({
    required this.braaiId,
    required this.duty,
    required this.assignment,
    required this.team,
    required this.takenUserIds,
  });

  final String braaiId;
  final BraaiResponsibility duty;
  final BraaiAssignment? assignment;
  final List<AppUser> team;
  final Set<String> takenUserIds;

  @override
  ConsumerState<_DutyRow> createState() => _DutyRowState();
}

class _DutyRowState extends ConsumerState<_DutyRow> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action, String success) async {
    setState(() => _busy = true);
    try {
      await action();
      ref.invalidate(braaiAssignmentsProvider(widget.braaiId));
      ref.invalidate(braaisProvider);
      if (mounted) context.showSuccess(success);
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _assign() async {
    // Someone already on another duty is still offered — the web lets one
    // person carry two — but they are marked so it is a conscious choice.
    final picked = await showModalBottomSheet<AppUser>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _MemberPicker(
        title: widget.duty.name,
        team: widget.team,
        takenUserIds: widget.takenUserIds,
      ),
    );
    if (picked == null) return;

    await _run(
      () => ref.read(fundraisingRepositoryProvider).assignDuty(
            braaiId: widget.braaiId,
            responsibilityKey: widget.duty.key,
            userId: picked.id,
          ),
      '${picked.name} has been asked to take this on.',
    );
  }

  Future<void> _remove() async {
    final assignment = widget.assignment;
    if (assignment == null) return;
    final ok = await confirmAction(
      context,
      title: 'Unassign ${assignment.userName}?',
      message: '"${widget.duty.name}" goes back to the open list.',
      confirmLabel: 'Unassign',
      destructive: true,
    );
    if (!ok) return;

    await _run(
      () => ref.read(fundraisingRepositoryProvider).removeAssignment(
            braaiId: widget.braaiId,
            assignmentId: assignment.id,
          ),
      'Unassigned.',
    );
  }

  Future<void> _setStatus(AssignmentStatus status) => _run(
        () => ref.read(fundraisingRepositoryProvider).updateAssignment(
              braaiId: widget.braaiId,
              assignmentId: widget.assignment!.id,
              status: status,
            ),
        status == AssignmentStatus.confirmed
            ? 'Marked confirmed.'
            : 'Marked declined.',
      );

  @override
  Widget build(BuildContext context) {
    final assignment = widget.assignment;

    return LuxCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  widget.duty.name,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.clay700,
                  ),
                ),
              ),
              if (assignment != null)
                StatusBadge.forStatus(assignment.status.wire,
                    label: assignment.status.label, dense: true),
            ],
          ),
          const SizedBox(height: 10),
          if (assignment == null)
            Align(
              alignment: Alignment.centerLeft,
              child: PrimaryButton(
                label: 'Assign someone',
                expand: false,
                icon: AppIcons.userPlus,
                loading: _busy,
                onPressed: widget.team.isEmpty ? null : _assign,
              ),
            )
          else ...[
            Row(
              children: [
                MemberAvatar(
                  initials: _initials(assignment.userName),
                  size: 34,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        assignment.userName,
                        style: const TextStyle(
                            fontSize: 13.5, color: AppColors.clay700),
                      ),
                      Text(
                        assignment.emailSent
                            ? 'Emailed ${D.relative(assignment.emailSentAt)}'
                            : 'Not emailed',
                        style: const TextStyle(
                            fontSize: 11.5, color: AppColors.clay400),
                      ),
                    ],
                  ),
                ),
                if ((assignment.userPhone ?? '').isNotEmpty)
                  IconButton(
                    icon: const Icon(AppIcons.phone, size: 17),
                    color: AppColors.clay400,
                    tooltip: 'Call ${assignment.userName}',
                    onPressed: () => _call(assignment.userPhone!),
                  ),
                IconButton(
                  icon: const Icon(AppIcons.trash, size: 17),
                  color: AppColors.destructive,
                  tooltip: 'Unassign',
                  onPressed: _busy ? null : _remove,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                if (assignment.status != AssignmentStatus.confirmed)
                  TextButton.icon(
                    onPressed: _busy
                        ? null
                        : () => _setStatus(AssignmentStatus.confirmed),
                    icon: const Icon(AppIcons.check, size: 14),
                    label: const Text('Confirmed'),
                    style: TextButton.styleFrom(
                        foregroundColor: AppColors.emerald600),
                  ),
                if (assignment.status != AssignmentStatus.declined)
                  TextButton.icon(
                    onPressed: _busy
                        ? null
                        : () => _setStatus(AssignmentStatus.declined),
                    icon: const Icon(AppIcons.xCircle, size: 14),
                    label: const Text('Declined'),
                    style: TextButton.styleFrom(
                        foregroundColor: AppColors.clay400),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _call(String phone) async {
    final uri = Phone.dialUri(phone);
    if (!await launchUrl(uri) && mounted) {
      context.showError("Couldn't open the dialler.");
    }
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}

class _MemberPicker extends StatelessWidget {
  const _MemberPicker({
    required this.title,
    required this.team,
    required this.takenUserIds,
  });

  final String title;
  final List<AppUser> team;
  final Set<String> takenUserIds;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      builder: (context, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          SectionHeading(
            title: 'Who takes this on?',
            icon: AppIcons.userPlus,
            subtitle: title,
          ),
          const SizedBox(height: 12),
          for (final member in team)
            LuxTile(
              title: member.name,
              subtitle: takenUserIds.contains(member.id)
                  ? 'Already has a duty on this braai'
                  : member.email,
              leading: MemberAvatar(
                initials: _initials(member.name),
                size: 34,
              ),
              onTap: () => Navigator.of(context).pop(member),
            ),
        ],
      ),
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}

// ─── Orders desk ───

class _OrdersTab extends ConsumerStatefulWidget {
  const _OrdersTab({required this.braaiId});

  final String braaiId;

  @override
  ConsumerState<_OrdersTab> createState() => _OrdersTabState();
}

class _OrdersTabState extends ConsumerState<_OrdersTab> {
  FundraisingPreparationStatus? _filter;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(braaiOrdersProvider(widget.braaiId));

    return async.when(
      loading: () => const LoadingView(),
      error: (e, _) => ErrorView(
        message: '$e',
        onRetry: () => ref.invalidate(braaiOrdersProvider(widget.braaiId)),
      ),
      data: (all) {
        final live = all.where((o) => !o.isArchived).toList();
        final shown = _filter == null
            ? live
            : live.where((o) => o.preparationStatus == _filter).toList();

        final takings = live
            .where((o) => o.isPaid)
            .fold<int>(0, (sum, o) => sum + o.total);
        final owing = live
            .where((o) => !o.isPaid)
            .fold<int>(0, (sum, o) => sum + o.total);

        return ListView(
          padding: EdgeInsets.zero,
          children: [
            StatStripLux(
              columns: 3,
              items: [
                StripItem(
                  icon: AppIcons.receipt,
                  tone: IconTone.teal,
                  label: 'Orders',
                  value: '${live.length}',
                ),
                StripItem(
                  icon: AppIcons.wallet,
                  tone: IconTone.emerald,
                  label: 'Taken',
                  value: '$kCurrencySymbol$takings',
                  hint: 'paid',
                ),
                StripItem(
                  icon: AppIcons.clock,
                  tone: IconTone.amber,
                  label: 'Owing',
                  value: '$kCurrencySymbol$owing',
                  hint: 'unpaid',
                  highlight: owing > 0,
                ),
              ],
            ),
            const SizedBox(height: 16),

            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _FilterChip(
                    label: 'All',
                    selected: _filter == null,
                    onTap: () => setState(() => _filter = null),
                  ),
                  for (final status in FundraisingPreparationStatus.values)
                    _FilterChip(
                      label: status.label,
                      count: live
                          .where((o) => o.preparationStatus == status)
                          .length,
                      selected: _filter == status,
                      onTap: () => setState(() => _filter = status),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            if (shown.isEmpty)
              const EmptyStateLux(
                icon: AppIcons.receipt,
                tone: IconTone.teal,
                title: 'No orders here yet',
                description: 'Orders placed on the public page land here as '
                    'they come in.',
              )
            else
              for (final order in shown)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _OrderCard(braaiId: widget.braaiId, order: order),
                ),
          ],
        );
      },
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.count,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int? count;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
          decoration: BoxDecoration(
            color: selected ? AppColors.clay700 : AppColors.cream,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
                color: selected ? AppColors.clay700 : AppColors.clay200),
          ),
          child: Text(
            count == null ? label : '$label · $count',
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : AppColors.clay500,
            ),
          ),
        ),
      ),
    );
  }
}

class _OrderCard extends ConsumerStatefulWidget {
  const _OrderCard({required this.braaiId, required this.order});

  final String braaiId;
  final FundraisingOrder order;

  @override
  ConsumerState<_OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends ConsumerState<_OrderCard> {
  bool _busy = false;

  Future<void> _patch({
    FundraisingPaymentStatus? paymentStatus,
    FundraisingPaymentMethod? paymentMethod,
    FundraisingPreparationStatus? preparationStatus,
    bool? isArchived,
  }) async {
    setState(() => _busy = true);
    try {
      await ref.read(fundraisingRepositoryProvider).updateOrder(
            braaiId: widget.braaiId,
            orderId: widget.order.id,
            paymentStatus: paymentStatus,
            paymentMethod: paymentMethod,
            preparationStatus: preparationStatus,
            isArchived: isArchived,
          );
      ref.invalidate(braaiOrdersProvider(widget.braaiId));
      if (mounted) context.showSuccess('Updated.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _markPaid() async {
    final method = await showModalBottomSheet<FundraisingPaymentMethod>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 18, 20, 6),
              child: SectionHeading(
                title: 'How did they pay?',
                icon: AppIcons.wallet,
                tone: IconTone.emerald,
              ),
            ),
            for (final m in FundraisingPaymentMethod.values)
              LuxTile(
                title: m.label,
                icon: m == FundraisingPaymentMethod.momo
                    ? AppIcons.phone
                    : AppIcons.money,
                onTap: () => Navigator.of(context).pop(m),
              ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
    if (method == null) return;
    await _patch(
      paymentStatus: FundraisingPaymentStatus.paid,
      paymentMethod: method,
    );
  }

  /// The next step in PENDING → IN_PREP → READY → COLLECTED, or null at the
  /// end of the line.
  FundraisingPreparationStatus? get _nextPrep {
    const order = FundraisingPreparationStatus.values;
    final i = order.indexOf(widget.order.preparationStatus);
    return i < 0 || i == order.length - 1 ? null : order[i + 1];
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final next = _nextPrep;

    return LuxCard(
      padding: const EdgeInsets.all(15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.orderNumber,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.4,
                        color: AppColors.clay700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${order.customerName} · ${order.customerPhone}',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.clay400),
                    ),
                  ],
                ),
              ),
              Text(
                '$kCurrencySymbol${order.total}',
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: AppColors.goldDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 7,
            runSpacing: 7,
            children: [
              StatusBadge.forStatus(order.preparationStatus.wire,
                  label: order.preparationStatus.label, dense: true),
              StatusBadge.forStatus(order.paymentStatus.wire,
                  label: order.paymentMethod == null
                      ? order.paymentStatus.label
                      : '${order.paymentStatus.label} · '
                          '${order.paymentMethod!.label}',
                  dense: true),
              StatusBadge(order.pickupLabel,
                  tone: IconTone.periwinkle, dense: true),
              if (order.submittedBy == FundraisingOrderSource.member)
                const StatusBadge('At the counter',
                    tone: IconTone.clay, dense: true),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            order.items.map((i) => '${i.qty}× ${i.name}').join(', '),
            style: const TextStyle(
                fontSize: 12.5, height: 1.5, color: AppColors.clay500),
          ),
          if ((order.notes ?? '').isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              '“${order.notes}”',
              style: const TextStyle(
                fontSize: 12,
                fontStyle: FontStyle.italic,
                color: AppColors.clay400,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              if (!order.isPaid)
                Expanded(
                  child: PrimaryButton(
                    label: 'Mark paid',
                    icon: AppIcons.wallet,
                    loading: _busy,
                    onPressed: _markPaid,
                  ),
                ),
              if (!order.isPaid && next != null) const SizedBox(width: 9),
              if (next != null)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy
                        ? null
                        : () => _patch(preparationStatus: next),
                    icon: const Icon(AppIcons.forward, size: 15),
                    label: Text(next.label),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.clay600,
                      minimumSize: const Size(0, 44),
                    ),
                  ),
                ),
              if (order.isPaid && next == null)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed:
                        _busy ? null : () => _patch(isArchived: true),
                    icon: const Icon(AppIcons.check, size: 15),
                    label: const Text('Close it out'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.clay500,
                      minimumSize: const Size(0, 44),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
