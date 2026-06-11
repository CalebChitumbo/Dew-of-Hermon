import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../core/fire.dart';
import '../../../models/models.dart';
import '../../../services/auth_service.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';

class ServiceRoleDef {
  ServiceRoleDef({
    required this.id,
    required this.name,
    required this.departmentId,
    required this.order,
  });

  final String id;
  final String name;
  final String departmentId;
  final int order;

  factory ServiceRoleDef.fromMap(String id, Map<String, dynamic> m) {
    return ServiceRoleDef(
      id: id,
      name: asString(m['name'], 'Role'),
      departmentId: asString(m['departmentId']),
      order: asNumOrNull(m['order'])?.toInt() ?? 0,
    );
  }
}

class RotaAssignment {
  RotaAssignment({
    required this.id,
    required this.roleId,
    required this.roleName,
    required this.userId,
    required this.userName,
    required this.status,
  });

  final String id;
  final String roleId;
  final String roleName;
  final String userId;
  final String userName;
  final String status;

  factory RotaAssignment.fromMap(String id, Map<String, dynamic> m) {
    return RotaAssignment(
      id: id,
      roleId: asString(m['roleId']),
      roleName: asString(m['roleName']),
      userId: asString(m['userId']),
      userName: asString(m['userName']),
      status: asString(m['status'], 'PENDING'),
    );
  }
}

/// Rota + checklist for one service. Assignments and the checklist stream
/// live from the same Firestore collections the web pages use; assigning a
/// member goes through POST /api/services/{id}/assignments so emails and
/// notifications fire server-side.
class ServiceDetailScreen extends StatefulWidget {
  const ServiceDetailScreen({
    super.key,
    required this.serviceId,
    required this.canEdit,
  });

  final String serviceId;
  final bool canEdit;

  @override
  State<ServiceDetailScreen> createState() => _ServiceDetailScreenState();
}

class _ServiceDetailScreenState extends State<ServiceDetailScreen> {
  String? _assigningRoleId;

  Future<void> _assign(ServiceRoleDef role) async {
    final api = context.read<ApiClient>();
    final auth = context.read<AuthService>();

    final usersSnap = await FirebaseFirestore.instance
        .collection('users')
        .where('isActive', isEqualTo: true)
        .get();
    final members = usersSnap.docs
        .map((d) => UserProfile.fromMap(d.id, d.data()))
        .toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    if (!mounted) return;

    final picked = await showModalBottomSheet<UserProfile>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: PWColors.cream,
      builder: (_) => _MemberPicker(
        title: 'Assign ${role.name}',
        members: members,
        preferredDepartmentId: role.departmentId,
      ),
    );
    if (picked == null || !mounted) return;

    setState(() => _assigningRoleId = role.id);
    try {
      await api.postJson('/api/services/${widget.serviceId}/assignments', {
        'roleId': role.id,
        'userId': picked.id,
        'callerRole': auth.profile?.role,
      });
      if (mounted) {
        showAppSnackBar(
            context, '${picked.firstName} assigned as ${role.name}.');
      }
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _assigningRoleId = null);
    }
  }

  Future<void> _unassign(RotaAssignment assignment) async {
    final api = context.read<ApiClient>();
    try {
      await api.deleteJson(
          '/api/services/${widget.serviceId}/assignments/${assignment.id}');
      if (mounted) showAppSnackBar(context, 'Assignment removed.');
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    }
  }

  Future<void> _sendReminders() async {
    final api = context.read<ApiClient>();
    final auth = context.read<AuthService>();
    try {
      await api.postJson('/api/services/${widget.serviceId}/remind', {
        'callerRole': auth.profile?.role,
      });
      if (mounted) {
        showAppSnackBar(context, 'Reminders sent to everyone pending.');
      }
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final db = FirebaseFirestore.instance;
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Service'),
          actions: [
            if (widget.canEdit)
              IconButton(
                tooltip: 'Send reminders',
                onPressed: _sendReminders,
                icon: const Icon(Icons.notifications_active_outlined),
              ),
          ],
          bottom: const TabBar(
            labelColor: PWColors.clay700,
            indicatorColor: PWColors.gold,
            tabs: [Tab(text: 'Rota'), Tab(text: 'Checklist')],
          ),
        ),
        body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: db.doc('services/${widget.serviceId}').snapshots(),
          builder: (context, serviceSnap) {
            final service = serviceSnap.data?.data();
            return Column(
              children: [
                if (service != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 10, 20, 4),
                    child: Card(
                      child: ListTile(
                        leading: const Icon(Icons.church,
                            color: PWColors.goldDark),
                        title: Text(
                          asStringOrNull(service['theme']) ??
                              'Sunday service',
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          'Service time: '
                          '${asString(service['serviceTime'], '—')}',
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: PWColors.clay400),
                        ),
                      ),
                    ),
                  ),
                Expanded(
                  child: TabBarView(
                    children: [
                      _RotaTab(
                        serviceId: widget.serviceId,
                        canEdit: widget.canEdit,
                        assigningRoleId: _assigningRoleId,
                        onAssign: _assign,
                        onUnassign: _unassign,
                      ),
                      _ChecklistTab(
                          serviceId: widget.serviceId,
                          canEdit: widget.canEdit),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _RotaTab extends StatelessWidget {
  const _RotaTab({
    required this.serviceId,
    required this.canEdit,
    required this.assigningRoleId,
    required this.onAssign,
    required this.onUnassign,
  });

  final String serviceId;
  final bool canEdit;
  final String? assigningRoleId;
  final ValueChanged<ServiceRoleDef> onAssign;
  final ValueChanged<RotaAssignment> onUnassign;

  @override
  Widget build(BuildContext context) {
    final db = FirebaseFirestore.instance;
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: db.collection('serviceRoles').orderBy('order').snapshots(),
      builder: (context, rolesSnap) {
        final roles = (rolesSnap.data?.docs ?? const [])
            .map((d) => ServiceRoleDef.fromMap(d.id, d.data()))
            .toList();
        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: db
              .collection('serviceAssignments')
              .where('serviceId', isEqualTo: serviceId)
              .snapshots(),
          builder: (context, assignSnap) {
            if (rolesSnap.connectionState == ConnectionState.waiting ||
                assignSnap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final assignments = (assignSnap.data?.docs ?? const [])
                .map((d) => RotaAssignment.fromMap(d.id, d.data()))
                .toList();
            final byRole = <String, RotaAssignment>{
              for (final a in assignments) a.roleId: a,
            };
            final filled = roles.where((r) => byRole.containsKey(r.id)).length;

            return ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text(
                    '$filled of ${roles.length} roles filled',
                    style: Theme.of(context)
                        .textTheme
                        .labelMedium
                        ?.copyWith(color: PWColors.clay500),
                  ),
                ),
                for (final role in roles)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Card(
                      child: ListTile(
                        title: Text(
                          role.name,
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        subtitle: byRole[role.id] == null
                            ? Text('Unassigned',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(color: PWColors.clay300))
                            : Text(byRole[role.id]!.userName,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(color: PWColors.clay500)),
                        trailing: byRole[role.id] != null
                            ? Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  StatusBadge(
                                      status: byRole[role.id]!.status),
                                  if (canEdit)
                                    IconButton(
                                      icon: const Icon(Icons.close,
                                          size: 18,
                                          color: PWColors.clay400),
                                      onPressed: () =>
                                          onUnassign(byRole[role.id]!),
                                    ),
                                ],
                              )
                            : canEdit
                                ? (assigningRoleId == role.id
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2),
                                      )
                                    : OutlinedButton(
                                        onPressed: () => onAssign(role),
                                        style: OutlinedButton.styleFrom(
                                          padding:
                                              const EdgeInsets.symmetric(
                                                  horizontal: 14,
                                                  vertical: 6),
                                          minimumSize: Size.zero,
                                        ),
                                        child: const Text('Assign'),
                                      ))
                                : null,
                      ),
                    ),
                  ),
                if (roles.isEmpty)
                  const EmptyState(
                    icon: Icons.badge_outlined,
                    title: 'No roles configured',
                    subtitle:
                        'Service roles are set up in the web templates page.',
                  ),
              ],
            );
          },
        );
      },
    );
  }
}

class _ChecklistTab extends StatelessWidget {
  const _ChecklistTab({required this.serviceId, required this.canEdit});

  final String serviceId;
  final bool canEdit;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('checklistItems')
          .where('serviceId', isEqualTo: serviceId)
          .snapshots(),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final docs = (snap.data?.docs ?? const []).toList()
          ..sort((a, b) => (asNumOrNull(a.data()['order']) ?? 0)
              .compareTo(asNumOrNull(b.data()['order']) ?? 0));
        if (docs.isEmpty) {
          return const EmptyState(
            icon: Icons.checklist,
            title: 'No checklist items',
            subtitle: 'This service has no preparation checklist.',
          );
        }
        final done =
            docs.where((d) => asBool(d.data()['isCompleted'])).length;
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                '$done of ${docs.length} done',
                style: Theme.of(context)
                    .textTheme
                    .labelMedium
                    ?.copyWith(color: PWColors.clay500),
              ),
            ),
            for (final doc in docs)
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: CheckboxListTile(
                  activeColor: PWColors.teal,
                  value: asBool(doc.data()['isCompleted']),
                  onChanged: canEdit
                      ? (v) => doc.reference.update({
                            'isCompleted': v ?? false,
                            'updatedAt': DateTime.now(),
                          })
                      : null,
                  title: Text(
                    asString(doc.data()['task']),
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          decoration: asBool(doc.data()['isCompleted'])
                              ? TextDecoration.lineThrough
                              : null,
                          color: asBool(doc.data()['isCompleted'])
                              ? PWColors.clay300
                              : PWColors.clay800,
                        ),
                  ),
                  subtitle: asStringOrNull(doc.data()['category']) != null
                      ? Text(
                          asString(doc.data()['category']),
                          style: Theme.of(context)
                              .textTheme
                              .labelSmall
                              ?.copyWith(color: PWColors.clay400),
                        )
                      : null,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _MemberPicker extends StatefulWidget {
  const _MemberPicker({
    required this.title,
    required this.members,
    this.preferredDepartmentId,
  });

  final String title;
  final List<UserProfile> members;
  final String? preferredDepartmentId;

  @override
  State<_MemberPicker> createState() => _MemberPickerState();
}

class _MemberPickerState extends State<_MemberPicker> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final deptId = widget.preferredDepartmentId;
    final filtered = widget.members
        .where((m) =>
            _query.isEmpty ||
            m.name.toLowerCase().contains(_query.toLowerCase()))
        .toList()
      ..sort((a, b) {
        // Members of the role's department float to the top.
        if (deptId != null) {
          final aIn = a.departmentIds.contains(deptId) ? 0 : 1;
          final bIn = b.departmentIds.contains(deptId) ? 0 : 1;
          if (aIn != bIn) return aIn - bIn;
        }
        return a.name.compareTo(b.name);
      });

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      builder: (context, controller) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Column(
              children: [
                Text(widget.title,
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 10),
                TextField(
                  decoration: const InputDecoration(
                    hintText: 'Search members…',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: (v) => setState(() => _query = v),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              controller: controller,
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              itemCount: filtered.length,
              itemBuilder: (context, i) {
                final m = filtered[i];
                final inDept =
                    deptId != null && m.departmentIds.contains(deptId);
                return ListTile(
                  onTap: () => Navigator.of(context).pop(m),
                  leading: InitialsAvatar(name: m.name, radius: 18),
                  title: Text(m.name),
                  subtitle: Text(
                    inDept ? 'In this department' : m.roleLabel,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color:
                              inDept ? PWColors.tealDark : PWColors.clay400,
                        ),
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
