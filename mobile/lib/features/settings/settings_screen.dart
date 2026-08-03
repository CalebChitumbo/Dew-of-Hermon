import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart' show FirebaseException;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/access/access_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/firestore_parse.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/firestore/streams.dart';

/// One row of the default service checklist.
class ChecklistTemplateItem {
  const ChecklistTemplateItem({required this.task, required this.category});

  factory ChecklistTemplateItem.fromMap(Map<String, dynamic> map) =>
      ChecklistTemplateItem(
        task: parseStringOr(map['task']),
        category: parseStringOr(map['category'], 'General'),
      );

  final String task;
  final String category;

  Map<String, dynamic> toMap() => {'task': task, 'category': category};
}

/// The checklist every new service starts from. Read live so an edit made on
/// the web shows here immediately.
final checklistTemplateProvider =
    StreamProvider<List<ChecklistTemplateItem>>((ref) {
  return db
      .collection('settings')
      .doc('checklistTemplate')
      .snapshots()
      .map((snap) {
        final items = snap.data()?['items'];
        if (items is! List) return const <ChecklistTemplateItem>[];
        return items
            .whereType<Map>()
            .map((m) =>
                ChecklistTemplateItem.fromMap(Map<String, dynamic>.from(m)))
            .toList();
      })
      .handleError((_) => const <ChecklistTemplateItem>[]);
});

/// Settings — the two admin sub-pages plus the service checklist template.
/// Mirrors `/manage/settings`.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final access = ref.watch(accessProvider);
    if (!access.can('manage_settings')) {
      return const AppScaffold(title: 'Settings', body: NoAccessView());
    }

    final async = ref.watch(checklistTemplateProvider);

    return AppScaffold(
      title: 'Settings',
      subtitle: 'System configuration and defaults',
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          LuxTile(
            title: 'Access Control',
            subtitle: 'Customise role permissions for pages',
            icon: AppIcons.shield,
            tone: IconTone.teal,
            onTap: () => context.push('/manage/settings/access-control'),
            trailing: const Icon(AppIcons.chevronRight,
                size: 18, color: AppColors.clay300),
          ),
          const SizedBox(height: 10),
          LuxTile(
            title: 'Institutions',
            subtitle: 'The schools and colleges students come from',
            icon: AppIcons.graduation,
            tone: IconTone.gold,
            onTap: () => context.push('/manage/settings/institutions'),
            trailing: const Icon(AppIcons.chevronRight,
                size: 18, color: AppColors.clay300),
          ),

          const SizedBox(height: 26),
          const SectionHeading(
            title: 'Service checklist template',
            icon: AppIcons.clipboardCheck,
            tone: IconTone.periwinkle,
            subtitle: 'What every new service starts with. Changes apply to '
                'future services only.',
          ),
          const SizedBox(height: 14),
          async.when(
            loading: () => const LoadingView(),
            error: (e, _) => ErrorView(message: '$e'),
            data: (items) => _ChecklistEditor(items: items),
          ),
        ],
      ),
    );
  }
}

class _ChecklistEditor extends ConsumerStatefulWidget {
  const _ChecklistEditor({required this.items});

  final List<ChecklistTemplateItem> items;

  @override
  ConsumerState<_ChecklistEditor> createState() => _ChecklistEditorState();
}

class _ChecklistEditorState extends ConsumerState<_ChecklistEditor> {
  final _task = TextEditingController();
  final _category = TextEditingController(text: 'General');
  bool _busy = false;

  @override
  void dispose() {
    _task.dispose();
    _category.dispose();
    super.dispose();
  }

  Future<void> _write(List<ChecklistTemplateItem> next) async {
    setState(() => _busy = true);
    try {
      // The rules give the Chairperson write on `settings`, and this screen is
      // already gated on `manage_settings`, so it writes straight through —
      // the same as the web page does.
      await db.collection('settings').doc('checklistTemplate').set({
        'items': [for (final i in next) i.toMap()],
        'updatedAt': Timestamp.now(),
      });
      if (mounted) context.showSuccess('Saved.');
    } on FirebaseException catch (e) {
      if (mounted) {
        context.showError(e.code == 'permission-denied'
            ? 'Only the Chairperson can change the checklist template.'
            : (e.message ?? "Couldn't save the template."));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _add() async {
    final task = _task.text.trim();
    if (task.isEmpty) {
      context.showError('Give the item a name.');
      return;
    }
    final category = _category.text.trim().isEmpty
        ? 'General'
        : _category.text.trim();
    await _write([
      ...widget.items,
      ChecklistTemplateItem(task: task, category: category),
    ]);
    if (mounted) setState(_task.clear);
  }

  Future<void> _remove(int index) async {
    final next = [...widget.items]..removeAt(index);
    await _write(next);
  }

  @override
  Widget build(BuildContext context) {
    // Preserve the order categories first appear in, the way the web groups.
    final categories = <String>[];
    for (final item in widget.items) {
      if (!categories.contains(item.category)) categories.add(item.category);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.items.isEmpty)
          const EmptyStateLux(
            icon: AppIcons.clipboardCheck,
            tone: IconTone.clay,
            title: 'No checklist items yet',
            description: 'Add one below to get started.',
          )
        else
          for (final category in categories) ...[
            FieldLabel(category),
            for (var i = 0; i < widget.items.length; i++)
              if (widget.items[i].category == category)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: LuxCard(
                    padding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            widget.items[i].task,
                            style: const TextStyle(
                                fontSize: 13.5, color: AppColors.clay700),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(AppIcons.trash, size: 17),
                          color: AppColors.destructive,
                          tooltip: 'Remove',
                          onPressed: _busy ? null : () => _remove(i),
                        ),
                      ],
                    ),
                  ),
                ),
            const SizedBox(height: 10),
          ],

        const SizedBox(height: 8),
        const LuxDivider(indent: 0),
        const SizedBox(height: 16),
        const FieldLabel('Add an item'),
        AppTextField(
          label: 'Task',
          controller: _task,
          hint: 'e.g. Sound system tested',
          onFieldSubmitted: (_) => _add(),
        ),
        const SizedBox(height: 12),
        AppTextField(
          label: 'Category',
          controller: _category,
          hint: 'General',
        ),
        const SizedBox(height: 16),
        PrimaryButton(
          label: 'Add to the template',
          icon: AppIcons.plus,
          loading: _busy,
          onPressed: _add,
        ),
      ],
    );
  }
}
