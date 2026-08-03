import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/firestore/streams.dart';
import '../../data/models/enums.dart';
import '../../data/models/user.dart';
import '../../data/repositories/member_repository.dart';

/// A rolled-up view of the ministry: who is on the roll, how the departments
/// are filled, and whether people are answering their assignments.
class MinistryReport {
  const MinistryReport({
    required this.members,
    required this.byRole,
    required this.byDepartment,
    required this.totalServices,
    required this.totalAssignments,
    required this.byAssignmentStatus,
  });

  final List<AppUser> members;
  final Map<UserRole, int> byRole;

  /// Department name → how many members are in it.
  final Map<String, int> byDepartment;

  final int totalServices;
  final int totalAssignments;
  final Map<AssignmentStatus, int> byAssignmentStatus;

  int get active => members.where((m) => m.isActive).length;
  int get inactive => members.length - active;

  int get confirmationRate {
    if (totalAssignments == 0) return 0;
    final confirmed = byAssignmentStatus[AssignmentStatus.confirmed] ?? 0;
    return ((confirmed / totalAssignments) * 100).round();
  }
}

/// The whole report in one read. Services and assignments are counted rather
/// than listed, so this stays a handful of aggregate numbers.
final ministryReportProvider = FutureProvider<MinistryReport>((ref) async {
  final members = await ref.watch(membersProvider.future);
  final departments = ref.watch(departmentsProvider).valueOrNull ?? const [];

  // A server-side count for services (nothing here needs the documents), and
  // a full read of the assignments so each status can be tallied.
  final serviceCountFuture = db.collection('services').count().get();
  final assignmentsFuture = db.collection('serviceAssignments').get();

  final serviceCount = (await serviceCountFuture).count ?? 0;
  final assignments = await assignmentsFuture;

  final byStatus = <AssignmentStatus, int>{};
  for (final doc in assignments.docs) {
    final status = AssignmentStatus.fromWire(doc.data()['status']);
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }

  final byRole = <UserRole, int>{};
  for (final member in members) {
    byRole[member.role] = (byRole[member.role] ?? 0) + 1;
  }

  final byDepartment = <String, int>{
    for (final dept in departments)
      dept.name:
          members.where((m) => m.departmentIds.contains(dept.id)).length,
  };

  return MinistryReport(
    members: members,
    byRole: byRole,
    byDepartment: byDepartment,
    totalServices: serviceCount,
    totalAssignments: assignments.docs.length,
    byAssignmentStatus: byStatus,
  );
});

/// Reports — membership and service statistics. Mirrors `/manage/reports`.
class ReportsScreen extends ConsumerWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final access = ref.watch(accessProvider);
    if (!access.role.atLeast(UserRole.admin)) {
      return const AppScaffold(
        title: 'Reports',
        body: NoAccessView(
          message: 'You do not have permission to view reports.',
        ),
      );
    }

    final async = ref.watch(ministryReportProvider);

    return AppScaffold(
      title: 'Reports',
      subtitle: 'Membership and service statistics',
      onRefresh: () async => ref.invalidate(ministryReportProvider),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(ministryReportProvider),
        ),
        data: (report) => ListView(
          padding: EdgeInsets.zero,
          children: [
            StatStripLux(
              items: [
                StripItem(
                  icon: AppIcons.users,
                  tone: IconTone.periwinkle,
                  label: 'Total members',
                  value: '${report.members.length}',
                ),
                StripItem(
                  icon: AppIcons.checkCircle,
                  tone: IconTone.emerald,
                  label: 'Active',
                  value: '${report.active}',
                ),
                StripItem(
                  icon: AppIcons.xCircle,
                  tone: IconTone.clay,
                  label: 'Inactive',
                  value: '${report.inactive}',
                ),
                StripItem(
                  icon: AppIcons.clipboardCheck,
                  tone: IconTone.gold,
                  label: 'Confirmation rate',
                  value: '${report.confirmationRate}%',
                  hint: 'of all assignments',
                  highlight: report.confirmationRate < 60,
                ),
              ],
            ),

            const SizedBox(height: 26),
            const SectionHeading(
              title: 'By role',
              icon: AppIcons.shield,
              tone: IconTone.lavender,
            ),
            const SizedBox(height: 12),
            _Bars(
              total: report.members.length,
              rows: [
                for (final role in UserRole.values)
                  if ((report.byRole[role] ?? 0) > 0)
                    (role.label, report.byRole[role]!),
              ],
              tone: IconTone.lavender,
            ),

            const SizedBox(height: 26),
            const SectionHeading(
              title: 'By department',
              icon: AppIcons.department,
              tone: IconTone.teal,
            ),
            const SizedBox(height: 12),
            if (report.byDepartment.isEmpty)
              const NoticeCard(
                icon: AppIcons.info,
                message: 'No departments yet.',
              )
            else
              _Bars(
                total: report.members.length,
                rows: [
                  for (final entry in report.byDepartment.entries)
                    (entry.key, entry.value),
                ],
                tone: IconTone.teal,
              ),

            const SizedBox(height: 26),
            const SectionHeading(
              title: 'Assignments',
              icon: AppIcons.clipboard,
              tone: IconTone.gold,
              subtitle: 'Across every service on record.',
            ),
            const SizedBox(height: 12),
            LuxCard(
              child: Column(
                children: [
                  DetailRow(
                    label: 'Services',
                    value: '${report.totalServices}',
                    icon: AppIcons.church,
                  ),
                  DetailRow(
                    label: 'Assignments',
                    value: '${report.totalAssignments}',
                    icon: AppIcons.clipboard,
                  ),
                  for (final status in AssignmentStatus.values)
                    DetailRow(
                      label: status.label,
                      value: '${report.byAssignmentStatus[status] ?? 0}',
                      icon: switch (status) {
                        AssignmentStatus.confirmed => AppIcons.checkCircle,
                        AssignmentStatus.declined => AppIcons.xCircle,
                        AssignmentStatus.noResponse => AppIcons.help,
                        AssignmentStatus.pending => AppIcons.clock,
                      },
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A labelled bar per row, sized against [total].
class _Bars extends StatelessWidget {
  const _Bars({required this.total, required this.rows, required this.tone});

  final int total;
  final List<(String, int)> rows;
  final IconTone tone;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return const NoticeCard(icon: AppIcons.info, message: 'Nothing to show.');
    }
    final colors = toneColors(tone);

    return LuxCard(
      child: Column(
        children: [
          for (final (label, count) in rows)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          label,
                          style: const TextStyle(
                              fontSize: 13, color: AppColors.clay600),
                        ),
                      ),
                      Text(
                        '$count',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: colors.foreground,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    child: LinearProgressIndicator(
                      value: total == 0 ? 0 : (count / total).clamp(0.0, 1.0),
                      minHeight: 6,
                      backgroundColor: AppColors.clay100,
                      valueColor: AlwaysStoppedAnimation(colors.foreground),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
