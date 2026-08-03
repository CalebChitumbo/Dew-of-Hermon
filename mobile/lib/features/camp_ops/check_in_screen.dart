import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/camp/camp_meals.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/money.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../core/widgets/scanner_view.dart';
import '../../data/models/camp.dart';
import '../../data/repositories/camp_repository.dart';

/// Arrival check-in. Scan a camper's badge, see who they are and whether their
/// fee is covered, then mark them arrived.
///
/// Payment is shown but never blocks arrival — a camper who has travelled to
/// camp is not turned away at the gate over a fee. The flag is for the manager.
class CampCheckInScreen extends ConsumerStatefulWidget {
  const CampCheckInScreen({super.key});

  @override
  ConsumerState<CampCheckInScreen> createState() => _CampCheckInScreenState();
}

class _CampCheckInScreenState extends ConsumerState<CampCheckInScreen> {
  CampRegistration? _found;
  String? _error;
  bool _looking = false;
  bool _saving = false;

  Future<void> _lookup(String raw) async {
    if (_looking) return;

    if (looksLikeExitPassQr(raw)) {
      setState(() {
        _found = null;
        _error = "That's an exit pass, not an arrival badge.";
      });
      return;
    }
    final code = normalizeMealCode(raw);
    if (code.isEmpty) {
      setState(() {
        _found = null;
        _error = "That QR code isn't a camper badge.";
      });
      return;
    }

    setState(() {
      _looking = true;
      _error = null;
    });
    try {
      final result = await ref.read(campRepositoryProvider).lookupRegistration(code);
      if (!mounted) return;
      setState(() {
        _found = result.registration;
        _looking = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _found = null;
        _error = e.message;
        _looking = false;
      });
    }
  }

  Future<void> _setCheckedIn(CampRegistration reg, bool value) async {
    setState(() => _saving = true);
    try {
      final updated =
          await ref.read(campRepositoryProvider).setCheckedIn(reg.id, value);
      if (!mounted) return;
      setState(() {
        _found = updated;
        _saving = false;
      });
      context.showSuccess(value
          ? '${reg.firstName} checked in.'
          : '${reg.firstName} un-checked-in.');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      context.showError(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final access = ref.watch(accessProvider);
    if (!access.can('manage_camp_registrations')) {
      return const AppScaffold(
        title: 'Check-in',
        body: NoAccessView(
          message: 'Arrival check-in needs the Manage ROPs Camp Registrations '
              'permission.',
        ),
      );
    }

    final reg = _found;

    return AppScaffold(
      title: 'Arrival check-in',
      subtitle: getCamp(kDefaultCampId)?.name,
      showBottomNav: false,
      padded: false,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
        children: [
          if (_error != null) ...[
            NoticeCard(
              message: _error!,
              tone: IconTone.rose,
              icon: AppIcons.xCircle,
            ),
            const SizedBox(height: 14),
          ],
          if (reg != null) ...[
            _CamperCard(
              registration: reg,
              saving: _saving,
              onToggle: (v) => _setCheckedIn(reg, v),
              onClear: () => setState(() {
                _found = null;
                _error = null;
              }),
            ),
            const SizedBox(height: 16),
          ],
          ScannerView(
            onDetect: _lookup,
            paused: _looking,
            overlayLabel: "Scan the camper's arrival badge",
            height: 300,
          ),
          const SizedBox(height: 16),
          ManualCodeEntry(
            onSubmit: _lookup,
            busy: _looking,
            label: 'Or type the badge code',
          ),
        ],
      ),
    );
  }
}

class _CamperCard extends StatelessWidget {
  const _CamperCard({
    required this.registration,
    required this.saving,
    required this.onToggle,
    required this.onClear,
  });

  final CampRegistration registration;
  final bool saving;
  final ValueChanged<bool> onToggle;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final reg = registration;
    final camp = getCamp(reg.campId);
    final tone = reg.checkedIn ? IconTone.emerald : IconTone.gold;
    final colors = toneColors(tone);

    return LuxCard(
      border: colors.foreground.withValues(alpha: 0.3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconChip(
                reg.checkedIn ? AppIcons.checkCircle : AppIcons.tent,
                tone: tone,
                size: 50,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      reg.fullName,
                      style: AppFonts.display(const TextStyle(
                        fontSize: 23,
                        height: 1.12,
                        color: AppColors.clay700,
                      )),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      reg.churchOrSchool,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.clay400),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(AppIcons.close, size: 18),
                color: AppColors.clay300,
                tooltip: 'Clear',
                onPressed: onClear,
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              StatusBadge(
                reg.checkedIn ? 'Checked in' : 'Not arrived',
                tone: reg.checkedIn ? IconTone.emerald : IconTone.clay,
                icon: reg.checkedIn ? AppIcons.check : AppIcons.clock,
              ),
              StatusBadge(
                reg.isPaid
                    ? 'Paid'
                    : reg.isSponsored
                        ? 'Sponsored'
                        : 'Fee outstanding',
                tone: reg.isPaid
                    ? IconTone.emerald
                    : reg.isSponsored
                        ? IconTone.teal
                        : IconTone.amber,
                icon: AppIcons.money,
              ),
              StatusBadge(reg.gender.label, tone: IconTone.periwinkle),
              StatusBadge('T-shirt ${reg.tshirtSize.label}',
                  tone: IconTone.lavender, icon: AppIcons.shirt),
              if (reg.age != null)
                StatusBadge('${reg.age} years',
                    tone: IconTone.blue, icon: AppIcons.cake),
              if (reg.onPass)
                const StatusBadge('Out on a pass',
                    tone: IconTone.rose, icon: AppIcons.doorOpen),
            ],
          ),

          if (reg.isPaymentFlagged) ...[
            const SizedBox(height: 14),
            NoticeCard(
              tone: IconTone.amber,
              icon: AppIcons.info,
              title: 'Fee not yet covered',
              message: 'Check them in anyway and tell the Camp Manager. '
                  'Nobody who has travelled to camp is turned away at the gate.'
                  '${camp == null ? '' : ' Fee: ${Money.format(camp.fee, camp.currency)}.'}',
            ),
          ],

          if ((reg.allergies ?? '').isNotEmpty ||
              (reg.medicalNotes ?? '').isNotEmpty ||
              (reg.medications ?? '').isNotEmpty) ...[
            const SizedBox(height: 14),
            NoticeCard(
              tone: IconTone.rose,
              icon: AppIcons.stethoscope,
              title: 'Medical',
              message: [
                if ((reg.allergies ?? '').isNotEmpty)
                  'Allergies: ${reg.allergies}',
                if ((reg.medications ?? '').isNotEmpty)
                  'Medication: ${reg.medications}',
                if ((reg.medicalNotes ?? '').isNotEmpty) reg.medicalNotes!,
              ].join('\n'),
            ),
          ],

          const SizedBox(height: 16),
          const LuxDivider(indent: 0),
          const SizedBox(height: 8),

          DetailRow(
            label: 'Guardian',
            value: reg.parentName ?? '—',
            icon: AppIcons.user,
          ),
          DetailRow(
            label: 'Emergency',
            value: '${reg.emergencyContactName} · '
                '${Phone.pretty(reg.emergencyContactPhone)}',
            icon: AppIcons.phone,
          ),
          DetailRow(
            label: 'Dietary',
            value: reg.dietaryPreference ?? 'No special requirement',
            icon: AppIcons.utensils,
          ),
          if (reg.checkedInAt != null)
            DetailRow(
              label: 'Arrived',
              value: '${D.dateTime(reg.checkedInAt)}'
                  '${reg.checkedInByName == null ? '' : ' · ${reg.checkedInByName}'}',
              icon: AppIcons.clock,
            ),

          const SizedBox(height: 18),
          PrimaryButton(
            label: reg.checkedIn ? 'Undo check-in' : 'Check in',
            icon: reg.checkedIn ? AppIcons.refresh : AppIcons.check,
            loading: saving,
            destructive: reg.checkedIn,
            onPressed: () => onToggle(!reg.checkedIn),
          ),
        ],
      ),
    );
  }
}
