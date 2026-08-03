import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/enums.dart';
import '../../data/models/requests.dart';
import '../../data/models/user.dart';
import '../../data/repositories/request_repository.dart';
import '../requests/department_requests_screen.dart'
    show departmentJoinRequestsProvider;

const _liveStatuses = <DepartmentJoinRequestStatus>{
  DepartmentJoinRequestStatus.pendingManager,
  DepartmentJoinRequestStatus.pendingChair,
};

/// Join a Department — a member asks, the department Manager recommends, and
/// the Chairperson approves. Mirrors `/department/join`.
class JoinDepartmentScreen extends ConsumerWidget {
  const JoinDepartmentScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(userOrNullProvider);
    final departments = ref.watch(departmentsProvider).valueOrNull ?? const [];
    final async = ref.watch(departmentJoinRequestsProvider);

    return DetailScaffold(
      title: 'Join a Department',
      subtitle: 'Your Manager recommends, the Chairperson approves',
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: '$e'),
        data: (all) {
          // The rules return a lead the whole collection; this screen is only
          // ever about the person reading it.
          final mine =
              all.where((r) => me != null && r.userId == me.id).toList();
          final live = mine.where((r) => _liveStatuses.contains(r.status));
          final past = mine.where((r) => !_liveStatuses.contains(r.status));

          final blocked = {
            ...?me?.departmentIds,
            for (final r in live) r.departmentId,
          };
          final joinable =
              departments.where((d) => !blocked.contains(d.id)).toList();

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              if (mine.isNotEmpty) ...[
                const SectionHeading(
                  title: 'Your requests',
                  icon: AppIcons.clock,
                  subtitle: 'Where each one is in the chain.',
                ),
                const SizedBox(height: 12),
                for (final request in [...live, ...past])
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _RequestCard(request: request),
                  ),
                const SizedBox(height: 20),
              ],

              const SectionHeading(
                title: 'Departments you can join',
                icon: AppIcons.department,
                tone: IconTone.lavender,
              ),
              const SizedBox(height: 12),
              if (joinable.isEmpty)
                const EmptyStateLux(
                  icon: AppIcons.department,
                  tone: IconTone.lavender,
                  title: 'Nothing to join right now',
                  description: "You're already in every department, or you "
                      'have a request pending for the rest.',
                )
              else
                for (final dept in joinable)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: LuxTile(
                      title: dept.name,
                      subtitle: dept.description,
                      icon: AppIcons.department,
                      tone: IconTone.lavender,
                      onTap: () => _ask(context, ref, dept),
                      trailing: const Icon(AppIcons.plus,
                          size: 18, color: AppColors.clay400),
                    ),
                  ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _ask(
    BuildContext context,
    WidgetRef ref,
    Department dept,
  ) async {
    final message = await promptForText(
      context,
      title: 'Ask to join ${dept.name}',
      hint: 'Why would you like to join? (optional)',
      confirmLabel: 'Send request',
    );
    if (message == null) return;

    try {
      await ref.read(requestRepositoryProvider).requestToJoin(
            departmentId: dept.id,
            message: message,
          );
      if (context.mounted) {
        context.showSuccess(
            'Sent. The ${dept.name} Manager sees it first.');
      }
    } on ApiException catch (e) {
      if (context.mounted) context.showError(e.message);
    }
  }
}

class _RequestCard extends ConsumerStatefulWidget {
  const _RequestCard({required this.request});

  final DepartmentJoinRequest request;

  @override
  ConsumerState<_RequestCard> createState() => _RequestCardState();
}

class _RequestCardState extends ConsumerState<_RequestCard> {
  bool _busy = false;

  Future<void> _cancel() async {
    final ok = await confirmAction(
      context,
      title: 'Cancel this request?',
      message: 'Your request to join ${widget.request.departmentName} is '
          'withdrawn. You can ask again later.',
      confirmLabel: 'Cancel it',
      destructive: true,
    );
    if (!ok) return;

    setState(() => _busy = true);
    try {
      await ref
          .read(requestRepositoryProvider)
          .decideJoinRequest(widget.request.id, action: 'CANCEL');
      if (mounted) context.showSuccess('Cancelled.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final request = widget.request;
    final note = request.chairComments ?? request.managerComments;
    final canCancel = _liveStatuses.contains(request.status);

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
                      request.departmentName,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.clay700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Requested ${D.medium(request.createdAt)}',
                      style: const TextStyle(
                          fontSize: 11.5, color: AppColors.clay400),
                    ),
                  ],
                ),
              ),
              StatusBadge.forStatus(request.status.wire,
                  label: request.status.label, dense: true),
            ],
          ),
          const SizedBox(height: 12),
          _JoinPipeline(status: request.status),
          if ((note ?? '').isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              '“$note”',
              style: const TextStyle(
                fontSize: 12.5,
                height: 1.5,
                fontStyle: FontStyle.italic,
                color: AppColors.clay500,
              ),
            ),
          ],
          if (canCancel) ...[
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: PrimaryButton(
                label: 'Cancel',
                expand: false,
                destructive: true,
                loading: _busy,
                onPressed: _cancel,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Asked → Manager → Chairperson, drawn as three beats.
class _JoinPipeline extends StatelessWidget {
  const _JoinPipeline({required this.status});

  final DepartmentJoinRequestStatus status;

  @override
  Widget build(BuildContext context) {
    final rejected = status == DepartmentJoinRequestStatus.rejected;
    final cancelled = status == DepartmentJoinRequestStatus.cancelled;
    final approved = status == DepartmentJoinRequestStatus.approved;

    final steps = <(String, Widget)>[
      ('Asked', _done()),
      (
        rejected
            ? 'Turned down'
            : status == DepartmentJoinRequestStatus.pendingManager
                ? 'With the Manager'
                : 'Manager recommended',
        rejected
            ? _bad()
            : status == DepartmentJoinRequestStatus.pendingManager
                ? _waiting()
                : cancelled
                    ? _idle()
                    : _done(),
      ),
      (
        approved
            ? "You're in"
            : status == DepartmentJoinRequestStatus.pendingChair
                ? 'With the Chairperson'
                : 'Chairperson',
        approved
            ? _done()
            : status == DepartmentJoinRequestStatus.pendingChair
                ? _waiting()
                : _idle(),
      ),
    ];

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              steps[i].$2,
              const SizedBox(width: 5),
              Text(
                steps[i].$1,
                style: const TextStyle(
                    fontSize: 11.5, color: AppColors.clay600),
              ),
            ],
          ),
          if (i < steps.length - 1)
            Container(width: 18, height: 1, color: AppColors.clay200),
        ],
      ],
    );
  }

  static Widget _done() =>
      const Icon(AppIcons.checkCircle, size: 15, color: AppColors.emerald600);
  static Widget _waiting() =>
      const Icon(AppIcons.clock, size: 15, color: AppColors.goldDark);
  static Widget _bad() =>
      const Icon(AppIcons.xCircle, size: 15, color: AppColors.destructive);
  static Widget _idle() => Container(
        width: 7,
        height: 7,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        decoration: const BoxDecoration(
          color: AppColors.clay300,
          shape: BoxShape.circle,
        ),
      );
}
