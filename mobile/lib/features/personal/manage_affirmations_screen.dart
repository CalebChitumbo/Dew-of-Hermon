import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart' show FirebaseException;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/access/access_providers.dart';
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
import '../../data/firestore/streams.dart';
import '../../data/models/enums.dart';
import '../../data/models/ministry.dart';
import '../../data/repositories/ministry_repository.dart';
import 'affirmations_screen.dart' show affirmationsProvider;

/// Every affirmation, newest first. Read straight from Firestore so an edit
/// or a delete shows up the moment it lands.
final manageAffirmationsProvider = StreamProvider<List<Affirmation>>((ref) {
  return collectionStream(
    db.collection('affirmations'),
    Affirmation.fromMap,
    sort: (a, b) => b.createdAt.compareTo(a.createdAt),
  );
});

/// Manage Affirmations — write, edit, and (for the Chairperson) remove.
/// Mirrors `/manage/affirmations`, plus its `new` and `<id>` pages, which on
/// mobile open as a sheet over this list.
class ManageAffirmationsScreen extends ConsumerStatefulWidget {
  const ManageAffirmationsScreen({
    super.key,
    this.composing = false,
    this.editingId,
  });

  /// Deep-linked from `/manage/affirmations/new`.
  final bool composing;

  /// Deep-linked from `/manage/affirmations/<id>`.
  final String? editingId;

  @override
  ConsumerState<ManageAffirmationsScreen> createState() =>
      _ManageAffirmationsScreenState();
}

class _ManageAffirmationsScreenState
    extends ConsumerState<ManageAffirmationsScreen> {
  /// A deep link opens its sheet once, after the first frame — reopening it
  /// on every rebuild would trap the user in it.
  bool _deepLinkHandled = false;

  void _handleDeepLink(List<Affirmation> list) {
    if (_deepLinkHandled) return;
    if (!widget.composing && widget.editingId == null) return;
    _deepLinkHandled = true;

    final target = widget.editingId == null
        ? null
        : firstWhereOrNull(list, (a) => a.id == widget.editingId);
    if (widget.editingId != null && target == null) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _edit(context, ref, target);
    });
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(manageAffirmationsProvider);
    final canDelete = ref.watch(accessProvider).role == UserRole.superAdmin;

    return AppScaffold(
      title: 'Manage Affirmations',
      subtitle: "Write, edit and manage Potter's Wheel affirmations",
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _edit(context, ref, null),
        icon: const Icon(AppIcons.plus, size: 19),
        label: const Text('New'),
      ),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: '$e'),
        data: (list) {
          _handleDeepLink(list);

          if (list.isEmpty) {
            return EmptyStateLux(
              icon: AppIcons.sparkles,
              tone: IconTone.blush,
              title: 'No affirmations yet',
              description:
                  'Write the first one to share with the group — something '
                  'short they can carry through the week.',
              action: PrimaryButton(
                label: 'Create the first one',
                expand: false,
                icon: AppIcons.plus,
                onPressed: () => _edit(context, ref, null),
              ),
            );
          }

          return ListView.separated(
            padding: EdgeInsets.zero,
            itemCount: list.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, i) => _ManageCard(
              affirmation: list[i],
              isLatest: i == 0,
              canDelete: canDelete,
              onEdit: () => _edit(context, ref, list[i]),
              onDelete: () => _delete(context, ref, list[i]),
            ),
          );
        },
      ),
    );
  }

  Future<void> _edit(
    BuildContext context,
    WidgetRef ref,
    Affirmation? existing,
  ) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AffirmationEditor(existing: existing),
    );
    // The feed is a one-shot API read, so nudge it when this list changes.
    if (saved == true) ref.invalidate(affirmationsProvider);
  }

  Future<void> _delete(
    BuildContext context,
    WidgetRef ref,
    Affirmation affirmation,
  ) async {
    final ok = await confirmAction(
      context,
      title: 'Delete this affirmation?',
      message: '"${affirmation.title}" will be removed for everyone. This '
          'cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!ok) return;

    try {
      // Deleting is a Chairperson-only rule in `firestore.rules`, so this goes
      // straight to Firestore exactly as the web page does.
      await db.collection('affirmations').doc(affirmation.id).delete();
      if (context.mounted) context.showSuccess('Deleted.');
      ref.invalidate(affirmationsProvider);
    } on FirebaseException catch (e) {
      if (context.mounted) {
        context.showError(e.code == 'permission-denied'
            ? 'Only the Chairperson can delete affirmations.'
            : (e.message ?? "Couldn't delete that affirmation."));
      }
    }
  }
}

class _ManageCard extends StatelessWidget {
  const _ManageCard({
    required this.affirmation,
    required this.isLatest,
    required this.canDelete,
    required this.onEdit,
    required this.onDelete,
  });

  final Affirmation affirmation;
  final bool isLatest;
  final bool canDelete;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 10, 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        affirmation.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppFonts.display(const TextStyle(
                          fontSize: 16,
                          color: AppColors.clay700,
                        )),
                      ),
                    ),
                    if (isLatest) ...[
                      const SizedBox(width: 8),
                      const StatusBadge('Latest',
                          tone: IconTone.gold, dense: true),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  affirmation.content,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 13, color: AppColors.clay400),
                ),
                const SizedBox(height: 5),
                Text(
                  'By ${affirmation.authorName} · '
                  '${D.medium(affirmation.createdAt)}',
                  style: const TextStyle(
                      fontSize: 11.5, color: AppColors.clay400),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(AppIcons.edit, size: 18),
            color: AppColors.clay500,
            tooltip: 'Edit',
            onPressed: onEdit,
          ),
          if (canDelete)
            IconButton(
              icon: const Icon(AppIcons.trash, size: 18),
              color: AppColors.destructive,
              tooltip: 'Delete',
              onPressed: onDelete,
            ),
        ],
      ),
    );
  }
}

/// Compose or edit. A new one is created through `/api/affirmations` so the
/// server stamps the author; an edit writes straight to the document, which
/// the rules allow an admin to do.
class _AffirmationEditor extends ConsumerStatefulWidget {
  const _AffirmationEditor({this.existing});

  final Affirmation? existing;

  @override
  ConsumerState<_AffirmationEditor> createState() => _AffirmationEditorState();
}

class _AffirmationEditorState extends ConsumerState<_AffirmationEditor> {
  late final TextEditingController _title =
      TextEditingController(text: widget.existing?.title ?? '');
  late final TextEditingController _content =
      TextEditingController(text: widget.existing?.content ?? '');
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    _content.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    final content = _content.text.trim();
    if (title.isEmpty || content.isEmpty) {
      context.showError('A title and the affirmation itself are both needed.');
      return;
    }

    setState(() => _busy = true);
    try {
      final existing = widget.existing;
      if (existing == null) {
        await ref
            .read(ministryRepositoryProvider)
            .createAffirmation(title: title, content: content);
      } else {
        final user = ref.read(userOrNullProvider);
        await db.collection('affirmations').doc(existing.id).update({
          'title': title,
          'content': content,
          if (user != null) ...{
            'authorId': user.id,
            'authorName': user.name,
          },
          'updatedAt': Timestamp.now(),
        });
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
      context.showSuccess(widget.existing == null ? 'Posted.' : 'Saved.');
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError(e.message);
      }
    } on FirebaseException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError(e.message ?? "Couldn't save that affirmation.");
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isNew = widget.existing == null;

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
              isNew ? 'New affirmation' : 'Edit affirmation',
              style: AppFonts.display(
                  const TextStyle(fontSize: 21, color: AppColors.clay700)),
            ),
            const SizedBox(height: 4),
            const Text(
              'Something short the ministry can carry through the week.',
              style: TextStyle(fontSize: 13, color: AppColors.clay400),
            ),
            const SizedBox(height: 20),
            AppTextField(label: 'Title', controller: _title, required: true),
            const SizedBox(height: 14),
            AppTextField(
              label: 'The affirmation',
              controller: _content,
              required: true,
              minLines: 4,
              maxLines: 8,
            ),
            const SizedBox(height: 22),
            PrimaryButton(
              label: isNew ? 'Post it' : 'Save changes',
              icon: isNew ? AppIcons.send : AppIcons.check,
              loading: _busy,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }
}
