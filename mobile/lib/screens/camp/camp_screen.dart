import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../models/camp.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import 'camp_register_screen.dart';
import 'payment_card.dart';

/// ROPs Camp hub: camp details, live capacity, the user's registrations
/// (their own + ones they submitted for others), and the register CTA.
class CampScreen extends StatefulWidget {
  const CampScreen({super.key});

  @override
  State<CampScreen> createState() => _CampScreenState();
}

class _CampScreenState extends State<CampScreen> {
  final camp = defaultCamp;
  int? _registered;
  int? _capacity;
  List<CampRegistration> _mine = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    try {
      final results = await Future.wait([
        api.getJson('/api/camp-registrations/capacity',
            query: {'campId': camp.id}),
        api.getJson('/api/camp-registrations/mine'),
      ]);
      final capacity = results[0];
      final mine = (results[1]['registrations'] as List? ?? [])
          .whereType<Map>()
          .map((m) => CampRegistration.fromJson(m.cast<String, dynamic>()))
          .where((r) => r.campId == camp.id)
          .toList();
      if (mounted) {
        setState(() {
          _registered = (capacity['registered'] as num?)?.toInt();
          _capacity = (capacity['capacity'] as num?)?.toInt();
          _mine = mine;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String get _dateRange {
    final start = DateTime.parse(camp.startDate);
    final end = DateTime.parse(camp.endDate);
    return '${DateFormat('MMM d').format(start)} – '
        '${DateFormat('MMM d, yyyy').format(end)}';
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final spotsLeft = (_capacity != null && _registered != null)
        ? (_capacity! - _registered!).clamp(0, _capacity!)
        : null;
    final isFull = spotsLeft != null && spotsLeft <= 0;

    return Scaffold(
      appBar: AppBar(title: const Text('ROPs Camp')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [PWColors.clay700, PWColors.clay800],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'RESERVE A PLACE BY THE FIRE',
                    style: textTheme.labelSmall?.copyWith(
                      color: PWColors.goldLight,
                      letterSpacing: 2,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    camp.name,
                    style: textTheme.headlineSmall
                        ?.copyWith(color: PWColors.cream),
                  ),
                  const SizedBox(height: 12),
                  _heroLine(Icons.calendar_today_outlined, _dateRange),
                  const SizedBox(height: 6),
                  _heroLine(Icons.payments_outlined,
                      '${camp.currency} ${camp.fee.toStringAsFixed(0)} per camper'),
                  if (spotsLeft != null) ...[
                    const SizedBox(height: 6),
                    _heroLine(
                      Icons.local_fire_department_outlined,
                      isFull
                          ? 'Camp is full — registration closed'
                          : '$spotsLeft of ${_capacity!} spots left',
                    ),
                  ],
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: isFull
                          ? null
                          : () async {
                              final registered =
                                  await Navigator.of(context).push<bool>(
                                MaterialPageRoute(
                                  builder: (_) =>
                                      CampRegisterScreen(camp: camp),
                                ),
                              );
                              if (registered == true) _load();
                            },
                      style: FilledButton.styleFrom(
                        backgroundColor: PWColors.gold,
                        foregroundColor: PWColors.clay900,
                      ),
                      child: Text(
                          isFull ? 'Registration closed' : 'Register a camper'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const SectionHeader('My registrations'),
            if (_loading)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(
                    child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                ),
              )
            else if (_mine.isEmpty)
              const Card(
                child: EmptyState(
                  icon: Icons.holiday_village_outlined,
                  title: 'No registrations yet',
                  subtitle: 'Register yourself or someone else above — '
                      'registrations you submit show up here.',
                ),
              )
            else
              for (final reg in _mine) ...[
                _RegistrationCard(reg: reg, camp: camp),
                const SizedBox(height: 10),
              ],
          ],
        ),
      ),
    );
  }

  Widget _heroLine(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: PWColors.goldLight),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: PWColors.clay100),
          ),
        ),
      ],
    );
  }
}

class _RegistrationCard extends StatelessWidget {
  const _RegistrationCard({required this.reg, required this.camp});

  final CampRegistration reg;
  final CampInfo camp;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final (statusLabel, fg, bg) = switch (reg.paymentStatus) {
      'PAID' => ('Paid', PWColors.tealDark, const Color(0xFFE2F3F0)),
      'REFUNDED' => (
          'Refunded',
          PWColors.clay500,
          PWColors.clay100,
        ),
      _ => ('Unpaid', PWColors.goldDark, const Color(0xFFFCF0DC)),
    };

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                InitialsAvatar(name: reg.fullName, radius: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(reg.fullName, style: textTheme.titleMedium),
                      Text(
                        [
                          if (reg.tshirtSize != null)
                            'T-shirt ${reg.tshirtSize}',
                          if (reg.dropoffLocation != null)
                            'Drop-off: ${reg.dropoffLocation == 'CHURCH' ? 'Church' : 'Campsite'}',
                        ].join(' · '),
                        style: textTheme.bodySmall
                            ?.copyWith(color: PWColors.clay400),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: bg,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    statusLabel,
                    style: textTheme.labelSmall?.copyWith(
                        color: fg, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            if (!reg.isPaid && reg.paymentStatus != 'REFUNDED') ...[
              const SizedBox(height: 12),
              CampPaymentCard(
                registrationId: reg.id,
                camperName: reg.firstName,
                amount: reg.paymentAmount ?? camp.fee,
                currency: camp.currency,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
