import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../models/requests.dart';
import '../../../services/access_service.dart';
import '../../../services/auth_service.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import 'queue_widgets.dart';

/// Transport queue. Coordinators cost a request
/// (PATCH /submit-details), then the treasurer decides
/// (PATCH /treasurer-decision) — same two-step flow as the web.
class TransportQueueScreen extends StatefulWidget {
  const TransportQueueScreen({super.key});

  @override
  State<TransportQueueScreen> createState() => _TransportQueueScreenState();
}

class _TransportQueueScreenState extends State<TransportQueueScreen> {
  List<TransportRequest> _requests = [];
  bool _loading = true;
  String? _actingOn;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    try {
      final res = await api.getJson('/api/transport-requests');
      final list = (res['requests'] as List? ?? []).whereType<Map>().map((m) {
        final map = m.cast<String, dynamic>();
        return TransportRequest.fromJson(map['id']?.toString() ?? '', map);
      }).toList();
      if (mounted) {
        setState(() {
          _requests = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitDetails(TransportRequest req) async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: PWColors.cream,
      builder: (_) => _CostingSheet(request: req),
    );
    if (result == null || !mounted) return;

    setState(() => _actingOn = req.id);
    final api = context.read<ApiClient>();
    try {
      await api.dio
          .patch('/api/transport-requests/${req.id}/submit-details',
              data: result);
      if (mounted) {
        showAppSnackBar(
            context, 'Costing sent to the treasurer for approval.');
      }
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  Future<void> _treasurerDecide(TransportRequest req, String action) async {
    final comments = await promptText(
      context,
      title: switch (action) {
        'APPROVE' => 'Approve transport funds?',
        'REJECT' => 'Reject this transport request?',
        _ => 'Request changes to the costing?',
      },
      label: action == 'APPROVE'
          ? 'Comments (optional)'
          : 'Reason (required)',
      requireText: action != 'APPROVE',
    );
    if (comments == null || !mounted) return;

    setState(() => _actingOn = req.id);
    final api = context.read<ApiClient>();
    try {
      await api.dio
          .patch('/api/transport-requests/${req.id}/treasurer-decision',
              data: {
        'action': action,
        if (comments.isNotEmpty) 'comments': comments,
      });
      if (mounted) showAppSnackBar(context, 'Decision recorded.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<AuthService>().profile;
    final access = context.watch<AccessService>();
    final canCost =
        access.checkFeature(profile, 'manage_transport_logistics');
    final canDecide = access.checkFeature(profile, 'approve_accounts');
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Transport Requests')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _requests.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      SizedBox(height: 80),
                      EmptyState(
                        icon: Icons.directions_bus_outlined,
                        title: 'No transport requests',
                        subtitle: 'Approved events that need transport '
                            'show up here for costing.',
                      ),
                    ],
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    itemCount: _requests.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final req = _requests[i];
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              QueueCardHeader(
                                eventTitle: req.eventTitle,
                                eventDate: req.eventStartDate,
                                status: req.status,
                              ),
                              NeedsBlock(
                                  label: 'Needs',
                                  text: req.needsDescription),
                              if (req.vehicleType != null) ...[
                                const SizedBox(height: 8),
                                Text(
                                  '${req.vehicleCount}× ${req.vehicleType} '
                                  '· ${req.currency ?? ''} '
                                  '${req.estimatedCost ?? '—'}',
                                  style: textTheme.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.w600),
                                ),
                                if (req.pickupLocation != null)
                                  Text(
                                    '${req.pickupLocation} → '
                                    '${req.dropoffLocation ?? '—'}'
                                    '${req.pickupTime != null ? ' · ${DateFormat('MMM d HH:mm').format(req.pickupTime!)}' : ''}',
                                    style: textTheme.bodySmall?.copyWith(
                                        color: PWColors.clay400),
                                  ),
                              ],
                              if (req.treasurerComments != null)
                                NeedsBlock(
                                    label: 'Treasurer notes',
                                    text: req.treasurerComments!),
                              if (req.status == 'PENDING_DETAILS' &&
                                  canCost) ...[
                                const SizedBox(height: 12),
                                _actingOn == req.id
                                    ? const Center(
                                        child: SizedBox(
                                          width: 22,
                                          height: 22,
                                          child:
                                              CircularProgressIndicator(
                                                  strokeWidth: 2),
                                        ),
                                      )
                                    : FilledButton.icon(
                                        onPressed: () =>
                                            _submitDetails(req),
                                        icon: const Icon(
                                            Icons.request_quote_outlined,
                                            size: 18),
                                        label: const Text(
                                            'Add costing & send to treasurer'),
                                      ),
                              ],
                              if (req.status == 'PENDING_TREASURER' &&
                                  canDecide) ...[
                                const SizedBox(height: 12),
                                _actingOn == req.id
                                    ? const Center(
                                        child: SizedBox(
                                          width: 22,
                                          height: 22,
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
                                              onPressed: () =>
                                                  _treasurerDecide(
                                                      req, 'APPROVE'),
                                              child:
                                                  const Text('Approve'),
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
                                              onPressed: () =>
                                                  _treasurerDecide(req,
                                                      'REQUEST_CHANGES'),
                                              child:
                                                  const Text('Changes'),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: OutlinedButton(
                                              style: OutlinedButton
                                                  .styleFrom(
                                                foregroundColor:
                                                    PWColors.destructive,
                                                side: const BorderSide(
                                                    color: Color(
                                                        0xFFFECACA)),
                                              ),
                                              onPressed: () =>
                                                  _treasurerDecide(
                                                      req, 'REJECT'),
                                              child: const Text('Reject'),
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

class _CostingSheet extends StatefulWidget {
  const _CostingSheet({required this.request});

  final TransportRequest request;

  @override
  State<_CostingSheet> createState() => _CostingSheetState();
}

class _CostingSheetState extends State<_CostingSheet> {
  final _vehicleType = TextEditingController();
  final _vehicleCount = TextEditingController(text: '1');
  final _cost = TextEditingController();
  final _currency = TextEditingController(text: 'ZMW');
  final _pickup = TextEditingController();
  final _dropoff = TextEditingController();
  final _notes = TextEditingController();
  DateTime? _pickupTime;

  @override
  void dispose() {
    for (final c in [
      _vehicleType, _vehicleCount, _cost, _currency, _pickup, _dropoff, _notes
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        maxChildSize: 0.95,
        builder: (context, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
          children: [
            Text('Cost this request',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 14),
            TextField(
              controller: _vehicleType,
              decoration: const InputDecoration(
                  labelText: 'Vehicle type * (e.g. Minibus)'),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _vehicleCount,
                    keyboardType: TextInputType.number,
                    decoration:
                        const InputDecoration(labelText: 'How many *'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _cost,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'Estimated cost *'),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  width: 80,
                  child: TextField(
                    controller: _currency,
                    decoration:
                        const InputDecoration(labelText: 'Currency'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _pickup,
              decoration:
                  const InputDecoration(labelText: 'Pickup location'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _dropoff,
              decoration:
                  const InputDecoration(labelText: 'Drop-off location'),
            ),
            const SizedBox(height: 10),
            InkWell(
              onTap: () async {
                final eventDate = widget.request.eventStartDate;
                final date = await showDatePicker(
                  context: context,
                  initialDate: eventDate ?? DateTime.now(),
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (date == null || !mounted) return;
                if (!context.mounted) return;
                final time = await showTimePicker(
                    context: context,
                    initialTime: const TimeOfDay(hour: 8, minute: 0));
                setState(() => _pickupTime = DateTime(date.year, date.month,
                    date.day, time?.hour ?? 8, time?.minute ?? 0));
              },
              child: InputDecorator(
                decoration:
                    const InputDecoration(labelText: 'Pickup time'),
                child: Text(_pickupTime == null
                    ? 'Tap to pick'
                    : DateFormat('EEE, MMM d · HH:mm')
                        .format(_pickupTime!)),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _notes,
              maxLines: 2,
              decoration:
                  const InputDecoration(labelText: 'Notes (optional)'),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                if (_vehicleType.text.trim().isEmpty ||
                    num.tryParse(_cost.text.trim()) == null) {
                  showAppSnackBar(
                      context, 'Vehicle type and cost are required.',
                      isError: true);
                  return;
                }
                Navigator.of(context).pop({
                  'vehicleType': _vehicleType.text.trim(),
                  'vehicleCount':
                      int.tryParse(_vehicleCount.text.trim()) ?? 1,
                  'estimatedCost': num.parse(_cost.text.trim()),
                  'currency': _currency.text.trim(),
                  'pickupLocation': _pickup.text.trim().isEmpty
                      ? null
                      : _pickup.text.trim(),
                  'dropoffLocation': _dropoff.text.trim().isEmpty
                      ? null
                      : _dropoff.text.trim(),
                  'pickupTime': ?_pickupTime?.toIso8601String(),
                  'coordinatorNotes': _notes.text.trim().isEmpty
                      ? null
                      : _notes.text.trim(),
                });
              },
              child: const Text('Send to treasurer'),
            ),
          ],
        ),
      ),
    );
  }
}
