import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../core/fire.dart';
import '../../../models/camp.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';

/// ROPs Camp admin: every registration with payment marking — the mobile
/// version of /manage/rops-camp.
class CampAdminScreen extends StatefulWidget {
  const CampAdminScreen({super.key});

  @override
  State<CampAdminScreen> createState() => _CampAdminScreenState();
}

class _CampAdminScreenState extends State<CampAdminScreen> {
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  String _query = '';
  String _filter = 'ALL';
  String? _actingOn;

  final camp = defaultCamp;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    try {
      final res = await api
          .getJson('/api/camp-registrations', query: {'campId': camp.id});
      final list = (res['registrations'] as List? ?? [])
          .whereType<Map>()
          .map((m) => m.cast<String, dynamic>())
          .toList();
      if (mounted) {
        setState(() {
          _rows = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markPayment(Map<String, dynamic> reg) async {
    final isPaid = asString(reg['paymentStatus'], 'UNPAID') == 'PAID';
    final amountController = TextEditingController(
        text: (asNumOrNull(reg['paymentAmount']) ?? camp.fee).toString());
    final referenceController =
        TextEditingController(text: asString(reg['paymentReference']));

    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      backgroundColor: PWColors.cream,
      isScrollControlled: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.fromLTRB(
            24, 0, 24, 24 + MediaQuery.of(sheetContext).viewInsets.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              '${asString(reg['firstName'])} ${asString(reg['lastName'])}',
              style: Theme.of(sheetContext).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            if (!isPaid) ...[
              TextField(
                controller: amountController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                    labelText: 'Amount received (${camp.currency})'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: referenceController,
                decoration: const InputDecoration(
                    labelText: 'Payment reference (optional)'),
              ),
              const SizedBox(height: 14),
              FilledButton(
                style:
                    FilledButton.styleFrom(backgroundColor: PWColors.teal),
                onPressed: () => Navigator.of(sheetContext).pop('PAID'),
                child: const Text('Mark as paid'),
              ),
            ] else ...[
              OutlinedButton(
                onPressed: () => Navigator.of(sheetContext).pop('UNPAID'),
                child: const Text('Mark as unpaid'),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                    foregroundColor: PWColors.destructive),
                onPressed: () => Navigator.of(sheetContext).pop('REFUNDED'),
                child: const Text('Mark as refunded'),
              ),
            ],
          ],
        ),
      ),
    );
    if (action == null || !mounted) return;

    setState(() => _actingOn = asString(reg['id']));
    final api = context.read<ApiClient>();
    try {
      await api.dio.patch('/api/camp-registrations/${reg['id']}', data: {
        'paymentStatus': action,
        if (action == 'PAID')
          'paymentAmount': num.tryParse(amountController.text.trim()),
        if (action == 'PAID' &&
            referenceController.text.trim().isNotEmpty)
          'paymentReference': referenceController.text.trim(),
      });
      await _load();
      if (mounted) showAppSnackBar(context, 'Payment updated.');
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final filtered = _rows.where((reg) {
      final status = asString(reg['paymentStatus'], 'UNPAID');
      if (_filter != 'ALL' && status != _filter) return false;
      if (_query.isEmpty) return true;
      final name =
          '${asString(reg['firstName'])} ${asString(reg['lastName'])}'
              .toLowerCase();
      return name.contains(_query.toLowerCase()) ||
          asString(reg['phone']).contains(_query);
    }).toList();
    final paid = _rows
        .where((r) => asString(r['paymentStatus'], 'UNPAID') == 'PAID')
        .length;

    return Scaffold(
      appBar: AppBar(title: const Text('Camp Registrations')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(camp.name, style: textTheme.titleMedium),
                            Text(
                              '${_rows.length} of ${camp.capacity} '
                              'registered · $paid paid',
                              style: textTheme.bodySmall
                                  ?.copyWith(color: PWColors.clay400),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        '${camp.currency} '
                        '${(paid * camp.fee).toStringAsFixed(0)}',
                        style: textTheme.titleMedium
                            ?.copyWith(color: PWColors.tealDark),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
              child: TextField(
                decoration: const InputDecoration(
                  hintText: 'Search name or phone…',
                  prefixIcon: Icon(Icons.search),
                ),
                onChanged: (v) => setState(() => _query = v),
              ),
            ),
            SizedBox(
              height: 50,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 9),
                children: [
                  for (final (value, label) in const [
                    ('ALL', 'All'),
                    ('UNPAID', 'Unpaid'),
                    ('PAID', 'Paid'),
                    ('REFUNDED', 'Refunded'),
                  ]) ...[
                    ChoiceChip(
                      label: Text(label),
                      selected: _filter == value,
                      selectedColor: PWColors.gold.withValues(alpha: 0.25),
                      onSelected: (_) => setState(() => _filter = value),
                    ),
                    const SizedBox(width: 8),
                  ],
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : filtered.isEmpty
                      ? const EmptyState(
                          icon: Icons.holiday_village_outlined,
                          title: 'No registrations match',
                          subtitle: 'Adjust the search or filter.',
                        )
                      : ListView.builder(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding:
                              const EdgeInsets.fromLTRB(20, 0, 20, 24),
                          itemCount: filtered.length,
                          itemBuilder: (context, i) {
                            final reg = filtered[i];
                            final name =
                                '${asString(reg['firstName'])} ${asString(reg['lastName'])}';
                            final status =
                                asString(reg['paymentStatus'], 'UNPAID');
                            final createdAt =
                                asDateOrNull(reg['createdAt']);
                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                onTap: () => _markPayment(reg),
                                leading: InitialsAvatar(
                                    name: name, radius: 18),
                                title: Text(name,
                                    style: textTheme.bodyMedium?.copyWith(
                                        fontWeight: FontWeight.w600)),
                                subtitle: Text(
                                  [
                                    asString(reg['phone']),
                                    if (asStringOrNull(
                                            reg['tshirtSize']) !=
                                        null)
                                      'T-shirt ${reg['tshirtSize']}',
                                    if (createdAt != null)
                                      DateFormat('MMM d')
                                          .format(createdAt),
                                  ].join(' · '),
                                  style: textTheme.bodySmall?.copyWith(
                                      color: PWColors.clay400),
                                ),
                                trailing: _actingOn ==
                                        asString(reg['id'])
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2),
                                      )
                                    : Container(
                                        padding:
                                            const EdgeInsets.symmetric(
                                                horizontal: 10,
                                                vertical: 4),
                                        decoration: BoxDecoration(
                                          color: switch (status) {
                                            'PAID' =>
                                              const Color(0xFFE2F3F0),
                                            'REFUNDED' =>
                                              PWColors.clay100,
                                            _ => const Color(0xFFFCF0DC),
                                          },
                                          borderRadius:
                                              BorderRadius.circular(999),
                                        ),
                                        child: Text(
                                          status == 'PAID'
                                              ? 'Paid'
                                              : status == 'REFUNDED'
                                                  ? 'Refunded'
                                                  : 'Unpaid',
                                          style: textTheme.labelSmall
                                              ?.copyWith(
                                            color: switch (status) {
                                              'PAID' => PWColors.tealDark,
                                              'REFUNDED' =>
                                                PWColors.clay500,
                                              _ => PWColors.goldDark,
                                            },
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                              ),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
