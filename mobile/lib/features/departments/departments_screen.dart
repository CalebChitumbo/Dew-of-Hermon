import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/user.dart';
import '../../data/repositories/request_repository.dart';
import '../services/service_detail_screen.dart' show activeMembersProvider;

/// Every department, with how many people are in it and who leads it.
class DepartmentsScreen extends ConsumerWidget {
  const DepartmentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final departments = ref.watch(departmentsProvider);
    final members = ref.watch(activeMembersProvider).valueOrNull ?? const [];
    final user = ref.watch(userOrNullProvider);

    return AppScaffold(
      title: 'Departments',
      onRefresh: () async => ref.invalidate(departmentsProvider),
      body: departments.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(departmentsProvider),
        ),
        data: (list) {
          if (list.isEmpty) {
            return const EmptyStateLux(
              icon: AppIcons.department,
              tone: IconTone.sage,
              title: 'No departments yet',
              description: 'Departments are set up once and then reused '
                  'everywhere — rotas, event roles, permissions.',
            );
          }

          final mine =
              list.where((d) => user?.belongsTo(d.id) ?? false).toList();

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              if (mine.isNotEmpty) ...[
                const SectionHeading(
                  title: 'Yours',
                  icon: AppIcons.heart,
                  tone: IconTone.gold,
                ),
                const SizedBox(height: 12),
                for (final d in mine)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _DepartmentCard(
                      name: d.name,
                      description: d.description,
                      icon: AppIcons.forName(d.icon),
                      memberCount:
                          members.where((m) => m.belongsTo(d.id)).length,
                      leadNames: members
                          .where((m) => m.leads(d.id))
                          .map((m) => m.name)
                          .toList(),
                      youLead: user?.leads(d.id) ?? false,
                      onTap: () => context.push('/departments/${d.id}'),
                    ),
                  ),
                const SizedBox(height: 22),
              ],

              SectionHeading(
                title: mine.isEmpty ? 'All departments' : 'Everything else',
                icon: AppIcons.department,
                tone: IconTone.periwinkle,
                subtitle: '${list.length} in total',
              ),
              const SizedBox(height: 12),
              for (final d in list)
                if (!(user?.belongsTo(d.id) ?? false))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _DepartmentCard(
                      name: d.name,
                      description: d.description,
                      icon: AppIcons.forName(d.icon),
                      memberCount:
                          members.where((m) => m.belongsTo(d.id)).length,
                      leadNames: members
                          .where((m) => m.leads(d.id))
                          .map((m) => m.name)
                          .toList(),
                      onTap: () => context.push('/departments/${d.id}'),
                      onJoin: () => _requestToJoin(context, ref, d.id, d.name),
                    ),
                  ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _requestToJoin(
    BuildContext context,
    WidgetRef ref,
    String departmentId,
    String name,
  ) async {
    final message = await promptForText(
      context,
      title: 'Ask to join $name?',
      hint: "Why you'd like to join (optional)",
      confirmLabel: 'Send request',
    );
    if (message == null) return;

    try {
      await ref.read(requestRepositoryProvider).requestToJoin(
            departmentId: departmentId,
            message: message,
          );
      if (context.mounted) {
        context.showSuccess(
          'Sent. The department Manager sees it first, then the Chairperson.',
        );
      }
    } on ApiException catch (e) {
      if (context.mounted) context.showError(e.message);
    }
  }
}

class _DepartmentCard extends StatelessWidget {
  const _DepartmentCard({
    required this.name,
    required this.icon,
    required this.memberCount,
    required this.leadNames,
    required this.onTap,
    this.description,
    this.youLead = false,
    this.onJoin,
  });

  final String name;
  final String? description;
  final IconData icon;
  final int memberCount;
  final List<String> leadNames;
  final VoidCallback onTap;
  final bool youLead;
  final VoidCallback? onJoin;

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconChip(icon,
                  tone: youLead ? IconTone.gold : IconTone.sage, size: 44),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      name,
                      style: AppFonts.display(const TextStyle(
                        fontSize: 17,
                        height: 1.2,
                        color: AppColors.clay700,
                      )),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      [
                        '$memberCount ${memberCount == 1 ? 'member' : 'members'}',
                        if (leadNames.isNotEmpty)
                          'led by ${leadNames.join(', ')}',
                      ].join(' · '),
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.clay400),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              if (youLead)
                const StatusBadge('You lead',
                    tone: IconTone.gold, dense: true),
            ],
          ),
          if (description != null && description!.isNotEmpty) ...[
            const SizedBox(height: 11),
            Text(
              description!,
              style: const TextStyle(
                  fontSize: 13, height: 1.45, color: AppColors.clay500),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (onJoin != null) ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onJoin,
              icon: const Icon(AppIcons.userPlus, size: 15),
              label: const Text('Ask to join'),
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40)),
            ),
          ],
        ],
      ),
    );
  }
}

/// A member's own department: the board, and who else is on the team.
class MyDepartmentScreen extends ConsumerWidget {
  const MyDepartmentScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(userOrNullProvider);
    final departments = ref.watch(departmentsProvider).valueOrNull ?? const [];

    if (user == null) {
      return const AppScaffold(title: 'My department', body: LoadingView());
    }

    final mine =
        departments.where((d) => user.belongsTo(d.id)).toList();

    if (mine.isEmpty) {
      return AppScaffold(
        title: 'My department',
        body: EmptyStateLux(
          icon: AppIcons.department,
          tone: IconTone.sage,
          title: 'You are not in a department yet',
          description: 'Departments are how the ministry organises its work — '
              'rotas, event roles, and who is asked to do what.',
          action: PrimaryButton(
            label: 'Ask to join one',
            expand: false,
            icon: AppIcons.userPlus,
            onPressed: () => context.push('/department/join'),
          ),
        ),
      );
    }

    // One department is the common case, and going straight to its board
    // saves a pointless tap. Several gets a picker.
    if (mine.length == 1) {
      // Replace rather than push, so Back does not bounce through a screen
      // the person never chose to be on.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) {
          context.pushReplacement('/departments/${mine.first.id}');
        }
      });
      return const AppScaffold(title: 'My department', body: LoadingView());
    }

    return AppScaffold(
      title: 'My departments',
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          for (final d in mine)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: LuxCard(
                onTap: () => context.push('/departments/${d.id}'),
                child: Row(
                  children: [
                    IconChip(AppIcons.forName(d.icon),
                        tone: user.leads(d.id)
                            ? IconTone.gold
                            : IconTone.sage),
                    const SizedBox(width: 13),
                    Expanded(
                      child: Text(
                        d.name,
                        style: AppFonts.display(const TextStyle(
                            fontSize: 17, color: AppColors.clay700)),
                      ),
                    ),
                    if (user.leads(d.id))
                      const StatusBadge('You lead',
                          tone: IconTone.gold, dense: true),
                    const SizedBox(width: 6),
                    const Icon(AppIcons.chevronRight,
                        size: 17, color: AppColors.clay300),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 14),
          LuxTile(
            title: 'Join another department',
            subtitle: 'Your Manager recommends, the Chairperson approves',
            icon: AppIcons.userPlus,
            tone: IconTone.lavender,
            dense: true,
            onTap: () => context.push('/department/join'),
          ),
          if (mine.any((d) => user.leads(d.id))) ...[
            const SizedBox(height: 8),
            LuxTile(
              title: 'Recommend a member',
              subtitle: 'Put someone forward for a service role',
              icon: AppIcons.star,
              tone: IconTone.gold,
              dense: true,
              onTap: () => context.push('/department/recommend'),
            ),
          ],
        ],
      ),
    );
  }
}

/// A tile listing one team member, reused across the ministry screens.
class MemberTile extends StatelessWidget {
  const MemberTile({
    super.key,
    required this.member,
    this.isLead = false,
    this.onTap,
    this.trailing,
  });

  final AppUser member;
  final bool isLead;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return LuxTile(
      title: member.name,
      subtitle: isLead ? 'Lead · ${member.role.label}' : member.role.label,
      leading: MemberAvatar(
        initials: member.initials,
        imageUrl: member.profileImage,
        size: 38,
      ),
      dense: true,
      trailing: trailing ??
          (isLead
              ? const StatusBadge('Lead', tone: IconTone.gold, dense: true)
              : null),
      onTap: onTap,
    );
  }
}
