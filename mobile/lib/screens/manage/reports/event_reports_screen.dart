import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../models/reports.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import 'report_form_screen.dart';

/// Post-event reports for events you initiated: pick an eligible event,
/// fill the questionnaire, save drafts, submit for review.
class EventReportsScreen extends StatefulWidget {
  const EventReportsScreen({super.key});

  @override
  State<EventReportsScreen> createState() => _EventReportsScreenState();
}

class _EventReportsScreenState extends State<EventReportsScreen> {
  List<EligibleEvent> _eligible = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    try {
      final res = await api.getJson('/api/event-reports/eligible-events');
      final list = (res['events'] as List? ?? [])
          .whereType<Map>()
          .map((m) => EligibleEvent.fromJson(m.cast<String, dynamic>()))
          .toList();
      if (mounted) {
        setState(() {
          _eligible = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  (String, Color) _statusMeta(String? status) => switch (status) {
        'SUBMITTED' => ('Submitted — awaiting review', PWColors.goldDark),
        'REVIEWED' => ('Reviewed ✓', PWColors.tealDark),
        'CHANGES_REQUESTED' => ('Changes requested', PWColors.destructive),
        'DRAFT' => ('Draft saved', PWColors.clay500),
        _ => ('Report needed', const Color(0xFF2563EB)),
      };

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Event Reports')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _eligible.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      SizedBox(height: 80),
                      EmptyState(
                        icon: Icons.assignment_outlined,
                        title: 'Nothing to report on',
                        subtitle:
                            'Once an event you initiated has happened, '
                            'its report form appears here.',
                      ),
                    ],
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    itemCount: _eligible.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final e = _eligible[i];
                      final (label, color) = _statusMeta(e.reportStatus);
                      final locked = e.reportStatus == 'REVIEWED' ||
                          e.reportStatus == 'SUBMITTED';
                      return Card(
                        child: ListTile(
                          onTap: locked
                              ? null
                              : () async {
                                  await Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) => ReportFormScreen(
                                        eventId: e.id,
                                        eventTitle: e.title,
                                      ),
                                    ),
                                  );
                                  _load();
                                },
                          title: Text(e.title,
                              style: textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w600)),
                          subtitle: Text(
                            [
                              if (e.startDate != null)
                                DateFormat('MMM d, yyyy')
                                    .format(e.startDate!),
                              label,
                            ].join(' · '),
                            style: textTheme.bodySmall
                                ?.copyWith(color: color),
                          ),
                          trailing: locked
                              ? const Icon(Icons.lock_outline,
                                  size: 18, color: PWColors.clay300)
                              : const Icon(Icons.chevron_right,
                                  color: PWColors.clay300),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}
