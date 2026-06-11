import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../models/models.dart';
import '../../../models/requests.dart';
import '../../../services/access_service.dart';
import '../../../services/auth_service.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';

/// Event approvals — the full chain from the web approvals page:
/// Events Lead (dispatch stakeholders, then approve) → Vice Chairperson →
/// Chairperson (final publish). Same endpoints, same rules.
class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  bool _showDecided = false;
  Map<String, StakeholderStatuses> _stakeholders = {};
  String? _actingOn;

  static const _pendingStatuses = [
    'PENDING_DISPATCH',
    'PENDING_STAKEHOLDERS',
    'PENDING_VICE_CHAIR',
    'PENDING_CHAIR',
  ];

  Future<void> _loadStakeholders(List<String> eventIds) async {
    if (eventIds.isEmpty) return;
    try {
      final api = context.read<ApiClient>();
      final res = await api.postJson(
          '/api/events/stakeholder-statuses', {'eventIds': eventIds});
      final raw = res['statuses'];
      if (raw is Map && mounted) {
        setState(() {
          _stakeholders = raw.map((k, v) => MapEntry(
                k.toString(),
                StakeholderStatuses.fromJson(
                    (v as Map).cast<String, dynamic>()),
              ));
        });
      }
    } catch (_) {
      // Pipeline chips just stay hidden — actions still work.
    }
  }

  Future<void> _act({
    required AppEvent event,
    required String action, // APPROVE | REJECT | REQUEST_CHANGES | DISPATCH
  }) async {
    final api = context.read<ApiClient>();
    String? comments;

    if (action != 'DISPATCH') {
      comments = await _commentsDialog(action, event.title);
      if (comments == null) return; // cancelled
    }

    setState(() => _actingOn = event.id);
    try {
      if (action == 'DISPATCH') {
        await api.postJson('/api/events/${event.id}/dispatch', {});
        if (mounted) {
          showAppSnackBar(context, 'Stakeholder requests dispatched.');
        }
        _loadStakeholders([event.id]);
      } else {
        final isExecTier = event.approvalStatus == 'PENDING_VICE_CHAIR' ||
            event.approvalStatus == 'PENDING_CHAIR';
        final path = isExecTier
            ? '/api/events/${event.id}/tier-approve'
            : '/api/events/${event.id}/approve';
        final trimmed = comments?.trim() ?? '';
        await api.dio.patch(path, data: {
          'action': action,
          if (trimmed.isNotEmpty) 'comments': trimmed,
        });
        if (mounted) {
          showAppSnackBar(
            context,
            switch (action) {
              'APPROVE' => 'Approved — moved to the next stage.',
              'REJECT' => 'Event rejected.',
              _ => 'Changes requested from the event creator.',
            },
          );
        }
      }
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } catch (e) {
      final message = e is Exception ? ApiException('Action failed.') : null;
      if (mounted) {
        showAppSnackBar(context, message?.message ?? 'Action failed.',
            isError: true);
      }
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  Future<String?> _commentsDialog(String action, String title) async {
    final controller = TextEditingController();
    final label = switch (action) {
      'APPROVE' => 'Approve',
      'REJECT' => 'Reject',
      _ => 'Request changes',
    };
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text('$label "$title"?',
            style: Theme.of(dialogContext).textTheme.titleLarge),
        content: TextField(
          controller: controller,
          maxLines: 3,
          decoration: InputDecoration(
            labelText: action == 'APPROVE'
                ? 'Comments (optional)'
                : 'Reason / notes for the creator',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: action == 'REJECT'
                ? FilledButton.styleFrom(backgroundColor: PWColors.destructive)
                : null,
            onPressed: () =>
                Navigator.of(dialogContext).pop(controller.text),
            child: Text(label),
          ),
        ],
      ),
    );
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<AuthService>().profile;
    final access = context.watch<AccessService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Event Approvals')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, label: Text('In the pipeline')),
                ButtonSegment(value: true, label: Text('Recently decided')),
              ],
              selected: {_showDecided},
              onSelectionChanged: (s) =>
                  setState(() => _showDecided = s.first),
            ),
          ),
          Expanded(
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: FirebaseFirestore.instance
                  .collection('events')
                  .where('approvalStatus',
                      whereIn: _showDecided
                          ? const ['REJECTED', 'CHANGES_REQUESTED']
                          : _pendingStatuses)
                  .snapshots(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                final events = (snapshot.data?.docs ?? const [])
                    .map((d) => AppEvent.fromMap(d.id, d.data()))
                    .toList()
                  ..sort((a, b) => a.startDate.compareTo(b.startDate));

                if (!_showDecided) {
                  final missing = events
                      .where((e) =>
                          e.hasStakeholders &&
                          !_stakeholders.containsKey(e.id))
                      .map((e) => e.id)
                      .toList();
                  if (missing.isNotEmpty) {
                    WidgetsBinding.instance.addPostFrameCallback(
                        (_) => _loadStakeholders(missing));
                  }
                }

                if (events.isEmpty) {
                  return EmptyState(
                    icon: Icons.fact_check_outlined,
                    title: _showDecided
                        ? 'No recent decisions'
                        : 'Nothing waiting for approval',
                    subtitle: _showDecided
                        ? 'Rejected events and change requests appear here.'
                        : 'New event submissions land here for the '
                            'approval chain.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                  itemCount: events.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (context, i) => _ApprovalCard(
                    event: events[i],
                    stakeholders: _stakeholders[events[i].id],
                    departmentName: access.departments
                        .where(
                            (d) => d.id == events[i].createdByDepartmentId)
                        .map((d) => d.name)
                        .firstOrNull,
                    busy: _actingOn == events[i].id,
                    canActEventsLead:
                        access.checkFeature(profile, 'approve_events'),
                    canActViceChair: access.checkFeature(
                        profile, 'vice_chair_approve_events'),
                    canActChair:
                        access.checkFeature(profile, 'chair_approve_events'),
                    onAction: (action) =>
                        _act(event: events[i], action: action),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ApprovalCard extends StatelessWidget {
  const _ApprovalCard({
    required this.event,
    required this.stakeholders,
    required this.departmentName,
    required this.busy,
    required this.canActEventsLead,
    required this.canActViceChair,
    required this.canActChair,
    required this.onAction,
  });

  final AppEvent event;
  final StakeholderStatuses? stakeholders;
  final String? departmentName;
  final bool busy;
  final bool canActEventsLead;
  final bool canActViceChair;
  final bool canActChair;
  final ValueChanged<String> onAction;

  bool get _callerCanAct => switch (event.approvalStatus) {
        'PENDING_DISPATCH' || 'PENDING_STAKEHOLDERS' => canActEventsLead,
        'PENDING_VICE_CHAIR' => canActViceChair,
        'PENDING_CHAIR' => canActChair,
        _ => false,
      };

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                EventTypeChip(type: event.type, label: event.typeLabel),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    DateFormat('EEE, MMM d · HH:mm').format(event.startDate),
                    style: textTheme.labelSmall
                        ?.copyWith(color: PWColors.clay400),
                  ),
                ),
                _StageChip(status: event.approvalStatus),
              ],
            ),
            const SizedBox(height: 8),
            Text(event.title, style: textTheme.titleMedium),
            Text(
              [
                event.venue,
                if (departmentName != null) 'by $departmentName',
              ].join(' · '),
              style: textTheme.bodySmall?.copyWith(color: PWColors.clay400),
            ),
            if (event.objective != null) ...[
              const SizedBox(height: 6),
              Text(
                event.objective!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: textTheme.bodySmall
                    ?.copyWith(color: PWColors.clay500, height: 1.4),
              ),
            ],
            if (event.approvalComments != null &&
                event.approvalComments!.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                'Comments: ${event.approvalComments}',
                style: textTheme.bodySmall?.copyWith(
                    color: PWColors.goldDark, fontStyle: FontStyle.italic),
              ),
            ],
            if (event.hasStakeholders) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  if (event.transportRequired)
                    _StakeChip('Transport', stakeholders?.transport),
                  if (event.budgetRequested)
                    _StakeChip(
                        'Budget '
                        '${event.budgetCurrency ?? ''} ${event.budgetAmount ?? ''}',
                        stakeholders?.budget),
                  if (event.mediaRequired)
                    _StakeChip('Media', stakeholders?.media),
                  if (event.foodRequired)
                    _StakeChip('Food', stakeholders?.food),
                ],
              ),
            ],
            const SizedBox(height: 10),
            _ChainRow(status: event.approvalStatus),
            if (_callerCanAct) ...[
              const Divider(height: 22),
              if (busy)
                const Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              else
                Row(
                  children: [
                    if (event.approvalStatus == 'PENDING_DISPATCH' &&
                        event.hasStakeholders) ...[
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () => onAction('DISPATCH'),
                          icon: const Icon(Icons.send, size: 16),
                          label: const Text('Dispatch requests'),
                        ),
                      ),
                    ] else ...[
                      Expanded(
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                              backgroundColor: PWColors.teal),
                          onPressed: () => onAction('APPROVE'),
                          child: const Text('Approve'),
                        ),
                      ),
                    ],
                    const SizedBox(width: 8),
                    _SmallAction(
                      icon: Icons.edit_note,
                      tooltip: 'Request changes',
                      color: PWColors.goldDark,
                      onTap: () => onAction('REQUEST_CHANGES'),
                    ),
                    const SizedBox(width: 6),
                    _SmallAction(
                      icon: Icons.close,
                      tooltip: 'Reject',
                      color: PWColors.destructive,
                      onTap: () => onAction('REJECT'),
                    ),
                  ],
                ),
              if (event.approvalStatus == 'PENDING_STAKEHOLDERS' ||
                  (event.approvalStatus == 'PENDING_DISPATCH' &&
                      event.hasStakeholders)) ...[
                const SizedBox(height: 6),
                Text(
                  event.approvalStatus == 'PENDING_DISPATCH'
                      ? 'Dispatch sends the transport/budget/media/food '
                          'requests to their teams.'
                      : 'Approve becomes available once every stakeholder '
                          'has confirmed.',
                  style: textTheme.labelSmall
                      ?.copyWith(color: PWColors.clay400),
                ),
                if (event.approvalStatus == 'PENDING_STAKEHOLDERS')
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: () => onAction('APPROVE'),
                      child: const Text('All confirmed? Pass to Vice Chair'),
                    ),
                  ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _StageChip extends StatelessWidget {
  const _StageChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = switch (status) {
      'APPROVED' => (PWColors.tealDark, const Color(0xFFE2F3F0)),
      'REJECTED' => (const Color(0xFFB91C1C), const Color(0xFFFEE2E2)),
      'CHANGES_REQUESTED' => (PWColors.goldDark, const Color(0xFFFCF0DC)),
      'PENDING_VICE_CHAIR' ||
      'PENDING_CHAIR' =>
        (const Color(0xFF7C3AED), const Color(0xFFF3E8FF)),
      _ => (const Color(0xFF2563EB), const Color(0xFFDBEAFE)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(
        approvalStatusLabels[status] ?? status,
        style: Theme.of(context)
            .textTheme
            .labelSmall
            ?.copyWith(color: fg, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _StakeChip extends StatelessWidget {
  const _StakeChip(this.label, this.status);

  final String label;
  final String? status;

  @override
  Widget build(BuildContext context) {
    final s = status ?? '…';
    final ok = s == 'APPROVED' || s == 'CONFIRMED';
    final bad = s.startsWith('REJECTED') || s == 'DECLINED' || s == 'CANCELLED';
    final color = ok
        ? PWColors.tealDark
        : bad
            ? PWColors.destructive
            : PWColors.goldDark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            ok
                ? Icons.check_circle
                : bad
                    ? Icons.cancel
                    : Icons.hourglass_top,
            size: 12,
            color: color,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: Theme.of(context)
                .textTheme
                .labelSmall
                ?.copyWith(color: color, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

/// The Events Lead → Vice Chair → Chair pipeline indicator.
class _ChainRow extends StatelessWidget {
  const _ChainRow({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final stageIndex = switch (status) {
      'PENDING_DISPATCH' || 'PENDING_STAKEHOLDERS' => 0,
      'PENDING_VICE_CHAIR' => 1,
      'PENDING_CHAIR' => 2,
      'APPROVED' => 3,
      _ => -1,
    };
    const labels = ['Events Lead', 'Vice Chair', 'Chairperson'];
    return Row(
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          if (i > 0)
            Container(
              width: 16,
              height: 2,
              color: stageIndex > i - 1 && stageIndex >= i
                  ? PWColors.teal
                  : PWColors.clay100,
            ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: stageIndex > i
                  ? PWColors.teal.withValues(alpha: 0.12)
                  : stageIndex == i
                      ? PWColors.gold.withValues(alpha: 0.18)
                      : PWColors.clay50,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: stageIndex > i
                    ? PWColors.teal.withValues(alpha: 0.4)
                    : stageIndex == i
                        ? PWColors.gold
                        : PWColors.clay100,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (stageIndex > i)
                  const Padding(
                    padding: EdgeInsets.only(right: 3),
                    child:
                        Icon(Icons.check, size: 11, color: PWColors.tealDark),
                  ),
                Text(
                  labels[i],
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        fontSize: 10,
                        color: stageIndex >= i
                            ? PWColors.clay700
                            : PWColors.clay300,
                        fontWeight: stageIndex == i
                            ? FontWeight.w700
                            : FontWeight.w500,
                      ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _SmallAction extends StatelessWidget {
  const _SmallAction({
    required this.icon,
    required this.tooltip,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Icon(icon, size: 18, color: color),
        ),
      ),
    );
  }
}
