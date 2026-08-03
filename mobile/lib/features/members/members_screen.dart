import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/access/access_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/enums.dart';
import '../../data/models/user.dart';
import '../../data/repositories/member_repository.dart';

/// The member roll — search, filter by role or department, and open anyone.
/// Mirrors `/manage/members`.
class MembersScreen extends ConsumerStatefulWidget {
  const MembersScreen({super.key});

  @override
  ConsumerState<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends ConsumerState<MembersScreen> {
  final _search = TextEditingController();
  UserRole? _role;
  String? _departmentId;
  bool _hideInactive = true;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final access = ref.watch(accessProvider);
    final async = ref.watch(membersProvider);
    final departments = ref.watch(departmentsProvider).valueOrNull ?? const [];

    if (!access.canView('members')) {
      return const AppScaffold(title: 'Members', body: NoAccessView());
    }

    final canAdd = access.canEdit('members');

    return AppScaffold(
      title: 'Members',
      subtitle: 'The roll, and who does what',
      floatingActionButton: canAdd
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/manage/members/new'),
              icon: const Icon(AppIcons.userPlus, size: 19),
              label: const Text('Add member'),
            )
          : null,
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: '$e'),
        data: (all) {
          final query = _search.text.trim().toLowerCase();
          final shown = all.where((m) {
            if (_hideInactive && !m.isActive) return false;
            if (_role != null && m.role != _role) return false;
            if (_departmentId != null &&
                !m.departmentIds.contains(_departmentId)) {
              return false;
            }
            if (query.isEmpty) return true;
            return m.name.toLowerCase().contains(query) ||
                m.email.toLowerCase().contains(query) ||
                (m.phone ?? '').contains(query);
          }).toList();

          final filtering = query.isNotEmpty ||
              _role != null ||
              _departmentId != null ||
              !_hideInactive;

          return Column(
            children: [
              AppTextField(
                label: '',
                controller: _search,
                hint: 'Search by name, email or phone',
                prefixIcon: AppIcons.search,
                textCapitalization: TextCapitalization.none,
                onChanged: (_) => setState(() {}),
                suffix: _search.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(AppIcons.close, size: 16),
                        color: AppColors.clay400,
                        onPressed: () => setState(_search.clear),
                      ),
              ),
              const SizedBox(height: 10),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _Chip(
                      label: _role?.label ?? 'Any role',
                      active: _role != null,
                      onTap: () => _pickRole(context),
                    ),
                    _Chip(
                      label: _departmentId == null
                          ? 'Any department'
                          : departments
                              .firstWhere((d) => d.id == _departmentId,
                                  orElse: () => departments.first)
                              .name,
                      active: _departmentId != null,
                      onTap: () => _pickDepartment(context, departments),
                    ),
                    _Chip(
                      label: _hideInactive ? 'Active only' : 'Including inactive',
                      active: !_hideInactive,
                      onTap: () =>
                          setState(() => _hideInactive = !_hideInactive),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(AppIcons.users, size: 14,
                      color: AppColors.clay400),
                  const SizedBox(width: 6),
                  Text(
                    '${shown.length} member${shown.length == 1 ? '' : 's'} '
                    '${filtering ? 'found' : 'total'}',
                    style: const TextStyle(
                        fontSize: 12.5, color: AppColors.clay400),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Expanded(
                child: shown.isEmpty
                    ? const EmptyStateLux(
                        icon: AppIcons.users,
                        tone: IconTone.periwinkle,
                        title: 'Nobody matches',
                        description: 'Try a different name, role or '
                            'department.',
                      )
                    : ListView.separated(
                        padding: EdgeInsets.zero,
                        itemCount: shown.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) => _MemberRow(
                          member: shown[i],
                          departments: departments,
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _pickRole(BuildContext context) async {
    final picked = await showModalBottomSheet<Object?>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 18, 20, 4),
              child: SectionHeading(title: 'Filter by role',
                  icon: AppIcons.shield),
            ),
            LuxTile(
              title: 'Any role',
              dense: true,
              onTap: () => Navigator.of(context).pop('any'),
            ),
            for (final role in UserRole.values)
              LuxTile(
                title: role.label,
                dense: true,
                onTap: () => Navigator.of(context).pop(role),
              ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
    if (picked == null) return;
    setState(() => _role = picked is UserRole ? picked : null);
  }

  Future<void> _pickDepartment(
    BuildContext context,
    List<Department> departments,
  ) async {
    final picked = await showModalBottomSheet<Object?>(
      context: context,
      isScrollControlled: true,
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        builder: (context, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(0, 14, 0, 24),
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 0, 20, 4),
              child: SectionHeading(
                  title: 'Filter by department', icon: AppIcons.department),
            ),
            LuxTile(
              title: 'Any department',
              dense: true,
              onTap: () => Navigator.of(context).pop('any'),
            ),
            for (final dept in departments)
              LuxTile(
                title: dept.name,
                dense: true,
                onTap: () => Navigator.of(context).pop(dept.id),
              ),
          ],
        ),
      ),
    );
    if (picked == null) return;
    setState(() => _departmentId = picked == 'any' ? null : picked as String);
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
          decoration: BoxDecoration(
            color: active ? AppColors.clay700 : AppColors.cream,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
                color: active ? AppColors.clay700 : AppColors.clay200),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: active ? Colors.white : AppColors.clay500,
                ),
              ),
              const SizedBox(width: 4),
              Icon(AppIcons.chevronDown,
                  size: 13,
                  color: active ? Colors.white : AppColors.clay400),
            ],
          ),
        ),
      ),
    );
  }
}

class _MemberRow extends StatelessWidget {
  const _MemberRow({required this.member, required this.departments});

  final AppUser member;
  final List<Department> departments;

  @override
  Widget build(BuildContext context) {
    final names = [
      for (final id in member.departmentIds)
        for (final d in departments)
          if (d.id == id) d.name,
    ];

    return LuxCard(
      onTap: () => context.push('/manage/members/${member.id}'),
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MemberAvatar(
            initials: member.initials,
            imageUrl: member.profileImage,
            size: 40,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        member.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                          color: member.isActive
                              ? AppColors.clay700
                              : AppColors.clay400,
                        ),
                      ),
                    ),
                    if (!member.isActive) ...[
                      const SizedBox(width: 7),
                      const StatusBadge('Inactive',
                          tone: IconTone.clay, dense: true),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  member.email,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.clay400),
                ),
                const SizedBox(height: 7),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    StatusBadge(member.role.label,
                        tone: _roleTone(member.role), dense: true),
                    for (final name in names.take(2))
                      StatusBadge(name, tone: IconTone.clay, dense: true),
                    if (names.length > 2)
                      StatusBadge('+${names.length - 2}',
                          tone: IconTone.clay, dense: true),
                  ],
                ),
              ],
            ),
          ),
          const Icon(AppIcons.chevronRight, size: 17,
              color: AppColors.clay300),
        ],
      ),
    );
  }

  static IconTone _roleTone(UserRole role) => switch (role) {
        UserRole.superAdmin => IconTone.gold,
        UserRole.viceChairperson => IconTone.lavender,
        UserRole.admin => IconTone.periwinkle,
        UserRole.departmentLead => IconTone.teal,
        UserRole.youthLeader => IconTone.sage,
        UserRole.member => IconTone.clay,
      };
}
