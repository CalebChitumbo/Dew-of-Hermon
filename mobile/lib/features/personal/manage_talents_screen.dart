import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/enums.dart';
import '../../data/models/ministry.dart';
import '../../data/repositories/ministry_repository.dart';
import 'talents_screen.dart' show openSampleLink;

/// Every talent submission — the rules only return the whole collection to a
/// department lead, so a member reaching this screen simply sees their own.
final allTalentsProvider = StreamProvider<List<TalentSubmission>>((ref) {
  return ref.watch(ministryRepositoryProvider).talentsStream();
});

/// What leadership can do to a submission, and how each reads.
enum TalentAction {
  shortlist('SHORTLIST', 'Shortlist', 'Shortlist into the talent pool', false,
      false),
  slot('SLOT', 'Slot in', 'Slot into an opportunity', false, false),
  decline('DECLINE', 'Decline', 'Decline submission', true, true),
  returnToPool('RETURN_TO_POOL', 'Return to pool', 'Return to the talent pool',
      false, true),
  complete('COMPLETE', 'Mark completed', 'Mark showcase completed', false,
      false);

  const TalentAction(
      this.wire, this.verb, this.title, this.needsReason, this.destructive);

  final String wire;
  final String verb;
  final String title;

  /// Whether the comment box is framed as a reason shared with the member.
  final bool needsReason;

  final bool destructive;
}

/// Talent Submissions — the review queue, the pool, and who is slotted in.
/// Mirrors `/manage/talents`.
class ManageTalentsScreen extends ConsumerStatefulWidget {
  const ManageTalentsScreen({super.key});

  @override
  ConsumerState<ManageTalentsScreen> createState() =>
      _ManageTalentsScreenState();
}

class _ManageTalentsScreenState extends ConsumerState<ManageTalentsScreen> {
  TalentCategory? _categoryFilter;
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(allTalentsProvider);

    return AppScaffold(
      title: 'Talent Submissions',
      subtitle: 'Review, pool, and slot members into opportunities',
      actions: [
        PopupMenuButton<TalentCategory?>(
          icon: Icon(
            AppIcons.filter,
            size: 20,
            color: _categoryFilter == null
                ? AppColors.clay500
                : AppColors.goldDark,
          ),
          tooltip: 'Filter by category',
          onSelected: (v) => setState(() => _categoryFilter = v),
          itemBuilder: (_) => [
            const PopupMenuItem<TalentCategory?>(
              value: null,
              child: Text('All categories'),
            ),
            for (final c in TalentCategory.values)
              PopupMenuItem<TalentCategory?>(value: c, child: Text(c.label)),
          ],
        ),
      ],
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: '$e'),
        data: (all) {
          final visible = _categoryFilter == null
              ? all
              : all.where((s) => s.category == _categoryFilter).toList();

          final review = visible
              .where((s) => s.status == TalentSubmissionStatus.pendingReview)
              .toList();
          final pool = visible
              .where((s) => s.status == TalentSubmissionStatus.shortlisted)
              .toList();
          final slotted = visible
              .where((s) => s.status == TalentSubmissionStatus.slotted)
              .toList();
          final closed = visible
              .where((s) =>
                  s.status == TalentSubmissionStatus.completed ||
                  s.status == TalentSubmissionStatus.declined ||
                  s.status == TalentSubmissionStatus.withdrawn)
              .take(15)
              .toList();

          if (all.isEmpty) {
            return const EmptyStateLux(
              icon: AppIcons.inbox,
              tone: IconTone.gold,
              title: 'No talent submissions yet',
              description:
                  'When members put their talents forward on the Talent '
                  'Showcase page, they land here for you to review and slot in.',
            );
          }

          final groups = <(List<TalentSubmission>, String, String)>[
            (
              review,
              'Nothing is waiting for review right now.',
              'Shortlist to keep someone in the pool for later, slot them '
                  'straight into an opportunity, or decline with feedback.',
            ),
            (
              pool,
              'The pool is empty — shortlist submissions to build it up.',
              'Shortlisted and waiting. When an event or service has room, '
                  'slot them in.',
            ),
            (
              slotted,
              'No one is currently slotted into an opportunity.',
              'Mark it completed once they have showcased, or return them to '
                  'the pool if the opportunity fell through.',
            ),
            (
              closed,
              'Nothing closed yet.',
              'The last fifteen showcased, declined or withdrawn submissions.',
            ),
          ];
          final tab = _tab.clamp(0, groups.length - 1);
          final (list, emptyLine, blurb) = groups[tab];

          return Column(
            children: [
              SegmentedTabs(
                tabs: const [
                  'Review',
                  'Pool',
                  'Slotted',
                  'Closed',
                ],
                selected: tab,
                onSelect: (i) => setState(() => _tab = i),
                counts: {
                  0: review.length,
                  1: pool.length,
                  2: slotted.length,
                  3: closed.length,
                },
              ),
              const SizedBox(height: 16),
              Expanded(
                child: list.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(28),
                          child: Text(
                            emptyLine,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 13.5, color: AppColors.clay400),
                          ),
                        ),
                      )
                    : ListView(
                        padding: EdgeInsets.zero,
                        children: [
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(
                              blurb,
                              style: const TextStyle(
                                  fontSize: 12,
                                  height: 1.5,
                                  color: AppColors.clay400),
                            ),
                          ),
                          for (final sub in list)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: TalentReviewCard(
                                submission: sub,
                                actions: _actionsFor(sub.status),
                              ),
                            ),
                        ],
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  List<TalentAction> _actionsFor(TalentSubmissionStatus status) =>
      switch (status) {
        TalentSubmissionStatus.pendingReview => const [
            TalentAction.shortlist,
            TalentAction.slot,
            TalentAction.decline,
          ],
        TalentSubmissionStatus.shortlisted => const [
            TalentAction.slot,
            TalentAction.decline,
          ],
        TalentSubmissionStatus.slotted => const [
            TalentAction.complete,
            TalentAction.returnToPool,
          ],
        _ => const <TalentAction>[],
      };
}

// ─── One submission, as leadership sees it ───

class TalentReviewCard extends ConsumerWidget {
  const TalentReviewCard({
    super.key,
    required this.submission,
    required this.actions,
  });

  final TalentSubmission submission;
  final List<TalentAction> actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sub = submission;
    final slotted = sub.status == TalentSubmissionStatus.slotted ||
        sub.status == TalentSubmissionStatus.completed;

    return LuxCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              MemberAvatar(initials: _initials(sub.userName), size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sub.userName,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.clay700,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        StatusBadge.forStatus(sub.status.wire,
                            label: sub.status.label, dense: true),
                        StatusBadge(sub.categoryLabel,
                            tone: IconTone.clay, dense: true),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            sub.title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.clay600,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            sub.description,
            style: const TextStyle(
                fontSize: 13, height: 1.6, color: AppColors.clay500),
          ),

          if ((sub.experience ?? '').isNotEmpty) ...[
            const SizedBox(height: 9),
            Text.rich(
              TextSpan(children: [
                const TextSpan(
                  text: 'Experience: ',
                  style: TextStyle(
                      fontWeight: FontWeight.w600, color: AppColors.clay600),
                ),
                TextSpan(text: sub.experience),
              ]),
              style: const TextStyle(
                  fontSize: 12, height: 1.5, color: AppColors.clay500),
            ),
          ],

          const SizedBox(height: 9),
          Text(
            [
              'Submitted ${D.medium(sub.createdAt)}',
              if ((sub.userEmail ?? '').isNotEmpty) sub.userEmail!,
              if ((sub.availabilityNote ?? '').isNotEmpty)
                'Available: ${sub.availabilityNote}',
            ].join(' · '),
            style: const TextStyle(fontSize: 11.5, color: AppColors.clay400),
          ),

          if ((sub.sampleLink ?? '').isNotEmpty) ...[
            const SizedBox(height: 10),
            InkWell(
              onTap: () => openSampleLink(context, sub.sampleLink!),
              borderRadius: BorderRadius.circular(AppRadius.sm),
              child: const Padding(
                padding: EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(AppIcons.externalLink,
                        size: 14, color: AppColors.blue600),
                    SizedBox(width: 6),
                    Text(
                      'Watch / listen to their sample',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.blue600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],

          if (slotted && (sub.opportunityTitle ?? '').isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 11),
              decoration: BoxDecoration(
                color: AppColors.emerald50,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(AppIcons.calendarCheck,
                          size: 15, color: AppColors.emerald600),
                      const SizedBox(width: 7),
                      Expanded(
                        child: Text(
                          '${sub.opportunityTitle}'
                          '${sub.opportunityDate == null ? '' : ' · ${D.dayMedium(sub.opportunityDate!)}'}',
                          style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.emerald600,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if ((sub.opportunityNotes ?? '').isNotEmpty) ...[
                    const SizedBox(height: 5),
                    Text(
                      sub.opportunityNotes!,
                      style: const TextStyle(
                          fontSize: 12, height: 1.5, color: AppColors.clay600),
                    ),
                  ],
                  if ((sub.slottedByName ?? '').isNotEmpty) ...[
                    const SizedBox(height: 5),
                    Text(
                      'Slotted in by ${sub.slottedByName}'
                      '${sub.slottedAt == null ? '' : ' · ${D.medium(sub.slottedAt!)}'}',
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.clay400),
                    ),
                  ],
                ],
              ),
            ),
          ],

          if ((sub.reviewComments ?? '').isNotEmpty) ...[
            const SizedBox(height: 10),
            Text.rich(
              TextSpan(children: [
                TextSpan(
                  text: '${sub.reviewedByName ?? 'Reviewer'}: ',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.clay600,
                  ),
                ),
                TextSpan(
                  text: '“${sub.reviewComments}”',
                  style: const TextStyle(fontStyle: FontStyle.italic),
                ),
              ]),
              style: const TextStyle(
                  fontSize: 12.5, height: 1.5, color: AppColors.clay500),
            ),
          ],

          if (actions.isNotEmpty) ...[
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final action in actions)
                  PrimaryButton(
                    label: action.verb,
                    expand: false,
                    destructive: action.destructive,
                    onPressed: () => showTalentDecisionSheet(
                      context,
                      submission: sub,
                      action: action,
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}

// ─── The decision sheet ───

Future<void> showTalentDecisionSheet(
  BuildContext context, {
  required TalentSubmission submission,
  required TalentAction action,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _DecisionSheet(submission: submission, action: action),
  );
}

class _DecisionSheet extends ConsumerStatefulWidget {
  const _DecisionSheet({required this.submission, required this.action});

  final TalentSubmission submission;
  final TalentAction action;

  @override
  ConsumerState<_DecisionSheet> createState() => _DecisionSheetState();
}

class _DecisionSheetState extends ConsumerState<_DecisionSheet> {
  final _comments = TextEditingController();
  final _opportunityTitle = TextEditingController();
  final _opportunityNotes = TextEditingController();
  DateTime? _opportunityDate;
  bool _busy = false;

  @override
  void dispose() {
    _comments.dispose();
    _opportunityTitle.dispose();
    _opportunityNotes.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _opportunityDate ?? now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 2),
    );
    if (picked != null) setState(() => _opportunityDate = picked);
  }

  Future<void> _confirm() async {
    final isSlot = widget.action == TalentAction.slot;
    if (isSlot && _opportunityTitle.text.trim().isEmpty) {
      context.showError(
          "Give the opportunity a title so the member knows what they're "
          'slotted into.');
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(ministryRepositoryProvider).decideTalent(
            widget.submission.id,
            action: widget.action.wire,
            comments: _comments.text.trim(),
            opportunityTitle: isSlot ? _opportunityTitle.text.trim() : null,
            opportunityDate: isSlot ? _opportunityDate : null,
            opportunityNotes: isSlot ? _opportunityNotes.text.trim() : null,
          );
      if (!mounted) return;
      Navigator.of(context).pop();
      context.showSuccess(
          '${widget.submission.userName}\'s "${widget.submission.title}" '
          'has been updated.');
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError(e.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final action = widget.action;
    final isSlot = action == TalentAction.slot;

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
              action.title,
              style: AppFonts.display(
                  const TextStyle(fontSize: 20, color: AppColors.clay700)),
            ),
            const SizedBox(height: 4),
            Text(
              '${widget.submission.userName} — "${widget.submission.title}"',
              style:
                  const TextStyle(fontSize: 13, color: AppColors.clay400),
            ),
            const SizedBox(height: 20),

            if (isSlot) ...[
              AppTextField(
                label: 'Opportunity',
                controller: _opportunityTitle,
                required: true,
                hint: 'e.g. Special item at the Youth Sunday service',
              ),
              const SizedBox(height: 14),
              const FieldLabel('Date (optional)'),
              LuxTile(
                title: _opportunityDate == null
                    ? 'Pick a date'
                    : D.dayMedium(_opportunityDate!),
                icon: AppIcons.calendar,
                dense: true,
                onTap: _pickDate,
                trailing: _opportunityDate == null
                    ? null
                    : IconButton(
                        icon: const Icon(AppIcons.close, size: 16),
                        color: AppColors.clay400,
                        onPressed: () =>
                            setState(() => _opportunityDate = null),
                      ),
              ),
              const SizedBox(height: 14),
              AppTextField(
                label: 'Details for them (optional)',
                controller: _opportunityNotes,
                minLines: 2,
                maxLines: 4,
                hint: 'Arrival time, duration, what to prepare…',
              ),
              const SizedBox(height: 14),
            ],

            AppTextField(
              label: action.needsReason
                  ? 'Reason (shared with the member)'
                  : 'Note (optional)',
              controller: _comments,
              minLines: 2,
              maxLines: 5,
              hint: action.needsReason
                  ? 'Encourage them — why, and what could help…'
                  : 'Add a note (optional)…',
            ),

            const SizedBox(height: 22),
            PrimaryButton(
              label: action.verb,
              destructive: action.destructive,
              loading: _busy,
              onPressed: _confirm,
            ),
          ],
        ),
      ),
    );
  }
}
