import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/enums.dart';
import '../../data/repositories/camp_repository.dart';

final campStatusProvider = FutureProvider<CampStatus>((ref) {
  return ref.watch(campRepositoryProvider).status();
});

/// Read-only camp numbers for department leads.
///
/// Deliberately narrower than the camp register: names and church/school only,
/// no medical notes and no contact details. A lead following how the camp is
/// filling up has no business with a minor's medication list.
class CampStatusScreen extends ConsumerStatefulWidget {
  const CampStatusScreen({super.key});

  @override
  ConsumerState<CampStatusScreen> createState() => _CampStatusScreenState();
}

class _CampStatusScreenState extends ConsumerState<CampStatusScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final access = ref.watch(accessProvider);
    if (!access.can('view_camp_registrations')) {
      return const AppScaffold(
        title: 'Camp status',
        body: NoAccessView(
          message: 'Camp numbers need the View ROPs Camp Registration Status '
              'permission.',
        ),
      );
    }

    final async = ref.watch(campStatusProvider);

    return AppScaffold(
      title: 'Camp status',
      onRefresh: () async => ref.invalidate(campStatusProvider),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(campStatusProvider),
        ),
        data: (status) {
          final q = _query.trim().toLowerCase();
          final shown = q.isEmpty
              ? status.campers
              : status.campers
                  .where((c) => '${c.fullName} ${c.churchOrSchool}'
                      .toLowerCase()
                      .contains(q))
                  .toList();

          final start = D.fromIso(status.startDate);
          final end = D.fromIso(status.endDate);
          final fraction = status.capacity <= 0
              ? 0.0
              : (status.registered / status.capacity).clamp(0.0, 1.0);

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              LuxCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      status.campName,
                      style: AppFonts.display(const TextStyle(
                          fontSize: 22, color: AppColors.clay700)),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '${D.range(start, end)}'
                      '${status.venue == null ? '' : ' · ${status.venue}'}',
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.clay400),
                    ),
                    const SizedBox(height: 16),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                      child: LinearProgressIndicator(
                        value: fraction,
                        minHeight: 8,
                        backgroundColor: AppColors.clay100,
                        valueColor: const AlwaysStoppedAnimation<Color>(
                            AppColors.teal),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${status.registered} of ${status.capacity} places taken'
                      ' · ${status.spotsLeft} left',
                      style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.clay500),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              StatStripLux(items: [
                StripItem(
                  icon: AppIcons.users,
                  tone: IconTone.gold,
                  label: 'Registered',
                  value: '${status.registered}',
                ),
                StripItem(
                  icon: AppIcons.money,
                  tone: IconTone.emerald,
                  label: 'Paid',
                  value: '${status.paid}',
                  hint: '${status.unpaid} unpaid',
                ),
                StripItem(
                  icon: AppIcons.tent,
                  tone: IconTone.teal,
                  label: 'Arrived',
                  value: '${status.checkedIn}',
                ),
                StripItem(
                  icon: AppIcons.plus,
                  tone: IconTone.sage,
                  label: 'Spots left',
                  value: '${status.spotsLeft}',
                ),
              ]),
              const SizedBox(height: 22),

              const NoticeCard(
                tone: IconTone.clay,
                icon: AppIcons.lock,
                message: 'Names and church/school only. Medical notes and '
                    'contact details stay with the camp team.',
              ),
              const SizedBox(height: 18),

              SectionHeading(
                title: 'Campers',
                icon: AppIcons.users,
                tone: IconTone.periwinkle,
                subtitle: '${shown.length} of ${status.campers.length}',
              ),
              const SizedBox(height: 12),
              TextField(
                onChanged: (v) => setState(() => _query = v),
                decoration: const InputDecoration(
                  hintText: 'Search by name or school',
                  prefixIcon: Icon(AppIcons.search,
                      size: 18, color: AppColors.clay300),
                ),
              ),
              const SizedBox(height: 14),

              if (shown.isEmpty)
                EmptyStateLux(
                  icon: AppIcons.users,
                  tone: IconTone.sage,
                  title: status.campers.isEmpty
                      ? 'No registrations yet'
                      : 'No matches',
                  description: status.campers.isEmpty
                      ? 'Campers appear here as they register.'
                      : 'Try a different search.',
                )
              else
                LuxCard(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    children: [
                      for (var i = 0; i < shown.length; i++) ...[
                        if (i > 0) const LuxDivider(),
                        LuxTile(
                          title: shown[i].fullName,
                          subtitle: shown[i].churchOrSchool,
                          leading: MemberAvatar(
                            initials: _initials(shown[i].fullName),
                            size: 36,
                          ),
                          dense: true,
                          trailing: StatusBadge(
                            shown[i].checkedIn
                                ? 'In camp'
                                : shown[i].paymentStatus ==
                                        CampPaymentStatus.paid
                                    ? 'Paid'
                                    : 'Unpaid',
                            tone: shown[i].checkedIn
                                ? IconTone.teal
                                : shown[i].paymentStatus ==
                                        CampPaymentStatus.paid
                                    ? IconTone.emerald
                                    : IconTone.amber,
                            dense: true,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  static String _initials(String name) {
    final parts =
        name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }
}
