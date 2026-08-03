import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/fundraising/fundraising_menu.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/fundraising.dart';
import '../../data/repositories/fundraising_repository.dart';

final braaisProvider = FutureProvider<List<BraaiEvent>>((ref) {
  return ref.watch(fundraisingRepositoryProvider).braais();
});

/// Fundraising — plan the Sunday braai, watch the roster fill up, and drop
/// into a braai's orders desk. Mirrors `/manage/fundraising`.
class FundraisingHubScreen extends ConsumerWidget {
  const FundraisingHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final access = ref.watch(accessProvider);
    final async = ref.watch(braaisProvider);
    final canPlan = access.can('plan_fundraising_braai');

    if (!access.canView('fundraising')) {
      return const AppScaffold(
        title: 'Fundraising',
        body: NoAccessView(),
      );
    }

    return AppScaffold(
      title: 'Fundraising',
      subtitle: 'Plan the Sunday braai and follow up on confirmations',
      onRefresh: () async => ref.invalidate(braaisProvider),
      actions: [
        IconButton(
          icon: const Icon(AppIcons.store, size: 20),
          color: AppColors.clay500,
          tooltip: 'The order page buyers see',
          onPressed: () => context.push('/fundraising/order'),
        ),
        if (canPlan)
          IconButton(
            icon: const Icon(AppIcons.receipt, size: 20),
            color: AppColors.clay500,
            tooltip: 'Menu & settings',
            onPressed: () => context.push('/manage/fundraising/settings'),
          ),
      ],
      floatingActionButton: canPlan
          ? FloatingActionButton.extended(
              onPressed: () => _newBraai(context, ref),
              icon: const Icon(AppIcons.plus, size: 19),
              label: const Text('New braai'),
            )
          : null,
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(braaisProvider),
        ),
        data: (all) {
          final live = all.where((b) => !b.isArchived).toList();
          final upcoming = live.where((b) => !b.isPast).toList();
          final past = live.where((b) => b.isPast).toList().reversed.toList();

          final openSeats = upcoming.fold<int>(
            0,
            (sum, b) => sum + (kBraaiTotalResponsibilities - b.assignmentCount),
          );
          final awaiting = live.fold<int>(
            0,
            (sum, b) => sum + (b.assignmentCount - b.confirmedCount),
          );

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              StatStripLux(
                columns: 3,
                items: [
                  StripItem(
                    icon: AppIcons.calendar,
                    tone: IconTone.teal,
                    label: 'Upcoming',
                    value: '${upcoming.length}',
                    hint: 'braais ahead',
                  ),
                  StripItem(
                    icon: AppIcons.alert,
                    tone: IconTone.blush,
                    label: 'Unassigned',
                    value: '$openSeats',
                    hint: 'need an owner',
                    highlight: openSeats > 0,
                  ),
                  StripItem(
                    icon: AppIcons.clock,
                    tone: IconTone.gold,
                    label: 'Awaiting',
                    value: '$awaiting',
                    hint: 'to confirm',
                    highlight: awaiting > 0,
                  ),
                ],
              ),
              const SizedBox(height: 24),

              const SectionHeading(
                title: 'Upcoming braais',
                icon: AppIcons.flame,
              ),
              const SizedBox(height: 12),
              if (upcoming.isEmpty)
                EmptyStateLux(
                  icon: AppIcons.flame,
                  tone: IconTone.gold,
                  title: 'No braais planned',
                  description: 'Create a Sunday braai to start assigning '
                      'responsibilities to your team.',
                  action: canPlan
                      ? PrimaryButton(
                          label: 'New braai',
                          expand: false,
                          icon: AppIcons.plus,
                          onPressed: () => _newBraai(context, ref),
                        )
                      : null,
                )
              else
                for (final braai in upcoming)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _BraaiCard(braai: braai, upcoming: true),
                  ),

              if (past.isNotEmpty) ...[
                const SizedBox(height: 26),
                const SectionHeading(
                  title: 'Past braais',
                  icon: AppIcons.history,
                  tone: IconTone.clay,
                ),
                const SizedBox(height: 12),
                for (final braai in past.take(8))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _BraaiCard(braai: braai, upcoming: false),
                  ),
              ],
            ],
          );
        },
      ),
    );
  }

  Future<void> _newBraai(BuildContext context, WidgetRef ref) async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _NewBraaiSheet(),
    );
    if (created == true) ref.invalidate(braaisProvider);
  }
}

class _BraaiCard extends StatelessWidget {
  const _BraaiCard({required this.braai, required this.upcoming});

  final BraaiEvent braai;
  final bool upcoming;

  @override
  Widget build(BuildContext context) {
    final filled = braai.assignmentCount;
    final progress =
        kBraaiTotalResponsibilities == 0 ? 0.0 : filled / kBraaiTotalResponsibilities;

    return LuxCard(
      onTap: () => context.push('/manage/fundraising/braai/${braai.id}'),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconChip(
                AppIcons.flame,
                tone: upcoming ? IconTone.gold : IconTone.clay,
                size: 44,
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      braai.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.clay700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      [
                        D.dayMedium(braai.eventDate),
                        if ((braai.venue ?? '').isNotEmpty) braai.venue!,
                      ].join(' · '),
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.clay400),
                    ),
                  ],
                ),
              ),
              const Icon(AppIcons.chevronRight,
                  size: 18, color: AppColors.clay300),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: progress.clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: AppColors.clay100,
              valueColor: AlwaysStoppedAnimation(
                progress >= 1 ? AppColors.emerald600 : AppColors.gold,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 7,
            runSpacing: 7,
            children: [
              StatusBadge(
                '$filled / $kBraaiTotalResponsibilities assigned',
                tone: filled >= kBraaiTotalResponsibilities
                    ? IconTone.emerald
                    : IconTone.amber,
                dense: true,
              ),
              if (braai.confirmedCount > 0)
                StatusBadge('${braai.confirmedCount} confirmed',
                    tone: IconTone.emerald, dense: true),
              if (braai.declinedCount > 0)
                StatusBadge('${braai.declinedCount} declined',
                    tone: IconTone.rose, dense: true),
            ],
          ),
        ],
      ),
    );
  }
}

class _NewBraaiSheet extends ConsumerStatefulWidget {
  const _NewBraaiSheet();

  @override
  ConsumerState<_NewBraaiSheet> createState() => _NewBraaiSheetState();
}

class _NewBraaiSheetState extends ConsumerState<_NewBraaiSheet> {
  final _title = TextEditingController(text: 'Sunday Fundraising Braai');
  final _venue = TextEditingController();
  final _notes = TextEditingController();
  DateTime? _date;
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    _venue.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date ?? D.nextSunday(now),
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 2),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _save() async {
    if (_date == null) {
      context.showError('Pick the date of the braai.');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(fundraisingRepositoryProvider).createBraai(
            eventDate: _date!,
            title: _title.text.trim(),
            venue: _venue.text.trim(),
            notes: _notes.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      context.showSuccess('Braai created.');
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
            const SectionHeading(
              title: 'New braai',
              icon: AppIcons.flame,
              subtitle: 'A Sunday to plan the roster around.',
            ),
            const SizedBox(height: 18),
            AppTextField(label: 'Title', controller: _title),
            const SizedBox(height: 14),
            const FieldLabel('Date', required: true),
            LuxTile(
              title: _date == null ? 'Pick a date' : D.long(_date),
              icon: AppIcons.calendar,
              dense: true,
              onTap: _pickDate,
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'Venue (optional)',
              controller: _venue,
              hint: 'Church grounds',
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'Notes (optional)',
              controller: _notes,
              minLines: 2,
              maxLines: 4,
            ),
            const SizedBox(height: 22),
            PrimaryButton(
              label: 'Create braai',
              icon: AppIcons.check,
              loading: _busy,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }
}
