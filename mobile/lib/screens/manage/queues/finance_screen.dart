import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../models/requests.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import 'queue_widgets.dart';

/// Treasurer queue: budget requests awaiting funds confirmation
/// (PATCH /api/budget-requests/{id}/treasurer-decision).
class FinanceApprovalsScreen extends StatefulWidget {
  const FinanceApprovalsScreen({super.key});

  @override
  State<FinanceApprovalsScreen> createState() =>
      _FinanceApprovalsScreenState();
}

class _FinanceApprovalsScreenState extends State<FinanceApprovalsScreen> {
  List<BudgetRequest> _requests = [];
  bool _loading = true;
  bool _pendingOnly = true;
  String? _actingOn;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    try {
      final res = await api.getJson('/api/budget-requests',
          query: _pendingOnly ? {'status': 'PENDING_TREASURER'} : null);
      final list = (res['requests'] as List? ?? [])
          .whereType<Map>()
          .map((m) {
            final map = m.cast<String, dynamic>();
            return BudgetRequest.fromJson(
                map['id']?.toString() ?? '', map);
          })
          .toList();
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

  Future<void> _decide(BudgetRequest req, String action) async {
    final api = context.read<ApiClient>();
    String? comments;
    num? approvedAmount;

    if (action == 'APPROVE') {
      final result = await _approveDialog(req);
      if (result == null) return;
      approvedAmount = result.$1;
      comments = result.$2;
    } else {
      comments = await promptText(context,
          title: 'Decline "${req.eventTitle}" budget?',
          label: 'Reason for the requester',
          requireText: true);
      if (comments == null) return;
    }

    setState(() => _actingOn = req.id);
    try {
      await api.dio
          .patch('/api/budget-requests/${req.id}/treasurer-decision', data: {
        'action': action,
        'approvedAmount': ?approvedAmount,
        if (comments.isNotEmpty) 'comments': comments,
      });
      if (mounted) {
        showAppSnackBar(
            context,
            action == 'APPROVE'
                ? 'Funds confirmed for ${req.eventTitle}.'
                : 'Budget request declined.');
      }
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  Future<(num, String)?> _approveDialog(BudgetRequest req) async {
    final amountController =
        TextEditingController(text: req.requestedAmount.toString());
    final commentsController = TextEditingController();
    return showDialog<(num, String)>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text('Confirm funds',
            style: Theme.of(dialogContext).textTheme.titleLarge),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: amountController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                  labelText: 'Approved amount (${req.currency})'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: commentsController,
              decoration:
                  const InputDecoration(labelText: 'Comments (optional)'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: PWColors.teal),
            onPressed: () {
              final amount = num.tryParse(amountController.text.trim());
              if (amount == null || amount <= 0) return;
              Navigator.of(dialogContext)
                  .pop((amount, commentsController.text.trim()));
            },
            child: const Text('Approve'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Finance Approvals'),
        actions: [
          TextButton(
            onPressed: () {
              setState(() => _pendingOnly = !_pendingOnly);
              _load();
            },
            child: Text(_pendingOnly ? 'Show all' : 'Pending only'),
          ),
        ],
      ),
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
                        icon: Icons.account_balance_wallet_outlined,
                        title: 'No budget requests',
                        subtitle:
                            'Requests appear here when events ask for funds.',
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
                              const SizedBox(height: 8),
                              Text(
                                '${req.currency} '
                                '${req.requestedAmount.toStringAsFixed(0)}',
                                style: textTheme.headlineSmall
                                    ?.copyWith(color: PWColors.goldDark),
                              ),
                              NeedsBlock(
                                  label: 'Purpose', text: req.purpose),
                              const SizedBox(height: 4),
                              Text(
                                'Requested by ${req.requestedByName}',
                                style: textTheme.labelSmall
                                    ?.copyWith(color: PWColors.clay400),
                              ),
                              if (req.treasurerComments != null)
                                NeedsBlock(
                                    label: 'Treasurer notes',
                                    text: req.treasurerComments!),
                              if (req.approvedAmount != null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 6),
                                  child: Text(
                                    'Approved: ${req.currency} '
                                    '${req.approvedAmount}',
                                    style: textTheme.bodySmall?.copyWith(
                                        color: PWColors.tealDark,
                                        fontWeight: FontWeight.w700),
                                  ),
                                ),
                              if (req.isPending) ...[
                                const SizedBox(height: 12),
                                ConfirmDeclineRow(
                                  busy: _actingOn == req.id,
                                  confirmLabel: 'Approve funds',
                                  onConfirm: () => _decide(req, 'APPROVE'),
                                  onDecline: () => _decide(req, 'REJECT'),
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
