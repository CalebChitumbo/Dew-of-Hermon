import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/camp/camp_meals.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/camp_theme.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/money.dart';
import '../../data/models/camp.dart';
import '../../data/models/enums.dart';
import '../../data/repositories/camp_repository.dart';

final myRegistrationsProvider =
    FutureProvider<List<CampRegistration>>((ref) {
  final user = ref.watch(userOrNullProvider);
  if (user == null) return Future.value(const []);
  return ref.watch(campRepositoryProvider).myRegistrations();
});

final myPassesProvider = FutureProvider<PassQueue>((ref) {
  final user = ref.watch(userOrNullProvider);
  if (user == null) {
    return Future.value(const PassQueue(passes: [], can: PassCapabilities()));
  }
  return ref.watch(campRepositoryProvider).listPasses(scope: 'mine');
});

/// A camper or guardian's own view: their registrations, their badges, and
/// any exit passes they have requested.
class MyRegistrationsScreen extends ConsumerWidget {
  const MyRegistrationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(userOrNullProvider);
    final registrations = ref.watch(myRegistrationsProvider);
    final passes = ref.watch(myPassesProvider).valueOrNull;

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
            title: const Text('My registrations'),
          ),
          body: user == null
              ? _SignedOut()
              : RefreshIndicator(
                  color: RopsColors.ember,
                  backgroundColor: RopsColors.inkSoft,
                  onRefresh: () async {
                    ref.invalidate(myRegistrationsProvider);
                    ref.invalidate(myPassesProvider);
                  },
                  child: registrations.when(
                    loading: () => const Center(
                      child: CircularProgressIndicator(
                          color: RopsColors.ember),
                    ),
                    error: (e, _) => _Message(
                      title: 'Could not load your registrations',
                      body: '$e',
                    ),
                    data: (list) {
                      if (list.isEmpty) {
                        return _Message(
                          title: 'Nothing here yet',
                          body: 'Registrations you submit while signed in — '
                              'or link with a claim code — appear here. If '
                              'you registered without an account, use Track '
                              'on the camp page instead.',
                          action: OutlinedButton(
                            onPressed: () => context.go('/rops-camp/track'),
                            child: const Text('Track a registration'),
                          ),
                        );
                      }
                      return ListView(
                        padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
                        children: [
                          for (final reg in list)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: _RegistrationCard(
                                registration: reg,
                                passes: (passes?.passes ?? const [])
                                    .where((p) => p.registrationId == reg.id)
                                    .toList(),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                ),
        ),
      ),
    );
  }
}

class _SignedOut extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return _Message(
      title: 'Sign in to see your registrations',
      body: 'Or use Track on the camp page — the badge code from your '
          'confirmation email is all you need.',
      action: Column(
        children: [
          FilledButton(
            onPressed: () => context.go('/login'),
            child: const Text('Sign in'),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () => context.go('/rops-camp/track'),
            child: const Text('Track a registration'),
          ),
        ],
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.title, required this.body, this.action});

  final String title;
  final String body;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(28, 60, 28, 40),
      children: [
        Text(
          title,
          textAlign: TextAlign.center,
          style: AppFonts.fraunces(const TextStyle(
            fontSize: 24,
            height: 1.15,
            fontWeight: FontWeight.w700,
            color: RopsColors.cream,
          )),
        ),
        const SizedBox(height: 12),
        Text(
          body,
          textAlign: TextAlign.center,
          style: AppFonts.manrope(const TextStyle(
            fontSize: 14,
            height: 1.6,
            color: RopsColors.sand,
          )),
        ),
        if (action != null) ...[
          const SizedBox(height: 26),
          action!,
        ],
      ],
    );
  }
}

class _RegistrationCard extends StatelessWidget {
  const _RegistrationCard({required this.registration, required this.passes});

  final CampRegistration registration;
  final List<CampPass> passes;

  @override
  Widget build(BuildContext context) {
    final reg = registration;
    final camp = getCamp(reg.campId);
    final code = reg.checkInCode;
    final settled = reg.isPaid || reg.isSponsored;

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
              fontSize: 23,
              height: 1.1,
              fontWeight: FontWeight.w700,
              color: RopsColors.cream,
            )),
          ),
          const SizedBox(height: 4),
          Text(
            '${camp?.name ?? 'ROPs Camp'} · registered '
            '${D.medium(reg.createdAt)}',
            style: AppFonts.manrope(
                const TextStyle(fontSize: 12.5, color: RopsColors.sand)),
          ),
          const SizedBox(height: 16),

          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Pill(
                label: reg.isPaid
                    ? 'Fee settled'
                    : reg.isSponsored
                        ? 'Sponsored'
                        : 'Fee outstanding',
                good: settled,
              ),
              _Pill(
                label: reg.checkedIn ? 'Checked in' : 'Not arrived',
                good: reg.checkedIn,
              ),
              if (reg.onPass) const _Pill(label: 'Out on a pass', good: false),
            ],
          ),

          if (!settled && camp != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: RopsColors.ember.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppRadius.card),
                border:
                    Border.all(color: RopsColors.ember.withValues(alpha: 0.35)),
              ),
              child: Text(
                'Send ${Money.format(camp.fee, camp.currency)} to '
                '$kCampPaymentNumber using reference '
                '${buildCampPaymentReference(reg.id)}, then send proof of '
                'payment to the camp team.',
                style: AppFonts.manrope(const TextStyle(
                  fontSize: 12.5,
                  height: 1.6,
                  color: RopsColors.cream,
                )),
              ),
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
                      data:
                          '${AppConfig.webBaseUrl}/rops-camp/track?code=$code',
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
                    const SizedBox(height: 9),
                    Text(
                      formatMealCode(code),
                      style: AppFonts.manrope(const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 2,
                        color: RopsColors.ink,
                      )),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Arrival · meals · gate',
                      style: AppFonts.manrope(const TextStyle(
                        fontSize: 10.5,
                        letterSpacing: 1.1,
                        color: Color(0xFF6B5545),
                      )),
                    ),
                  ],
                ),
              ),
            ),
          ],

          if (passes.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Divider(color: RopsColors.border),
            const SizedBox(height: 14),
            Text(
              'EXIT PASSES',
              style: AppFonts.manrope(const TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.7,
                color: RopsColors.ember,
              )),
            ),
            const SizedBox(height: 12),
            for (final pass in passes)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _PassRow(pass: pass),
              ),
          ],
        ],
      ),
    );
  }
}

class _PassRow extends StatelessWidget {
  const _PassRow({required this.pass});

  final CampPass pass;

  @override
  Widget build(BuildContext context) {
    final issued = pass.passCode != null && pass.passCode!.isNotEmpty;
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: RopsColors.ink,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: RopsColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  pass.reason,
                  style: AppFonts.manrope(const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: RopsColors.cream,
                  )),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 10),
              _Pill(
                label: pass.status.label,
                good: pass.status == CampPassStatus.approved ||
                    pass.status == CampPassStatus.returned,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Back by ${D.dateTime(pass.expectedReturnAt)}',
            style: AppFonts.manrope(
                const TextStyle(fontSize: 11.5, color: RopsColors.sand)),
          ),
          if (issued && pass.status == CampPassStatus.approved) ...[
            const SizedBox(height: 12),
            Center(
              child: Container(
                padding: const EdgeInsets.all(11),
                decoration: BoxDecoration(
                  color: RopsColors.cream,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: QrImageView(
                  data:
                      '${AppConfig.webBaseUrl}/rops-camp/track?pass=${pass.passCode}',
                  size: 120,
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
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Show this at the gate. It scans once out and once back in.',
              textAlign: TextAlign.center,
              style: AppFonts.manrope(
                  const TextStyle(fontSize: 11, color: RopsColors.sand)),
            ),
          ],
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.good});

  final String label;
  final bool good;

  @override
  Widget build(BuildContext context) {
    final colour = good ? const Color(0xFF6EE7B7) : RopsColors.emberSoft;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: colour.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colour.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: AppFonts.manrope(TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: colour,
        )),
      ),
    );
  }
}
