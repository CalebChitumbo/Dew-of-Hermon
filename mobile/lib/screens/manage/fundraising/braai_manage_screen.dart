import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../models/fundraising_manage.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import 'braai_detail_screen.dart';

/// Braai planning list — upcoming fundraising braais with roster progress.
class BraaiManageScreen extends StatefulWidget {
  const BraaiManageScreen({super.key});

  @override
  State<BraaiManageScreen> createState() => _BraaiManageScreenState();
}

class _BraaiManageScreenState extends State<BraaiManageScreen> {
  List<BraaiEventSummary> _braais = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    try {
      final res = await api.getJson('/api/fundraising/braai/events');
      final list = (res['events'] as List? ?? [])
          .whereType<Map>()
          .map((m) => BraaiEventSummary.fromJson(m.cast<String, dynamic>()))
          .where((b) => !b.isArchived)
          .toList()
        ..sort((a, b) {
          final ad = a.eventDate, bd = b.eventDate;
          if (ad == null || bd == null) return 0;
          return ad.compareTo(bd);
        });
      if (mounted) {
        setState(() {
          _braais = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    final titleController =
        TextEditingController(text: 'Sunday Fundraising Braai');
    final venueController = TextEditingController();
    DateTime? date;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          backgroundColor: Colors.white,
          title: Text('Plan a braai',
              style: Theme.of(dialogContext).textTheme.titleLarge),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleController,
                decoration: const InputDecoration(labelText: 'Title'),
              ),
              const SizedBox(height: 10),
              InkWell(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: dialogContext,
                    initialDate:
                        DateTime.now().add(const Duration(days: 7)),
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  if (picked != null) setDialogState(() => date = picked);
                },
                child: InputDecorator(
                  decoration:
                      const InputDecoration(labelText: 'Event day *'),
                  child: Text(date == null
                      ? 'Tap to pick'
                      : DateFormat('EEE, MMM d, yyyy').format(date!)),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: venueController,
                decoration:
                    const InputDecoration(labelText: 'Venue (optional)'),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('Cancel')),
            FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: const Text('Create')),
          ],
        ),
      ),
    );
    if (confirmed != true || date == null || !mounted) return;

    final api = context.read<ApiClient>();
    try {
      await api.postJson('/api/fundraising/braai/events', {
        'title': titleController.text.trim(),
        'eventDate': date!.toIso8601String(),
        'venue': venueController.text.trim().isEmpty
            ? null
            : venueController.text.trim(),
      });
      if (mounted) showAppSnackBar(context, 'Braai planned.');
      _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = braaiResponsibilities.length;
    return Scaffold(
      appBar: AppBar(title: const Text('Fundraising Braais')),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: PWColors.gold,
        foregroundColor: PWColors.clay900,
        onPressed: _create,
        icon: const Icon(Icons.add),
        label: const Text('Plan braai'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _braais.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      SizedBox(height: 80),
                      EmptyState(
                        icon: Icons.outdoor_grill_outlined,
                        title: 'No braai planned',
                        subtitle:
                            'Plan a Sunday braai to open the roster and '
                            'orders.',
                      ),
                    ],
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 90),
                    itemCount: _braais.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final braai = _braais[i];
                      return Card(
                        child: ListTile(
                          onTap: () async {
                            await Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => BraaiDetailScreen(
                                  braaiId: braai.id,
                                  title: braai.title,
                                ),
                              ),
                            );
                            _load();
                          },
                          leading: Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEE2E2),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Icon(Icons.outdoor_grill,
                                color: Color(0xFFDC2626)),
                          ),
                          title: Text(
                            braai.title,
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                          subtitle: Text(
                            [
                              if (braai.eventDate != null)
                                DateFormat('EEE, MMM d')
                                    .format(braai.eventDate!),
                              '${braai.assignmentCount}/$total roles · '
                                  '${braai.confirmedCount} confirmed',
                            ].join(' · '),
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: PWColors.clay400),
                          ),
                          trailing: const Icon(Icons.chevron_right,
                              color: PWColors.clay300),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}
