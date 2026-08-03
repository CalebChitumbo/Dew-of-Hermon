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
import '../../core/utils/firestore_parse.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/enums.dart';
import '../../data/models/ministry.dart';
import '../../data/models/user.dart';
import '../../data/repositories/ministry_repository.dart';
import '../services/service_detail_screen.dart' show activeMembersProvider;
import 'departments_screen.dart' show MemberTile;

final departmentTasksProvider =
    FutureProvider.family<List<DepartmentTask>, String>((ref, departmentId) {
  return ref.watch(ministryRepositoryProvider).tasks(departmentId);
});

/// One department: its board and its team.
///
/// The board is three columns on the web; on a phone that becomes a segmented
/// control over one list, because three columns of cards at 390px wide is
/// three columns of nothing.
class DepartmentDetailScreen extends ConsumerStatefulWidget {
  const DepartmentDetailScreen({super.key, required this.departmentId});

  final String departmentId;

  @override
  ConsumerState<DepartmentDetailScreen> createState() =>
      _DepartmentDetailScreenState();
}

class _DepartmentDetailScreenState
    extends ConsumerState<DepartmentDetailScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final departments = ref.watch(departmentsProvider).valueOrNull ?? const [];
    final members = ref.watch(activeMembersProvider).valueOrNull ?? const [];
    final user = ref.watch(userOrNullProvider);
    final tasksAsync = ref.watch(departmentTasksProvider(widget.departmentId));

    final department =
        firstWhereOrNull(departments, (d) => d.id == widget.departmentId);

    final team =
        members.where((m) => m.belongsTo(widget.departmentId)).toList();
    final leads = team.where((m) => m.leads(widget.departmentId)).toList();
    final isLead = user?.leads(widget.departmentId) ?? false;
    final canManage = isLead ||
        ref.watch(accessProvider).can('manage_departments');

    return DetailScaffold(
      title: department?.name ?? 'Department',
      subtitle: '${team.length} ${team.length == 1 ? 'member' : 'members'}',
      floatingActionButton: canManage && _tab == 0
          ? FloatingActionButton.extended(
              onPressed: () => _newTask(team),
              icon: const Icon(AppIcons.plus, size: 19),
              label: const Text('New task'),
            )
          : null,
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          SegmentedTabs(
            tabs: const ['Board', 'Team'],
            selected: _tab,
            onSelect: (i) => setState(() => _tab = i),
          ),
          const SizedBox(height: 18),

          if (_tab == 0)
            tasksAsync.when(
              loading: () => const LoadingView(),
              error: (e, _) => ErrorView(
                message: '$e',
                onRetry: () =>
                    ref.invalidate(departmentTasksProvider(widget.departmentId)),
              ),
              data: (tasks) => _Board(
                tasks: tasks,
                departmentId: widget.departmentId,
                canManage: canManage,
                team: team,
              ),
            )
          else
            _Team(team: team, leads: leads),
        ],
      ),
    );
  }

  Future<void> _newTask(List<AppUser> team) async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _TaskSheet(
        departmentId: widget.departmentId,
        team: team,
      ),
    );
    if (created == true) {
      ref.invalidate(departmentTasksProvider(widget.departmentId));
    }
  }
}

class _Board extends ConsumerWidget {
  const _Board({
    required this.tasks,
    required this.departmentId,
    required this.canManage,
    required this.team,
  });

  final List<DepartmentTask> tasks;
  final String departmentId;
  final bool canManage;
  final List<AppUser> team;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (tasks.isEmpty) {
      return const EmptyStateLux(
        icon: AppIcons.listTodo,
        tone: IconTone.sage,
        title: 'Nothing on the board',
        description: 'Tasks the department is working on live here — who is '
            'doing what, and by when.',
      );
    }

    final byStatus = <TaskStatus, List<DepartmentTask>>{
      for (final status in TaskStatus.values)
        status: tasks.where((t) => t.status == status).toList(),
    };
    final overdue = tasks.where((t) => t.isOverdue).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (overdue.isNotEmpty) ...[
          NoticeCard(
            tone: IconTone.rose,
            icon: AppIcons.alert,
            title: overdue.length == 1
                ? '1 task is overdue'
                : '${overdue.length} tasks are overdue',
            message: overdue.map((t) => t.title).take(3).join(', '),
          ),
          const SizedBox(height: 18),
        ],
        for (final status in TaskStatus.values) ...[
          SectionHeading(
            title: status.label,
            icon: switch (status) {
              TaskStatus.todo => AppIcons.listTodo,
              TaskStatus.inProgress => AppIcons.clock,
              TaskStatus.done => AppIcons.checkCircle,
            },
            tone: switch (status) {
              TaskStatus.todo => IconTone.clay,
              TaskStatus.inProgress => IconTone.blue,
              TaskStatus.done => IconTone.emerald,
            },
            subtitle: '${byStatus[status]!.length}',
          ),
          const SizedBox(height: 12),
          if (byStatus[status]!.isEmpty)
            const LuxCard(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Text(
                'Nothing here.',
                style: TextStyle(fontSize: 13, color: AppColors.clay300),
              ),
            )
          else
            for (final task in byStatus[status]!)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _TaskCard(
                  task: task,
                  canManage: canManage,
                  onMoved: () =>
                      ref.invalidate(departmentTasksProvider(departmentId)),
                ),
              ),
          const SizedBox(height: 18),
        ],
      ],
    );
  }
}

class _TaskCard extends ConsumerStatefulWidget {
  const _TaskCard({
    required this.task,
    required this.canManage,
    required this.onMoved,
  });

  final DepartmentTask task;
  final bool canManage;
  final VoidCallback onMoved;

  @override
  ConsumerState<_TaskCard> createState() => _TaskCardState();
}

class _TaskCardState extends ConsumerState<_TaskCard> {
  bool _busy = false;

  Future<void> _move(TaskStatus status) async {
    setState(() => _busy = true);
    try {
      await ref
          .read(ministryRepositoryProvider)
          .moveTask(widget.task.id, status);
      widget.onMoved();
      if (mounted) context.showSuccess('Moved to ${status.label}.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final task = widget.task;
    final next = switch (task.status) {
      TaskStatus.todo => TaskStatus.inProgress,
      TaskStatus.inProgress => TaskStatus.done,
      TaskStatus.done => TaskStatus.todo,
    };

    return LuxCard(
      padding: const EdgeInsets.all(15),
      border: task.isOverdue
          ? AppColors.destructive.withValues(alpha: 0.3)
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  task.title,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    height: 1.35,
                    color: AppColors.clay700,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              StatusBadge(task.priority.label,
                  tone: switch (task.priority) {
                    TaskPriority.urgent => IconTone.rose,
                    TaskPriority.high => IconTone.amber,
                    TaskPriority.medium => IconTone.clay,
                    TaskPriority.low => IconTone.sage,
                  },
                  dense: true),
            ],
          ),
          if ((task.description ?? '').isNotEmpty) ...[
            const SizedBox(height: 7),
            Text(
              task.description!,
              style: const TextStyle(
                  fontSize: 13, height: 1.45, color: AppColors.clay500),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              if (task.assigneeName != null) ...[
                const Icon(AppIcons.user, size: 13, color: AppColors.clay300),
                const SizedBox(width: 5),
                Flexible(
                  child: Text(
                    task.assigneeName!,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.clay400),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 12),
              ],
              if (task.dueDate != null) ...[
                Icon(AppIcons.calendar,
                    size: 13,
                    color: task.isOverdue
                        ? AppColors.destructive
                        : AppColors.clay300),
                const SizedBox(width: 5),
                Text(
                  D.medium(task.dueDate),
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: task.isOverdue ? FontWeight.w700 : null,
                    color: task.isOverdue
                        ? AppColors.destructive
                        : AppColors.clay400,
                  ),
                ),
              ],
              const Spacer(),
              if (widget.canManage)
                _busy
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : TextButton(
                        onPressed: () => _move(next),
                        style: TextButton.styleFrom(
                          minimumSize: const Size(0, 30),
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                        ),
                        child: Text(
                          task.status == TaskStatus.done
                              ? 'Reopen'
                              : 'Move to ${next.label.toLowerCase()}',
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Team extends StatelessWidget {
  const _Team({required this.team, required this.leads});

  final List<AppUser> team;
  final List<AppUser> leads;

  @override
  Widget build(BuildContext context) {
    if (team.isEmpty) {
      return const EmptyStateLux(
        icon: AppIcons.users,
        tone: IconTone.sage,
        title: 'Nobody in this department yet',
        description: 'Members can ask to join from the departments list.',
      );
    }

    final leadIds = leads.map((l) => l.id).toSet();
    final rest = team.where((m) => !leadIds.contains(m.id)).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (leads.isNotEmpty) ...[
          const SectionHeading(
            title: 'Leadership',
            icon: AppIcons.star,
            tone: IconTone.gold,
          ),
          const SizedBox(height: 12),
          LuxCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                for (var i = 0; i < leads.length; i++) ...[
                  if (i > 0) const LuxDivider(),
                  MemberTile(member: leads[i], isLead: true),
                ],
              ],
            ),
          ),
          const SizedBox(height: 22),
        ],
        SectionHeading(
          title: 'Team',
          icon: AppIcons.users,
          tone: IconTone.sage,
          subtitle: '${rest.length}',
        ),
        const SizedBox(height: 12),
        LuxCard(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            children: [
              for (var i = 0; i < rest.length; i++) ...[
                if (i > 0) const LuxDivider(),
                MemberTile(member: rest[i]),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _TaskSheet extends ConsumerStatefulWidget {
  const _TaskSheet({required this.departmentId, required this.team});

  final String departmentId;
  final List<AppUser> team;

  @override
  ConsumerState<_TaskSheet> createState() => _TaskSheetState();
}

class _TaskSheetState extends ConsumerState<_TaskSheet> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  TaskPriority _priority = TaskPriority.medium;
  AppUser? _assignee;
  DateTime? _dueDate;
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_title.text.trim().isEmpty) {
      context.showError('The task needs a title.');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(ministryRepositoryProvider).createTask(
            departmentId: widget.departmentId,
            title: _title.text.trim(),
            description: _description.text.trim(),
            priority: _priority,
            assigneeId: _assignee?.id,
            assigneeName: _assignee?.name,
            dueDate: _dueDate,
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      context.showSuccess('Task added.');
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
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'New task',
              style: AppFonts.display(
                  const TextStyle(fontSize: 21, color: AppColors.clay700)),
            ),
            const SizedBox(height: 20),
            AppTextField(
              label: 'What needs doing',
              controller: _title,
              required: true,
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'Details',
              controller: _description,
              maxLines: 3,
            ),
            const SizedBox(height: 14),
            const FieldLabel('Priority'),
            Wrap(
              spacing: 8,
              children: [
                for (final p in TaskPriority.values)
                  ChoiceChip(
                    label: Text(p.label),
                    selected: _priority == p,
                    onSelected: (_) => setState(() => _priority = p),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            AppDropdown<String>(
              label: 'Assign to',
              hint: 'Nobody yet',
              value: _assignee?.id,
              items: [
                const DropdownMenuItem(value: null, child: Text('Nobody yet')),
                for (final m in widget.team)
                  DropdownMenuItem(value: m.id, child: Text(m.name)),
              ],
              onChanged: (id) => setState(() {
                _assignee = id == null
                    ? null
                    : firstWhereOrNull(widget.team, (m) => m.id == id);
              }),
            ),
            const SizedBox(height: 16),
            const FieldLabel('Due by'),
            InkWell(
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _dueDate ?? DateTime.now(),
                  firstDate:
                      DateTime.now().subtract(const Duration(days: 7)),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (picked != null) setState(() => _dueDate = picked);
              },
              borderRadius: BorderRadius.circular(AppRadius.base),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppRadius.base),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    const Icon(AppIcons.calendar,
                        size: 16, color: AppColors.clay300),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Text(
                        _dueDate == null ? 'No date' : D.medium(_dueDate),
                        style: TextStyle(
                          fontSize: 14.5,
                          color: _dueDate == null
                              ? AppColors.clay400
                              : AppColors.clay700,
                        ),
                      ),
                    ),
                    if (_dueDate != null)
                      IconButton(
                        icon: const Icon(AppIcons.close, size: 16),
                        color: AppColors.clay300,
                        onPressed: () => setState(() => _dueDate = null),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 22),
            PrimaryButton(
              label: 'Add task',
              icon: AppIcons.plus,
              loading: _busy,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
