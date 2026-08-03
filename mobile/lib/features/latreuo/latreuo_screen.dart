import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
import '../../core/auth/auth_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import 'latreuo_models.dart';
import 'latreuo_pdf.dart';

/// Latreuo — the worship cycle planner.
///
/// Seven steps covering one two-Sunday cycle. The draft autosaves to the
/// device on every change, because planning a cycle takes an hour and a phone
/// call in the middle of it should not cost that hour.
class LatreuoScreen extends ConsumerStatefulWidget {
  const LatreuoScreen({super.key});

  @override
  ConsumerState<LatreuoScreen> createState() => _LatreuoScreenState();
}

class _LatreuoScreenState extends ConsumerState<LatreuoScreen> {
  LatreuoDraftStore? _store;
  LatreuoCycle _cycle = const LatreuoCycle();
  int _step = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    unawaited(_restore());
  }

  Future<void> _restore() async {
    final store = await LatreuoDraftStore.open();
    final draft = store.load();
    if (!mounted) return;
    setState(() {
      _store = store;
      _cycle = draft ??
          LatreuoCycle.empty(
            preparedBy: ref.read(userOrNullProvider)?.name ?? '',
          );
      _loading = false;
    });
    if (draft != null && mounted) {
      context.showInfo('Picked up where you left off.');
    }
  }

  void _update(LatreuoCycle next) {
    setState(() => _cycle = next);
    unawaited(_store?.save(next));
  }

  Future<void> _startOver() async {
    final ok = await confirmAction(
      context,
      title: 'Start a new cycle?',
      message: 'This clears every step and removes the saved draft on this '
          'device.',
      confirmLabel: 'Start over',
      destructive: true,
    );
    if (!ok) return;
    await _store?.clear();
    if (!mounted) return;
    setState(() {
      _cycle = LatreuoCycle.empty(
        preparedBy: ref.read(userOrNullProvider)?.name ?? '',
      );
      _step = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final access = ref.watch(accessProvider);
    if (!access.canView('latreou') && !access.can('latreou_access')) {
      return const AppScaffold(
        title: 'Latreuo',
        body: NoAccessView(
          message: 'The Latreuo planner is for the worship team.',
        ),
      );
    }

    if (_loading) {
      return const AppScaffold(title: 'Latreuo', body: LoadingView());
    }

    return AppScaffold(
      title: 'Latreuo',
      subtitle: '${kLatreuoSteps[_step]} · step ${_step + 1} of '
          '${kLatreuoSteps.length}',
      actions: [
        IconButton(
          icon: const Icon(AppIcons.refresh),
          tooltip: 'Start over',
          onPressed: _startOver,
        ),
      ],
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          _StepStrip(
            step: _step,
            onSelect: (i) => setState(() => _step = i),
          ),
          const SizedBox(height: 20),
          ..._stepBody(),
          const SizedBox(height: 24),
          Row(
            children: [
              if (_step > 0)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => setState(() => _step -= 1),
                    icon: const Icon(AppIcons.chevronLeft, size: 16),
                    label: const Text('Back'),
                    style:
                        OutlinedButton.styleFrom(minimumSize: const Size(0, 46)),
                  ),
                ),
              if (_step > 0) const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: _step < kLatreuoSteps.length - 1
                    ? PrimaryButton(
                        label: 'Continue',
                        icon: AppIcons.forward,
                        onPressed: () => setState(() => _step += 1),
                      )
                    : PrimaryButton(
                        label: 'Export the sheet',
                        icon: AppIcons.printer,
                        onPressed: _export,
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _export() async {
    try {
      await LatreuoPdf.share(_cycle);
    } catch (e) {
      if (mounted) context.showError('Could not build the sheet: $e');
    }
  }

  List<Widget> _stepBody() => switch (_step) {
        0 => _overview(),
        1 => _sunday(first: true),
        2 => _sunday(first: false),
        3 => _uniforms(),
        4 => _rehearsals(),
        5 => _scripture(),
        _ => _preview(),
      };

  // ── Step 1: the cycle itself ──
  List<Widget> _overview() => [
        const SectionHeading(
          title: 'This cycle',
          icon: AppIcons.music,
          tone: IconTone.gold,
        ),
        const SizedBox(height: 12),
        LuxCard(
          child: Column(
            children: [
              AppTextField(
                label: 'Cycle name',
                initialValue: _cycle.cycleName,
                hint: 'e.g. August 2026 cycle',
                onChanged: (v) => _update(_cycle.copyWith(cycleName: v)),
              ),
              const SizedBox(height: 14),
              AppTextField(
                label: 'Prepared by',
                initialValue: _cycle.preparedBy,
                textCapitalization: TextCapitalization.words,
                onChanged: (v) => _update(_cycle.copyWith(preparedBy: v)),
              ),
              const SizedBox(height: 16),
              _DateRow(
                label: 'First Sunday',
                value: D.fromIso(_cycle.firstSunday.date),
                onPick: (d) => _update(_cycle.copyWith(
                    firstSunday: _cycle.firstSunday.copyWith(date: D.iso(d)))),
              ),
              const SizedBox(height: 14),
              _DateRow(
                label: 'Second Sunday',
                value: D.fromIso(_cycle.secondSunday.date),
                onPick: (d) => _update(_cycle.copyWith(
                    secondSunday:
                        _cycle.secondSunday.copyWith(date: D.iso(d)))),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const NoticeCard(
          tone: IconTone.periwinkle,
          icon: AppIcons.info,
          message: 'Your work saves to this phone as you go, so you can put it '
              'down and come back. Nothing leaves the device until you export.',
        ),
      ];

  // ── Steps 2 & 3: the two Sundays ──
  List<Widget> _sunday({required bool first}) {
    final plan = first ? _cycle.firstSunday : _cycle.secondSunday;
    void setPlan(SundayPlan next) => _update(first
        ? _cycle.copyWith(firstSunday: next)
        : _cycle.copyWith(secondSunday: next));

    return [
      SectionHeading(
        title: first ? 'First Sunday' : 'Second Sunday',
        icon: AppIcons.church,
        tone: first ? IconTone.gold : IconTone.teal,
        subtitle: D.long(D.fromIso(plan.date)),
      ),
      const SizedBox(height: 12),
      _SongSection(
        label: 'Praise',
        songs: plan.praise,
        onChanged: (songs) => setPlan(plan.copyWith(praise: songs)),
        prefix: first ? 's1-praise' : 's2-praise',
      ),
      const SizedBox(height: 18),
      _SongSection(
        label: 'Worship',
        songs: plan.worship,
        onChanged: (songs) => setPlan(plan.copyWith(worship: songs)),
        prefix: first ? 's1-worship' : 's2-worship',
      ),
      const SizedBox(height: 18),
      const SectionHeading(
        title: 'Special item',
        icon: AppIcons.star,
        tone: IconTone.lavender,
      ),
      const SizedBox(height: 12),
      LuxCard(
        child: Column(
          children: [
            AppTextField(
              label: 'What',
              initialValue: plan.specialItem.title,
              hint: 'A dance, a poem, a testimony…',
              onChanged: (v) => setPlan(plan.copyWith(
                  specialItem: plan.specialItem.copyWith(title: v))),
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'Who',
              initialValue: plan.specialItem.responsible,
              textCapitalization: TextCapitalization.words,
              onChanged: (v) => setPlan(plan.copyWith(
                  specialItem: plan.specialItem.copyWith(responsible: v))),
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'Link',
              initialValue: plan.specialItem.link,
              keyboardType: TextInputType.url,
              textCapitalization: TextCapitalization.none,
              onChanged: (v) => setPlan(plan.copyWith(
                  specialItem: plan.specialItem.copyWith(link: v))),
            ),
          ],
        ),
      ),
    ];
  }

  // ── Step 4 ──
  List<Widget> _uniforms() => [
        const SectionHeading(
          title: 'What everyone wears',
          icon: AppIcons.shirt,
          tone: IconTone.blush,
        ),
        const SizedBox(height: 12),
        LuxCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Builder(
                builder: (context) =>
                    Text('FIRST SUNDAY', style: context.eyebrow),
              ),
              const SizedBox(height: 10),
              AppTextField(
                label: 'Gents',
                initialValue: _cycle.uniforms.firstSundayGents,
                onChanged: (v) => _update(_cycle.copyWith(
                    uniforms: _cycle.uniforms.copyWith(firstSundayGents: v))),
              ),
              const SizedBox(height: 14),
              AppTextField(
                label: 'Ladies',
                initialValue: _cycle.uniforms.firstSundayLadies,
                onChanged: (v) => _update(_cycle.copyWith(
                    uniforms: _cycle.uniforms.copyWith(firstSundayLadies: v))),
              ),
              const SizedBox(height: 20),
              Builder(
                builder: (context) =>
                    Text('SECOND SUNDAY', style: context.eyebrow),
              ),
              const SizedBox(height: 10),
              AppTextField(
                label: 'Gents',
                initialValue: _cycle.uniforms.secondSundayGents,
                onChanged: (v) => _update(_cycle.copyWith(
                    uniforms: _cycle.uniforms.copyWith(secondSundayGents: v))),
              ),
              const SizedBox(height: 14),
              AppTextField(
                label: 'Ladies',
                initialValue: _cycle.uniforms.secondSundayLadies,
                onChanged: (v) => _update(_cycle.copyWith(
                    uniforms:
                        _cycle.uniforms.copyWith(secondSundayLadies: v))),
              ),
              const SizedBox(height: 16),
              AppTextField(
                label: 'Notes',
                initialValue: _cycle.uniforms.notes,
                maxLines: 3,
                onChanged: (v) => _update(_cycle.copyWith(
                    uniforms: _cycle.uniforms.copyWith(notes: v))),
              ),
            ],
          ),
        ),
      ];

  // ── Step 5 ──
  List<Widget> _rehearsals() => [
        SectionHeading(
          title: 'Rehearsals',
          icon: AppIcons.clock,
          tone: IconTone.periwinkle,
          action: TextButton.icon(
            onPressed: () => _update(_cycle.copyWith(rehearsals: [
              ..._cycle.rehearsals,
              Rehearsal(
                id: 'r${_cycle.rehearsals.length + 1}-'
                    '${_cycle.rehearsals.length}',
                time: '18:00',
                location: 'Church',
              ),
            ])),
            icon: const Icon(AppIcons.plus, size: 15),
            label: const Text('Add'),
          ),
        ),
        const SizedBox(height: 12),
        for (var i = 0; i < _cycle.rehearsals.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _RehearsalCard(
              rehearsal: _cycle.rehearsals[i],
              index: i,
              onChanged: (next) {
                final list = [..._cycle.rehearsals];
                list[i] = next;
                _update(_cycle.copyWith(rehearsals: list));
              },
              onRemove: () {
                final list = [..._cycle.rehearsals]..removeAt(i);
                _update(_cycle.copyWith(rehearsals: list));
              },
            ),
          ),
        if (_cycle.rehearsals.isEmpty)
          const LuxCard(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'No rehearsals scheduled. Add one so the team knows when to '
                'come.',
                style:
                    TextStyle(fontSize: 13.5, color: AppColors.clay400),
              ),
            ),
          ),
      ];

  // ── Step 6 ──
  List<Widget> _scripture() => [
        const SectionHeading(
          title: 'What this cycle sits on',
          icon: AppIcons.bible,
          tone: IconTone.sage,
        ),
        const SizedBox(height: 12),
        LuxCard(
          child: Column(
            children: [
              AppTextField(
                label: 'Scripture reference',
                initialValue: _cycle.scriptureReference,
                hint: 'e.g. Psalm 133',
                onChanged: (v) =>
                    _update(_cycle.copyWith(scriptureReference: v)),
              ),
              const SizedBox(height: 14),
              AppTextField(
                label: 'The passage',
                initialValue: _cycle.scriptureText,
                maxLines: 6,
                minLines: 3,
                onChanged: (v) => _update(_cycle.copyWith(scriptureText: v)),
              ),
              const SizedBox(height: 14),
              AppTextField(
                label: 'Prayer direction',
                initialValue: _cycle.prayerDirection,
                maxLines: 5,
                minLines: 3,
                hint: 'What the team is praying towards this cycle',
                onChanged: (v) =>
                    _update(_cycle.copyWith(prayerDirection: v)),
              ),
            ],
          ),
        ),
      ];

  // ── Step 7 ──
  List<Widget> _preview() => [
        const SectionHeading(
          title: 'The sheet',
          icon: AppIcons.fileText,
          tone: IconTone.gold,
        ),
        const SizedBox(height: 12),
        LuxCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _cycle.cycleName.isEmpty ? 'Worship cycle' : _cycle.cycleName,
                style: AppFonts.display(
                    const TextStyle(fontSize: 22, color: AppColors.clay700)),
              ),
              if (_cycle.preparedBy.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  'Prepared by ${_cycle.preparedBy}',
                  style: const TextStyle(
                      fontSize: 12.5, color: AppColors.clay400),
                ),
              ],
              const SizedBox(height: 16),
              _PreviewSunday(label: 'First Sunday', plan: _cycle.firstSunday),
              const SizedBox(height: 16),
              _PreviewSunday(label: 'Second Sunday', plan: _cycle.secondSunday),
              if (_cycle.rehearsals.isNotEmpty) ...[
                const SizedBox(height: 16),
                Builder(
                  builder: (context) =>
                      Text('REHEARSALS', style: context.eyebrow),
                ),
                const SizedBox(height: 8),
                for (final r in _cycle.rehearsals)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      '${D.dayMedium(D.fromIso(r.date))} · ${r.time}'
                      '${r.location.isEmpty ? '' : ' · ${r.location}'}'
                      '${r.focus.isEmpty ? '' : ' — ${r.focus}'}',
                      style: const TextStyle(
                          fontSize: 13, height: 1.5, color: AppColors.clay600),
                    ),
                  ),
              ],
              if (_cycle.scriptureReference.isNotEmpty) ...[
                const SizedBox(height: 16),
                Builder(
                  builder: (context) =>
                      Text('SCRIPTURE', style: context.eyebrow),
                ),
                const SizedBox(height: 6),
                Text(
                  _cycle.scriptureReference,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.clay700,
                  ),
                ),
                if (_cycle.scriptureText.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    _cycle.scriptureText,
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.6,
                      fontStyle: FontStyle.italic,
                      color: AppColors.clay600,
                    ),
                  ),
                ],
              ],
            ],
          ),
        ),
      ];
}

class _StepStrip extends StatelessWidget {
  const _StepStrip({required this.step, required this.onSelect});

  final int step;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var i = 0; i < kLatreuoSteps.length; i++)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: InkWell(
                onTap: () => onSelect(i),
                borderRadius: BorderRadius.circular(999),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
                  decoration: BoxDecoration(
                    color: i == step
                        ? AppColors.gold.withValues(alpha: 0.18)
                        : i < step
                            ? AppColors.teal.withValues(alpha: 0.12)
                            : Colors.white,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: i == step ? AppColors.gold : AppColors.border,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (i < step) ...[
                        const Icon(AppIcons.check,
                            size: 13, color: AppColors.teal),
                        const SizedBox(width: 6),
                      ],
                      Text(
                        kLatreuoSteps[i],
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight:
                              i == step ? FontWeight.w700 : FontWeight.w500,
                          color: i == step
                              ? AppColors.goldDark
                              : AppColors.clay500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _SongSection extends StatelessWidget {
  const _SongSection({
    required this.label,
    required this.songs,
    required this.onChanged,
    required this.prefix,
  });

  final String label;
  final List<Song> songs;
  final ValueChanged<List<Song>> onChanged;
  final String prefix;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeading(
          title: label,
          icon: AppIcons.music,
          tone: label == 'Praise' ? IconTone.amber : IconTone.periwinkle,
          action: TextButton.icon(
            onPressed: () => onChanged(
                [...songs, Song(id: '$prefix-${songs.length}')]),
            icon: const Icon(AppIcons.plus, size: 15),
            label: const Text('Add'),
          ),
        ),
        const SizedBox(height: 12),
        for (var i = 0; i < songs.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: LuxCard(
              padding: const EdgeInsets.all(14),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: AppTextField(
                          label: 'Song ${i + 1}',
                          initialValue: songs[i].title,
                          onChanged: (v) {
                            final list = [...songs];
                            list[i] = list[i].copyWith(title: v);
                            onChanged(list);
                          },
                        ),
                      ),
                      if (songs.length > 1)
                        Padding(
                          padding: const EdgeInsets.only(left: 6, top: 18),
                          child: IconButton(
                            icon: const Icon(AppIcons.trash, size: 16),
                            color: AppColors.clay300,
                            onPressed: () {
                              final list = [...songs]..removeAt(i);
                              onChanged(list);
                            },
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  AppTextField(
                    label: 'Led by',
                    initialValue: songs[i].leader,
                    textCapitalization: TextCapitalization.words,
                    onChanged: (v) {
                      final list = [...songs];
                      list[i] = list[i].copyWith(leader: v);
                      onChanged(list);
                    },
                  ),
                  const SizedBox(height: 12),
                  AppTextField(
                    label: 'Link',
                    initialValue: songs[i].youtubeLink,
                    keyboardType: TextInputType.url,
                    textCapitalization: TextCapitalization.none,
                    hint: 'So the team can learn it',
                    onChanged: (v) {
                      final list = [...songs];
                      list[i] = list[i].copyWith(youtubeLink: v);
                      onChanged(list);
                    },
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _RehearsalCard extends StatelessWidget {
  const _RehearsalCard({
    required this.rehearsal,
    required this.index,
    required this.onChanged,
    required this.onRemove,
  });

  final Rehearsal rehearsal;
  final int index;
  final ValueChanged<Rehearsal> onChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _DateRow(
                  label: 'Rehearsal ${index + 1}',
                  value: D.fromIso(rehearsal.date),
                  onPick: (d) => onChanged(rehearsal.copyWith(date: D.iso(d))),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(left: 6, top: 18),
                child: IconButton(
                  icon: const Icon(AppIcons.trash, size: 16),
                  color: AppColors.clay300,
                  onPressed: onRemove,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AppTextField(
                  label: 'Time',
                  initialValue: rehearsal.time,
                  hint: '18:00',
                  onChanged: (v) => onChanged(rehearsal.copyWith(time: v)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: AppTextField(
                  label: 'Where',
                  initialValue: rehearsal.location,
                  onChanged: (v) =>
                      onChanged(rehearsal.copyWith(location: v)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          AppTextField(
            label: 'Led by',
            initialValue: rehearsal.coordinator,
            textCapitalization: TextCapitalization.words,
            onChanged: (v) => onChanged(rehearsal.copyWith(coordinator: v)),
          ),
          const SizedBox(height: 12),
          AppTextField(
            label: 'Focus',
            initialValue: rehearsal.focus,
            hint: 'What this rehearsal is for',
            onChanged: (v) => onChanged(rehearsal.copyWith(focus: v)),
          ),
        ],
      ),
    );
  }
}

class _DateRow extends StatelessWidget {
  const _DateRow({
    required this.label,
    required this.value,
    required this.onPick,
  });

  final String label;
  final DateTime? value;
  final ValueChanged<DateTime> onPick;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FieldLabel(label),
        InkWell(
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: value ?? DateTime.now(),
              firstDate: DateTime.now().subtract(const Duration(days: 60)),
              lastDate: DateTime.now().add(const Duration(days: 365)),
            );
            if (picked != null) onPick(picked);
          },
          borderRadius: BorderRadius.circular(AppRadius.base),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppRadius.base),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                const Icon(AppIcons.calendar,
                    size: 16, color: AppColors.clay300),
                const SizedBox(width: 11),
                Expanded(
                  child: Text(
                    value == null ? 'Choose a date' : D.dayMedium(value),
                    style: TextStyle(
                      fontSize: 14.5,
                      color:
                          value == null ? AppColors.clay400 : AppColors.clay700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _PreviewSunday extends StatelessWidget {
  const _PreviewSunday({required this.label, required this.plan});

  final String label;
  final SundayPlan plan;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${label.toUpperCase()} · '
          '${D.dayMedium(D.fromIso(plan.date)).toUpperCase()}',
          style: context.eyebrow,
        ),
        const SizedBox(height: 8),
        if (plan.songCount == 0)
          const Text(
            'No songs chosen yet.',
            style: TextStyle(fontSize: 13, color: AppColors.clay300),
          )
        else ...[
          for (final song in [...plan.praise, ...plan.worship])
            if (!song.isEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  '${song.title}'
                  '${song.leader.isEmpty ? '' : ' — ${song.leader}'}',
                  style: const TextStyle(
                      fontSize: 13.5, height: 1.5, color: AppColors.clay600),
                ),
              ),
        ],
        if (!plan.specialItem.isEmpty) ...[
          const SizedBox(height: 4),
          Text(
            'Special: ${plan.specialItem.title}'
            '${plan.specialItem.responsible.isEmpty ? '' : ' — ${plan.specialItem.responsible}'}',
            style: const TextStyle(
                fontSize: 13, height: 1.5, color: AppColors.clay500),
          ),
        ],
      ],
    );
  }
}
