import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../models/fundraising_manage.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';

/// One braai: the responsibility roster (assign Fundraising members to the
/// 12 standard duties) and the live order/kitchen queue.
class BraaiDetailScreen extends StatefulWidget {
  const BraaiDetailScreen({
    super.key,
    required this.braaiId,
    required this.title,
  });

  final String braaiId;
  final String title;

  @override
  State<BraaiDetailScreen> createState() => _BraaiDetailScreenState();
}

class _BraaiDetailScreenState extends State<BraaiDetailScreen> {
  List<BraaiAssignmentModel> _assignments = [];
  List<KitchenOrder> _orders = [];
  List<BraaiMember> _members = [];
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
      final results = await Future.wait([
        api.getJson(
            '/api/fundraising/braai/events/${widget.braaiId}/assignments'),
        api.getJson('/api/fundraising/braai/events/${widget.braaiId}/orders'),
        api.getJson('/api/fundraising/braai/department-members'),
      ]);
      if (!mounted) return;
      setState(() {
        _assignments = (results[0]['assignments'] as List? ?? [])
            .whereType<Map>()
            .map((m) =>
                BraaiAssignmentModel.fromJson(m.cast<String, dynamic>()))
            .toList();
        _orders = (results[1]['orders'] as List? ?? [])
            .whereType<Map>()
            .map((m) => KitchenOrder.fromJson(m.cast<String, dynamic>()))
            .where((o) => !o.isArchived)
            .toList();
        _members = (results[2]['members'] as List? ?? [])
            .whereType<Map>()
            .map((m) => BraaiMember.fromJson(m.cast<String, dynamic>()))
            .toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _assign((String, String, String) responsibility) async {
    final picked = await showModalBottomSheet<BraaiMember>(
      context: context,
      showDragHandle: true,
      backgroundColor: PWColors.cream,
      builder: (_) => ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        children: [
          Text('Assign: ${responsibility.$2}',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (_members.isEmpty)
            const EmptyState(
              icon: Icons.people_outline,
              title: 'No Fundraising members found',
              subtitle: 'Add members to the Fundraising department first.',
            ),
          for (final member in _members)
            ListTile(
              onTap: () => Navigator.of(context).pop(member),
              leading: InitialsAvatar(name: member.name, radius: 16),
              title: Text(member.name),
            ),
        ],
      ),
    );
    if (picked == null || !mounted) return;

    setState(() => _actingOn = responsibility.$1);
    final api = context.read<ApiClient>();
    try {
      await api.postJson(
          '/api/fundraising/braai/events/${widget.braaiId}/assignments', {
        'responsibilityKey': responsibility.$1,
        'userId': picked.id,
      });
      await _load();
      if (mounted) {
        showAppSnackBar(context,
            '${picked.name} assigned — they get an email + notification.');
      }
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  Future<void> _unassign(BraaiAssignmentModel assignment) async {
    final api = context.read<ApiClient>();
    try {
      await api.deleteJson(
          '/api/fundraising/braai/events/${widget.braaiId}/assignments/${assignment.id}');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    }
  }

  Future<void> _updateOrder(
      KitchenOrder order, Map<String, dynamic> updates) async {
    final api = context.read<ApiClient>();
    setState(() => _actingOn = order.id);
    try {
      await api.dio.patch(
          '/api/fundraising/braai/events/${widget.braaiId}/orders/${order.id}',
          data: updates);
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.title),
          bottom: TabBar(
            labelColor: PWColors.clay700,
            indicatorColor: PWColors.gold,
            tabs: [
              const Tab(text: 'Roster'),
              Tab(text: 'Orders (${_orders.length})'),
            ],
          ),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(
                children: [
                  _buildRoster(context),
                  _buildOrders(context),
                ],
              ),
      ),
    );
  }

  Widget _buildRoster(BuildContext context) {
    final byKey = <String, BraaiAssignmentModel>{
      for (final a in _assignments) a.responsibilityKey: a,
    };
    final textTheme = Theme.of(context).textTheme;

    Widget section(String phase, String title) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(title),
            for (final resp
                in braaiResponsibilities.where((r) => r.$3 == phase))
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text(
                    resp.$2,
                    style: textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  subtitle: byKey[resp.$1] == null
                      ? Text('Unassigned',
                          style: textTheme.bodySmall
                              ?.copyWith(color: PWColors.clay300))
                      : Text(byKey[resp.$1]!.userName,
                          style: textTheme.bodySmall
                              ?.copyWith(color: PWColors.clay500)),
                  trailing: byKey[resp.$1] != null
                      ? Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            StatusBadge(status: byKey[resp.$1]!.status),
                            IconButton(
                              icon: const Icon(Icons.close,
                                  size: 18, color: PWColors.clay400),
                              onPressed: () => _unassign(byKey[resp.$1]!),
                            ),
                          ],
                        )
                      : _actingOn == resp.$1
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2),
                            )
                          : OutlinedButton(
                              onPressed: () => _assign(resp),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 6),
                                minimumSize: Size.zero,
                              ),
                              child: const Text('Assign'),
                            ),
                ),
              ),
          ],
        );

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        children: [
          section('PREPARATION', 'Preparations (before the day)'),
          const SizedBox(height: 8),
          section('EVENT_DAY', 'On the day'),
        ],
      ),
    );
  }

  Widget _buildOrders(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    if (_orders.isEmpty) {
      return const EmptyState(
        icon: Icons.receipt_long_outlined,
        title: 'No orders yet',
        subtitle: 'Orders from the public page and the app land here live.',
      );
    }
    final totalPaid = _orders
        .where((o) => o.paymentStatus == 'PAID')
        .fold<num>(0, (sum, o) => sum + o.total);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Expanded(
                    child: Text('${_orders.length} orders',
                        style: textTheme.titleMedium),
                  ),
                  Text(
                    'Paid: ${_orders.first.currency} '
                    '${totalPaid.toStringAsFixed(0)}',
                    style: textTheme.bodyMedium?.copyWith(
                        color: PWColors.tealDark,
                        fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          for (final order in _orders) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: PWColors.gold.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            order.orderNumber,
                            style: textTheme.labelMedium?.copyWith(
                                color: PWColors.goldDark,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.2),
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '${order.currency} '
                          '${order.total.toStringAsFixed(0)}',
                          style: textTheme.titleMedium,
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${order.customerName} · ${order.customerPhone}',
                      style: textTheme.bodyMedium
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      '${order.itemsSummary} · ${order.pickupLabel}',
                      style: textTheme.bodySmall
                          ?.copyWith(color: PWColors.clay500),
                    ),
                    if (order.notes != null)
                      Text('“${order.notes}”',
                          style: textTheme.bodySmall?.copyWith(
                              color: PWColors.clay400,
                              fontStyle: FontStyle.italic)),
                    const SizedBox(height: 10),
                    if (_actingOn == order.id)
                      const Center(
                        child: SizedBox(
                          width: 20,
                          height: 20,
                          child:
                              CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    else
                      Row(
                        children: [
                          // Payment toggle
                          Expanded(
                            child: order.paymentStatus == 'PAID'
                                ? OutlinedButton.icon(
                                    onPressed: () => _updateOrder(order,
                                        {'paymentStatus': 'UNPAID'}),
                                    icon: const Icon(Icons.check_circle,
                                        size: 16,
                                        color: PWColors.tealDark),
                                    label: Text(
                                        'Paid (${order.paymentMethod ?? '—'})'),
                                  )
                                : FilledButton.icon(
                                    style: FilledButton.styleFrom(
                                        backgroundColor: PWColors.teal),
                                    onPressed: () async {
                                      final method =
                                          await showModalBottomSheet<
                                              String>(
                                        context: context,
                                        showDragHandle: true,
                                        backgroundColor: PWColors.cream,
                                        builder: (sheetContext) => Column(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            ListTile(
                                              leading: const Icon(
                                                  Icons.phone_iphone),
                                              title: const Text(
                                                  'Mobile money'),
                                              onTap: () => Navigator.of(
                                                      sheetContext)
                                                  .pop('momo'),
                                            ),
                                            ListTile(
                                              leading: const Icon(
                                                  Icons.payments),
                                              title: const Text('Cash'),
                                              onTap: () => Navigator.of(
                                                      sheetContext)
                                                  .pop('cash'),
                                            ),
                                            const SizedBox(height: 16),
                                          ],
                                        ),
                                      );
                                      if (method != null) {
                                        _updateOrder(order, {
                                          'paymentStatus': 'PAID',
                                          'paymentMethod': method,
                                        });
                                      }
                                    },
                                    icon: const Icon(
                                        Icons.attach_money,
                                        size: 16),
                                    label: const Text('Mark paid'),
                                  ),
                          ),
                          const SizedBox(width: 8),
                          // Preparation status stepper
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () {
                                const flow = [
                                  'PENDING',
                                  'IN_PREP',
                                  'READY',
                                  'COLLECTED'
                                ];
                                final idx = flow
                                    .indexOf(order.preparationStatus);
                                final next = flow[
                                    (idx + 1).clamp(0, flow.length - 1)];
                                if (next != order.preparationStatus) {
                                  _updateOrder(order,
                                      {'preparationStatus': next});
                                }
                              },
                              child: Text(
                                prepStatusLabels[
                                        order.preparationStatus] ??
                                    order.preparationStatus,
                                style: TextStyle(
                                  color: switch (
                                      order.preparationStatus) {
                                    'READY' => PWColors.tealDark,
                                    'COLLECTED' => PWColors.clay400,
                                    'IN_PREP' => PWColors.goldDark,
                                    _ => PWColors.clay600,
                                  },
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}
