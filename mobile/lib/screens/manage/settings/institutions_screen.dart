import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../core/fire.dart';
import '../../../models/models.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';

/// Institutions (campuses/schools) used by student registration —
/// add, rename, enable/disable via /api/institutions.
class InstitutionsScreen extends StatefulWidget {
  const InstitutionsScreen({super.key});

  @override
  State<InstitutionsScreen> createState() => _InstitutionsScreenState();
}

class _InstitutionsScreenState extends State<InstitutionsScreen> {
  List<Institution> _institutions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    try {
      final res = await api.getJson('/api/institutions');
      final list = (res['institutions'] as List? ?? [])
          .whereType<Map>()
          .map((m) {
        final map = m.cast<String, dynamic>();
        return Institution(
          id: asString(map['id']),
          name: asString(map['name']),
          isActive: asBool(map['isActive'], true),
          order: (asNumOrNull(map['order']) ?? 0).toInt(),
        );
      }).toList()
        ..sort((a, b) => a.order.compareTo(b.order));
      if (mounted) {
        setState(() {
          _institutions = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _add() async {
    final name = await _nameDialog('Add institution', '');
    if (name == null || name.isEmpty || !mounted) return;
    final api = context.read<ApiClient>();
    try {
      await api.postJson('/api/institutions', {'name': name});
      _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    }
  }

  Future<void> _rename(Institution inst) async {
    final name = await _nameDialog('Rename institution', inst.name);
    if (name == null || name.isEmpty || !mounted) return;
    _patch(inst, {'name': name});
  }

  Future<void> _patch(Institution inst, Map<String, dynamic> updates) async {
    final api = context.read<ApiClient>();
    try {
      await api.dio
          .patch('/api/institutions', data: {'id': inst.id, ...updates});
      _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    }
  }

  Future<String?> _nameDialog(String title, String initial) {
    final controller = TextEditingController(text: initial);
    return showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text(title,
            style: Theme.of(dialogContext).textTheme.titleLarge),
        content: TextField(
          controller: controller,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(labelText: 'Name'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () =>
                Navigator.of(dialogContext).pop(controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Institutions')),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: PWColors.gold,
        foregroundColor: PWColors.clay900,
        onPressed: _add,
        icon: const Icon(Icons.add),
        label: const Text('Add'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _institutions.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        SizedBox(height: 80),
                        EmptyState(
                          icon: Icons.school_outlined,
                          title: 'No institutions yet',
                          subtitle:
                              'Students pick their campus from this list '
                              'when registering.',
                        ),
                      ],
                    )
                  : ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 90),
                      itemCount: _institutions.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final inst = _institutions[i];
                        return Card(
                          child: ListTile(
                            onTap: () => _rename(inst),
                            leading: const Icon(Icons.school_outlined,
                                color: PWColors.teal),
                            title: Text(
                              inst.name,
                              style: textTheme.bodyMedium?.copyWith(
                                fontWeight: FontWeight.w600,
                                color: inst.isActive
                                    ? PWColors.clay800
                                    : PWColors.clay300,
                              ),
                            ),
                            trailing: Switch(
                              value: inst.isActive,
                              activeThumbColor: PWColors.teal,
                              onChanged: (v) =>
                                  _patch(inst, {'isActive': v}),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
