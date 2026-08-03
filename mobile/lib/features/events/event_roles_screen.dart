import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/firestore/streams.dart';
import '../../data/models/event.dart';
import '../../data/repositories/service_repository.dart';

final eventProvider = StreamProvider.family<AppEvent?, String>((ref, id) {
  return documentStream(
    db.collection('events').doc(id),
    AppEvent.fromMap,
  ).handleError((_) => null);
});

final eventDepartmentRolesProvider =
    StreamProvider.family<List<EventDepartmentRole>, String>((ref, eventId) {
  return collectionStream(
    db
        .collection('eventDepartmentRoles')
        .where('eventId', isEqualTo: eventId),
    EventDepartmentRole.fromMap,
    sort: (a, b) {
      final byDept = a.departmentName.compareTo(b.departmentName);
      return byDept != 0 ? byDept : a.role.compareTo(b.role);
    },
  ).handleError((_) => <EventDepartmentRole>[]);
});

/// Who is doing what on an event: the core roles the event itself carries, and
/// the department-tier roles generated from the departments involved.
class EventRolesScreen extends ConsumerStatefulWidget {
  const EventRolesScreen({super.key, required this.eventId});

  final String eventId;

  @override
  ConsumerState<EventRolesScreen> createState() => _EventRolesScreenState();
}

class _EventRolesScreenState extends ConsumerState<EventRolesScreen> {
  bool _busy = false;

  Future<void> _generate() async {
    final ok = await confirmAction(
      context,
      title: 'Generate department roles?',
      message: 'Creates the standard roles for each department this event '
          'involves, ready to be filled.',
      confirmLabel: 'Generate',
    );
    if (!ok) return;

    setState(() => _busy = true);
    try {
      await ref
          .read(eventRepositoryProvider)
          .generateDepartmentRoles(widget.eventId);
      if (mounted) context.showSuccess('Roles generated.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remind() async {
    final ok = await confirmAction(
      context,
      title: 'Remind everyone assigned?',
      message: 'Sends a reminder to everyone holding a role on this event.',
      confirmLabel: 'Send',
    );
    if (!ok) return;
    try {
      await ref.read(eventRepositoryProvider).remindRoles(widget.eventId);
      if (mounted) context.showSuccess('Reminders sent.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!ref.watch(accessProvider).canView('events_approvals')) {
      return const DetailScaffold(
        title: 'Event roles',
        body: NoAccessView(
          message: 'Assigning event roles needs access to Event Approvals.',
        ),
      );
    }

    final event = ref.watch(eventProvider(widget.eventId)).valueOrNull;
    final rolesAsync =
        ref.watch(eventDepartmentRolesProvider(widget.eventId));
    final canEdit = ref.watch(accessProvider).can('approve_events');

    return DetailScaffold(
      title: 'Event roles',
      subtitle: event?.title,
      actions: [
        if (canEdit)
          IconButton(
            icon: const Icon(AppIcons.send),
            tooltip: 'Remind everyone',
            onPressed: _remind,
          ),
      ],
      body: rolesAsync.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: '$e'),
        data: (deptRoles) {
          final coreRoles = event?.coreRoles ?? const <EventCoreRole>[];
          final filledCore = coreRoles.where((r) => r.isFilled).length;
          final filledDept = deptRoles.where((r) => r.isFilled).length;
          final total = coreRoles.length + deptRoles.length;
          final filled = filledCore + filledDept;

          final byDepartment = <String, List<EventDepartmentRole>>{};
          for (final role in deptRoles) {
            byDepartment.putIfAbsent(role.departmentName, () => []).add(role);
          }
          final departments = byDepartment.keys.toList()..sort();

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              if (event != null)
                LuxCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        event.title,
                        style: AppFonts.display(const TextStyle(
                            fontSize: 20, color: AppColors.clay700)),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${D.dayMedium(event.startDate)} · ${event.venue}',
                        style: const TextStyle(
                            fontSize: 12.5, color: AppColors.clay400),
                      ),
                      const SizedBox(height: 14),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          value: total == 0 ? 0 : filled / total,
                          minHeight: 7,
                          backgroundColor: AppColors.clay100,
                          valueColor: const AlwaysStoppedAnimation<Color>(
                              AppColors.gold),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '$filled of $total roles filled',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.clay400),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 20),

              if (coreRoles.isNotEmpty) ...[
                SectionHeading(
                  title: 'Core roles',
                  icon: AppIcons.star,
                  tone: IconTone.gold,
                  subtitle: '$filledCore of ${coreRoles.length} filled',
                ),
                const SizedBox(height: 12),
                LuxCard(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    children: [
                      for (var i = 0; i < coreRoles.length; i++) ...[
                        if (i > 0) const LuxDivider(),
                        LuxTile(
                          title: coreRoles[i].role,
                          subtitle: coreRoles[i].assignedUserName ??
                              'Not assigned',
                          icon: coreRoles[i].isFilled
                              ? AppIcons.checkCircle
                              : AppIcons.user,
                          tone: coreRoles[i].isFilled
                              ? IconTone.emerald
                              : IconTone.clay,
                          dense: true,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 22),
              ],

              if (deptRoles.isEmpty)
                EmptyStateLux(
                  icon: AppIcons.users,
                  tone: IconTone.sage,
                  title: 'No department roles yet',
                  description: 'Generate the standard roles for the '
                      'departments this event involves, then fill them.',
                  action: canEdit
                      ? PrimaryButton(
                          label: 'Generate roles',
                          expand: false,
                          icon: AppIcons.plus,
                          loading: _busy,
                          onPressed: _generate,
                        )
                      : null,
                )
              else
                for (final department in departments) ...[
                  SectionHeading(
                    title: department,
                    icon: AppIcons.department,
                    tone: IconTone.periwinkle,
                    subtitle:
                        '${byDepartment[department]!.where((r) => r.isFilled).length}'
                        ' of ${byDepartment[department]!.length} filled',
                  ),
                  const SizedBox(height: 12),
                  LuxCard(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Column(
                      children: [
                        for (var i = 0;
                            i < byDepartment[department]!.length;
                            i++) ...[
                          if (i > 0) const LuxDivider(),
                          _DeptRoleRow(
                            eventId: widget.eventId,
                            role: byDepartment[department]![i],
                            canEdit: canEdit,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
            ],
          );
        },
      ),
    );
  }
}

class _DeptRoleRow extends ConsumerStatefulWidget {
  const _DeptRoleRow({
    required this.eventId,
    required this.role,
    required this.canEdit,
  });

  final String eventId;
  final EventDepartmentRole role;
  final bool canEdit;

  @override
  ConsumerState<_DeptRoleRow> createState() => _DeptRoleRowState();
}

class _DeptRoleRowState extends ConsumerState<_DeptRoleRow> {
  bool _busy = false;

  Future<void> _assign() async {
    setState(() => _busy = true);
    try {
      // The server knows which members are eligible for this event's
      // department roles, so ask it rather than filtering locally.
      final members = await ref
          .read(eventRepositoryProvider)
          .assignableMembers(widget.eventId,
              departmentId: widget.role.departmentId);
      if (!mounted) return;
      setState(() => _busy = false);

      if (members.isEmpty) {
        context.showInfo('Nobody in ${widget.role.departmentName} is '
            'available for this event.');
        return;
      }

      final chosen = await showModalBottomSheet<Map<String, dynamic>>(
        context: context,
        isScrollControlled: true,
        builder: (_) => _AssignableList(
          members: members,
          roleName: widget.role.role,
        ),
      );
      if (chosen == null) return;

      setState(() => _busy = true);
      await ref.read(eventRepositoryProvider).assignDepartmentRole(
            eventId: widget.eventId,
            roleId: widget.role.id,
            userId: '${chosen['id']}',
          );
      if (mounted) context.showSuccess('${chosen['name']} assigned.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _clear() async {
    setState(() => _busy = true);
    try {
      await ref.read(eventRepositoryProvider).assignDepartmentRole(
            eventId: widget.eventId,
            roleId: widget.role.id,
            userId: null,
          );
      if (mounted) context.showSuccess('Cleared.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.role;
    return LuxTile(
      title: role.role,
      subtitle: role.assignedUserName ?? 'Not assigned',
      icon: role.isFilled ? AppIcons.checkCircle : AppIcons.user,
      tone: role.isFilled ? IconTone.emerald : IconTone.clay,
      dense: true,
      trailing: _busy
          ? const SizedBox(
              height: 17,
              width: 17,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : widget.canEdit
              ? role.isFilled
                  ? IconButton(
                      icon: const Icon(AppIcons.close, size: 15),
                      color: AppColors.clay300,
                      tooltip: 'Clear',
                      onPressed: _clear,
                    )
                  : TextButton(
                      onPressed: _assign,
                      style: TextButton.styleFrom(
                        minimumSize: const Size(0, 32),
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                      ),
                      child: const Text('Assign'),
                    )
              : null,
      onTap: widget.canEdit && !role.isFilled ? _assign : null,
    );
  }
}

class _AssignableList extends StatelessWidget {
  const _AssignableList({required this.members, required this.roleName});

  final List<Map<String, dynamic>> members;
  final String roleName;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Who is doing $roleName?',
              style: AppFonts.display(
                  const TextStyle(fontSize: 20, color: AppColors.clay700)),
            ),
            const SizedBox(height: 14),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: members.length,
                separatorBuilder: (_, __) => const LuxDivider(indent: 0),
                itemBuilder: (context, i) => LuxTile(
                  title: '${members[i]['name'] ?? 'Member'}',
                  subtitle: members[i]['email']?.toString(),
                  icon: AppIcons.user,
                  tone: IconTone.periwinkle,
                  dense: true,
                  onTap: () => Navigator.of(context).pop(members[i]),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
