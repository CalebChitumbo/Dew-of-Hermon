import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
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
import '../../data/models/enums.dart';
import '../../data/models/requests.dart';
import '../../data/repositories/request_repository.dart';

final departmentJoinRequestsProvider =
    FutureProvider<List<DepartmentJoinRequest>>((ref) {
  return ref.watch(requestRepositoryProvider).departmentJoinRequests();
});

/// Members asking to join a department. Two sign-offs: the department Manager
/// recommends, then the Chairperson approves — and only that final approval
/// actually adds the member.
class DepartmentRequestsScreen extends ConsumerStatefulWidget {
  const DepartmentRequestsScreen({super.key});

  @override
  ConsumerState<DepartmentRequestsScreen> createState() =>
      _DepartmentRequestsScreenState();
}

class _DepartmentRequestsScreenState
    extends ConsumerState<DepartmentRequestsScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(departmentJoinRequestsProvider);
    final user = ref.watch(userOrNullProvider);
    final isChair = ref.watch(accessProvider).role == UserRole.superAdmin;

    return AppScaffold(
      title: 'Join requests',
      onRefresh: () async => ref.invalidate(departmentJoinRequestsProvider),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(departmentJoinRequestsProvider),
        ),
        data: (requests) {
          // A lead should see what is on their desk, not the whole pipeline.
          final mine = requests.where((r) {
            if (r.awaitingChair) return isChair;
            if (r.awaitingManager) {
              return user?.leads(r.departmentId) ?? false;
            }
            return false;
          }).toList();

          final settled = requests
              .where((r) => !r.awaitingManager && !r.awaitingChair)
              .toList();
          final shown = switch (_tab) {
            0 => mine,
            1 => requests
                .where((r) => r.awaitingManager || r.awaitingChair)
                .toList(),
            _ => settled,
          };

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              SegmentedTabs(
                tabs: const ['Yours', 'All waiting', 'Settled'],
                selected: _tab,
                counts: {0: mine.length},
                onSelect: (i) => setState(() => _tab = i),
              ),
              const SizedBox(height: 18),
              if (shown.isEmpty)
                EmptyStateLux(
                  icon: AppIcons.userPlus,
                  tone: IconTone.sage,
                  title: switch (_tab) {
                    0 => 'Nothing needs you',
                    1 => 'Nothing waiting',
                    _ => 'Nothing settled yet',
                  },
                  description: switch (_tab) {
                    0 => 'Requests to join a department you lead appear here.',
                    1 => 'When a member asks to join a department, it lands '
                        'with that department\'s Manager first.',
                    _ => 'Approved and declined requests are kept here.',
                  },
                )
              else
                for (final request in shown)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _JoinRequestCard(request: request),
                  ),
            ],
          );
        },
      ),
    );
  }
}

class _JoinRequestCard extends ConsumerStatefulWidget {
  const _JoinRequestCard({required this.request});

  final DepartmentJoinRequest request;

  @override
  ConsumerState<_JoinRequestCard> createState() => _JoinRequestCardState();
}

class _JoinRequestCardState extends ConsumerState<_JoinRequestCard> {
  bool _busy = false;

  Future<void> _decide(String action) async {
    final r = widget.request;
    String? comments;

    if (action == 'DECLINE' || action == 'REJECT') {
      comments = await promptForText(
        context,
        title: 'Turn down ${r.userName}?',
        hint: 'A short reason — they see this',
        confirmLabel: 'Turn down',
        required: true,
      );
      if (comments == null || comments.isEmpty) return;
    } else {
      final isFinal = action == 'APPROVE';
      final ok = await confirmAction(
        context,
        title: isFinal
            ? 'Add ${r.userName} to ${r.departmentName}?'
            : 'Recommend ${r.userName}?',
        message: isFinal
            ? 'This adds them to the department straight away.'
            : 'This passes the request to the Chairperson for final approval.',
        confirmLabel: isFinal ? 'Approve' : 'Recommend',
      );
      if (!ok) return;
    }

    setState(() => _busy = true);
    try {
      await ref
          .read(requestRepositoryProvider)
          .decideJoinRequest(r.id, action: action, comments: comments);
      ref.invalidate(departmentJoinRequestsProvider);
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
    final user = ref.watch(userOrNullProvider);
    final isChair = ref.watch(accessProvider).role == UserRole.superAdmin;

    final canRecommend =
        r.awaitingManager && (user?.leads(r.departmentId) ?? false);
    final canApprove = r.awaitingChair && isChair;

    return LuxCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              MemberAvatar(initials: _initials(r.userName), size: 44),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      r.userName,
                      style: AppFonts.display(const TextStyle(
                        fontSize: 17,
                        height: 1.2,
                        color: AppColors.clay700,
                      )),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'wants to join ${r.departmentName}',
                      style: const TextStyle(
                          fontSize: 12.5, color: AppColors.clay400),
                    ),
                  ],
                ),
              ),
              StatusBadge(r.status.label,
                  tone: switch (r.status) {
                    DepartmentJoinRequestStatus.approved => IconTone.emerald,
                    DepartmentJoinRequestStatus.rejected => IconTone.rose,
                    DepartmentJoinRequestStatus.cancelled => IconTone.clay,
                    _ => IconTone.amber,
                  },
                  dense: true),
            ],
          ),

          if ((r.message ?? '').isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.cream,
                borderRadius: BorderRadius.circular(AppRadius.card),
              ),
              child: Text(
                '"${r.message}"',
                style: const TextStyle(
                  fontSize: 13,
                  height: 1.5,
                  fontStyle: FontStyle.italic,
                  color: AppColors.clay600,
                ),
              ),
            ),
          ],

          const SizedBox(height: 12),
          Text(
            'Asked ${D.relative(r.createdAt)}'
            '${r.managerName == null ? '' : ' · recommended by ${r.managerName}'}',
            style: const TextStyle(fontSize: 11.5, color: AppColors.clay400),
          ),

          if ((r.managerComments ?? '').isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'Manager: ${r.managerComments}',
              style: const TextStyle(
                  fontSize: 12, height: 1.4, color: AppColors.clay500),
            ),
          ],
          if ((r.chairComments ?? '').isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'Chairperson: ${r.chairComments}',
              style: const TextStyle(
                  fontSize: 12, height: 1.4, color: AppColors.clay500),
            ),
          ],

          if (canRecommend || canApprove) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy
                        ? null
                        : () => _decide(canApprove ? 'REJECT' : 'DECLINE'),
                    icon: const Icon(AppIcons.xCircle, size: 15),
                    label: const Text('Turn down'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.destructive,
                      side: BorderSide(
                          color:
                              AppColors.destructive.withValues(alpha: 0.3)),
                      minimumSize: const Size(0, 44),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: PrimaryButton(
                    label: canApprove ? 'Approve' : 'Recommend',
                    icon: AppIcons.check,
                    loading: _busy,
                    onPressed: () =>
                        _decide(canApprove ? 'APPROVE' : 'RECOMMEND'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  static String _initials(String name) {
    final parts =
        name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }
}
