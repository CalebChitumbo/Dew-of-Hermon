import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/camp_theme.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/money.dart';
import '../../data/models/camp.dart';
import '../../data/repositories/camp_repository.dart';
import 'camp_register_screen.dart';

final publicCapacityProvider = FutureProvider<CampCapacity>((ref) {
  return ref.watch(campRepositoryProvider).capacity();
});

/// The public ROPs Camp page — the one a parent lands on from a WhatsApp
/// link, with no account. Dark ink and ember, Fraunces over Manrope: its own
/// world, scoped by a theme wrapper rather than applied app-wide.
class CampLandingScreen extends ConsumerWidget {
  const CampLandingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final camp = getCamp(kDefaultCampId);
    final capacity = ref.watch(publicCapacityProvider).valueOrNull;

    return RopsThemeScope(
      child: Builder(
        builder: (context) => Scaffold(
          backgroundColor: RopsColors.ink,
          body: RefreshIndicator(
            color: RopsColors.ember,
            backgroundColor: RopsColors.inkSoft,
            onRefresh: () async => ref.invalidate(publicCapacityProvider),
            child: CustomScrollView(
              slivers: [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 340,
                  backgroundColor: RopsColors.ink,
                  surfaceTintColor: Colors.transparent,
                  leading: IconButton(
                    icon: const Icon(AppIcons.back),
                    color: RopsColors.cream,
                    onPressed: () => context.canPop()
                        ? context.pop()
                        : context.go('/login'),
                  ),
                  flexibleSpace: FlexibleSpaceBar(
                    background: _Hero(camp: camp),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (camp != null) _Facts(camp: camp, capacity: capacity),
                        const SizedBox(height: 26),
                        _Actions(full: capacity?.isFull ?? false),
                        const SizedBox(height: 34),
                        const _Gallery(),
                        const SizedBox(height: 34),
                        const _SponsorBlock(),
                        const SizedBox(height: 34),
                        const _Contacts(),
                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({this.camp});

  final CampDefinition? camp;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.asset(
          'assets/images/rops-camp/hero.jpg',
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => const ColoredBox(color: RopsColors.ink),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                RopsColors.ink.withValues(alpha: 0.55),
                RopsColors.ink.withValues(alpha: 0.8),
                RopsColors.ink,
              ],
              stops: const [0, 0.6, 1],
            ),
          ),
        ),
        Positioned(
          left: 20,
          right: 20,
          bottom: 26,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: RopsColors.ember,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  'RITES OF PASSAGE · ${camp?.startDate.split('-').first ?? ''}',
                  style: AppFonts.manrope(const TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.9,
                    color: Colors.white,
                  )),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                camp?.name ?? 'ROPs Camp',
                style: AppFonts.fraunces(const TextStyle(
                  fontSize: 36,
                  height: 1.02,
                  fontWeight: FontWeight.w700,
                  color: RopsColors.cream,
                )),
              ),
              const SizedBox(height: 8),
              Text(
                'Five days set apart — for who you are becoming.',
                style: AppFonts.manrope(TextStyle(
                  fontSize: 14,
                  height: 1.5,
                  color: RopsColors.cream.withValues(alpha: 0.8),
                )),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Facts extends StatelessWidget {
  const _Facts({required this.camp, this.capacity});

  final CampDefinition camp;
  final CampCapacity? capacity;

  @override
  Widget build(BuildContext context) {
    final left = capacity?.spotsLeft;
    return Column(
      children: [
        _FactRow(
          icon: AppIcons.calendar,
          label: 'When',
          value: D.range(camp.start, camp.end),
        ),
        if (camp.venue != null)
          _FactRow(
            icon: AppIcons.mapPin,
            label: 'Where',
            value: camp.venue!,
          ),
        _FactRow(
          icon: AppIcons.money,
          label: 'Camp fee',
          value: Money.format(camp.fee, camp.currency),
        ),
        _FactRow(
          icon: AppIcons.users,
          label: 'Places',
          value: left == null
              ? '${camp.capacity} in total'
              : left == 0
                  ? 'Full — join the waiting list'
                  : '$left of ${capacity!.capacity} still open',
          highlight: left != null && left > 0 && left <= 10,
        ),
      ],
    );
  }
}

class _FactRow extends StatelessWidget {
  const _FactRow({
    required this.icon,
    required this.label,
    required this.value,
    this.highlight = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 17, color: RopsColors.ember),
          const SizedBox(width: 13),
          SizedBox(
            width: 78,
            child: Text(
              label.toUpperCase(),
              style: AppFonts.manrope(TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.5,
                color: RopsColors.sand.withValues(alpha: 0.85),
              )),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppFonts.manrope(TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
                height: 1.35,
                color: highlight ? RopsColors.emberSoft : RopsColors.cream,
              )),
            ),
          ),
        ],
      ),
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({required this.full});

  final bool full;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const CampRegisterScreen(),
              ),
            ),
            icon: const Icon(AppIcons.tent, size: 18),
            label: Text(full ? 'Join the waiting list' : 'Register for camp'),
          ),
        ),
        const SizedBox(height: 11),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => context.push('/rops-camp/track'),
                icon: const Icon(AppIcons.search, size: 16),
                label: const Text('Track'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => context.push('/rops-camp/sponsor'),
                icon: const Icon(AppIcons.handshake, size: 16),
                label: const Text('Sponsor'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _Gallery extends StatelessWidget {
  const _Gallery();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'From camps past',
          style: AppFonts.fraunces(const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: RopsColors.cream,
          )),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 150,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: 7,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (context, i) {
              final n = (i + 1).toString().padLeft(2, '0');
              return ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.card),
                child: Image.asset(
                  'assets/images/rops-camp/gallery-$n.jpg',
                  width: 200,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    width: 200,
                    color: RopsColors.inkSoft,
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _SponsorBlock extends StatelessWidget {
  const _SponsorBlock();

  @override
  Widget build(BuildContext context) {
    final camp = getCamp(kDefaultCampId);
    return Container(
      width: double.infinity,
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
            'NOT ATTENDING? CARRY SOMEONE WHO IS.',
            style: AppFonts.manrope(const TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.7,
              color: RopsColors.ember,
            )),
          ),
          const SizedBox(height: 12),
          Text.rich(
            TextSpan(
              children: [
                const TextSpan(text: 'Sponsor a youth '),
                TextSpan(
                  text: 'to camp.',
                  style: AppFonts.fraunces(const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    fontStyle: FontStyle.italic,
                    color: RopsColors.ember,
                  )),
                ),
              ],
            ),
            style: AppFonts.fraunces(const TextStyle(
              fontSize: 26,
              height: 1.1,
              fontWeight: FontWeight.w700,
              color: RopsColors.cream,
            )),
          ),
          const SizedBox(height: 12),
          Text(
            camp == null
                ? "One pledge covers a young person's passage — camp fee, "
                    'meals, and all.'
                : "${Money.format(camp.fee, camp.currency)} covers one young "
                    "person's passage — camp fee, meals, and all. Pledge for "
                    'as many youth as you wish, or give an amount, and the '
                    'camp team will allocate it to campers who need it.',
            style: AppFonts.manrope(TextStyle(
              fontSize: 14,
              height: 1.6,
              color: RopsColors.sand,
            )),
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => context.push('/rops-camp/sponsor'),
              icon: const Icon(AppIcons.handshake, size: 17),
              label: const Text('Pledge sponsorship'),
            ),
          ),
        ],
      ),
    );
  }
}

class _Contacts extends StatelessWidget {
  const _Contacts();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Questions?',
          style: AppFonts.fraunces(const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: RopsColors.cream,
          )),
        ),
        const SizedBox(height: 4),
        Text(
          'Call any of us — we would rather answer than have you wonder.',
          style: AppFonts.manrope(
              TextStyle(fontSize: 13.5, height: 1.5, color: RopsColors.sand)),
        ),
        const SizedBox(height: 14),
        for (final contact in kCampContacts)
          Padding(
            padding: const EdgeInsets.only(bottom: 9),
            child: InkWell(
              onTap: () async {
                final uri = Phone.dialUri(contact.phone);
                if (await canLaunchUrl(uri)) await launchUrl(uri);
              },
              borderRadius: BorderRadius.circular(AppRadius.card),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
                decoration: BoxDecoration(
                  color: RopsColors.inkSoft,
                  borderRadius: BorderRadius.circular(AppRadius.card),
                  border: Border.all(color: RopsColors.border),
                ),
                child: Row(
                  children: [
                    const Icon(AppIcons.phone,
                        size: 16, color: RopsColors.ember),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            contact.name,
                            style: AppFonts.manrope(const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: RopsColors.cream,
                            )),
                          ),
                          Text(
                            '${contact.role} · ${contact.phone}',
                            style: AppFonts.manrope(const TextStyle(
                                fontSize: 12, color: RopsColors.sand)),
                          ),
                        ],
                      ),
                    ),
                    const Icon(AppIcons.chevronRight,
                        size: 15, color: RopsColors.sand),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
