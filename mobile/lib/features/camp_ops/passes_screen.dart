import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
import '../../data/models/camp.dart';
import '../../data/models/enums.dart';
import '../../data/repositories/camp_repository.dart';

/// The pass queue, live.
final passQueueProvider = FutureProvider<PassQueue>((ref) {
  return ref.watch(campRepositoryProvider).listPasses();
});

/// Exit passes — the three sign-offs, in order.
///
/// A camper who needs to leave camp is signed off by Admissions, then the Camp
/// Manager, then the Chairperson, and only the Chairperson's approval mints the
/// QR ticket the gate scans. The buttons here follow the server's own
/// capability answer rather than re-deriving it, so what is shown and what the
/// API will accept can never disagree.
class CampPassesScreen extends ConsumerWidget {
  const CampPassesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(passQueueProvider);

    return AppScaffold(
      title: 'Exit passes',
      subtitle: getCamp(kDefaultCampId)?.name,
      showBottomNav: false,
      onRefresh: () async => ref.invalidate(passQueueProvider),
      actions: [
        IconButton(
          icon: const Icon(AppIcons.scan),
          tooltip: 'Gate scanner',
          onPressed: () => context.push('/manage/rops-camp/gate'),
        ),
      ],
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(passQueueProvider),
        ),
        data: (queue) => _PassQueueBody(queue: queue),
      ),
      floatingActionButton: async.valueOrNull?.can.admissions == true
          ? FloatingActionButton.extended(
              onPressed: () => _openRequestSheet(context, ref),
              icon: const Icon(AppIcons.plus, size: 19),
              label: const Text('Log a request'),
            )
          : null,
    );
  }

  Future<void> _openRequestSheet(BuildContext context, WidgetRef ref) async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _RequestPassSheet(),
    );
    if (created == true) ref.invalidate(passQueueProvider);
  }
}

class _PassQueueBody extends ConsumerStatefulWidget {
  const _PassQueueBody({required this.queue});

  final PassQueue queue;

  @override
  ConsumerState<_PassQueueBody> createState() => _PassQueueBodyState();
}

class _PassQueueBodyState extends ConsumerState<_PassQueueBody> {
  int _tab = 0;

  static const _tabs = ['Waiting', 'Out', 'Approved', 'Closed'];

  List<CampPass> _filter(List<CampPass> passes) => switch (_tab) {
        0 => passes.where((p) => p.status.isPending).toList(),
        1 => passes.where((p) => p.status == CampPassStatus.out).toList(),
        2 => passes
            .where((p) => p.status == CampPassStatus.approved)
            .toList(),
        _ => passes
            .where((p) =>
                p.status == CampPassStatus.returned ||
                p.status == CampPassStatus.rejected ||
                p.status == CampPassStatus.cancelled)
            .toList(),
      };

  @override
  Widget build(BuildContext context) {
    final passes = widget.queue.passes;
    final can = widget.queue.can;
    final shown = _filter(passes);

    final counts = {
      0: passes.where((p) => p.status.isPending).length,
      1: passes.where((p) => p.status == CampPassStatus.out).length,
      2: passes.where((p) => p.status == CampPassStatus.approved).length,
    };

    // A pass past its return time is the thing the Camp Manager most needs to
    // see, so it is called out above the tabs rather than buried in a list.
    final overdue = passes.where((p) => p.isOverdue).toList();

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        if (overdue.isNotEmpty) ...[
          NoticeCard(
            tone: IconTone.rose,
            icon: AppIcons.alert,
            title: overdue.length == 1
                ? '1 camper is overdue'
                : '${overdue.length} campers are overdue',
            message: overdue.map((p) => p.camperName).join(', '),
          ),
          const SizedBox(height: 16),
        ],
        SegmentedTabs(
          tabs: _tabs,
          selected: _tab,
          counts: counts,
          onSelect: (i) => setState(() => _tab = i),
        ),
        const SizedBox(height: 16),
        if (shown.isEmpty)
          EmptyStateLux(
            icon: AppIcons.ticket,
            tone: IconTone.sage,
            title: switch (_tab) {
              0 => 'Nothing waiting',
              1 => 'Everyone is in camp',
              2 => 'No issued passes',
              _ => 'Nothing closed yet',
            },
            description: switch (_tab) {
              0 => 'Requests to leave camp appear here as they come in.',
              1 => 'Campers signed out at the gate show up here until they '
                  'are back.',
              2 => 'Once the Chairperson approves a request, the issued '
                  'ticket appears here until the gate scans it out.',
              _ => 'Returned, rejected and cancelled passes are kept here.',
            },
          )
        else
          for (final pass in shown)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _PassCard(
                pass: pass,
                can: can,
                onDecided: () => ref.invalidate(passQueueProvider),
              ),
            ),
      ],
    );
  }
}

class _PassCard extends ConsumerStatefulWidget {
  const _PassCard({
    required this.pass,
    required this.can,
    required this.onDecided,
  });

  final CampPass pass;
  final PassCapabilities can;
  final VoidCallback onDecided;

  @override
  ConsumerState<_PassCard> createState() => _PassCardState();
}

class _PassCardState extends ConsumerState<_PassCard> {
  bool _busy = false;
  bool _expanded = false;

  Future<void> _decide(String action) async {
    final pass = widget.pass;
    String? comments;

    if (action == 'REJECT') {
      comments = await promptForText(
        context,
        title: 'Turn down ${pass.camperFirstName}\'s request?',
        hint: 'Why — the camper and the desk both see this',
        confirmLabel: 'Turn down',
        required: true,
      );
      if (comments == null || comments.isEmpty) return;
    } else if (action == 'APPROVE') {
      final stage = pass.awaitingStage;
      final isChair = stage == CampPassStage.chair;
      final ok = await confirmAction(
        context,
        title: isChair ? 'Issue the gate pass?' : 'Sign off this request?',
        message: isChair
            ? 'Approving mints the QR ticket and emails it. Nothing scannable '
                'exists until you do this.'
            : 'This passes the request to '
                '${stage == CampPassStage.admissions ? 'the Camp Manager' : 'the Chairperson'}.',
        confirmLabel: isChair ? 'Approve and issue' : 'Sign off',
      );
      if (!ok) return;
      comments = null;
    } else {
      final ok = await confirmAction(
        context,
        title: 'Cancel this pass?',
        message: 'The request is withdrawn and cannot be reinstated.',
        confirmLabel: 'Cancel pass',
        destructive: true,
      );
      if (!ok) return;
    }

    setState(() => _busy = true);
    try {
      await ref
          .read(campRepositoryProvider)
          .decidePass(pass.id, action: action, comments: comments);
      if (!mounted) return;
      widget.onDecided();
      context.showSuccess(switch (action) {
        'APPROVE' => pass.awaitingStage == CampPassStage.chair
            ? 'Pass issued and emailed.'
            : 'Signed off.',
        'REJECT' => 'Request turned down.',
        _ => 'Pass cancelled.',
      });
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    setState(() => _busy = true);
    try {
      await ref.read(campRepositoryProvider).resendPassEmail(widget.pass.id);
      if (mounted) context.showSuccess('Pass ticket re-sent.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pass = widget.pass;
    final stage = pass.awaitingStage;
    final canActNow = stage != null && widget.can.canAct(stage);

    return LuxCard(
      onTap: () => setState(() => _expanded = !_expanded),
      border: pass.isOverdue
          ? AppColors.destructive.withValues(alpha: 0.35)
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconChip(
                pass.isOverdue ? AppIcons.alert : AppIcons.ticket,
                tone: _toneFor(pass),
                size: 44,
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      pass.camperName,
                      style: AppFonts.display(const TextStyle(
                        fontSize: 18,
                        height: 1.2,
                        color: AppColors.clay700,
                      )),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      pass.reason,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.clay500),
                      maxLines: _expanded ? 4 : 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Icon(_expanded ? AppIcons.chevronUp : AppIcons.chevronDown,
                  size: 16, color: AppColors.clay300),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 7,
            runSpacing: 7,
            children: [
              StatusBadge(pass.status.label, tone: _toneFor(pass), dense: true),
              StatusBadge(
                'Back ${D.relative(pass.expectedReturnAt)}',
                tone: pass.isOverdue ? IconTone.rose : IconTone.clay,
                icon: AppIcons.clock,
                dense: true,
              ),
              StatusBadge(pass.requestSource.label,
                  tone: IconTone.periwinkle, dense: true),
            ],
          ),

          if (_expanded) ...[
            const SizedBox(height: 14),
            const LuxDivider(indent: 0),
            const SizedBox(height: 6),
            if ((pass.destination ?? '').isNotEmpty)
              DetailRow(
                label: 'Destination',
                value: pass.destination!,
                icon: AppIcons.mapPin,
              ),
            DetailRow(
              label: 'Back by',
              value: D.dateTime(pass.expectedReturnAt),
              icon: AppIcons.clock,
            ),
            if ((pass.escortName ?? '').isNotEmpty)
              DetailRow(
                label: 'Escort',
                value: '${pass.escortName}'
                    '${(pass.escortPhone ?? '').isEmpty ? '' : ' · ${Phone.pretty(pass.escortPhone!)}'}',
                icon: AppIcons.user,
              ),
            DetailRow(
              label: 'Requested by',
              value: pass.requestedByName,
              icon: AppIcons.user,
            ),
            const SizedBox(height: 8),
            _StageChain(pass: pass),
            if (pass.statusHistory.isNotEmpty) ...[
              const SizedBox(height: 12),
              for (final entry in pass.statusHistory.reversed.take(4))
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    '${D.dateTime(entry.changedAt)} · ${entry.changedByName} · '
                    '${entry.status}'
                    '${(entry.comments ?? '').isEmpty ? '' : ' — ${entry.comments}'}',
                    style: const TextStyle(
                        fontSize: 11.5, height: 1.4, color: AppColors.clay400),
                  ),
                ),
            ],
          ],

          if (canActNow || pass.status == CampPassStatus.approved) ...[
            const SizedBox(height: 16),
            if (canActNow)
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : () => _decide('REJECT'),
                      icon: const Icon(AppIcons.xCircle, size: 16),
                      label: const Text('Turn down'),
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
                      label: stage == CampPassStage.chair
                          ? 'Approve'
                          : 'Sign off',
                      icon: AppIcons.check,
                      loading: _busy,
                      onPressed: () => _decide('APPROVE'),
                    ),
                  ),
                ],
              )
            else
              OutlinedButton.icon(
                onPressed: _busy ? null : _resend,
                icon: const Icon(AppIcons.send, size: 16),
                label: const Text('Re-send the ticket'),
              ),
          ],
        ],
      ),
    );
  }

  static IconTone _toneFor(CampPass pass) {
    if (pass.isOverdue) return IconTone.rose;
    return switch (pass.status) {
      CampPassStatus.approved => IconTone.emerald,
      CampPassStatus.out => IconTone.blue,
      CampPassStatus.returned => IconTone.sage,
      CampPassStatus.rejected || CampPassStatus.cancelled => IconTone.clay,
      _ => IconTone.amber,
    };
  }
}

/// The three sign-offs drawn as a chain, so it is obvious at a glance where a
/// request has got to and who it is waiting on.
class _StageChain extends StatelessWidget {
  const _StageChain({required this.pass});

  final CampPass pass;

  @override
  Widget build(BuildContext context) {
    final rejectedAt = pass.rejectedStage;

    return Row(
      children: [
        for (final stage in CampPassStage.values) ...[
          Expanded(
            child: _StageDot(
              stage: stage,
              state: _stateOf(stage, rejectedAt),
              actorName: _actorFor(stage),
            ),
          ),
          if (stage != CampPassStage.chair)
            Container(
              width: 14,
              height: 1.5,
              color: AppColors.clay200,
            ),
        ],
      ],
    );
  }

  String? _actorFor(CampPassStage stage) => switch (stage) {
        CampPassStage.admissions => pass.admissionsName,
        CampPassStage.manager => pass.managerName,
        CampPassStage.chair => pass.chairName,
      };

  _StageState _stateOf(CampPassStage stage, CampPassStage? rejectedAt) {
    if (rejectedAt == stage) return _StageState.rejected;
    final decidedAt = switch (stage) {
      CampPassStage.admissions => pass.admissionsDecidedAt,
      CampPassStage.manager => pass.managerDecidedAt,
      CampPassStage.chair => pass.chairDecidedAt,
    };
    if (decidedAt != null) return _StageState.done;
    if (pass.awaitingStage == stage) return _StageState.waiting;
    return _StageState.pending;
  }
}

enum _StageState { done, waiting, pending, rejected }

class _StageDot extends StatelessWidget {
  const _StageDot({
    required this.stage,
    required this.state,
    this.actorName,
  });

  final CampPassStage stage;
  final _StageState state;
  final String? actorName;

  @override
  Widget build(BuildContext context) {
    final (icon, tone) = switch (state) {
      _StageState.done => (AppIcons.check, IconTone.emerald),
      _StageState.waiting => (AppIcons.clock, IconTone.amber),
      _StageState.rejected => (AppIcons.close, IconTone.rose),
      _StageState.pending => (AppIcons.minus, IconTone.clay),
    };
    final colors = toneColors(tone);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          height: 26,
          width: 26,
          decoration: BoxDecoration(
            color: colors.background,
            shape: BoxShape.circle,
            border: state == _StageState.waiting
                ? Border.all(color: colors.foreground, width: 1.5)
                : null,
          ),
          alignment: Alignment.center,
          child: Icon(icon, size: 13, color: colors.foreground),
        ),
        const SizedBox(height: 5),
        Text(
          stage.label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: state == _StageState.pending
                ? AppColors.clay300
                : AppColors.clay600,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        if (actorName != null && actorName!.isNotEmpty)
          Text(
            actorName!,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 9.5, color: AppColors.clay300),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
      ],
    );
  }
}

/// The Admissions desk logging a walk-up request.
class _RequestPassSheet extends ConsumerStatefulWidget {
  const _RequestPassSheet();

  @override
  ConsumerState<_RequestPassSheet> createState() => _RequestPassSheetState();
}

class _RequestPassSheetState extends ConsumerState<_RequestPassSheet> {
  final _formKey = GlobalKey<FormState>();
  final _reason = TextEditingController();
  final _destination = TextEditingController();
  final _escortName = TextEditingController();
  final _escortPhone = TextEditingController();

  String? _registrationId;
  DateTime _returnAt = DateTime.now().add(const Duration(hours: 4));
  bool _busy = false;
  List<Map<String, dynamic>> _campers = const [];
  bool _loadingCampers = true;

  @override
  void initState() {
    super.initState();
    unawaited(_loadCampers());
  }

  @override
  void dispose() {
    _reason.dispose();
    _destination.dispose();
    _escortName.dispose();
    _escortPhone.dispose();
    super.dispose();
  }

  Future<void> _loadCampers() async {
    try {
      final campers =
          await ref.read(campRepositoryProvider).passEligibleCampers();
      if (mounted) {
        setState(() {
          _campers = campers;
          _loadingCampers = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _loadingCampers = false);
        context.showError(e.message);
      }
    }
  }

  Future<void> _pickReturn() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _returnAt,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 14)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_returnAt),
    );
    if (time == null) return;
    setState(() => _returnAt = DateTime(
          date.year,
          date.month,
          date.day,
          time.hour,
          time.minute,
        ));
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_registrationId == null) {
      context.showError('Choose the camper.');
      return;
    }
    if (!_returnAt.isAfter(DateTime.now())) {
      context.showError('The expected return time must be in the future.');
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(campRepositoryProvider).requestPass(
            registrationId: _registrationId!,
            reason: _reason.text.trim(),
            expectedReturnAt: _returnAt,
            destination: _destination.text.trim(),
            escortName: _escortName.text.trim(),
            escortPhone: _escortPhone.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      context.showSuccess('Request logged — it now goes to the Camp Manager.');
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError(e.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Log a request to leave camp',
                style: AppFonts.display(const TextStyle(
                    fontSize: 21, color: AppColors.clay700)),
              ),
              const SizedBox(height: 4),
              const Text(
                'Admissions signs off first, then the Camp Manager, then the '
                'Chairperson — who issues the gate ticket.',
                style: TextStyle(
                    fontSize: 13, height: 1.5, color: AppColors.clay400),
              ),
              const SizedBox(height: 20),
              AppDropdown<String>(
                label: 'Camper',
                required: true,
                hint: _loadingCampers ? 'Loading campers…' : 'Choose a camper',
                value: _registrationId,
                items: [
                  for (final c in _campers)
                    DropdownMenuItem(
                      value: '${c['id']}',
                      child: Text(
                        '${c['firstName'] ?? ''} ${c['lastName'] ?? ''}'.trim(),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                onChanged: (v) => setState(() => _registrationId = v),
              ),
              const SizedBox(height: 16),
              AppTextField(
                label: 'Reason',
                controller: _reason,
                required: true,
                maxLines: 3,
                minLines: 2,
                hint: 'Why the camper needs to leave',
              ),
              const SizedBox(height: 16),
              AppTextField(
                label: 'Destination',
                controller: _destination,
                hint: 'Where they are going',
              ),
              const SizedBox(height: 16),
              _ReturnPicker(value: _returnAt, onTap: _pickReturn),
              const SizedBox(height: 16),
              AppTextField(
                label: 'Escort',
                controller: _escortName,
                hint: 'Who is collecting them — required for minors',
                textCapitalization: TextCapitalization.words,
              ),
              const SizedBox(height: 16),
              AppTextField(
                label: 'Escort phone',
                controller: _escortPhone,
                keyboardType: TextInputType.phone,
                textCapitalization: TextCapitalization.none,
              ),
              const SizedBox(height: 22),
              PrimaryButton(
                label: 'Log request',
                loading: _busy,
                onPressed: _submit,
                icon: AppIcons.send,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReturnPicker extends StatelessWidget {
  const _ReturnPicker({required this.value, required this.onTap});

  final DateTime value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const FieldLabel('Expected back', required: true),
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.base),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppRadius.base),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                const Icon(AppIcons.clock, size: 17, color: AppColors.clay300),
                const SizedBox(width: 11),
                Expanded(
                  child: Text(
                    D.dateTime(value),
                    style: const TextStyle(
                        fontSize: 14.5, color: AppColors.clay700),
                  ),
                ),
                const Icon(AppIcons.chevronDown,
                    size: 16, color: AppColors.clay400),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
