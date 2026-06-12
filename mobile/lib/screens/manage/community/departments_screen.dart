import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../models/models.dart';
import '../../../services/access_service.dart';
import '../../../services/auth_service.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';

/// Departments directory with member lists and the per-department task
/// board (same /api/department-tasks endpoints as the web).
class DepartmentsScreen extends StatelessWidget {
  const DepartmentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final access = context.watch<AccessService>();
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Departments')),
      body: access.departments.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              itemCount: access.departments.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final dept = access.departments[i];
                return Card(
                  child: ListTile(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) =>
                            DepartmentDetailScreen(department: dept),
                      ),
                    ),
                    leading: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: PWColors.teal.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.groups_outlined,
                          color: PWColors.teal),
                    ),
                    title: Text(dept.name,
                        style: textTheme.bodyMedium
                            ?.copyWith(fontWeight: FontWeight.w600)),
                    subtitle: dept.description == null
                        ? null
                        : Text(
                            dept.description!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: textTheme.bodySmall
                                ?.copyWith(color: PWColors.clay400),
                          ),
                    trailing: const Icon(Icons.chevron_right,
                        color: PWColors.clay300),
                  ),
                );
              },
            ),
    );
  }
}

class DepartmentDetailScreen extends StatefulWidget {
  const DepartmentDetailScreen({super.key, required this.department});

  final Department department;

  @override
  State<DepartmentDetailScreen> createState() =>
      _DepartmentDetailScreenState();
}

class _DepartmentDetailScreenState extends State<DepartmentDetailScreen> {
  List<DepartmentTask> _tasks = [];
  bool _loadingTasks = true;

  @override
  void initState() {
    super.initState();
    _loadTasks();
  }

  Future<void> _loadTasks() async {
    final api = context.read<ApiClient>();
    try {
      final res = await api.getJson('/api/department-tasks',
          query: {'departmentId': widget.department.id});
      final list = (res['tasks'] as List? ?? []).whereType<Map>().map((m) {
        final map = m.cast<String, dynamic>();
        return DepartmentTask.fromMap(map['id']?.toString() ?? '', map);
      }).toList();
      if (mounted) {
        setState(() {
          _tasks = list;
          _loadingTasks = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingTasks = false);
    }
  }

  Future<void> _addTask() async {
    final titleController = TextEditingController();
    final descController = TextEditingController();
    String priority = 'MEDIUM';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          backgroundColor: Colors.white,
          title: Text('New task',
              style: Theme.of(dialogContext).textTheme.titleLarge),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleController,
                decoration: const InputDecoration(labelText: 'Task *'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: descController,
                decoration:
                    const InputDecoration(labelText: 'Details (optional)'),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: priority,
                decoration: const InputDecoration(labelText: 'Priority'),
                items: const [
                  DropdownMenuItem(value: 'LOW', child: Text('Low')),
                  DropdownMenuItem(value: 'MEDIUM', child: Text('Medium')),
                  DropdownMenuItem(value: 'HIGH', child: Text('High')),
                  DropdownMenuItem(value: 'URGENT', child: Text('Urgent')),
                ],
                onChanged: (v) =>
                    setDialogState(() => priority = v ?? 'MEDIUM'),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('Cancel')),
            FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: const Text('Add')),
          ],
        ),
      ),
    );
    if (confirmed != true || titleController.text.trim().isEmpty || !mounted) {
      return;
    }

    final api = context.read<ApiClient>();
    try {
      await api.postJson('/api/department-tasks', {
        'departmentId': widget.department.id,
        'title': titleController.text.trim(),
        'description': descController.text.trim().isEmpty
            ? null
            : descController.text.trim(),
        'priority': priority,
      });
      _loadTasks();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    }
  }

  Future<void> _cycleStatus(DepartmentTask task) async {
    const flow = ['TODO', 'IN_PROGRESS', 'DONE'];
    final next = flow[(flow.indexOf(task.status) + 1) % flow.length];
    final api = context.read<ApiClient>();
    try {
      await api.dio.patch('/api/department-tasks',
          data: {'taskId': task.id, 'status': next});
      _loadTasks();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<AuthService>().profile;
    final canManageTasks = profile != null &&
        (hasMinRole(profile.role, 'ADMIN') ||
            profile.leadsDepartmentIds.contains(widget.department.id));
    final textTheme = Theme.of(context).textTheme;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.department.name),
          bottom: const TabBar(
            labelColor: PWColors.clay700,
            indicatorColor: PWColors.gold,
            tabs: [Tab(text: 'Members'), Tab(text: 'Tasks')],
          ),
        ),
        body: TabBarView(
          children: [
            // ── Members tab ──
            StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: FirebaseFirestore.instance
                  .collection('users')
                  .where('departmentIds',
                      arrayContains: widget.department.id)
                  .snapshots(),
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                final members = (snap.data?.docs ?? const [])
                    .map((d) => UserProfile.fromMap(d.id, d.data()))
                    .where((m) => m.isActive)
                    .toList()
                  ..sort((a, b) {
                    final aLead = a.leadsDepartmentIds
                            .contains(widget.department.id)
                        ? 0
                        : 1;
                    final bLead = b.leadsDepartmentIds
                            .contains(widget.department.id)
                        ? 0
                        : 1;
                    if (aLead != bLead) return aLead - bLead;
                    return a.name.compareTo(b.name);
                  });
                if (members.isEmpty) {
                  return const EmptyState(
                    icon: Icons.people_outline,
                    title: 'No members yet',
                    subtitle: 'Add members to this department from the '
                        'Members tool.',
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
                  itemCount: members.length,
                  itemBuilder: (context, i) {
                    final m = members[i];
                    final isLead = m.leadsDepartmentIds
                        .contains(widget.department.id);
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: InitialsAvatar(name: m.name, radius: 18),
                        title: Text(m.name,
                            style: textTheme.bodyMedium?.copyWith(
                                fontWeight: FontWeight.w600)),
                        subtitle: Text(
                          isLead ? 'Department Lead' : m.roleLabel,
                          style: textTheme.labelSmall?.copyWith(
                            color: isLead
                                ? PWColors.goldDark
                                : PWColors.clay400,
                            fontWeight:
                                isLead ? FontWeight.w700 : FontWeight.w500,
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
            // ── Tasks tab ──
            Scaffold(
              backgroundColor: Colors.transparent,
              floatingActionButton: canManageTasks
                  ? FloatingActionButton.extended(
                      backgroundColor: PWColors.gold,
                      foregroundColor: PWColors.clay900,
                      onPressed: _addTask,
                      icon: const Icon(Icons.add),
                      label: const Text('Task'),
                    )
                  : null,
              body: _loadingTasks
                  ? const Center(child: CircularProgressIndicator())
                  : RefreshIndicator(
                      onRefresh: _loadTasks,
                      child: _tasks.isEmpty
                          ? ListView(
                              physics:
                                  const AlwaysScrollableScrollPhysics(),
                              children: const [
                                SizedBox(height: 60),
                                EmptyState(
                                  icon: Icons.task_alt,
                                  title: 'No tasks',
                                  subtitle:
                                      'Department to-dos appear here.',
                                ),
                              ],
                            )
                          : ListView.separated(
                              physics:
                                  const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(
                                  20, 10, 20, 90),
                              itemCount: _tasks.length,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (context, i) {
                                final task = _tasks[i];
                                final done = task.status == 'DONE';
                                return Card(
                                  child: ListTile(
                                    onTap: canManageTasks
                                        ? () => _cycleStatus(task)
                                        : null,
                                    leading: Icon(
                                      done
                                          ? Icons.check_circle
                                          : task.status == 'IN_PROGRESS'
                                              ? Icons.timelapse
                                              : Icons
                                                  .radio_button_unchecked,
                                      color: done
                                          ? PWColors.teal
                                          : task.status == 'IN_PROGRESS'
                                              ? PWColors.goldDark
                                              : PWColors.clay300,
                                    ),
                                    title: Text(
                                      task.title,
                                      style: textTheme.bodyMedium
                                          ?.copyWith(
                                        fontWeight: FontWeight.w600,
                                        decoration: done
                                            ? TextDecoration.lineThrough
                                            : null,
                                        color: done
                                            ? PWColors.clay300
                                            : PWColors.clay800,
                                      ),
                                    ),
                                    subtitle: Text(
                                      [
                                        task.priority,
                                        if (task.assigneeName != null)
                                          task.assigneeName!,
                                        if (task.dueDate != null)
                                          'due ${DateFormat('MMM d').format(task.dueDate!)}',
                                      ].join(' · '),
                                      style: textTheme.labelSmall
                                          ?.copyWith(
                                              color: task.priority ==
                                                          'URGENT' &&
                                                      !done
                                                  ? PWColors.destructive
                                                  : PWColors.clay400),
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
