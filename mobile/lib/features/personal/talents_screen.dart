import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_providers.dart';
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

/// This member's own talent submissions, live.
final myTalentsProvider = StreamProvider<List<TalentSubmission>>((ref) {
  final user = ref.watch(userOrNullProvider);
  if (user == null) return Stream.value(const <TalentSubmission>[]);
  return ref.watch(ministryRepositoryProvider).talentsStream(userId: user.id);
});

/// The member's wording for each status — softer than the queue's, because
/// this is the person whose talent it is reading it.
const _memberStatusLabel = <TalentSubmissionStatus, String>{
  TalentSubmissionStatus.pendingReview: 'Awaiting review',
  TalentSubmissionStatus.shortlisted: 'In the talent pool',
  TalentSubmissionStatus.slotted: 'Opportunity given',
  TalentSubmissionStatus.completed: 'Showcased',
  TalentSubmissionStatus.declined: 'Not taken forward',
  TalentSubmissionStatus.withdrawn: 'Withdrawn',
};

const _activeStatuses = <TalentSubmissionStatus>{
  TalentSubmissionStatus.pendingReview,
  TalentSubmissionStatus.shortlisted,
  TalentSubmissionStatus.slotted,
};

/// Talent Showcase — a member raises their hand, leadership finds them the
/// right moment. Mirrors `/talents`.
class TalentsScreen extends ConsumerWidget {
  const TalentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myTalentsProvider);

    return AppScaffold(
      title: 'Talent Showcase',
      subtitle: 'Put a talent forward and leadership will slot you in',
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _submitSheet(context),
        icon: const Icon(AppIcons.plus, size: 19),
        label: const Text('Put one forward'),
      ),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: '$e'),
        data: (all) {
          final active =
              all.where((s) => _activeStatuses.contains(s.status)).toList();
          final past =
              all.where((s) => !_activeStatuses.contains(s.status)).toList();

          if (all.isEmpty) {
            return EmptyStateLux(
              icon: AppIcons.star,
              tone: IconTone.gold,
              title: 'No submissions yet',
              description:
                  'Singing, an instrument, drama, tech, art — whatever it is, '
                  'this is your way of raising your hand. Be brave: put it '
                  'forward and leadership will find you the right opportunity '
                  'to shine.',
              action: PrimaryButton(
                label: 'Put a talent forward',
                expand: false,
                icon: AppIcons.sparkles,
                onPressed: () => _submitSheet(context),
              ),
            );
          }

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              const SectionHeading(
                title: 'Your talents',
                icon: AppIcons.clock,
                subtitle: 'From review through to your moment on stage.',
              ),
              const SizedBox(height: 12),
              for (final sub in [...active, ...past])
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _MyTalentCard(submission: sub),
                ),
              const SizedBox(height: 6),
              NoticeCard(
                icon: AppIcons.sparkles,
                title: 'How it works',
                message:
                    'Leadership reviews every submission. They may shortlist '
                    'you into the talent pool first, then slot you into a '
                    'service or event when the moment fits.',
              ),
            ],
          );
        },
      ),
    );
  }

  void _submitSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.9,
        maxChildSize: 0.95,
        builder: (context, controller) =>
            _SubmitTalentSheet(scrollController: controller),
      ),
    );
  }
}

// ─── The pipeline strip ───

enum _StepState { done, active, rejected, pending }

/// Submitted → review → opportunity, the same three beats the web draws.
class _Pipeline extends StatelessWidget {
  const _Pipeline({required this.submission});

  final TalentSubmission submission;

  @override
  Widget build(BuildContext context) {
    final status = submission.status;

    final reviewState = switch (status) {
      TalentSubmissionStatus.pendingReview => _StepState.active,
      TalentSubmissionStatus.declined => _StepState.rejected,
      TalentSubmissionStatus.withdrawn => _StepState.pending,
      _ => _StepState.done,
    };
    final opportunityState = switch (status) {
      TalentSubmissionStatus.slotted ||
      TalentSubmissionStatus.completed =>
        _StepState.done,
      TalentSubmissionStatus.shortlisted => _StepState.active,
      _ => _StepState.pending,
    };

    final steps = <(String, _StepState)>[
      ('Submitted', _StepState.done),
      (
        switch (reviewState) {
          _StepState.rejected => 'Not taken forward',
          _StepState.done => 'Shortlisted',
          _ => 'Leadership review',
        },
        reviewState,
      ),
      (
        status == TalentSubmissionStatus.completed
            ? 'Showcased'
            : opportunityState == _StepState.done
                ? 'Slotted in'
                : 'Opportunity',
        opportunityState,
      ),
    ];

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _dot(steps[i].$2),
              const SizedBox(width: 5),
              Text(
                steps[i].$1,
                style: TextStyle(
                  fontSize: 11.5,
                  color: switch (steps[i].$2) {
                    _StepState.rejected => AppColors.destructive,
                    _StepState.pending => AppColors.clay400,
                    _ => AppColors.clay600,
                  },
                ),
              ),
            ],
          ),
          if (i < steps.length - 1)
            Container(width: 18, height: 1, color: AppColors.clay200),
        ],
      ],
    );
  }

  Widget _dot(_StepState state) => switch (state) {
        _StepState.done => const Icon(AppIcons.checkCircle,
            size: 15, color: AppColors.emerald600),
        _StepState.active =>
          const Icon(AppIcons.clock, size: 15, color: AppColors.goldDark),
        _StepState.rejected => const Icon(AppIcons.xCircle,
            size: 15, color: AppColors.destructive),
        _StepState.pending => Container(
            width: 7,
            height: 7,
            margin: const EdgeInsets.symmetric(horizontal: 4),
            decoration: const BoxDecoration(
              color: AppColors.clay300,
              shape: BoxShape.circle,
            ),
          ),
      };
}

// ─── One of the member's own submissions ───

class _MyTalentCard extends ConsumerStatefulWidget {
  const _MyTalentCard({required this.submission});

  final TalentSubmission submission;

  @override
  ConsumerState<_MyTalentCard> createState() => _MyTalentCardState();
}

class _MyTalentCardState extends ConsumerState<_MyTalentCard> {
  bool _busy = false;

  Future<void> _withdraw() async {
    final sub = widget.submission;
    final ok = await confirmAction(
      context,
      title: 'Withdraw this submission?',
      message:
          '"${sub.title}" will be taken out of the queue. You can always put '
          'it forward again later.',
      confirmLabel: 'Withdraw',
      destructive: true,
    );
    if (!ok || !mounted) return;

    setState(() => _busy = true);
    try {
      await ref
          .read(ministryRepositoryProvider)
          .decideTalent(sub.id, action: 'WITHDRAW');
      if (mounted) context.showSuccess('"${sub.title}" has been withdrawn.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sub = widget.submission;
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
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sub.title,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.clay700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${sub.categoryLabel} · Submitted '
                      '${D.medium(sub.createdAt)}',
                      style: const TextStyle(
                          fontSize: 11.5, color: AppColors.clay400),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              StatusBadge.forStatus(
                sub.status.wire,
                label: _memberStatusLabel[sub.status] ?? sub.status.label,
                dense: true,
              ),
            ],
          ),
          const SizedBox(height: 12),
          _Pipeline(submission: sub),

          if (slotted && (sub.opportunityTitle ?? '').isNotEmpty) ...[
            const SizedBox(height: 12),
            _OpportunityPanel(submission: sub),
          ],

          if ((sub.reviewComments ?? '').isNotEmpty) ...[
            const SizedBox(height: 12),
            Text.rich(
              TextSpan(children: [
                TextSpan(
                  text: '${sub.reviewedByName ?? 'Leadership'}: ',
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

          if (sub.canWithdraw) ...[
            const SizedBox(height: 14),
            Align(
              alignment: Alignment.centerRight,
              child: PrimaryButton(
                label: 'Withdraw',
                expand: false,
                destructive: true,
                loading: _busy,
                onPressed: _withdraw,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The green panel that appears once someone has been slotted in.
class _OpportunityPanel extends StatelessWidget {
  const _OpportunityPanel({required this.submission});

  final TalentSubmission submission;

  @override
  Widget build(BuildContext context) {
    final sub = submission;
    final date = sub.opportunityDate;

    return Container(
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
                  '${date == null ? '' : ' · ${D.dayMedium(date)}'}',
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
              style:
                  const TextStyle(fontSize: 11, color: AppColors.clay400),
            ),
          ],
        ],
      ),
    );
  }
}

// ─── Putting a talent forward ───

class _SubmitTalentSheet extends ConsumerStatefulWidget {
  const _SubmitTalentSheet({required this.scrollController});

  final ScrollController scrollController;

  @override
  ConsumerState<_SubmitTalentSheet> createState() => _SubmitTalentSheetState();
}

class _SubmitTalentSheetState extends ConsumerState<_SubmitTalentSheet> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _categoryOther = TextEditingController();
  final _description = TextEditingController();
  final _experience = TextEditingController();
  final _sampleLink = TextEditingController();
  final _availability = TextEditingController();

  TalentCategory? _category;
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    _categoryOther.dispose();
    _description.dispose();
    _experience.dispose();
    _sampleLink.dispose();
    _availability.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_category == null) {
      context.showError('Pick a category first.');
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final link = _sampleLink.text.trim();
    if (link.isNotEmpty && !RegExp(r'^https?://', caseSensitive: false)
        .hasMatch(link)) {
      context.showError('A sample link must start with http:// or https://');
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(ministryRepositoryProvider).submitTalent(
            category: _category!,
            categoryOther: _categoryOther.text.trim(),
            title: _title.text.trim(),
            description: _description.text.trim(),
            experience: _experience.text.trim(),
            sampleLink: link,
            availabilityNote: _availability.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop();
      context.showSuccess(
          "Talent submitted. Leadership will review it and slot you in.");
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError(e.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: ListView(
        controller: widget.scrollController,
        padding: EdgeInsets.fromLTRB(
            20, 4, 20, MediaQuery.of(context).viewInsets.bottom + 28),
        children: [
          Row(
            children: [
              const IconChip(AppIcons.sparkles, tone: IconTone.gold, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Tell us what you can do',
                  style: AppFonts.display(
                      const TextStyle(fontSize: 20, color: AppColors.clay700)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Singing, an instrument, drama, tech, art — whatever it is, this '
            'is your way of raising your hand. Leadership decides when and '
            'where to slot you in.',
            style:
                TextStyle(fontSize: 13, height: 1.55, color: AppColors.clay400),
          ),
          const SizedBox(height: 20),

          AppDropdown<TalentCategory>(
            label: 'Category',
            required: true,
            value: _category,
            hint: 'What kind of talent?',
            items: [
              for (final c in TalentCategory.values)
                DropdownMenuItem(value: c, child: Text(c.label)),
            ],
            onChanged: (v) => setState(() => _category = v),
          ),

          if (_category == TalentCategory.other) ...[
            const SizedBox(height: 14),
            AppTextField(
              label: 'What is your talent?',
              controller: _categoryOther,
              required: true,
              hint: 'Tell us what it is',
            ),
          ],

          const SizedBox(height: 14),
          AppTextField(
            label: 'Short title',
            controller: _title,
            required: true,
            hint: 'e.g. Acoustic guitar & lead vocals',
          ),
          const SizedBox(height: 14),
          AppTextField(
            label: 'Describe it',
            controller: _description,
            required: true,
            minLines: 3,
            maxLines: 6,
            hint: 'What can you do? What would you love to share?',
          ),
          const SizedBox(height: 14),
          AppTextField(
            label: 'Your experience (optional)',
            controller: _experience,
            minLines: 2,
            maxLines: 4,
            hint: 'How long have you been doing this? Any training?',
          ),
          const SizedBox(height: 14),
          AppTextField(
            label: 'Link to a sample (optional)',
            controller: _sampleLink,
            keyboardType: TextInputType.url,
            textCapitalization: TextCapitalization.none,
            hint: 'https:// — a video or audio of you',
          ),
          const SizedBox(height: 14),
          AppTextField(
            label: 'When are you available? (optional)',
            controller: _availability,
            hint: 'e.g. Sundays, or any Friday evening',
          ),

          const SizedBox(height: 24),
          PrimaryButton(
            label: 'Submit my talent',
            icon: AppIcons.send,
            loading: _busy,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }
}

/// Open a member's sample link in the browser. Shared with the review queue.
Future<void> openSampleLink(BuildContext context, String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null ||
      !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
    if (context.mounted) context.showError("Couldn't open that link.");
  }
}
