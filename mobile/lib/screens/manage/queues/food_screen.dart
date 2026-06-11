import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../models/requests.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import 'queue_widgets.dart';

/// Food Logistics queue: plan catering and confirm food provision
/// (PATCH /api/food-requests/{id}/confirm), optionally raising a linked
/// budget request for catering funds, same as the web.
class FoodQueueScreen extends StatefulWidget {
  const FoodQueueScreen({super.key});

  @override
  State<FoodQueueScreen> createState() => _FoodQueueScreenState();
}

class _FoodQueueScreenState extends State<FoodQueueScreen> {
  List<FoodRequest> _requests = [];
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
      final res = await api.getJson('/api/food-requests');
      final list = (res['requests'] as List? ?? []).whereType<Map>().map((m) {
        final map = m.cast<String, dynamic>();
        return FoodRequest.fromJson(map['id']?.toString() ?? '', map);
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

  Future<void> _confirm(FoodRequest req) async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: PWColors.cream,
      builder: (_) => const _FoodPlanSheet(),
    );
    if (result == null || !mounted) return;

    setState(() => _actingOn = req.id);
    final api = context.read<ApiClient>();
    try {
      await api.dio.patch('/api/food-requests/${req.id}/confirm', data: {
        'action': 'CONFIRM',
        ...result,
      });
      if (mounted) showAppSnackBar(context, 'Food provision confirmed.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  Future<void> _decline(FoodRequest req) async {
    final comments = await promptText(context,
        title: 'Decline catering for "${req.eventTitle}"?',
        label: 'Reason (required)',
        requireText: true);
    if (comments == null || !mounted) return;
    setState(() => _actingOn = req.id);
    final api = context.read<ApiClient>();
    try {
      await api.dio.patch('/api/food-requests/${req.id}/confirm', data: {
        'action': 'DECLINE',
        'comments': comments,
      });
      if (mounted) showAppSnackBar(context, 'Food request declined.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Food Requests')),
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
                        icon: Icons.restaurant_outlined,
                        title: 'No food requests',
                        subtitle: 'Events that flagged catering needs '
                            'appear here once dispatched.',
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
                              if (req.status == 'CONFIRMED') ...[
                                const SizedBox(height: 8),
                                Text(
                                  [
                                    if (req.headcount != null)
                                      'Headcount: ${req.headcount}',
                                    if (req.menuPlan != null)
                                      'Menu: ${req.menuPlan}',
                                    if (req.budgetRequestId != null)
                                      'Catering budget raised',
                                  ].join('\n'),
                                  style: textTheme.bodySmall?.copyWith(
                                      color: PWColors.clay600,
                                      height: 1.5),
                                ),
                              ],
                              if (req.status == 'PENDING_FOOD') ...[
                                const SizedBox(height: 12),
                                ConfirmDeclineRow(
                                  busy: _actingOn == req.id,
                                  confirmLabel: 'Plan & confirm',
                                  onConfirm: () => _confirm(req),
                                  onDecline: () => _decline(req),
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

class _FoodPlanSheet extends StatefulWidget {
  const _FoodPlanSheet();

  @override
  State<_FoodPlanSheet> createState() => _FoodPlanSheetState();
}

class _FoodPlanSheetState extends State<_FoodPlanSheet> {
  final _headcount = TextEditingController();
  final _menuPlan = TextEditingController();
  final _notes = TextEditingController();
  bool _raiseBudget = false;
  final _amount = TextEditingController();
  final _currency = TextEditingController(text: 'ZMW');
  final _purpose = TextEditingController(text: 'Event catering');

  @override
  void dispose() {
    for (final c in [
      _headcount, _menuPlan, _notes, _amount, _currency, _purpose
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Catering plan',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 14),
            TextField(
              controller: _headcount,
              keyboardType: TextInputType.number,
              decoration:
                  const InputDecoration(labelText: 'Expected headcount'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _menuPlan,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Menu plan'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _notes,
              maxLines: 2,
              decoration:
                  const InputDecoration(labelText: 'Notes (optional)'),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              activeThumbColor: PWColors.gold,
              title: Text('Request catering funds from the treasurer',
                  style: Theme.of(context).textTheme.bodyMedium),
              value: _raiseBudget,
              onChanged: (v) => setState(() => _raiseBudget = v),
            ),
            if (_raiseBudget) ...[
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: TextField(
                      controller: _amount,
                      keyboardType: TextInputType.number,
                      decoration:
                          const InputDecoration(labelText: 'Amount *'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
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
                controller: _purpose,
                decoration: const InputDecoration(labelText: 'Purpose'),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                if (_raiseBudget &&
                    (num.tryParse(_amount.text.trim()) ?? 0) <= 0) {
                  showAppSnackBar(
                      context, 'Enter the catering budget amount.',
                      isError: true);
                  return;
                }
                Navigator.of(context).pop({
                  if (_headcount.text.trim().isNotEmpty)
                    'headcount': int.tryParse(_headcount.text.trim()),
                  if (_menuPlan.text.trim().isNotEmpty)
                    'menuPlan': _menuPlan.text.trim(),
                  if (_notes.text.trim().isNotEmpty)
                    'comments': _notes.text.trim(),
                  if (_raiseBudget)
                    'raiseBudget': {
                      'amount': num.parse(_amount.text.trim()),
                      'currency': _currency.text.trim(),
                      'purpose': _purpose.text.trim(),
                    },
                });
              },
              child: const Text('Confirm food provision'),
            ),
          ],
        ),
      ),
    );
  }
}
