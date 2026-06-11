import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../models/fundraising.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

/// Potter's Shockers braai ordering — the mobile version of
/// /fundraising/order. Loads the live menu and upcoming braais from the
/// public API and submits to the same order endpoint, so orders land in the
/// same kitchen queue the Fundraising team manages on the web.
class FundraisingOrderScreen extends StatefulWidget {
  const FundraisingOrderScreen({super.key});

  @override
  State<FundraisingOrderScreen> createState() =>
      _FundraisingOrderScreenState();
}

class _FundraisingOrderScreenState extends State<FundraisingOrderScreen> {
  FundraisingMenu? _menu;
  List<PublicBraai> _braais = [];
  bool _loading = true;
  String? _loadError;

  String? _braaiId;
  final Map<String, int> _quantities = {};
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _notes = TextEditingController();
  String _pickup = 'after_2nd';
  final _customTime = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    final profile = context.read<AuthService>().profile;
    if (profile != null) {
      _name.text = profile.name;
      _phone.text = profile.phone ?? '';
    }
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _notes.dispose();
    _customTime.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final results = await Future.wait([
        api.getJson('/api/fundraising/public/menu'),
        api.getJson('/api/fundraising/public/braais'),
      ]);
      final menu = FundraisingMenu.fromJson(results[0]);
      final braais = (results[1]['braais'] as List? ?? [])
          .whereType<Map>()
          .map((m) => PublicBraai.fromJson(m.cast<String, dynamic>()))
          .toList();
      if (mounted) {
        setState(() {
          _menu = menu;
          _braais = braais;
          _braaiId ??= braais.isNotEmpty ? braais.first.id : null;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadError = 'Could not load the menu. Pull down to retry.';
        });
      }
    }
  }

  num get _total {
    final menu = _menu;
    if (menu == null) return 0;
    num total = 0;
    for (final item in menu.items) {
      total += item.price * (_quantities[item.key] ?? 0);
    }
    return total;
  }

  int get _itemCount =>
      _quantities.values.fold(0, (sum, qty) => sum + qty);

  Future<void> _submit() async {
    final menu = _menu;
    if (menu == null) return;
    if (_braaiId == null) {
      showAppSnackBar(context, 'Pick a braai to order from.', isError: true);
      return;
    }
    if (_itemCount == 0) {
      showAppSnackBar(context, 'Add at least one item to your order.',
          isError: true);
      return;
    }
    if (_name.text.trim().isEmpty || _phone.text.trim().isEmpty) {
      showAppSnackBar(context, 'Your name and phone number are required.',
          isError: true);
      return;
    }
    if (_pickup == 'custom' &&
        !RegExp(r'^\d{1,2}:\d{2}$').hasMatch(_customTime.text.trim())) {
      showAppSnackBar(context, 'Enter the pickup time as HH:mm.',
          isError: true);
      return;
    }

    setState(() => _submitting = true);
    final api = context.read<ApiClient>();
    try {
      final response = await api.postJson('/api/fundraising/public/orders', {
        'braaiEventId': _braaiId,
        'customerName': _name.text.trim(),
        'customerPhone': _phone.text.trim(),
        'pickupTime': _pickup,
        if (_pickup == 'custom') 'customPickupTime': _customTime.text.trim(),
        if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
        'items': [
          for (final entry in _quantities.entries)
            if (entry.value > 0)
              {'itemKey': entry.key, 'qty': entry.value},
        ],
      });
      final order = response['order'];
      if (mounted && order is Map) {
        final data = order.cast<String, dynamic>();
        setState(() {
          _quantities.clear();
          _notes.clear();
        });
        await showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          showDragHandle: true,
          backgroundColor: PWColors.cream,
          builder: (_) => _OrderSuccessSheet(data: data),
        );
      }
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } catch (_) {
      if (mounted) {
        showAppSnackBar(context, 'Could not place the order. Try again.',
            isError: true);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final menu = _menu;

    return Scaffold(
      appBar: AppBar(title: Text(menu?.campaignName ?? 'Braai orders')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : (_loadError != null || menu == null)
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      const SizedBox(height: 80),
                      EmptyState(
                        icon: Icons.outdoor_grill_outlined,
                        title: 'Menu unavailable',
                        subtitle: _loadError,
                      ),
                    ],
                  )
                : _braais.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: const [
                          SizedBox(height: 80),
                          EmptyState(
                            icon: Icons.outdoor_grill_outlined,
                            title: 'No braai coming up',
                            subtitle:
                                'Orders open when the next fundraising '
                                'braai is scheduled. Check back soon!',
                          ),
                        ],
                      )
                    : ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding:
                            const EdgeInsets.fromLTRB(20, 8, 20, 28),
                        children: [
                          if (_braais.length > 1) ...[
                            const SectionHeader('Which braai?'),
                            DropdownButtonFormField<String>(
                              initialValue: _braaiId,
                              items: [
                                for (final braai in _braais)
                                  DropdownMenuItem(
                                    value: braai.id,
                                    child: Text(
                                      braai.eventDate == null
                                          ? braai.title
                                          : '${braai.title} — ${DateFormat('EEE, MMM d').format(braai.eventDate!)}',
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                              ],
                              onChanged: (v) =>
                                  setState(() => _braaiId = v),
                            ),
                            const SizedBox(height: 20),
                          ] else ...[
                            _BraaiBanner(braai: _braais.first),
                            const SizedBox(height: 20),
                          ],
                          const SectionHeader('Menu'),
                          Card(
                            child: Column(
                              children: [
                                for (final (i, item)
                                    in menu.items.indexed) ...[
                                  if (i > 0) const Divider(height: 1),
                                  _MenuRow(
                                    item: item,
                                    currency: menu.currency,
                                    qty: _quantities[item.key] ?? 0,
                                    onChanged: (qty) => setState(() {
                                      if (qty <= 0) {
                                        _quantities.remove(item.key);
                                      } else {
                                        _quantities[item.key] =
                                            qty.clamp(0, 99);
                                      }
                                    }),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(height: 20),
                          const SectionHeader('Collection'),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final (value, label) in pickupOptions)
                                ChoiceChip(
                                  label: Text(label),
                                  selected: _pickup == value,
                                  selectedColor: PWColors.gold
                                      .withValues(alpha: 0.25),
                                  onSelected: (_) =>
                                      setState(() => _pickup = value),
                                ),
                            ],
                          ),
                          if (_pickup == 'custom') ...[
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _customTime,
                              keyboardType: TextInputType.datetime,
                              decoration: const InputDecoration(
                                labelText: 'Pickup time (HH:mm)',
                                prefixIcon: Icon(Icons.schedule),
                              ),
                            ),
                          ],
                          const SizedBox(height: 20),
                          const SectionHeader('Your details'),
                          TextFormField(
                            controller: _name,
                            textCapitalization:
                                TextCapitalization.words,
                            decoration: const InputDecoration(
                              labelText: 'Name *',
                              prefixIcon: Icon(Icons.person_outline),
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _phone,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(
                              labelText: 'Phone *',
                              prefixIcon: Icon(Icons.phone_outlined),
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _notes,
                            maxLines: 2,
                            decoration: const InputDecoration(
                              labelText: 'Notes (optional)',
                              prefixIcon: Icon(Icons.sticky_note_2_outlined),
                            ),
                          ),
                          const SizedBox(height: 20),
                          FilledButton(
                            onPressed: _submitting ? null : _submit,
                            child: _submitting
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: PWColors.cream),
                                  )
                                : Text(_itemCount == 0
                                    ? 'Place order'
                                    : 'Place order · ${menu.currency} ${_total.toStringAsFixed(0)}'),
                          ),
                          const SizedBox(height: 8),
                          Center(
                            child: Text(
                              'Pay on collection — cash or MoMo to '
                              '${menu.momoNumber}.',
                              style: textTheme.bodySmall
                                  ?.copyWith(color: PWColors.clay400),
                            ),
                          ),
                        ],
                      ),
      ),
    );
  }
}

class _BraaiBanner extends StatelessWidget {
  const _BraaiBanner({required this.braai});

  final PublicBraai braai;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.outdoor_grill,
                  color: Color(0xFFDC2626)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(braai.title, style: textTheme.titleMedium),
                  Text(
                    [
                      if (braai.eventDate != null)
                        DateFormat('EEEE, MMM d').format(braai.eventDate!),
                      if (braai.venue != null) braai.venue!,
                    ].join(' · '),
                    style: textTheme.bodySmall
                        ?.copyWith(color: PWColors.clay400),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.item,
    required this.currency,
    required this.qty,
    required this.onChanged,
  });

  final FundraisingMenuItem item;
  final String currency;
  final int qty;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Text(item.emoji, style: const TextStyle(fontSize: 26)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name,
                    style: textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600)),
                if (item.description.isNotEmpty)
                  Text(
                    item.description,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.bodySmall
                        ?.copyWith(color: PWColors.clay400),
                  ),
                Text(
                  '$currency ${item.price.toStringAsFixed(0)}',
                  style: textTheme.bodySmall?.copyWith(
                      color: PWColors.goldDark,
                      fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
          if (qty == 0)
            OutlinedButton(
              onPressed: () => onChanged(1),
              style: OutlinedButton.styleFrom(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                minimumSize: Size.zero,
              ),
              child: const Text('Add'),
            )
          else
            Row(
              children: [
                _StepButton(
                    icon: Icons.remove, onTap: () => onChanged(qty - 1)),
                SizedBox(
                  width: 32,
                  child: Center(
                    child: Text('$qty',
                        style: textTheme.titleMedium
                            ?.copyWith(color: PWColors.clay700)),
                  ),
                ),
                _StepButton(icon: Icons.add, onTap: () => onChanged(qty + 1)),
              ],
            ),
        ],
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          color: PWColors.gold.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 16, color: PWColors.goldDark),
      ),
    );
  }
}

class _OrderSuccessSheet extends StatelessWidget {
  const _OrderSuccessSheet({required this.data});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final orderNumber = data['orderNumber']?.toString() ?? '—';
    final total = data['total'];
    final currency = data['currency']?.toString() ?? '';
    final momo = data['momoNumber']?.toString();

    return Padding(
      padding: EdgeInsets.fromLTRB(
          24, 8, 24, 24 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.check_circle_outline,
              size: 56, color: PWColors.teal),
          const SizedBox(height: 12),
          Text('Order placed!', style: textTheme.headlineSmall),
          const SizedBox(height: 6),
          Text(
            'Quote this number at collection:',
            style: textTheme.bodySmall?.copyWith(color: PWColors.clay500),
          ),
          const SizedBox(height: 10),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 22, vertical: 10),
            decoration: BoxDecoration(
              color: PWColors.gold.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              orderNumber,
              style: textTheme.headlineMedium
                  ?.copyWith(color: PWColors.goldDark, letterSpacing: 2),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'Total: $currency $total'
            '${momo == null || momo.isEmpty ? '' : ' — pay cash or MoMo to $momo'}',
            textAlign: TextAlign.center,
            style: textTheme.bodyMedium,
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Done'),
            ),
          ),
        ],
      ),
    );
  }
}
