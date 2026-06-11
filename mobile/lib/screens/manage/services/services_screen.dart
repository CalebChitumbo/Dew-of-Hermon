import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../core/fire.dart';
import '../../../services/auth_service.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import 'service_detail_screen.dart';

class ServiceSummary {
  ServiceSummary({
    required this.id,
    required this.eventId,
    required this.theme,
    required this.serviceTime,
    required this.eventDate,
    required this.venue,
    required this.assignmentCount,
    required this.isArchived,
  });

  final String id;
  final String? eventId;
  final String? theme;
  final String? serviceTime;
  final DateTime? eventDate;
  final String? venue;
  final int assignmentCount;
  final bool isArchived;

  factory ServiceSummary.fromJson(Map<String, dynamic> m) {
    return ServiceSummary(
      id: asString(m['id']),
      eventId: asStringOrNull(m['eventId']),
      theme: asStringOrNull(m['theme']),
      serviceTime: asStringOrNull(m['serviceTime']),
      eventDate: asDateOrNull(m['eventDate'] ?? m['date']),
      venue: asStringOrNull(m['venue']),
      assignmentCount: asNumOrNull(m['assignmentCount'])?.toInt() ?? 0,
      isArchived: asBool(m['isArchived']),
    );
  }
}

/// Services & rotas (GET /api/services + POST to create a new Sunday
/// service, which also creates its calendar event server-side).
class ServicesScreen extends StatefulWidget {
  const ServicesScreen({super.key, required this.canEdit});

  final bool canEdit;

  @override
  State<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends State<ServicesScreen> {
  List<ServiceSummary> _services = [];
  bool _loading = true;
  bool _archived = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    setState(() => _loading = true);
    try {
      final res = await api.getJson('/api/services', query: {
        'archived': '$_archived',
        'limit': '50',
      });
      final list = (res['services'] as List? ?? [])
          .whereType<Map>()
          .map((m) => ServiceSummary.fromJson(m.cast<String, dynamic>()))
          .toList();
      if (mounted) {
        setState(() {
          _services = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createService() async {
    final auth = context.read<AuthService>();
    final api = context.read<ApiClient>();
    final themeController = TextEditingController();
    final venueController = TextEditingController(text: 'Main Sanctuary');
    final timeController = TextEditingController(text: '09:00');
    DateTime? date;

    final created = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          backgroundColor: Colors.white,
          title: Text('New service',
              style: Theme.of(dialogContext).textTheme.titleLarge),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              InkWell(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: dialogContext,
                    initialDate:
                        DateTime.now().add(const Duration(days: 7)),
                    firstDate: DateTime.now(),
                    lastDate:
                        DateTime.now().add(const Duration(days: 365)),
                  );
                  if (picked != null) {
                    setDialogState(() => date = picked);
                  }
                },
                child: InputDecorator(
                  decoration:
                      const InputDecoration(labelText: 'Service date *'),
                  child: Text(date == null
                      ? 'Tap to pick'
                      : DateFormat('EEE, MMM d, yyyy').format(date!)),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: timeController,
                decoration: const InputDecoration(
                    labelText: 'Service time (HH:mm)'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: themeController,
                decoration:
                    const InputDecoration(labelText: 'Theme (optional)'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: venueController,
                decoration: const InputDecoration(labelText: 'Venue'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
    if (created != true || date == null) return;

    try {
      await api.postJson('/api/services', {
        'date': date!.toIso8601String(),
        'serviceTime': timeController.text.trim(),
        'theme': themeController.text.trim().isEmpty
            ? null
            : themeController.text.trim(),
        'venue': venueController.text.trim(),
        'callerRole': auth.profile?.role,
        'callerId': auth.profile?.id,
      });
      if (mounted) {
        showAppSnackBar(context, 'Service created with its checklist.');
      }
      _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Services & Rotas'),
        actions: [
          TextButton(
            onPressed: () {
              setState(() => _archived = !_archived);
              _load();
            },
            child: Text(_archived ? 'Show current' : 'Archive'),
          ),
        ],
      ),
      floatingActionButton: widget.canEdit
          ? FloatingActionButton.extended(
              onPressed: _createService,
              backgroundColor: PWColors.gold,
              foregroundColor: PWColors.clay900,
              icon: const Icon(Icons.add),
              label: const Text('New service'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _services.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      SizedBox(height: 80),
                      EmptyState(
                        icon: Icons.event_note_outlined,
                        title: 'No services here',
                        subtitle:
                            'Create a service to start planning its rota.',
                      ),
                    ],
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 90),
                    itemCount: _services.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final s = _services[i];
                      return Card(
                        child: ListTile(
                          onTap: () async {
                            await Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => ServiceDetailScreen(
                                  serviceId: s.id,
                                  canEdit: widget.canEdit,
                                ),
                              ),
                            );
                            _load();
                          },
                          leading: Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: PWColors.gold.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Icon(Icons.church,
                                color: PWColors.goldDark, size: 20),
                          ),
                          title: Text(
                            s.eventDate == null
                                ? (s.theme ?? 'Service')
                                : DateFormat('EEE, MMM d, yyyy')
                                    .format(s.eventDate!),
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                          subtitle: Text(
                            [
                              if (s.serviceTime != null) s.serviceTime!,
                              if (s.theme != null) s.theme!,
                              '${s.assignmentCount} assigned',
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
