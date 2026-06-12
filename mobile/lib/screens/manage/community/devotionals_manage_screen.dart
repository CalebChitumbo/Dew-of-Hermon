import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../core/fire.dart';
import '../../../models/models.dart';
import '../../../services/access_service.dart';
import '../../../services/auth_service.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';

/// Post and edit the weekly devotionals for Campus Ministry and Life
/// Groups — same /api/devotionals endpoints as the web department pages.
class DevotionalsManageScreen extends StatefulWidget {
  const DevotionalsManageScreen({super.key});

  @override
  State<DevotionalsManageScreen> createState() =>
      _DevotionalsManageScreenState();
}

class _DevotionalsManageScreenState extends State<DevotionalsManageScreen> {
  List<Devotional> _devotionals = [];
  bool _loading = true;
  String _scope = 'CAMPUS_MINISTRY';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    try {
      final res = await api
          .getJson('/api/devotionals', query: {'scope': _scope, 'limit': '20'});
      final list = (res['devotionals'] as List? ?? [])
          .whereType<Map>()
          .map((m) {
        final map = m.cast<String, dynamic>();
        return Devotional(
          id: asString(map['id']),
          scope: asString(map['scope'], 'CAMPUS_MINISTRY'),
          title: asString(map['title']),
          content: asString(map['content']),
          weekStartDate: asString(map['weekStartDate']),
          scriptureReference: asStringOrNull(map['scriptureReference']),
          authorName: asString(map['authorName']),
        );
      }).toList();
      if (mounted) {
        setState(() {
          _devotionals = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _edit(Devotional? existing) async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: PWColors.cream,
      builder: (_) => _DevotionalSheet(existing: existing, scope: _scope),
    );
    if (result == null || !mounted) return;

    final api = context.read<ApiClient>();
    try {
      if (existing == null) {
        await api.postJson('/api/devotionals', result);
      } else {
        await api.dio.patch('/api/devotionals/${existing.id}', data: result);
      }
      if (mounted) {
        showAppSnackBar(context,
            existing == null ? 'Devotional posted.' : 'Devotional updated.');
      }
      _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    }
  }

  Future<void> _delete(Devotional devotional) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text('Delete "${devotional.title}"?',
            style: Theme.of(dialogContext).textTheme.titleLarge),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel')),
          FilledButton(
            style:
                FilledButton.styleFrom(backgroundColor: PWColors.destructive),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final api = context.read<ApiClient>();
    try {
      await api.deleteJson('/api/devotionals/${devotional.id}');
      if (mounted) showAppSnackBar(context, 'Devotional deleted.');
      _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final access = context.watch<AccessService>();
    final profile = context.watch<AuthService>().profile;
    final canCampus = access.checkFeature(profile, 'manage_devotionals');
    final canLifeGroups =
        access.checkFeature(profile, 'manage_life_group_devotionals');
    final canEditCurrent =
        _scope == 'CAMPUS_MINISTRY' ? canCampus : canLifeGroups;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Devotionals')),
      floatingActionButton: canEditCurrent
          ? FloatingActionButton.extended(
              backgroundColor: PWColors.gold,
              foregroundColor: PWColors.clay900,
              onPressed: () => _edit(null),
              icon: const Icon(Icons.add),
              label: const Text('Post devotional'),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                    value: 'CAMPUS_MINISTRY', label: Text('Campus Ministry')),
                ButtonSegment(
                    value: 'LIFE_GROUPS', label: Text('Life Groups')),
              ],
              selected: {_scope},
              onSelectionChanged: (s) {
                setState(() {
                  _scope = s.first;
                  _loading = true;
                });
                _load();
              },
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _devotionals.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: const [
                              SizedBox(height: 80),
                              EmptyState(
                                icon: Icons.menu_book_outlined,
                                title: 'No devotionals yet',
                                subtitle:
                                    'Posted devotionals appear on every '
                                    'member\'s home screen.',
                              ),
                            ],
                          )
                        : ListView.separated(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding:
                                const EdgeInsets.fromLTRB(20, 4, 20, 90),
                            itemCount: _devotionals.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 10),
                            itemBuilder: (context, i) {
                              final d = _devotionals[i];
                              return Card(
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(d.title,
                                                style:
                                                    textTheme.titleMedium),
                                          ),
                                          if (canEditCurrent) ...[
                                            IconButton(
                                              icon: const Icon(
                                                  Icons.edit_outlined,
                                                  size: 18,
                                                  color: PWColors.clay400),
                                              onPressed: () => _edit(d),
                                            ),
                                            IconButton(
                                              icon: const Icon(
                                                  Icons.delete_outline,
                                                  size: 18,
                                                  color:
                                                      PWColors.destructive),
                                              onPressed: () => _delete(d),
                                            ),
                                          ],
                                        ],
                                      ),
                                      Text(
                                        [
                                          'Week of ${d.weekStartDate}',
                                          if (d.scriptureReference != null)
                                            d.scriptureReference!,
                                          d.authorName,
                                        ].join(' · '),
                                        style: textTheme.labelSmall
                                            ?.copyWith(
                                                color: PWColors.clay400),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        d.content,
                                        maxLines: 3,
                                        overflow: TextOverflow.ellipsis,
                                        style: textTheme.bodySmall
                                            ?.copyWith(
                                                color: PWColors.clay600,
                                                height: 1.45),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _DevotionalSheet extends StatefulWidget {
  const _DevotionalSheet({required this.existing, required this.scope});

  final Devotional? existing;
  final String scope;

  @override
  State<_DevotionalSheet> createState() => _DevotionalSheetState();
}

class _DevotionalSheetState extends State<_DevotionalSheet> {
  late final _title = TextEditingController(text: widget.existing?.title);
  late final _content =
      TextEditingController(text: widget.existing?.content);
  late final _scripture =
      TextEditingController(text: widget.existing?.scriptureReference);
  late DateTime _weekStart = widget.existing != null
      ? (DateTime.tryParse(widget.existing!.weekStartDate) ?? _thisMonday())
      : _thisMonday();

  static DateTime _thisMonday() {
    final now = DateTime.now();
    return now.subtract(Duration(days: now.weekday - 1));
  }

  @override
  void dispose() {
    _title.dispose();
    _content.dispose();
    _scripture.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.existing == null
                  ? 'Post devotional'
                  : 'Edit devotional',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _title,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(labelText: 'Title *'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _scripture,
              decoration: const InputDecoration(
                  labelText: 'Scripture reference (optional)'),
            ),
            const SizedBox(height: 10),
            InkWell(
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _weekStart,
                  firstDate:
                      DateTime.now().subtract(const Duration(days: 90)),
                  lastDate: DateTime.now().add(const Duration(days: 90)),
                );
                if (picked != null) setState(() => _weekStart = picked);
              },
              child: InputDecorator(
                decoration:
                    const InputDecoration(labelText: 'Week starting'),
                child: Text(DateFormat('EEE, MMM d, yyyy').format(_weekStart)),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _content,
              maxLines: 8,
              textCapitalization: TextCapitalization.sentences,
              decoration:
                  const InputDecoration(labelText: 'Devotional content *'),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                if (_title.text.trim().isEmpty ||
                    _content.text.trim().isEmpty) {
                  showAppSnackBar(
                      context, 'Title and content are required.',
                      isError: true);
                  return;
                }
                Navigator.of(context).pop({
                  'scope': widget.scope,
                  'title': _title.text.trim(),
                  'content': _content.text.trim(),
                  'weekStartDate':
                      DateFormat('yyyy-MM-dd').format(_weekStart),
                  'scriptureReference': _scripture.text.trim().isEmpty
                      ? null
                      : _scripture.text.trim(),
                });
              },
              child:
                  Text(widget.existing == null ? 'Post' : 'Save changes'),
            ),
          ],
        ),
      ),
    );
  }
}
