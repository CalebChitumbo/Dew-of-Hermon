import 'dart:async';

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
import '../../core/utils/dates.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/firestore/streams.dart';
import '../../data/models/enums.dart';
import '../../data/models/event.dart';
import '../../data/models/user.dart';
import '../../data/repositories/service_repository.dart';
import 'services_screen.dart';

/// The rota for one service, live.
final serviceAssignmentsProvider =
    StreamProvider.family<List<ServiceAssignment>, String>((ref, serviceId) {
  return collectionStream(
    db
        .collection('serviceAssignments')
        .where('serviceId', isEqualTo: serviceId),
    ServiceAssignment.fromMap,
    sort: (a, b) => a.roleName.compareTo(b.roleName),
  ).handleError((_) => <ServiceAssignment>[]);
});

final serviceProvider =
    StreamProvider.family<Service?, String>((ref, serviceId) {
  return documentStream(
    db.collection('services').doc(serviceId),
    Service.fromMap,
  ).handleError((_) => null);
});

/// Every role that can be filled on a service, grouped by department.
final serviceRolesProvider = StreamProvider<List<ServiceRole>>((ref) {
  return collectionStream(
    db.collection('serviceRoles'),
    ServiceRole.fromMap,
    sort: (a, b) {
      final byOrder = a.order.compareTo(b.order);
      return byOrder != 0 ? byOrder : a.name.compareTo(b.name);
    },
  ).handleError((_) => <ServiceRole>[]);
});

/// All active members, for the assignment picker.
final activeMembersProvider = StreamProvider<List<AppUser>>((ref) {
  return collectionStream(
    db.collection('users').where('isActive', isEqualTo: true),
    AppUser.fromMap,
    sort: (a, b) => a.name.compareTo(b.name),
  ).handleError((_) => <AppUser>[]);
});

/// The rota: who is doing what this Sunday, and what is still unfilled.
class ServiceDetailScreen extends ConsumerWidget {
  const ServiceDetailScreen({super.key, required this.serviceId});

  final String serviceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final blocked = servicesGuard(ref, 'Rota');
    if (blocked != null) return blocked;

    final access = ref.watch(accessProvider);
    final service = ref.watch(serviceProvider(serviceId)).valueOrNull;
    final assignmentsAsync = ref.watch(serviceAssignmentsProvider(serviceId));
    final roles = ref.watch(serviceRolesProvider).valueOrNull ?? const [];
    final departments = ref.watch(departmentsProvider).valueOrNull ?? const [];
    final canEdit = access.canEdit('services') || access.can('create_service');

    return DetailScaffold(
      title: service?.theme?.isNotEmpty == true
          ? service!.theme!
          : "Potter's Wheel rota",
      subtitle: service?.serviceTime,
      actions: [
        if (canEdit)
          IconButton(
            icon: const Icon(AppIcons.send),
            tooltip: 'Remind everyone',
            onPressed: () => _remind(context, ref),
          ),
        IconButton(
          icon: const Icon(AppIcons.listTodo),
          tooltip: 'Checklist',
          onPressed: () =>
              context.push('/manage/services/$serviceId/checklist'),
        ),
      ],
      body: assignmentsAsync.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: '$e'),
        data: (assignments) {
          final byRoleId = {for (final a in assignments) a.roleId: a};
          final confirmed = assignments
              .where((a) => a.status == AssignmentStatus.confirmed)
              .length;
          final declined = assignments
              .where((a) => a.status == AssignmentStatus.declined)
              .toList();

          // Group roles by department so the rota reads the way the church
          // is organised, not alphabetically.
          final deptNames = {for (final d in departments) d.id: d.name};
          final grouped = <String, List<ServiceRole>>{};
          for (final role in roles) {
            grouped
                .putIfAbsent(deptNames[role.departmentId] ?? 'Other', () => [])
                .add(role);
          }
          final groupNames = grouped.keys.toList()..sort();

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              StatStripLux(items: [
                StripItem(
                  icon: AppIcons.users,
                  tone: IconTone.gold,
                  label: 'Assigned',
                  value: '${assignments.length}',
                  hint: '${roles.length} roles in total',
                ),
                StripItem(
                  icon: AppIcons.checkCircle,
                  tone: IconTone.emerald,
                  label: 'Confirmed',
                  value: '$confirmed',
                ),
              ]),
              const SizedBox(height: 18),

              if (declined.isNotEmpty) ...[
                NoticeCard(
                  tone: IconTone.rose,
                  icon: AppIcons.alert,
                  title: declined.length == 1
                      ? '1 person cannot make it'
                      : '${declined.length} people cannot make it',
                  message: declined
                      .map((a) => '${a.userName} (${a.roleName})')
                      .join(', '),
                ),
                const SizedBox(height: 18),
              ],

              for (final group in groupNames) ...[
                SectionHeading(
                  title: group,
                  icon: AppIcons.department,
                  tone: IconTone.sage,
                  subtitle:
                      '${grouped[group]!.where((r) => byRoleId.containsKey(r.id)).length}'
                      ' of ${grouped[group]!.length} filled',
                ),
                const SizedBox(height: 12),
                LuxCard(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    children: [
                      for (var i = 0; i < grouped[group]!.length; i++) ...[
                        if (i > 0) const LuxDivider(),
                        _RoleRow(
                          serviceId: serviceId,
                          role: grouped[group]![i],
                          assignment: byRoleId[grouped[group]![i].id],
                          canEdit: canEdit,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              if (roles.isEmpty)
                const EmptyStateLux(
                  icon: AppIcons.clipboard,
                  tone: IconTone.clay,
                  title: 'No roles configured',
                  description: 'Service roles are set up once, in Settings, '
                      'and then reused every Sunday.',
                ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _remind(BuildContext context, WidgetRef ref) async {
    final ok = await confirmAction(
      context,
      title: 'Remind everyone?',
      message: 'Sends a reminder email to everyone on this rota who has not '
          'yet confirmed.',
      confirmLabel: 'Send reminders',
    );
    if (!ok) return;
    try {
      await ref.read(serviceRepositoryProvider).remind(serviceId);
      if (context.mounted) context.showSuccess('Reminders sent.');
    } on ApiException catch (e) {
      if (context.mounted) context.showError(e.message);
    }
  }
}

class _RoleRow extends ConsumerStatefulWidget {
  const _RoleRow({
    required this.serviceId,
    required this.role,
    required this.assignment,
    required this.canEdit,
  });

  final String serviceId;
  final ServiceRole role;
  final ServiceAssignment? assignment;
  final bool canEdit;

  @override
  ConsumerState<_RoleRow> createState() => _RoleRowState();
}

class _RoleRowState extends ConsumerState<_RoleRow> {
  bool _busy = false;

  Future<void> _assign() async {
    final members = ref.read(activeMembersProvider).valueOrNull ?? const [];
    if (members.isEmpty) {
      context.showInfo('No active members to assign.');
      return;
    }

    final chosen = await showModalBottomSheet<AppUser>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _MemberPicker(
        members: members,
        roleName: widget.role.name,
      ),
    );
    if (chosen == null) return;

    setState(() => _busy = true);
    try {
      await ref.read(serviceRepositoryProvider).assign(
            serviceId: widget.serviceId,
            roleId: widget.role.id,
            userId: chosen.id,
          );
      if (mounted) {
        context.showSuccess('${chosen.firstName} assigned as '
            '${widget.role.name}.');
      }
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove() async {
    final assignment = widget.assignment;
    if (assignment == null) return;
    final ok = await confirmAction(
      context,
      title: 'Remove ${assignment.userName}?',
      message: 'This frees up ${widget.role.name} for someone else.',
      confirmLabel: 'Remove',
      destructive: true,
    );
    if (!ok) return;

    setState(() => _busy = true);
    try {
      await ref.read(serviceRepositoryProvider).removeAssignment(
            serviceId: widget.serviceId,
            assignmentId: assignment.id,
          );
      if (mounted) context.showSuccess('Removed.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final assignment = widget.assignment;
    final filled = assignment != null;

    return LuxTile(
      title: widget.role.name,
      subtitle: filled
          ? assignment.userName
          : widget.role.timeSlot ?? 'Not assigned',
      icon: filled ? AppIcons.checkCircle : AppIcons.user,
      tone: filled
          ? switch (assignment.status) {
              AssignmentStatus.confirmed => IconTone.emerald,
              AssignmentStatus.declined => IconTone.rose,
              _ => IconTone.amber,
            }
          : IconTone.clay,
      dense: true,
      trailing: _busy
          ? const SizedBox(
              height: 17,
              width: 17,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : filled
              ? Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    StatusBadge(assignment.status.label,
                        tone: switch (assignment.status) {
                          AssignmentStatus.confirmed => IconTone.emerald,
                          AssignmentStatus.declined => IconTone.rose,
                          _ => IconTone.amber,
                        },
                        dense: true),
                    if (widget.canEdit)
                      IconButton(
                        icon: const Icon(AppIcons.close, size: 15),
                        color: AppColors.clay300,
                        tooltip: 'Remove',
                        onPressed: _remove,
                      ),
                  ],
                )
              : widget.canEdit
                  ? TextButton(
                      onPressed: _assign,
                      style: TextButton.styleFrom(
                        minimumSize: const Size(0, 32),
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                      ),
                      child: const Text('Assign'),
                    )
                  : null,
      onTap: widget.canEdit && !filled ? _assign : null,
    );
  }
}

class _MemberPicker extends ConsumerStatefulWidget {
  const _MemberPicker({required this.members, required this.roleName});

  final List<AppUser> members;
  final String roleName;

  @override
  ConsumerState<_MemberPicker> createState() => _MemberPickerState();
}

class _MemberPickerState extends ConsumerState<_MemberPicker> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final q = _query.trim().toLowerCase();
    final shown = q.isEmpty
        ? widget.members
        : widget.members
            .where((m) => m.name.toLowerCase().contains(q))
            .toList();

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 4,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Who is doing ${widget.roleName}?',
            style: AppFonts.display(
                const TextStyle(fontSize: 20, color: AppColors.clay700)),
          ),
          const SizedBox(height: 14),
          TextField(
            autofocus: true,
            onChanged: (v) => setState(() => _query = v),
            decoration: const InputDecoration(
              hintText: 'Search members',
              prefixIcon:
                  Icon(AppIcons.search, size: 18, color: AppColors.clay300),
            ),
          ),
          const SizedBox(height: 12),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: shown.length,
              separatorBuilder: (_, __) => const LuxDivider(indent: 0),
              itemBuilder: (context, i) => LuxTile(
                title: shown[i].name,
                subtitle: shown[i].role.label,
                leading: MemberAvatar(
                  initials: shown[i].initials,
                  imageUrl: shown[i].profileImage,
                  size: 36,
                ),
                dense: true,
                onTap: () => Navigator.of(context).pop(shown[i]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The pre-service checklist — what has to be ready before Sunday.
final checklistProvider =
    StreamProvider.family<List<ChecklistItem>, String>((ref, serviceId) {
  return collectionStream(
    db.collection('checklistItems').where('serviceId', isEqualTo: serviceId),
    ChecklistItem.fromMap,
    sort: (a, b) {
      final byOrder = a.order.compareTo(b.order);
      return byOrder != 0 ? byOrder : a.task.compareTo(b.task);
    },
  ).handleError((_) => <ChecklistItem>[]);
});

class ServiceChecklistScreen extends ConsumerWidget {
  const ServiceChecklistScreen({super.key, required this.serviceId});

  final String serviceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final blocked = servicesGuard(ref, 'Service checklist');
    if (blocked != null) return blocked;

    final async = ref.watch(checklistProvider(serviceId));

    return DetailScaffold(
      title: 'Service checklist',
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: '$e'),
        data: (items) {
          if (items.isEmpty) {
            return const EmptyStateLux(
              icon: AppIcons.listTodo,
              tone: IconTone.sage,
              title: 'Nothing on the checklist',
              description: 'Checklist items are added from the web for now.',
            );
          }

          final done = items.where((i) => i.isCompleted).length;
          final byCategory = <String, List<ChecklistItem>>{};
          for (final item in items) {
            byCategory.putIfAbsent(item.category, () => []).add(item);
          }
          final categories = byCategory.keys.toList()..sort();

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              LuxCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: items.isEmpty ? 0 : done / items.length,
                        minHeight: 8,
                        backgroundColor: AppColors.clay100,
                        valueColor: const AlwaysStoppedAnimation<Color>(
                            AppColors.teal),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '$done of ${items.length} done',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.clay500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              for (final category in categories) ...[
                SectionHeading(
                  title: category,
                  icon: AppIcons.listTodo,
                  tone: IconTone.periwinkle,
                ),
                const SizedBox(height: 12),
                LuxCard(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    children: [
                      for (var i = 0; i < byCategory[category]!.length; i++) ...[
                        if (i > 0) const LuxDivider(),
                        _ChecklistRow(item: byCategory[category]![i]),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 18),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _ChecklistRow extends ConsumerStatefulWidget {
  const _ChecklistRow({required this.item});

  final ChecklistItem item;

  @override
  ConsumerState<_ChecklistRow> createState() => _ChecklistRowState();
}

class _ChecklistRowState extends ConsumerState<_ChecklistRow> {
  bool _busy = false;

  Future<void> _toggle() async {
    setState(() => _busy = true);
    try {
      // Checklist items are a per-service subcollection the rules already
      // scope to signed-in members, so this is a direct write.
      await db.collection('checklistItems').doc(widget.item.id).update({
        'isCompleted': !widget.item.isCompleted,
        'completedBy':
            widget.item.isCompleted ? null : ref.read(userOrNullProvider)?.id,
        'updatedAt': DateTime.now(),
      });
    } catch (e) {
      if (mounted) context.showError('Could not update: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    return LuxTile(
      title: item.task,
      icon: item.isCompleted ? AppIcons.checkCircle : AppIcons.listTodo,
      tone: item.isCompleted ? IconTone.emerald : IconTone.clay,
      dense: true,
      onTap: _busy ? null : _toggle,
      trailing: _busy
          ? const SizedBox(
              height: 17,
              width: 17,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Checkbox(
              value: item.isCompleted,
              onChanged: (_) => _toggle(),
            ),
    );
  }
}
