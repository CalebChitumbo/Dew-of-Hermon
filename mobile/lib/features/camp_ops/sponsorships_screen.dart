import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/money.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/camp.dart';
import '../../data/models/enums.dart';
import '../../data/repositories/camp_repository.dart';
import 'camp_hub_screen.dart';

final sponsorshipsProvider = FutureProvider<List<CampSponsorship>>((ref) {
  return ref.watch(campRepositoryProvider).listSponsorships();
});

/// Sponsorship pledges and the campers assigned against them.
///
/// A pledge opens `slotsPledged` places; assigning a camper consumes one. The
/// server maintains the assigned count transactionally, so two admins
/// assigning at once cannot oversubscribe a pledge.
class SponsorshipsScreen extends ConsumerWidget {
  const SponsorshipsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(accessProvider).can('manage_camp_registrations')) {
      return const AppScaffold(
        title: 'Sponsorships',
        body: NoAccessView(
          message: 'Sponsorships need the Manage ROPs Camp Registrations '
              'permission.',
        ),
      );
    }

    final async = ref.watch(sponsorshipsProvider);
    final camp = getCamp(kDefaultCampId);

    return AppScaffold(
      title: 'Sponsorships',
      subtitle: camp?.name,
      showBottomNav: false,
      onRefresh: () async => ref.invalidate(sponsorshipsProvider),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(sponsorshipsProvider),
        ),
        data: (pledges) {
          final totalSlots =
              pledges.fold<int>(0, (a, p) => a + p.slotsPledged);
          final assigned =
              pledges.fold<int>(0, (a, p) => a + p.slotsAssigned);
          final pledged =
              pledges.fold<double>(0, (a, p) => a + p.amountPledged);
          final received = pledges.fold<double>(
              0, (a, p) => a + (p.amountReceived ?? 0));

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              StatStripLux(items: [
                StripItem(
                  icon: AppIcons.handshake,
                  tone: IconTone.emerald,
                  label: 'Pledges',
                  value: '${pledges.length}',
                ),
                StripItem(
                  icon: AppIcons.users,
                  tone: IconTone.gold,
                  label: 'Places pledged',
                  value: '$totalSlots',
                  hint: '$assigned allocated',
                ),
                StripItem(
                  icon: AppIcons.money,
                  tone: IconTone.teal,
                  label: 'Pledged',
                  value: Money.compact(pledged),
                  hint: Money.format(pledged, camp?.currency),
                ),
                StripItem(
                  icon: AppIcons.wallet,
                  tone: received >= pledged && pledged > 0
                      ? IconTone.emerald
                      : IconTone.amber,
                  label: 'Received',
                  value: Money.compact(received),
                  hint: Money.format(received, camp?.currency),
                ),
              ]),
              const SizedBox(height: 20),

              if (totalSlots > assigned)
                Padding(
                  padding: const EdgeInsets.only(bottom: 18),
                  child: NoticeCard(
                    tone: IconTone.gold,
                    icon: AppIcons.info,
                    title: '${totalSlots - assigned} sponsored places unused',
                    message: 'Assign them to campers whose fee is not yet '
                        'covered — tap a pledge to allocate.',
                  ),
                ),

              if (pledges.isEmpty)
                const EmptyStateLux(
                  icon: AppIcons.handshake,
                  tone: IconTone.emerald,
                  title: 'No pledges yet',
                  description: 'Pledges made from the public sponsor page '
                      'appear here.',
                )
              else
                for (final pledge in pledges)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _PledgeCard(pledge: pledge),
                  ),
            ],
          );
        },
      ),
    );
  }
}

class _PledgeCard extends ConsumerStatefulWidget {
  const _PledgeCard({required this.pledge});

  final CampSponsorship pledge;

  @override
  ConsumerState<_PledgeCard> createState() => _PledgeCardState();
}

class _PledgeCardState extends ConsumerState<_PledgeCard> {
  bool _busy = false;

  Future<void> _assign() async {
    final registrations =
        ref.read(campRegistrationsProvider).valueOrNull ?? const [];
    final candidates =
        registrations.where((r) => r.isPaymentFlagged).toList();

    if (candidates.isEmpty) {
      context.showInfo('Every camper is already paid or sponsored.');
      return;
    }

    final chosen = await showModalBottomSheet<CampRegistration>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _CamperPicker(candidates: candidates),
    );
    if (chosen == null) return;

    setState(() => _busy = true);
    try {
      await ref
          .read(campRepositoryProvider)
          .assignSponsorship(widget.pledge.id, chosen.id);
      ref.invalidate(sponsorshipsProvider);
      ref.invalidate(campRegistrationsProvider);
      if (mounted) {
        context.showSuccess(
            '${chosen.firstName} sponsored by ${widget.pledge.sponsorName}.');
      }
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _markPayment() async {
    final camp = getCamp(widget.pledge.campId);
    final entered = await promptForText(
      context,
      title: 'Record payment received',
      hint: 'Amount in ${camp?.currency ?? 'ZMW'}',
      confirmLabel: 'Record',
      required: true,
      maxLines: 1,
    );
    if (entered == null || entered.isEmpty) return;

    final amount = double.tryParse(entered.replaceAll(RegExp(r'[^0-9.]'), ''));
    if (amount == null) {
      if (mounted) context.showError('That does not look like an amount.');
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(campRepositoryProvider).updateSponsorship(
        widget.pledge.id,
        {
          'amountReceived': amount,
          'paymentStatus': amount >= widget.pledge.amountPledged
              ? CampSponsorshipPaymentStatus.paid.wire
              : amount > 0
                  ? CampSponsorshipPaymentStatus.partial.wire
                  : CampSponsorshipPaymentStatus.unpaid.wire,
        },
      );
      ref.invalidate(sponsorshipsProvider);
      if (mounted) context.showSuccess('Payment recorded.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.pledge;
    final camp = getCamp(p.campId);
    final fraction = p.slotsPledged <= 0
        ? 0.0
        : (p.slotsAssigned / p.slotsPledged).clamp(0.0, 1.0);

    return LuxCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconChip(AppIcons.handshake,
                  tone: p.isFullyAssigned
                      ? IconTone.emerald
                      : IconTone.gold,
                  size: 44),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      p.sponsorName,
                      style: AppFonts.display(const TextStyle(
                        fontSize: 18,
                        height: 1.2,
                        color: AppColors.clay700,
                      )),
                    ),
                    if ((p.organization ?? '').isNotEmpty)
                      Text(
                        p.organization!,
                        style: const TextStyle(
                            fontSize: 12.5, color: AppColors.clay400),
                      ),
                  ],
                ),
              ),
              StatusBadge(
                p.paymentStatus.label,
                tone: switch (p.paymentStatus) {
                  CampSponsorshipPaymentStatus.paid => IconTone.emerald,
                  CampSponsorshipPaymentStatus.partial => IconTone.amber,
                  CampSponsorshipPaymentStatus.unpaid => IconTone.clay,
                },
                dense: true,
              ),
            ],
          ),
          const SizedBox(height: 14),

          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 6,
              backgroundColor: AppColors.clay100,
              valueColor:
                  const AlwaysStoppedAnimation<Color>(AppColors.gold),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${p.slotsAssigned} of ${p.slotsPledged} places allocated · '
            '${Money.format(p.amountPledged, camp?.currency)} pledged'
            '${p.amountReceived == null ? '' : ' · ${Money.format(p.amountReceived, camp?.currency)} received'}',
            style: const TextStyle(fontSize: 12, color: AppColors.clay400),
          ),

          const SizedBox(height: 12),
          DetailRow(
            label: 'Phone',
            value: p.phone,
            icon: AppIcons.phone,
          ),
          if ((p.email ?? '').isNotEmpty)
            DetailRow(label: 'Email', value: p.email!, icon: AppIcons.mail),
          if ((p.notes ?? '').isNotEmpty)
            DetailRow(label: 'Notes', value: p.notes!, icon: AppIcons.info),

          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy ? null : _markPayment,
                  icon: const Icon(AppIcons.money, size: 15),
                  label: const Text('Payment'),
                  style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 42)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: PrimaryButton(
                  label: p.isFullyAssigned ? 'Fully used' : 'Allocate',
                  icon: AppIcons.userPlus,
                  loading: _busy,
                  onPressed: p.isFullyAssigned ? null : _assign,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CamperPicker extends StatelessWidget {
  const _CamperPicker({required this.candidates});

  final List<CampRegistration> candidates;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Who should this cover?',
              style: AppFonts.display(
                  const TextStyle(fontSize: 20, color: AppColors.clay700)),
            ),
            const SizedBox(height: 4),
            const Text(
              'Only campers whose fee is not yet covered are listed.',
              style: TextStyle(fontSize: 13, color: AppColors.clay400),
            ),
            const SizedBox(height: 16),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: candidates.length,
                separatorBuilder: (_, __) => const LuxDivider(indent: 0),
                itemBuilder: (context, i) => LuxTile(
                  title: candidates[i].fullName,
                  subtitle: candidates[i].churchOrSchool,
                  icon: AppIcons.user,
                  tone: IconTone.amber,
                  dense: true,
                  onTap: () => Navigator.of(context).pop(candidates[i]),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
