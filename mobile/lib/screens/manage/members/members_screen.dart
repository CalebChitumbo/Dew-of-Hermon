import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../models/models.dart';
import '../../../services/access_service.dart';
import '../../../services/auth_service.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import 'member_detail_screen.dart';

/// Member directory — streams the same users collection as the web page.
class MembersScreen extends StatefulWidget {
  const MembersScreen({super.key, required this.canEdit});

  final bool canEdit;

  @override
  State<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends State<MembersScreen> {
  String _query = '';
  String? _departmentFilter;
  bool _showInactive = false;

  @override
  Widget build(BuildContext context) {
    final access = context.watch<AccessService>();
    final me = context.watch<AuthService>().profile;

    return Scaffold(
      appBar: AppBar(title: const Text('Members')),
      floatingActionButton: widget.canEdit
          ? FloatingActionButton.extended(
              backgroundColor: PWColors.gold,
              foregroundColor: PWColors.clay900,
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const MemberDetailScreen(member: null),
                ),
              ),
              icon: const Icon(Icons.person_add_alt),
              label: const Text('Add member'),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search by name or email…',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              children: [
                FilterChip(
                  label: const Text('Inactive too'),
                  selected: _showInactive,
                  onSelected: (v) => setState(() => _showInactive = v),
                ),
                const SizedBox(width: 8),
                for (final dept in access.departments) ...[
                  FilterChip(
                    label: Text(dept.name),
                    selected: _departmentFilter == dept.id,
                    selectedColor: PWColors.gold.withValues(alpha: 0.25),
                    onSelected: (v) => setState(
                        () => _departmentFilter = v ? dept.id : null),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          Expanded(
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: FirebaseFirestore.instance
                  .collection('users')
                  .orderBy('name')
                  .snapshots(),
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                var members = (snap.data?.docs ?? const [])
                    .map((d) => UserProfile.fromMap(d.id, d.data()))
                    .where((m) => _showInactive || m.isActive)
                    .where((m) =>
                        _departmentFilter == null ||
                        m.departmentIds.contains(_departmentFilter) ||
                        m.leadsDepartmentIds.contains(_departmentFilter))
                    .where((m) =>
                        _query.isEmpty ||
                        m.name
                            .toLowerCase()
                            .contains(_query.toLowerCase()) ||
                        m.email
                            .toLowerCase()
                            .contains(_query.toLowerCase()))
                    .toList();

                if (members.isEmpty) {
                  return const EmptyState(
                    icon: Icons.people_outline,
                    title: 'No members match',
                    subtitle: 'Adjust the search or filters.',
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 90),
                  itemCount: members.length,
                  itemBuilder: (context, i) {
                    final m = members[i];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => MemberDetailScreen(member: m),
                          ),
                        ),
                        leading: InitialsAvatar(name: m.name, radius: 20),
                        title: Row(
                          children: [
                            Expanded(
                              child: Text(
                                m.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                            ),
                            if (m.id == me?.id)
                              Text(' (you)',
                                  style: Theme.of(context)
                                      .textTheme
                                      .labelSmall
                                      ?.copyWith(color: PWColors.clay400)),
                          ],
                        ),
                        subtitle: Text(
                          [
                            m.roleLabel,
                            if (!m.isActive) 'Inactive',
                            if (m.lifeGroup != null) m.lifeGroup!,
                          ].join(' · '),
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(
                                color: m.isActive
                                    ? PWColors.clay400
                                    : PWColors.destructive,
                              ),
                        ),
                        trailing: const Icon(Icons.chevron_right,
                            color: PWColors.clay300),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
