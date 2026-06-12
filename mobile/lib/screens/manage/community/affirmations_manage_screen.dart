import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../models/models.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';

/// Create, edit and delete affirmations. Creation goes through
/// POST /api/affirmations (which stamps the author); edits and deletes
/// update Firestore directly, exactly like the web manage page.
class AffirmationsManageScreen extends StatefulWidget {
  const AffirmationsManageScreen({super.key});

  @override
  State<AffirmationsManageScreen> createState() =>
      _AffirmationsManageScreenState();
}

class _AffirmationsManageScreenState
    extends State<AffirmationsManageScreen> {
  Future<void> _edit(Affirmation? existing) async {
    final result = await showModalBottomSheet<(String, String)>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: PWColors.cream,
      builder: (_) => _AffirmationSheet(existing: existing),
    );
    if (result == null || !mounted) return;

    try {
      if (existing == null) {
        final api = context.read<ApiClient>();
        await api.postJson('/api/affirmations', {
          'title': result.$1,
          'content': result.$2,
        });
      } else {
        await FirebaseFirestore.instance
            .collection('affirmations')
            .doc(existing.id)
            .update({
          'title': result.$1,
          'content': result.$2,
          'updatedAt': DateTime.now(),
        });
      }
      if (mounted) {
        showAppSnackBar(context,
            existing == null ? 'Affirmation posted.' : 'Affirmation updated.');
      }
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } catch (_) {
      if (mounted) {
        showAppSnackBar(context, 'Could not save the affirmation.',
            isError: true);
      }
    }
  }

  Future<void> _delete(Affirmation affirmation) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text('Delete "${affirmation.title}"?',
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
    try {
      await FirebaseFirestore.instance
          .collection('affirmations')
          .doc(affirmation.id)
          .delete();
      if (mounted) showAppSnackBar(context, 'Affirmation deleted.');
    } catch (_) {
      if (mounted) {
        showAppSnackBar(context, 'Could not delete it. Try again.',
            isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Manage Affirmations')),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: PWColors.gold,
        foregroundColor: PWColors.clay900,
        onPressed: () => _edit(null),
        icon: const Icon(Icons.add),
        label: const Text('New affirmation'),
      ),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance
            .collection('affirmations')
            .orderBy('createdAt', descending: true)
            .limit(50)
            .snapshots(),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final items = (snap.data?.docs ?? const [])
              .map((d) => Affirmation.fromMap(d.id, d.data()))
              .toList();
          if (items.isEmpty) {
            return const EmptyState(
              icon: Icons.auto_awesome,
              title: 'No affirmations yet',
              subtitle: 'Post encouragement for the team — everyone sees '
                  'it in their Affirmations feed.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 90),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, i) {
              final a = items[i];
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                              child:
                                  Text(a.title, style: textTheme.titleMedium)),
                          IconButton(
                            icon: const Icon(Icons.edit_outlined,
                                size: 18, color: PWColors.clay400),
                            onPressed: () => _edit(a),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline,
                                size: 18, color: PWColors.destructive),
                            onPressed: () => _delete(a),
                          ),
                        ],
                      ),
                      Text(
                        a.content,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.bodySmall
                            ?.copyWith(color: PWColors.clay600, height: 1.45),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${a.authorName} · '
                        '${DateFormat('MMM d, yyyy').format(a.createdAt)}',
                        style: textTheme.labelSmall
                            ?.copyWith(color: PWColors.clay400),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _AffirmationSheet extends StatefulWidget {
  const _AffirmationSheet({required this.existing});

  final Affirmation? existing;

  @override
  State<_AffirmationSheet> createState() => _AffirmationSheetState();
}

class _AffirmationSheetState extends State<_AffirmationSheet> {
  late final _title = TextEditingController(text: widget.existing?.title);
  late final _content =
      TextEditingController(text: widget.existing?.content);

  @override
  void dispose() {
    _title.dispose();
    _content.dispose();
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
                  ? 'New affirmation'
                  : 'Edit affirmation',
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
              controller: _content,
              maxLines: 6,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(labelText: 'Message *'),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                if (_title.text.trim().isEmpty ||
                    _content.text.trim().isEmpty) {
                  showAppSnackBar(context, 'Title and message are required.',
                      isError: true);
                  return;
                }
                Navigator.of(context)
                    .pop((_title.text.trim(), _content.text.trim()));
              },
              child: Text(widget.existing == null ? 'Post' : 'Save'),
            ),
          ],
        ),
      ),
    );
  }
}
