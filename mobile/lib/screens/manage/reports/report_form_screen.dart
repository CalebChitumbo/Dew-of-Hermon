import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../models/reports.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';

/// The post-event questionnaire (PUT /api/event-reports/{eventId} with
/// action SAVE or SUBMIT). Loads any existing draft first.
class ReportFormScreen extends StatefulWidget {
  const ReportFormScreen({
    super.key,
    required this.eventId,
    required this.eventTitle,
  });

  final String eventId;
  final String eventTitle;

  @override
  State<ReportFormScreen> createState() => _ReportFormScreenState();
}

class _ReportFormScreenState extends State<ReportFormScreen> {
  final _attendance = TextEditingController();
  final _highlights = TextEditingController();
  final _challenges = TextEditingController();
  final _lessons = TextEditingController();
  final _recommendations = TextEditingController();
  final _budget = TextEditingController();
  final _actualSpend = TextEditingController();
  final _financesNotes = TextEditingController();
  final _mediaLink = TextEditingController();
  final _additional = TextEditingController();
  int? _rating;
  String? _reviewComments;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadExisting();
  }

  @override
  void dispose() {
    for (final c in [
      _attendance, _highlights, _challenges, _lessons, _recommendations,
      _budget, _actualSpend, _financesNotes, _mediaLink, _additional,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadExisting() async {
    final api = context.read<ApiClient>();
    try {
      final res = await api.getJson('/api/event-reports/${widget.eventId}');
      final raw = res['report'];
      if (raw is Map) {
        final report =
            EventReportModel.fromJson(raw.cast<String, dynamic>());
        _attendance.text = report.attendanceCount?.toString() ?? '';
        _highlights.text = report.highlights;
        _challenges.text = report.challenges;
        _lessons.text = report.lessonsLearned;
        _recommendations.text = report.recommendations;
        _budget.text = report.financesBudget?.toString() ?? '';
        _actualSpend.text = report.financesActualSpend?.toString() ?? '';
        _financesNotes.text = report.financesNotes ?? '';
        _mediaLink.text = report.mediaLink ?? '';
        _additional.text = report.additionalComments ?? '';
        _rating = report.objectivesMetRating;
        _reviewComments = report.reviewComments;
      }
    } catch (_) {
      // New report — empty form is fine.
    }
    if (mounted) setState(() => _loading = false);
  }

  Map<String, dynamic> _payload() {
    num? parse(TextEditingController c) => num.tryParse(c.text.trim());
    final hasFinances = parse(_budget) != null ||
        parse(_actualSpend) != null ||
        _financesNotes.text.trim().isNotEmpty;
    return {
      'attendanceCount': parse(_attendance)?.toInt(),
      'objectivesMetRating': _rating,
      'highlights': _highlights.text.trim(),
      'challenges': _challenges.text.trim(),
      'lessonsLearned': _lessons.text.trim(),
      'recommendations': _recommendations.text.trim(),
      'finances': hasFinances
          ? {
              'budget': parse(_budget),
              'actualSpend': parse(_actualSpend),
              'notes': _financesNotes.text.trim().isEmpty
                  ? null
                  : _financesNotes.text.trim(),
            }
          : null,
      'mediaLink':
          _mediaLink.text.trim().isEmpty ? null : _mediaLink.text.trim(),
      'additionalComments':
          _additional.text.trim().isEmpty ? null : _additional.text.trim(),
    };
  }

  Future<void> _save(String action) async {
    setState(() => _saving = true);
    final api = context.read<ApiClient>();
    try {
      await api.putJson('/api/event-reports/${widget.eventId}', {
        'action': action,
        'payload': _payload(),
      });
      if (mounted) {
        showAppSnackBar(
            context,
            action == 'SUBMIT'
                ? 'Report submitted for review.'
                : 'Draft saved.');
        if (action == 'SUBMIT') Navigator.of(context).pop();
      }
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(widget.eventTitle)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
              children: [
                if (_reviewComments != null) ...[
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('REVIEWER FEEDBACK',
                              style: textTheme.labelSmall?.copyWith(
                                  color: PWColors.destructive,
                                  letterSpacing: 1.4,
                                  fontWeight: FontWeight.w700)),
                          const SizedBox(height: 4),
                          Text(_reviewComments!,
                              style: textTheme.bodySmall?.copyWith(
                                  color: PWColors.clay600, height: 1.4)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                const SectionHeader('Numbers'),
                TextField(
                  controller: _attendance,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Attendance count'),
                ),
                const SizedBox(height: 14),
                Text('How well were the objectives met? *',
                    style: textTheme.bodyMedium),
                const SizedBox(height: 8),
                Row(
                  children: [
                    for (var star = 1; star <= 5; star++)
                      IconButton(
                        onPressed: () => setState(() => _rating = star),
                        icon: Icon(
                          (_rating ?? 0) >= star
                              ? Icons.star
                              : Icons.star_border,
                          color: PWColors.gold,
                          size: 30,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                const SectionHeader('Reflection'),
                TextField(
                  controller: _highlights,
                  maxLines: 3,
                  decoration:
                      const InputDecoration(labelText: 'Highlights *'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _challenges,
                  maxLines: 3,
                  decoration:
                      const InputDecoration(labelText: 'Challenges *'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _lessons,
                  maxLines: 3,
                  decoration:
                      const InputDecoration(labelText: 'Lessons learned *'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _recommendations,
                  maxLines: 3,
                  decoration: const InputDecoration(
                      labelText: 'Recommendations *'),
                ),
                const SizedBox(height: 16),
                const SectionHeader('Finances (optional)'),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _budget,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Budget'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _actualSpend,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Actual spend'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _financesNotes,
                  decoration:
                      const InputDecoration(labelText: 'Finance notes'),
                ),
                const SizedBox(height: 16),
                const SectionHeader('Extras (optional)'),
                TextField(
                  controller: _mediaLink,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(
                      labelText: 'Link to photos/videos'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _additional,
                  maxLines: 2,
                  decoration: const InputDecoration(
                      labelText: 'Additional comments'),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _saving ? null : () => _save('SAVE'),
                        child: const Text('Save draft'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton(
                        onPressed: _saving ? null : () => _save('SUBMIT'),
                        child: _saving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: PWColors.cream),
                              )
                            : const Text('Submit report'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
    );
  }
}
