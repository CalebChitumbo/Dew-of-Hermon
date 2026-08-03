import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/api/api_client.dart';
import '../../core/camp/camp_meals.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/camp_theme.dart';
import '../../core/utils/money.dart';
import '../../data/models/camp.dart';
import '../../data/repositories/camp_repository.dart';

/// Track a registration from its badge code — no account needed.
///
/// Deliberately shows only what the person holding the badge already knows:
/// the name, whether the fee is settled, and whether they have arrived. The
/// medical notes and guardian numbers stay with the camp team.
class CampTrackScreen extends ConsumerStatefulWidget {
  const CampTrackScreen({super.key, this.initialCode});

  final String? initialCode;

  @override
  ConsumerState<CampTrackScreen> createState() => _CampTrackScreenState();
}

class _CampTrackScreenState extends ConsumerState<CampTrackScreen> {
  final _controller = TextEditingController();
  CampRegistration? _found;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final code = widget.initialCode;
    if (code != null && code.isNotEmpty) {
      _controller.text = code;
      WidgetsBinding.instance.addPostFrameCallback((_) => _lookup());
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _lookup() async {
    final code = normalizeMealCode(_controller.text);
    if (code.isEmpty) {
      setState(() => _error = 'Enter the badge code from your confirmation.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // The public tracker is the one camp lookup that is not admin-gated;
      // the badge code itself is the credential.
      final result =
          await ref.read(campRepositoryProvider).lookupRegistration(code);
      if (!mounted) return;
      setState(() {
        _found = result.registration;
        _busy = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _found = null;
        _busy = false;
        _error = e.isUnauthorized || e.isForbidden
            ? 'Sign in to look up a registration, or ask the camp team.'
            : e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return RopsThemeScope(
      child: Builder(
        builder: (context) => Scaffold(
          backgroundColor: RopsColors.ink,
          appBar: AppBar(
            leading: IconButton(
              icon: const Icon(AppIcons.back),
              onPressed: () => context.canPop()
                  ? context.pop()
                  : context.go('/rops-camp'),
            ),
            title: const Text('Track a registration'),
          ),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
            children: [
              Text(
                'Where is my registration?',
                style: AppFonts.fraunces(const TextStyle(
                  fontSize: 26,
                  height: 1.1,
                  fontWeight: FontWeight.w700,
                  color: RopsColors.cream,
                )),
              ),
              const SizedBox(height: 8),
              Text(
                'Enter the badge code from your confirmation email to see '
                'whether the fee is settled and whether the camper has '
                'arrived.',
                style: AppFonts.manrope(const TextStyle(
                  fontSize: 14,
                  height: 1.55,
                  color: RopsColors.sand,
                )),
              ),
              const SizedBox(height: 22),
              TextField(
                controller: _controller,
                textCapitalization: TextCapitalization.characters,
                textInputAction: TextInputAction.go,
                onSubmitted: (_) => _lookup(),
                style: AppFonts.manrope(const TextStyle(
                  fontSize: 16,
                  letterSpacing: 1.6,
                  fontWeight: FontWeight.w600,
                  color: RopsColors.cream,
                )),
                decoration: const InputDecoration(
                  hintText: 'ABCD-EFGH-JKMN',
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _busy ? null : _lookup,
                  icon: _busy
                      ? const SizedBox(
                          height: 17,
                          width: 17,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(AppIcons.search, size: 17),
                  label: const Text('Look it up'),
                ),
              ),

              if (_error != null) ...[
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFF6B6B).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    border: Border.all(
                        color: const Color(0xFFFF6B6B).withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(AppIcons.alert,
                          size: 17, color: Color(0xFFFF6B6B)),
                      const SizedBox(width: 11),
                      Expanded(
                        child: Text(
                          _error!,
                          style: AppFonts.manrope(const TextStyle(
                            fontSize: 13,
                            height: 1.5,
                            color: RopsColors.cream,
                          )),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              if (_found != null) ...[
                const SizedBox(height: 22),
                _TrackResult(registration: _found!),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _TrackResult extends StatelessWidget {
  const _TrackResult({required this.registration});

  final CampRegistration registration;

  @override
  Widget build(BuildContext context) {
    final reg = registration;
    final camp = getCamp(reg.campId);
    final code = reg.checkInCode;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: RopsColors.inkSoft,
        borderRadius: BorderRadius.circular(AppRadius.lux),
        border: Border.all(color: RopsColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            reg.fullName,
            style: AppFonts.fraunces(const TextStyle(
              fontSize: 24,
              height: 1.1,
              fontWeight: FontWeight.w700,
              color: RopsColors.cream,
            )),
          ),
          const SizedBox(height: 5),
          Text(
            camp?.name ?? 'ROPs Camp',
            style: AppFonts.manrope(
                const TextStyle(fontSize: 13, color: RopsColors.sand)),
          ),
          const SizedBox(height: 18),

          _TrackRow(
            icon: AppIcons.money,
            label: 'Camp fee',
            value: reg.isPaid
                ? 'Settled — thank you'
                : reg.isSponsored
                    ? 'Covered by ${reg.sponsorName ?? 'a sponsor'}'
                    : 'Not yet received',
            good: reg.isPaid || reg.isSponsored,
          ),
          _TrackRow(
            icon: AppIcons.tent,
            label: 'At camp',
            value: reg.checkedIn
                ? reg.onPass
                    ? 'Checked in — currently out on an approved pass'
                    : 'Checked in'
                : 'Not arrived yet',
            good: reg.checkedIn,
          ),

          if (!reg.isPaid && !reg.isSponsored && camp != null) ...[
            const SizedBox(height: 16),
            const Divider(color: RopsColors.border),
            const SizedBox(height: 14),
            Text(
              'TO SETTLE THE FEE',
              style: AppFonts.manrope(const TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.7,
                color: RopsColors.ember,
              )),
            ),
            const SizedBox(height: 10),
            Text(
              'Send ${Money.format(camp.fee, camp.currency)} to '
              '$kCampPaymentNumber using reference '
              '${buildCampPaymentReference(reg.id)}, then send proof of '
              'payment to the camp team.',
              style: AppFonts.manrope(const TextStyle(
                fontSize: 13,
                height: 1.6,
                color: RopsColors.sand,
              )),
            ),
          ],

          if (code != null && code.isNotEmpty) ...[
            const SizedBox(height: 18),
            Center(
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: RopsColors.cream,
                  borderRadius: BorderRadius.circular(AppRadius.card),
                ),
                child: Column(
                  children: [
                    QrImageView(
                      data: '${AppConfig.webBaseUrl}/rops-camp/track?code=$code',
                      size: 150,
                      backgroundColor: RopsColors.cream,
                      eyeStyle: const QrEyeStyle(
                        eyeShape: QrEyeShape.square,
                        color: RopsColors.ink,
                      ),
                      dataModuleStyle: const QrDataModuleStyle(
                        dataModuleShape: QrDataModuleShape.square,
                        color: RopsColors.ink,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      formatMealCode(code),
                      style: AppFonts.manrope(const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 2,
                        color: RopsColors.ink,
                      )),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _TrackRow extends StatelessWidget {
  const _TrackRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.good,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool good;

  @override
  Widget build(BuildContext context) {
    final colour = good ? const Color(0xFF6EE7B7) : RopsColors.emberSoft;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(good ? AppIcons.checkCircle : icon, size: 18, color: colour),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label.toUpperCase(),
                  style: AppFonts.manrope(const TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5,
                    color: RopsColors.sand,
                  )),
                ),
                const SizedBox(height: 3),
                Text(
                  value,
                  style: AppFonts.manrope(TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    height: 1.35,
                    color: colour,
                  )),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
