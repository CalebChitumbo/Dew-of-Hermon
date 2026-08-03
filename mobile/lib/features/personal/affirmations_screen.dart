import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
import '../../data/models/ministry.dart';
import '../../data/repositories/ministry_repository.dart';

final affirmationsProvider = FutureProvider<List<Affirmation>>((ref) {
  return ref.watch(ministryRepositoryProvider).affirmations();
});

/// Affirmations — short encouragements posted for the ministry to carry
/// through the week.
class AffirmationsScreen extends ConsumerWidget {
  const AffirmationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final access = ref.watch(accessProvider);
    final async = ref.watch(affirmationsProvider);
    final canWrite = access.can('manage_affirmations');

    return AppScaffold(
      title: 'Affirmations',
      onRefresh: () async => ref.invalidate(affirmationsProvider),
      actions: canWrite
          ? [
              IconButton(
                icon: const Icon(AppIcons.listTodo, size: 20),
                color: AppColors.clay500,
                tooltip: 'Manage affirmations',
                onPressed: () => context.push('/manage/affirmations'),
              ),
            ]
          : null,
      floatingActionButton: canWrite
          ? FloatingActionButton.extended(
              onPressed: () => _compose(context, ref),
              icon: const Icon(AppIcons.plus, size: 19),
              label: const Text('Write one'),
            )
          : null,
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(affirmationsProvider),
        ),
        data: (list) {
          if (list.isEmpty) {
            return EmptyStateLux(
              icon: AppIcons.sparkles,
              tone: IconTone.blush,
              title: 'Nothing yet',
              description: 'Affirmations are short encouragements the ministry '
                  'carries through the week.',
              action: canWrite
                  ? PrimaryButton(
                      label: 'Write the first one',
                      expand: false,
                      icon: AppIcons.plus,
                      onPressed: () => _compose(context, ref),
                    )
                  : null,
            );
          }

          final latest = list.first;
          final rest = list.skip(1).toList();

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              _FeaturedCard(affirmation: latest),
              if (rest.isNotEmpty) ...[
                const SizedBox(height: 24),
                const SectionHeading(
                  title: 'Earlier',
                  icon: AppIcons.history,
                  tone: IconTone.clay,
                ),
                const SizedBox(height: 12),
                for (final a in rest)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _AffirmationCard(affirmation: a),
                  ),
              ],
            ],
          );
        },
      ),
    );
  }

  Future<void> _compose(BuildContext context, WidgetRef ref) async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _ComposeSheet(),
    );
    if (created == true) ref.invalidate(affirmationsProvider);
  }
}

class _FeaturedCard extends StatelessWidget {
  const _FeaturedCard({required this.affirmation});

  final Affirmation affirmation;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.lux),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF3E2518), AppColors.clay700],
        ),
        boxShadow: AppColors.luxShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(AppIcons.sparkles,
                  size: 16,
                  color: AppColors.goldLight.withValues(alpha: 0.9)),
              const SizedBox(width: 8),
              Text(
                'THIS WEEK',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 2,
                  color: AppColors.goldLight.withValues(alpha: 0.9),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            affirmation.title,
            style: AppFonts.display(const TextStyle(
              fontSize: 26,
              height: 1.15,
              color: AppColors.cream,
            )),
          ),
          const SizedBox(height: 14),
          Text(
            affirmation.content,
            style: TextStyle(
              fontSize: 15,
              height: 1.75,
              color: AppColors.cream.withValues(alpha: 0.88),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            '— ${affirmation.authorName} · '
            '${D.medium(affirmation.createdAt)}',
            style: TextStyle(
              fontSize: 12,
              color: AppColors.cream.withValues(alpha: 0.6),
            ),
          ),
        ],
      ),
    );
  }
}

class _AffirmationCard extends StatelessWidget {
  const _AffirmationCard({required this.affirmation});

  final Affirmation affirmation;

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      onTap: () => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (_) => DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.6,
          builder: (context, controller) => ListView(
            controller: controller,
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
            children: [
              Text(
                affirmation.title,
                style: AppFonts.display(
                    const TextStyle(fontSize: 24, color: AppColors.clay700)),
              ),
              const SizedBox(height: 14),
              Text(
                affirmation.content,
                style: const TextStyle(
                    fontSize: 15.5, height: 1.8, color: AppColors.clay600),
              ),
              const SizedBox(height: 18),
              Text(
                '— ${affirmation.authorName} · '
                '${D.medium(affirmation.createdAt)}',
                style:
                    const TextStyle(fontSize: 12.5, color: AppColors.clay400),
              ),
            ],
          ),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const IconChip(AppIcons.sparkles, tone: IconTone.blush, size: 42),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  affirmation.title,
                  style: AppFonts.display(const TextStyle(
                    fontSize: 17,
                    height: 1.2,
                    color: AppColors.clay700,
                  )),
                ),
                const SizedBox(height: 5),
                Text(
                  affirmation.content,
                  style: const TextStyle(
                      fontSize: 13, height: 1.5, color: AppColors.clay500),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Text(
                  '${affirmation.authorName} · '
                  '${D.relative(affirmation.createdAt)}',
                  style: const TextStyle(
                      fontSize: 11.5, color: AppColors.clay300),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ComposeSheet extends ConsumerStatefulWidget {
  const _ComposeSheet();

  @override
  ConsumerState<_ComposeSheet> createState() => _ComposeSheetState();
}

class _ComposeSheetState extends ConsumerState<_ComposeSheet> {
  final _title = TextEditingController();
  final _content = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    _content.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_title.text.trim().isEmpty || _content.text.trim().isEmpty) {
      context.showError('A title and the affirmation itself are both needed.');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(ministryRepositoryProvider).createAffirmation(
            title: _title.text.trim(),
            content: _content.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      context.showSuccess('Posted.');
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
              'An affirmation',
              style: AppFonts.display(
                  const TextStyle(fontSize: 21, color: AppColors.clay700)),
            ),
            const SizedBox(height: 4),
            const Text(
              'Something short the ministry can carry through the week.',
              style: TextStyle(fontSize: 13, color: AppColors.clay400),
            ),
            const SizedBox(height: 20),
            AppTextField(
              label: 'Title',
              controller: _title,
              required: true,
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'The affirmation',
              controller: _content,
              required: true,
              maxLines: 8,
              minLines: 4,
            ),
            const SizedBox(height: 22),
            PrimaryButton(
              label: 'Post it',
              icon: AppIcons.send,
              loading: _busy,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
