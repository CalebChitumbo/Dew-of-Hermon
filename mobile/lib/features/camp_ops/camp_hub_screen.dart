import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/money.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/camp.dart';
import '../../data/models/enums.dart';
import '../../data/repositories/camp_repository.dart';
import 'camper_detail_screen.dart';

/// The full camp register — camp admins only.
final campRegistrationsProvider =
    FutureProvider<List<CampRegistration>>((ref) {
  return ref.watch(campRepositoryProvider).listRegistrations();
});

final campCapacityProvider = FutureProvider<CampCapacity>((ref) {
  return ref.watch(campRepositoryProvider).capacity();
});

/// The camp operations hub: the numbers, the tools, and the register.
class CampHubScreen extends ConsumerStatefulWidget {
  const CampHubScreen({super.key});

  @override
  ConsumerState<CampHubScreen> createState() => _CampHubScreenState();
}

class _CampHubScreenState extends ConsumerState<CampHubScreen> {
  String _query = '';
  int _filter = 0;

  static const _filters = ['All', 'Unpaid', 'Sponsored', 'Arrived', 'To come'];

  List<CampRegistration> _apply(List<CampRegistration> all) {
    final q = _query.trim().toLowerCase();
    return all.where((r) {
      if (q.isNotEmpty) {
        final haystack =
            '${r.fullName} ${r.churchOrSchool} ${r.phone} ${r.email ?? ''}'
                .toLowerCase();
        if (!haystack.contains(q)) return false;
      }
      return switch (_filter) {
        1 => r.isPaymentFlagged,
        2 => r.isSponsored,
        3 => r.checkedIn,
        4 => !r.checkedIn,
        _ => true,
      };
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final access = ref.watch(accessProvider);
    if (!access.can('manage_camp_registrations')) {
      return const AppScaffold(
        title: 'ROPs Camp',
        body: NoAccessView(
          message: 'The camp register needs the Manage ROPs Camp '
              'Registrations permission.',
        ),
      );
    }

    final camp = getCamp(kDefaultCampId);
    final async = ref.watch(campRegistrationsProvider);
    final capacity = ref.watch(campCapacityProvider).valueOrNull;

    return AppScaffold(
      title: 'ROPs Camp',
      subtitle: camp?.name,
      onRefresh: () async {
        ref.invalidate(campRegistrationsProvider);
        ref.invalidate(campCapacityProvider);
      },
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(campRegistrationsProvider),
        ),
        data: (all) {
          final shown = _apply(all);
          final paid = all.where((r) => r.isPaid).length;
          final sponsored = all.where((r) => r.isSponsored).length;
          final arrived = all.where((r) => r.checkedIn).length;
          final onPass = all.where((r) => r.onPass).length;
          final cap = capacity?.capacity ?? camp?.capacity ?? 0;

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              if (camp != null) _CampHeader(camp: camp, registered: all.length,
                  capacity: cap),
              const SizedBox(height: 18),

              StatStripLux(items: [
                StripItem(
                  icon: AppIcons.users,
                  tone: IconTone.gold,
                  label: 'Registered',
                  value: '${all.length}',
                  hint: cap > 0
                      ? '${(cap - all.length).clamp(0, cap)} spots left'
                      : null,
                ),
                StripItem(
                  icon: AppIcons.money,
                  tone: IconTone.emerald,
                  label: 'Fee covered',
                  value: '${paid + sponsored}',
                  hint: '$paid paid · $sponsored sponsored',
                ),
                StripItem(
                  icon: AppIcons.tent,
                  tone: IconTone.teal,
                  label: 'Arrived',
                  value: '$arrived',
                  hint: '${all.length - arrived} still to come',
                ),
                StripItem(
                  icon: AppIcons.doorOpen,
                  tone: onPass > 0 ? IconTone.blue : IconTone.clay,
                  label: 'Out on a pass',
                  value: '$onPass',
                  hint: onPass == 0 ? 'Everyone in camp' : null,
                  onTap: () => context.push('/manage/rops-camp/passes'),
                ),
              ]),
              const SizedBox(height: 22),

              const SectionHeading(
                title: 'Camp tools',
                icon: AppIcons.scan,
                tone: IconTone.periwinkle,
              ),
              const SizedBox(height: 12),
              _ToolGrid(access: access),
              const SizedBox(height: 24),

              SectionHeading(
                title: 'Register',
                icon: AppIcons.users,
                tone: IconTone.sage,
                subtitle: '${shown.length} of ${all.length}',
              ),
              const SizedBox(height: 12),
              TextField(
                onChanged: (v) => setState(() => _query = v),
                decoration: const InputDecoration(
                  hintText: 'Search by name, school or phone',
                  prefixIcon: Icon(AppIcons.search,
                      size: 18, color: AppColors.clay300),
                ),
              ),
              const SizedBox(height: 12),
              SegmentedTabs(
                tabs: _filters,
                selected: _filter,
                onSelect: (i) => setState(() => _filter = i),
              ),
              const SizedBox(height: 14),

              if (shown.isEmpty)
                EmptyStateLux(
                  icon: AppIcons.users,
                  tone: IconTone.sage,
                  title: all.isEmpty ? 'No registrations yet' : 'No matches',
                  description: all.isEmpty
                      ? 'Registrations submitted from the public camp page '
                          'appear here.'
                      : 'Try a different search or filter.',
                )
              else
                LuxCard(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    children: [
                      for (var i = 0; i < shown.length; i++) ...[
                        if (i > 0) const LuxDivider(),
                        _CamperRow(registration: shown[i]),
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
}

class _CampHeader extends StatelessWidget {
  const _CampHeader({
    required this.camp,
    required this.registered,
    required this.capacity,
  });

  final CampDefinition camp;
  final int registered;
  final int capacity;

  @override
  Widget build(BuildContext context) {
    final start = camp.start;
    final end = camp.end;
    final days = start == null ? null : D.daysUntil(start);
    final fraction =
        capacity <= 0 ? 0.0 : (registered / capacity).clamp(0.0, 1.0);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.lux),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.tealDark, AppColors.teal],
        ),
        boxShadow: AppColors.luxShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            camp.name,
            style: AppFonts.display(const TextStyle(
              fontSize: 24,
              height: 1.1,
              color: Colors.white,
            )),
          ),
          const SizedBox(height: 6),
          Text(
            '${D.range(start, end)}'
            '${camp.venue == null ? '' : ' · ${camp.venue}'}',
            style: TextStyle(
              fontSize: 13,
              color: Colors.white.withValues(alpha: 0.85),
            ),
          ),
          if (days != null) ...[
            const SizedBox(height: 4),
            Text(
              days > 0
                  ? '$days day${days == 1 ? '' : 's'} to go'
                  : days == 0
                      ? 'Camp starts today'
                      : 'Camp is running',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Colors.white.withValues(alpha: 0.95),
              ),
            ),
          ],
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 7,
              backgroundColor: Colors.white.withValues(alpha: 0.22),
              valueColor:
                  const AlwaysStoppedAnimation<Color>(AppColors.goldLight),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            capacity > 0
                ? '$registered of $capacity places taken · '
                    '${Money.format(camp.fee, camp.currency)} per camper'
                : '$registered registered',
            style: TextStyle(
              fontSize: 12,
              color: Colors.white.withValues(alpha: 0.85),
            ),
          ),
        ],
      ),
    );
  }
}

class _ToolGrid extends StatelessWidget {
  const _ToolGrid({required this.access});

  final Access access;

  @override
  Widget build(BuildContext context) {
    final tools = <Widget>[
      if (access.can('manage_camp_registrations'))
        _Tool(
          label: 'Check-in',
          detail: 'Scan arrivals',
          icon: AppIcons.qrCode,
          tone: IconTone.gold,
          onTap: () => context.push('/manage/rops-camp/check-in'),
        ),
      if (access.can('serve_camp_meals'))
        _Tool(
          label: 'Meal line',
          detail: 'Serve a sitting',
          icon: AppIcons.utensils,
          tone: IconTone.amber,
          onTap: () => context.push('/manage/rops-camp/meals'),
        ),
      if (access.can('scan_camp_passes'))
        _Tool(
          label: 'Gate',
          detail: 'Out and back in',
          icon: AppIcons.doorOpen,
          tone: IconTone.blue,
          onTap: () => context.push('/manage/rops-camp/gate'),
        ),
      _Tool(
        label: 'Exit passes',
        detail: 'The approval chain',
        icon: AppIcons.ticket,
        tone: IconTone.periwinkle,
        onTap: () => context.push('/manage/rops-camp/passes'),
      ),
      if (access.can('manage_camp_registrations')) ...[
        _Tool(
          label: 'Sponsorships',
          detail: 'Pledges and slots',
          icon: AppIcons.handshake,
          tone: IconTone.emerald,
          onTap: () => context.push('/manage/rops-camp/sponsorships'),
        ),
        _Tool(
          label: 'Announcements',
          detail: 'Email the campers',
          icon: AppIcons.megaphone,
          tone: IconTone.lavender,
          onTap: () => context.push('/manage/rops-camp/announcements'),
        ),
      ],
      _Tool(
        label: 'Status',
        detail: 'Read-only numbers',
        icon: AppIcons.reports,
        tone: IconTone.sage,
        onTap: () => context.push('/manage/rops-camp/status'),
      ),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 11,
      crossAxisSpacing: 11,
      childAspectRatio: 1.75,
      children: tools,
    );
  }
}

class _Tool extends StatelessWidget {
  const _Tool({
    required this.label,
    required this.detail,
    required this.icon,
    required this.tone,
    required this.onTap,
  });

  final String label;
  final String detail;
  final IconData icon;
  final IconTone tone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      onTap: onTap,
      radius: 18,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconChip(icon, tone: tone, size: 38),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.clay700,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                detail,
                style:
                    const TextStyle(fontSize: 11.5, color: AppColors.clay400),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CamperRow extends StatelessWidget {
  const _CamperRow({required this.registration});

  final CampRegistration registration;

  @override
  Widget build(BuildContext context) {
    final r = registration;
    return LuxTile(
      title: r.fullName,
      subtitle: '${r.churchOrSchool}'
          '${r.age == null ? '' : ' · ${r.age}'}'
          '${r.isSponsored ? ' · ${r.sponsorName ?? 'sponsored'}' : ''}',
      leading: MemberAvatar(
        initials: '${r.firstName.isEmpty ? '?' : r.firstName[0]}'
            '${r.lastName.isEmpty ? '' : r.lastName[0]}',
        size: 38,
      ),
      dense: true,
      trailing: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          StatusBadge(
            r.isPaid
                ? 'Paid'
                : r.isSponsored
                    ? 'Sponsored'
                    : 'Unpaid',
            tone: r.isPaid
                ? IconTone.emerald
                : r.isSponsored
                    ? IconTone.teal
                    : IconTone.amber,
            dense: true,
          ),
          if (r.checkedIn) ...[
            const SizedBox(height: 4),
            StatusBadge(
              r.onPass ? 'Out' : 'In camp',
              tone: r.onPass ? IconTone.blue : IconTone.sage,
              dense: true,
            ),
          ],
        ],
      ),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => CamperDetailScreen(registrationId: r.id),
        ),
      ),
    );
  }
}
