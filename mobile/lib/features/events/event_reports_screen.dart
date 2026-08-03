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
import '../../core/utils/money.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/enums.dart';
import '../../data/models/requests.dart';
import '../../data/repositories/request_repository.dart';

final eventReportsProvider = FutureProvider<List<EventReport>>((ref) {
  return ref.watch(requestRepositoryProvider).eventReports();
});

/// Events this person initiated that are over and still need writing up.
final reportableEventsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) {
  return ref.watch(requestRepositoryProvider).reportableEvents();
});

/// Post-event reports the initiator writes: what happened, what it cost, and
/// what we would do differently.
class EventReportsScreen extends ConsumerWidget {
  const EventReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reports = ref.watch(eventReportsProvider);
    final pending = ref.watch(reportableEventsProvider).valueOrNull ?? const [];

    return AppScaffold(
      title: 'Event reports',
      onRefresh: () async {
        ref.invalidate(eventReportsProvider);
        ref.invalidate(reportableEventsProvider);
      },
      body: reports.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(eventReportsProvider),
        ),
        data: (list) {
          final drafts = list.where((r) => r.isEditable).toList();
          final submitted = list.where((r) => !r.isEditable).toList();

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              if (pending.isNotEmpty) ...[
                SectionHeading(
                  title: 'Still to write up',
                  icon: AppIcons.alert,
                  tone: IconTone.amber,
                  subtitle: '${pending.length} '
                      '${pending.length == 1 ? 'event' : 'events'}',
                ),
                const SizedBox(height: 12),
                LuxCard(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    children: [
                      for (var i = 0; i < pending.length; i++) ...[
                        if (i > 0) const LuxDivider(),
                        LuxTile(
                          title: '${pending[i]['title'] ?? 'Event'}',
                          subtitle:
                              D.medium(D.fromIso('${pending[i]['startDate']}')),
                          icon: AppIcons.fileText,
                          tone: IconTone.amber,
                          dense: true,
                          onTap: () => context.push(
                              '/manage/events/reports/${pending[i]['id']}'),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 22),
              ],

              if (drafts.isNotEmpty) ...[
                const SectionHeading(
                  title: 'Drafts',
                  icon: AppIcons.edit,
                  tone: IconTone.periwinkle,
                ),
                const SizedBox(height: 12),
                for (final report in drafts)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _ReportCard(report: report),
                  ),
                const SizedBox(height: 12),
              ],

              const SectionHeading(
                title: 'Submitted',
                icon: AppIcons.checkCircle,
                tone: IconTone.emerald,
              ),
              const SizedBox(height: 12),
              if (submitted.isEmpty)
                const LuxCard(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      'Nothing submitted yet.',
                      style: TextStyle(
                          fontSize: 13.5, color: AppColors.clay400),
                    ),
                  ),
                )
              else
                for (final report in submitted)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _ReportCard(report: report),
                  ),

              if (list.isEmpty && pending.isEmpty)
                const EmptyStateLux(
                  icon: AppIcons.fileText,
                  tone: IconTone.sage,
                  title: 'Nothing to report on',
                  description: 'Once an event you initiated is over, it '
                      'appears here to be written up.',
                ),
            ],
          );
        },
      ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({required this.report});

  final EventReport report;

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      onTap: () =>
          context.push('/manage/events/reports/${report.eventId}'),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconChip(AppIcons.fileText, tone: _tone(report.status), size: 42),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  report.eventTitle,
                  style: AppFonts.display(const TextStyle(
                    fontSize: 17,
                    height: 1.2,
                    color: AppColors.clay700,
                  )),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Text(
                  '${D.medium(report.eventStartDate)}'
                  '${report.attendanceCount == null ? '' : ' · ${report.attendanceCount} attended'}',
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.clay400),
                ),
                if ((report.reviewComments ?? '').isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Reviewer: ${report.reviewComments}',
                    style: const TextStyle(
                        fontSize: 12, height: 1.4, color: AppColors.clay500),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          StatusBadge(report.status.label,
              tone: _tone(report.status), dense: true),
        ],
      ),
    );
  }

  static IconTone _tone(EventReportStatus status) => switch (status) {
        EventReportStatus.reviewed => IconTone.emerald,
        EventReportStatus.submitted => IconTone.blue,
        EventReportStatus.changesRequested => IconTone.rose,
        EventReportStatus.draft => IconTone.clay,
      };
}

/// Write (or read) one report.
class EventReportFormScreen extends ConsumerStatefulWidget {
  const EventReportFormScreen({
    super.key,
    required this.eventId,
    this.reviewMode = false,
  });

  final String eventId;

  /// The Chairperson's view: read the report and mark it reviewed or send it
  /// back, rather than edit it.
  final bool reviewMode;

  @override
  ConsumerState<EventReportFormScreen> createState() =>
      _EventReportFormScreenState();
}

class _EventReportFormScreenState
    extends ConsumerState<EventReportFormScreen> {
  final _attendance = TextEditingController();
  final _highlights = TextEditingController();
  final _challenges = TextEditingController();
  final _lessons = TextEditingController();
  final _recommendations = TextEditingController();
  final _budget = TextEditingController();
  final _spend = TextEditingController();
  final _financeNotes = TextEditingController();
  final _mediaLink = TextEditingController();
  final _additional = TextEditingController();

  int _rating = 0;
  EventReport? _report;
  bool _loading = true;
  bool _busy = false;
  bool _seeded = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in [
      _attendance,
      _highlights,
      _challenges,
      _lessons,
      _recommendations,
      _budget,
      _spend,
      _financeNotes,
      _mediaLink,
      _additional,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final report =
          await ref.read(requestRepositoryProvider).eventReport(widget.eventId);
      if (!mounted) return;
      setState(() {
        _report = report;
        _loading = false;
      });
      if (report != null && !_seeded) {
        _seeded = true;
        _attendance.text = report.attendanceCount?.toString() ?? '';
        _highlights.text = report.highlights;
        _challenges.text = report.challenges;
        _lessons.text = report.lessonsLearned;
        _recommendations.text = report.recommendations;
        _budget.text = report.budget?.toStringAsFixed(0) ?? '';
        _spend.text = report.actualSpend?.toStringAsFixed(0) ?? '';
        _financeNotes.text = report.financeNotes ?? '';
        _mediaLink.text = report.mediaLink ?? '';
        _additional.text = report.additionalComments ?? '';
        _rating = report.objectivesMetRating ?? 0;
        setState(() {});
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          // A report that does not exist yet is the normal case for a first
          // write-up, not an error.
          _error = e.isNotFound ? null : e.message;
        });
      }
    }
  }

  Map<String, dynamic> get _body => {
        'attendanceCount': int.tryParse(_attendance.text.trim()),
        'objectivesMetRating': _rating == 0 ? null : _rating,
        'highlights': _highlights.text.trim(),
        'challenges': _challenges.text.trim(),
        'lessonsLearned': _lessons.text.trim(),
        'recommendations': _recommendations.text.trim(),
        'finances': {
          'budget': double.tryParse(_budget.text.trim().replaceAll(',', '')),
          'actualSpend':
              double.tryParse(_spend.text.trim().replaceAll(',', '')),
          'notes': _financeNotes.text.trim().isEmpty
              ? null
              : _financeNotes.text.trim(),
        },
        'mediaLink':
            _mediaLink.text.trim().isEmpty ? null : _mediaLink.text.trim(),
        'additionalComments': _additional.text.trim().isEmpty
            ? null
            : _additional.text.trim(),
      };

  Future<void> _save({required bool submit}) async {
    if (submit && _highlights.text.trim().isEmpty) {
      context.showError('Say what went well before submitting.');
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(requestRepositoryProvider).saveEventReport(
            eventId: widget.eventId,
            body: _body,
            submit: submit,
          );
      ref.invalidate(eventReportsProvider);
      ref.invalidate(reportableEventsProvider);
      if (!mounted) return;
      context.showSuccess(submit
          ? 'Submitted for review.'
          : 'Saved — come back to it any time.');
      if (submit && context.canPop()) context.pop();
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _review(String action) async {
    String? comments;
    if (action == 'REQUEST_CHANGES') {
      comments = await promptForText(
        context,
        title: 'What needs adding?',
        hint: 'The initiator sees this',
        confirmLabel: 'Send back',
        required: true,
      );
      if (comments == null || comments.isEmpty) return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(requestRepositoryProvider).reviewEventReport(
            widget.eventId,
            action: action,
            comments: comments,
          );
      ref.invalidate(eventReportsProvider);
      if (!mounted) return;
      context.showSuccess(action == 'MARK_REVIEWED'
          ? 'Marked as reviewed.'
          : 'Sent back for changes.');
      if (context.canPop()) context.pop();
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const DetailScaffold(title: 'Event report', body: LoadingView());
    }
    if (_error != null) {
      return DetailScaffold(
        title: 'Event report',
        body: ErrorView(message: _error!, onRetry: _load),
      );
    }

    final report = _report;
    final readOnly = widget.reviewMode ||
        (report != null && !report.isEditable);
    final canReview =
        widget.reviewMode && ref.watch(accessProvider).can('review_event_reports');

    return DetailScaffold(
      title: report?.eventTitle ?? 'Event report',
      subtitle: report == null ? null : D.medium(report.eventStartDate),
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          if (report != null && (report.reviewComments ?? '').isNotEmpty) ...[
            NoticeCard(
              tone: report.status == EventReportStatus.changesRequested
                  ? IconTone.rose
                  : IconTone.emerald,
              icon: AppIcons.info,
              title: report.status == EventReportStatus.changesRequested
                  ? 'Changes asked for'
                  : 'Reviewed',
              message: '${report.reviewComments}'
                  '${report.reviewedByName == null ? '' : '\n— ${report.reviewedByName}'}',
            ),
            const SizedBox(height: 18),
          ],

          const SectionHeading(
            title: 'How it went',
            icon: AppIcons.star,
            tone: IconTone.gold,
          ),
          const SizedBox(height: 12),
          LuxCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppTextField(
                  label: 'How many came',
                  controller: _attendance,
                  keyboardType: TextInputType.number,
                  enabled: !readOnly,
                ),
                const SizedBox(height: 16),
                const FieldLabel('Did it meet its objective?'),
                _RatingRow(
                  value: _rating,
                  onChanged:
                      readOnly ? null : (v) => setState(() => _rating = v),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),

          const SectionHeading(
            title: 'What happened',
            icon: AppIcons.fileText,
            tone: IconTone.periwinkle,
          ),
          const SizedBox(height: 12),
          LuxCard(
            child: Column(
              children: [
                AppTextField(
                  label: 'What went well',
                  controller: _highlights,
                  maxLines: 5,
                  minLines: 3,
                  enabled: !readOnly,
                  required: !readOnly,
                ),
                const SizedBox(height: 14),
                AppTextField(
                  label: 'What was hard',
                  controller: _challenges,
                  maxLines: 5,
                  minLines: 3,
                  enabled: !readOnly,
                ),
                const SizedBox(height: 14),
                AppTextField(
                  label: 'What we learned',
                  controller: _lessons,
                  maxLines: 5,
                  minLines: 3,
                  enabled: !readOnly,
                ),
                const SizedBox(height: 14),
                AppTextField(
                  label: 'What we would do differently',
                  controller: _recommendations,
                  maxLines: 5,
                  minLines: 3,
                  enabled: !readOnly,
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),

          const SectionHeading(
            title: 'What it cost',
            icon: AppIcons.money,
            tone: IconTone.emerald,
          ),
          const SizedBox(height: 12),
          LuxCard(
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: AppTextField(
                        label: 'Budget (ZMW)',
                        controller: _budget,
                        keyboardType: TextInputType.number,
                        enabled: !readOnly,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: AppTextField(
                        label: 'Actually spent',
                        controller: _spend,
                        keyboardType: TextInputType.number,
                        enabled: !readOnly,
                        onChanged: (_) => setState(() {}),
                      ),
                    ),
                  ],
                ),
                if (_variance != null) ...[
                  const SizedBox(height: 12),
                  NoticeCard(
                    tone: _variance! > 0 ? IconTone.amber : IconTone.emerald,
                    icon: _variance! > 0 ? AppIcons.alert : AppIcons.checkCircle,
                    message: _variance! > 0
                        ? 'Over budget by ${Money.format(_variance, 'ZMW')}'
                        : 'Under budget by '
                            '${Money.format(_variance!.abs(), 'ZMW')}',
                  ),
                ],
                const SizedBox(height: 14),
                AppTextField(
                  label: 'Notes on the money',
                  controller: _financeNotes,
                  maxLines: 3,
                  enabled: !readOnly,
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),

          const SectionHeading(
            title: 'Anything else',
            icon: AppIcons.info,
            tone: IconTone.clay,
          ),
          const SizedBox(height: 12),
          LuxCard(
            child: Column(
              children: [
                AppTextField(
                  label: 'Link to photos or video',
                  controller: _mediaLink,
                  keyboardType: TextInputType.url,
                  textCapitalization: TextCapitalization.none,
                  enabled: !readOnly,
                ),
                const SizedBox(height: 14),
                AppTextField(
                  label: 'Anything else',
                  controller: _additional,
                  maxLines: 4,
                  enabled: !readOnly,
                ),
              ],
            ),
          ),
        ],
      ),
      bottomBar: canReview
          ? Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed:
                        _busy ? null : () => _review('REQUEST_CHANGES'),
                    icon: const Icon(AppIcons.edit, size: 15),
                    label: const Text('Ask for more'),
                    style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 44)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: PrimaryButton(
                    label: 'Mark reviewed',
                    icon: AppIcons.check,
                    loading: _busy,
                    onPressed: () => _review('MARK_REVIEWED'),
                  ),
                ),
              ],
            )
          : readOnly
              ? null
              : Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed:
                            _busy ? null : () => _save(submit: false),
                        icon: const Icon(AppIcons.download, size: 15),
                        label: const Text('Save draft'),
                        style: OutlinedButton.styleFrom(
                            minimumSize: const Size(0, 44)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: PrimaryButton(
                        label: 'Submit',
                        icon: AppIcons.send,
                        loading: _busy,
                        onPressed: () => _save(submit: true),
                      ),
                    ),
                  ],
                ),
    );
  }

  double? get _variance {
    final budget = double.tryParse(_budget.text.trim().replaceAll(',', ''));
    final spend = double.tryParse(_spend.text.trim().replaceAll(',', ''));
    if (budget == null || spend == null) return null;
    return spend - budget;
  }
}

class _RatingRow extends StatelessWidget {
  const _RatingRow({required this.value, this.onChanged});

  final int value;
  final ValueChanged<int>? onChanged;

  static const _labels = ['Not at all', 'Barely', 'Partly', 'Mostly', 'Fully'];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            for (var i = 1; i <= 5; i++)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: InkWell(
                  onTap: onChanged == null ? null : () => onChanged!(i),
                  borderRadius: BorderRadius.circular(999),
                  child: Container(
                    height: 40,
                    width: 40,
                    decoration: BoxDecoration(
                      color: i <= value
                          ? AppColors.gold.withValues(alpha: 0.18)
                          : Colors.white,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: i <= value
                            ? AppColors.gold
                            : AppColors.border,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Icon(
                      AppIcons.star,
                      size: 17,
                      color: i <= value
                          ? AppColors.goldDark
                          : AppColors.clay300,
                    ),
                  ),
                ),
              ),
          ],
        ),
        if (value > 0) ...[
          const SizedBox(height: 8),
          Text(
            _labels[value - 1],
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: AppColors.clay500,
            ),
          ),
        ],
      ],
    );
  }
}

/// The Chairperson's review queue.
class EventReportReviewScreen extends ConsumerWidget {
  const EventReportReviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(accessProvider).canView('event_reports_review')) {
      return const AppScaffold(
        title: 'Report reviews',
        body: NoAccessView(
          message: 'Reviewing event reports is the Chairperson\'s role.',
        ),
      );
    }

    final async = ref.watch(eventReportsProvider);

    return AppScaffold(
      title: 'Report reviews',
      onRefresh: () async => ref.invalidate(eventReportsProvider),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: '$e'),
        data: (list) {
          final awaiting = list
              .where((r) => r.status == EventReportStatus.submitted)
              .toList();
          final done = list
              .where((r) => r.status == EventReportStatus.reviewed)
              .toList();

          if (list.isEmpty) {
            return const EmptyStateLux(
              icon: AppIcons.fileText,
              tone: IconTone.sage,
              title: 'Nothing to review',
              description: 'Submitted reports appear here.',
            );
          }

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              SectionHeading(
                title: 'Waiting on you',
                icon: AppIcons.clipboardCheck,
                tone: IconTone.amber,
                subtitle: '${awaiting.length} '
                    '${awaiting.length == 1 ? 'report' : 'reports'}',
              ),
              const SizedBox(height: 12),
              if (awaiting.isEmpty)
                const LuxCard(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      'Nothing waiting.',
                      style: TextStyle(
                          fontSize: 13.5, color: AppColors.clay400),
                    ),
                  ),
                )
              else
                for (final report in awaiting)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _ReviewCard(report: report),
                  ),
              const SizedBox(height: 22),
              const SectionHeading(
                title: 'Reviewed',
                icon: AppIcons.checkCircle,
                tone: IconTone.emerald,
              ),
              const SizedBox(height: 12),
              for (final report in done)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _ReviewCard(report: report),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.report});

  final EventReport report;

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      onTap: () => context
          .push('/manage/events/reports/review/${report.eventId}'),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconChip(AppIcons.fileText,
              tone: report.status == EventReportStatus.reviewed
                  ? IconTone.emerald
                  : IconTone.amber,
              size: 42),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  report.eventTitle,
                  style: AppFonts.display(const TextStyle(
                    fontSize: 17,
                    height: 1.2,
                    color: AppColors.clay700,
                  )),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Text(
                  '${report.initiatorName} · '
                  'submitted ${D.relative(report.submittedAt)}',
                  style:
                      const TextStyle(fontSize: 12, color: AppColors.clay400),
                ),
              ],
            ),
          ),
          const Icon(AppIcons.chevronRight,
              size: 17, color: AppColors.clay300),
        ],
      ),
    );
  }
}
