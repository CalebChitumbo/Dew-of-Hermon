import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../models/reports.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import '../queues/queue_widgets.dart';

/// Review submitted post-event reports: mark reviewed or request changes
/// (PATCH /api/event-reports/{eventId}/review).
class ReviewReportsScreen extends StatefulWidget {
  const ReviewReportsScreen({super.key});

  @override
  State<ReviewReportsScreen> createState() => _ReviewReportsScreenState();
}

class _ReviewReportsScreenState extends State<ReviewReportsScreen> {
  List<EventReportModel> _reports = [];
  bool _loading = true;
  bool _submittedOnly = true;
  String? _actingOn;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    try {
      final res = await api.getJson('/api/event-reports',
          query: _submittedOnly ? {'status': 'SUBMITTED'} : null);
      final list = (res['reports'] as List? ?? [])
          .whereType<Map>()
          .map((m) => EventReportModel.fromJson(m.cast<String, dynamic>()))
          .toList();
      if (mounted) {
        setState(() {
          _reports = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _review(EventReportModel report, String action) async {
    final comments = await promptText(
      context,
      title: action == 'REVIEWED'
          ? 'Mark "${report.eventTitle}" report reviewed?'
          : 'Request changes from ${report.initiatorName}?',
      label: action == 'REVIEWED'
          ? 'Comments (optional)'
          : 'What should change? (required)',
      requireText: action != 'REVIEWED',
    );
    if (comments == null || !mounted) return;

    setState(() => _actingOn = report.eventId);
    final api = context.read<ApiClient>();
    try {
      await api.dio
          .patch('/api/event-reports/${report.eventId}/review', data: {
        'action': action,
        if (comments.isNotEmpty) 'comments': comments,
      });
      if (mounted) showAppSnackBar(context, 'Review recorded.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  void _viewReport(EventReportModel report) {
    final textTheme = Theme.of(context).textTheme;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: PWColors.cream,
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.8,
        maxChildSize: 0.95,
        builder: (context, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
          children: [
            Text(report.eventTitle, style: textTheme.headlineSmall),
            Text(
              [
                'By ${report.initiatorName}',
                if (report.submittedAt != null)
                  'submitted ${DateFormat('MMM d').format(report.submittedAt!)}',
              ].join(' · '),
              style: textTheme.bodySmall?.copyWith(color: PWColors.clay400),
            ),
            const Divider(height: 24),
            _block(textTheme, 'Attendance',
                report.attendanceCount?.toString() ?? '—'),
            _block(
                textTheme,
                'Objectives met',
                report.objectivesMetRating == null
                    ? '—'
                    : '${'★' * report.objectivesMetRating!}'
                        '${'☆' * (5 - report.objectivesMetRating!)}'),
            _block(textTheme, 'Highlights', report.highlights),
            _block(textTheme, 'Challenges', report.challenges),
            _block(textTheme, 'Lessons learned', report.lessonsLearned),
            _block(textTheme, 'Recommendations', report.recommendations),
            if (report.financesBudget != null ||
                report.financesActualSpend != null)
              _block(
                  textTheme,
                  'Finances',
                  'Budget: ${report.financesBudget ?? '—'} · '
                      'Spent: ${report.financesActualSpend ?? '—'}'
                      '${report.financesNotes != null ? '\n${report.financesNotes}' : ''}'),
            if (report.mediaLink != null)
              _block(textTheme, 'Media', report.mediaLink!),
            if (report.additionalComments != null)
              _block(textTheme, 'Additional', report.additionalComments!),
          ],
        ),
      ),
    );
  }

  Widget _block(TextTheme textTheme, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(),
              style: textTheme.labelSmall?.copyWith(
                  color: PWColors.clay400, letterSpacing: 1.4)),
          const SizedBox(height: 2),
          Text(value.isEmpty ? '—' : value,
              style: textTheme.bodyMedium?.copyWith(height: 1.45)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Report Reviews'),
        actions: [
          TextButton(
            onPressed: () {
              setState(() => _submittedOnly = !_submittedOnly);
              _load();
            },
            child: Text(_submittedOnly ? 'Show all' : 'Awaiting only'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _reports.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      SizedBox(height: 80),
                      EmptyState(
                        icon: Icons.rate_review_outlined,
                        title: 'Nothing awaiting review',
                        subtitle:
                            'Submitted post-event reports land here.',
                      ),
                    ],
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    itemCount: _reports.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final report = _reports[i];
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(report.eventTitle,
                                        style: textTheme.titleMedium),
                                  ),
                                  TextButton(
                                    onPressed: () => _viewReport(report),
                                    child: const Text('Read'),
                                  ),
                                ],
                              ),
                              Text(
                                [
                                  report.initiatorName,
                                  report.status,
                                  if (report.eventStartDate != null)
                                    DateFormat('MMM d')
                                        .format(report.eventStartDate!),
                                ].join(' · '),
                                style: textTheme.bodySmall
                                    ?.copyWith(color: PWColors.clay400),
                              ),
                              if (report.status == 'SUBMITTED') ...[
                                const SizedBox(height: 10),
                                _actingOn == report.eventId
                                    ? const Center(
                                        child: SizedBox(
                                          width: 20,
                                          height: 20,
                                          child:
                                              CircularProgressIndicator(
                                                  strokeWidth: 2),
                                        ),
                                      )
                                    : Row(
                                        children: [
                                          Expanded(
                                            child: FilledButton(
                                              style: FilledButton.styleFrom(
                                                  backgroundColor:
                                                      PWColors.teal),
                                              onPressed: () => _review(
                                                  report, 'REVIEWED'),
                                              child: const Text(
                                                  'Mark reviewed'),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: OutlinedButton(
                                              style: OutlinedButton
                                                  .styleFrom(
                                                foregroundColor:
                                                    PWColors.goldDark,
                                              ),
                                              onPressed: () => _review(
                                                  report,
                                                  'REQUEST_CHANGES'),
                                              child: const Text(
                                                  'Request changes'),
                                            ),
                                          ),
                                        ],
                                      ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}
