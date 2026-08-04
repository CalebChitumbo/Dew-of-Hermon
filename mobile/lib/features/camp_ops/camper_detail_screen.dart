import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/camp/camp_meals.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/money.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/firestore/streams.dart';
import '../../data/models/camp.dart';
import '../../data/models/enums.dart';
import '../../data/repositories/camp_repository.dart';
import 'camp_hub_screen.dart';

/// One camper, live from Firestore so a payment marked on another device
/// lands here without a refresh.
final camperProvider =
    StreamProvider.family<CampRegistration?, String>((ref, id) {
  return documentStream(
    db.collection('campRegistrations').doc(id),
    CampRegistration.fromMap,
  ).handleError((_) => null);
});

/// Everything the camp team knows about one camper, and the actions they can
/// take: mark paid, check in, re-send the QR badge, edit, remove.
class CamperDetailScreen extends ConsumerStatefulWidget {
  const CamperDetailScreen({super.key, required this.registrationId});

  final String registrationId;

  @override
  ConsumerState<CamperDetailScreen> createState() => _CamperDetailScreenState();
}

class _CamperDetailScreenState extends ConsumerState<CamperDetailScreen> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action, String success) async {
    setState(() => _busy = true);
    try {
      await action();
      if (mounted) context.showSuccess(success);
      ref.invalidate(campRegistrationsProvider);
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _togglePaid(CampRegistration reg) async {
    final markingPaid = !reg.isPaid;
    final camp = getCamp(reg.campId);

    String? reference;
    if (markingPaid) {
      reference = await promptForText(
        context,
        title: 'Mark ${reg.firstName} paid',
        hint: 'Payment reference (optional)',
        confirmLabel: 'Mark paid',
        maxLines: 1,
      );
      if (reference == null) return;
    } else {
      final ok = await confirmAction(
        context,
        title: 'Mark unpaid?',
        message: 'This clears the payment record for ${reg.fullName}.',
        confirmLabel: 'Mark unpaid',
        destructive: true,
      );
      if (!ok) return;
    }

    await _run(
      () => ref.read(campRepositoryProvider).updateRegistration(reg.id, {
        'paymentStatus': markingPaid
            ? CampPaymentStatus.paid.wire
            : CampPaymentStatus.unpaid.wire,
        if (markingPaid) 'paymentAmount': camp?.fee,
        if (markingPaid && (reference ?? '').isNotEmpty)
          'paymentReference': reference,
      }),
      markingPaid ? '${reg.firstName} marked paid.' : 'Payment cleared.',
    );
  }

  Future<void> _sendQr(CampRegistration reg) async {
    final to = reg.parentEmail ?? reg.email;
    if (to == null || to.isEmpty) {
      context.showError(
        'No email on this registration. Add one first, then re-send.',
      );
      return;
    }
    await _run(
      () => ref.read(campRepositoryProvider).sendQrEmail(reg.id, to: to),
      'Badge emailed to $to.',
    );
  }

  Future<void> _delete(CampRegistration reg) async {
    final ok = await confirmAction(
      context,
      title: 'Remove ${reg.fullName}?',
      message: 'This deletes the registration. It cannot be undone.',
      confirmLabel: 'Remove',
      destructive: true,
    );
    if (!ok) return;
    await _run(
      () => ref.read(campRepositoryProvider).deleteRegistration(reg.id),
      'Registration removed.',
    );
    if (mounted && Navigator.of(context).canPop()) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    // Deep-linkable, and it carries a minor's medical notes and guardian
    // numbers — so it checks for itself rather than relying on having been
    // reached from the register.
    if (!ref.watch(accessProvider).can('manage_camp_registrations')) {
      return const DetailScaffold(
        title: 'Camper',
        body: NoAccessView(
          message: 'Camper details need the Manage ROPs Camp Registrations '
              'permission.',
        ),
      );
    }

    final async = ref.watch(camperProvider(widget.registrationId));

    return async.when(
      loading: () => const DetailScaffold(title: 'Camper', body: LoadingView()),
      error: (e, _) => DetailScaffold(
        title: 'Camper',
        body: ErrorView(message: '$e'),
      ),
      data: (reg) {
        if (reg == null) {
          return const DetailScaffold(
            title: 'Camper',
            body: EmptyStateLux(
              icon: AppIcons.users,
              tone: IconTone.clay,
              title: 'Registration not found',
              description: 'It may have been removed.',
            ),
          );
        }

        final camp = getCamp(reg.campId);

        return DetailScaffold(
          title: reg.fullName,
          subtitle: reg.churchOrSchool,
          body: ListView(
            padding: EdgeInsets.zero,
            children: [
              _HeaderCard(registration: reg),
              const SizedBox(height: 18),

              if (reg.isPaymentFlagged)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: NoticeCard(
                    tone: IconTone.amber,
                    icon: AppIcons.money,
                    title: 'Fee not yet covered',
                    message: camp == null
                        ? 'Neither paid nor sponsored.'
                        : 'Neither paid nor sponsored. Fee is '
                            '${Money.format(camp.fee, camp.currency)}; '
                            'reference ${buildCampPaymentReference(reg.id)}.',
                  ),
                ),

              if ((reg.allergies ?? '').isNotEmpty ||
                  (reg.medicalNotes ?? '').isNotEmpty ||
                  (reg.medications ?? '').isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: NoticeCard(
                    tone: IconTone.rose,
                    icon: AppIcons.stethoscope,
                    title: 'Medical',
                    message: [
                      if ((reg.allergies ?? '').isNotEmpty)
                        'Allergies: ${reg.allergies}',
                      if ((reg.medications ?? '').isNotEmpty)
                        'Medication: ${reg.medications}',
                      if ((reg.medicalNotes ?? '').isNotEmpty)
                        reg.medicalNotes!,
                    ].join('\n'),
                  ),
                ),

              const SectionHeading(
                title: 'Camper',
                icon: AppIcons.user,
                tone: IconTone.periwinkle,
              ),
              const SizedBox(height: 12),
              LuxCard(
                child: Column(
                  children: [
                    DetailRow(
                      label: 'Date of birth',
                      value: '${reg.dateOfBirth}'
                          '${reg.age == null ? '' : ' · ${reg.age} years'}',
                      icon: AppIcons.cake,
                    ),
                    DetailRow(
                      label: 'Gender',
                      value: reg.gender.label,
                      icon: AppIcons.user,
                    ),
                    DetailRow(
                      label: 'T-shirt',
                      value: reg.tshirtSize.label,
                      icon: AppIcons.shirt,
                    ),
                    DetailRow(
                      label: 'Phone',
                      value: Phone.pretty(reg.phone),
                      icon: AppIcons.phone,
                      onTap: () => _dial(reg.phone),
                    ),
                    if ((reg.email ?? '').isNotEmpty)
                      DetailRow(
                        label: 'Email',
                        value: reg.email!,
                        icon: AppIcons.mail,
                      ),
                    if ((reg.address ?? '').isNotEmpty)
                      DetailRow(
                        label: 'Address',
                        value: reg.address!,
                        icon: AppIcons.mapPin,
                      ),
                    DetailRow(
                      label: 'Dietary',
                      value: reg.dietaryPreference ?? 'No special requirement',
                      icon: AppIcons.utensils,
                    ),
                    if (reg.dropoffLocation != null)
                      DetailRow(
                        label: 'Drop-off',
                        value: reg.dropoffLocation!.label,
                        icon: AppIcons.transport,
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 22),

              const SectionHeading(
                title: 'Guardian & emergency',
                icon: AppIcons.shield,
                tone: IconTone.rose,
              ),
              const SizedBox(height: 12),
              LuxCard(
                child: Column(
                  children: [
                    DetailRow(
                      label: 'Guardian',
                      value: reg.parentName ?? '—',
                      icon: AppIcons.user,
                    ),
                    if ((reg.parentRelationship ?? '').isNotEmpty)
                      DetailRow(
                        label: 'Relationship',
                        value: reg.parentRelationship!,
                        icon: AppIcons.heart,
                      ),
                    if ((reg.parentAltPhone ?? '').isNotEmpty)
                      DetailRow(
                        label: 'Guardian phone',
                        value: Phone.pretty(reg.parentAltPhone!),
                        icon: AppIcons.phone,
                        onTap: () => _dial(reg.parentAltPhone!),
                      ),
                    if ((reg.parentEmail ?? '').isNotEmpty)
                      DetailRow(
                        label: 'Guardian email',
                        value: reg.parentEmail!,
                        icon: AppIcons.mail,
                      ),
                    const LuxDivider(indent: 0),
                    DetailRow(
                      label: 'Emergency',
                      value: reg.emergencyContactName,
                      icon: AppIcons.alert,
                    ),
                    DetailRow(
                      label: 'Emergency phone',
                      value: Phone.pretty(reg.emergencyContactPhone),
                      icon: AppIcons.phone,
                      onTap: () => _dial(reg.emergencyContactPhone),
                    ),
                    if ((reg.emergencyContactRelationship ?? '').isNotEmpty)
                      DetailRow(
                        label: 'Relationship',
                        value: reg.emergencyContactRelationship!,
                        icon: AppIcons.heart,
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 22),

              const SectionHeading(
                title: 'Payment',
                icon: AppIcons.money,
                tone: IconTone.emerald,
              ),
              const SizedBox(height: 12),
              LuxCard(
                child: Column(
                  children: [
                    DetailRow(
                      label: 'Status',
                      value: reg.paymentStatus.label,
                      icon: AppIcons.money,
                      valueWidget: StatusBadge(
                        reg.paymentStatus.label,
                        tone: reg.isPaid ? IconTone.emerald : IconTone.amber,
                      ),
                    ),
                    if (reg.paymentAmount != null)
                      DetailRow(
                        label: 'Amount',
                        value: Money.format(
                            reg.paymentAmount, camp?.currency),
                        icon: AppIcons.wallet,
                      ),
                    DetailRow(
                      label: 'Reference',
                      value: reg.paymentReference ??
                          buildCampPaymentReference(reg.id),
                      icon: AppIcons.receipt,
                    ),
                    if (reg.isSponsored)
                      DetailRow(
                        label: 'Sponsor',
                        value: reg.sponsorName ?? 'Sponsored',
                        icon: AppIcons.handshake,
                      ),
                    if (reg.paymentMarkedAt != null)
                      DetailRow(
                        label: 'Marked',
                        value: '${D.dateTime(reg.paymentMarkedAt)}'
                            '${reg.paymentMarkedByName == null ? '' : ' · ${reg.paymentMarkedByName}'}',
                        icon: AppIcons.clock,
                      ),
                    const SizedBox(height: 10),
                    PrimaryButton(
                      label: reg.isPaid ? 'Mark unpaid' : 'Mark paid',
                      icon: reg.isPaid ? AppIcons.refresh : AppIcons.check,
                      loading: _busy,
                      destructive: reg.isPaid,
                      onPressed: () => _togglePaid(reg),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),

              const SectionHeading(
                title: 'Camp badge',
                icon: AppIcons.qrCode,
                tone: IconTone.gold,
              ),
              const SizedBox(height: 12),
              _BadgeCard(
                registration: reg,
                busy: _busy,
                onSend: () => _sendQr(reg),
              ),
              const SizedBox(height: 22),

              OutlinedButton.icon(
                onPressed: _busy ? null : () => _delete(reg),
                icon: const Icon(AppIcons.trash, size: 16),
                label: const Text('Remove registration'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.destructive,
                  side: BorderSide(
                      color: AppColors.destructive.withValues(alpha: 0.3)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _dial(String phone) async {
    final uri = Phone.dialUri(phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (mounted) {
      context.showError('No dialler on this device.');
    }
  }
}

class _HeaderCard extends ConsumerWidget {
  const _HeaderCard({required this.registration});

  final CampRegistration registration;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reg = registration;
    return LuxCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              MemberAvatar(
                initials: '${reg.firstName.isEmpty ? '?' : reg.firstName[0]}'
                    '${reg.lastName.isEmpty ? '' : reg.lastName[0]}',
                size: 54,
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
                        fontSize: 21,
                        height: 1.15,
                        color: AppColors.clay700,
                      )),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Registered ${D.medium(reg.createdAt)}',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.clay400),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 7,
            runSpacing: 7,
            children: [
              StatusBadge(
                reg.checkedIn ? 'Checked in' : 'Not arrived',
                tone: reg.checkedIn ? IconTone.emerald : IconTone.clay,
                icon: reg.checkedIn ? AppIcons.check : AppIcons.clock,
                dense: true,
              ),
              if (reg.onPass)
                const StatusBadge('Out on a pass',
                    tone: IconTone.blue, icon: AppIcons.doorOpen, dense: true),
              StatusBadge(reg.gender.label,
                  tone: IconTone.periwinkle, dense: true),
              if (reg.age != null)
                StatusBadge('${reg.age} years',
                    tone: IconTone.lavender, dense: true),
              if (reg.isMinor)
                const StatusBadge('Minor',
                    tone: IconTone.amber, icon: AppIcons.shield, dense: true),
            ],
          ),
        ],
      ),
    );
  }
}

class _BadgeCard extends StatelessWidget {
  const _BadgeCard({
    required this.registration,
    required this.busy,
    required this.onSend,
  });

  final CampRegistration registration;
  final bool busy;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final code = registration.checkInCode;

    if (code == null || code.isEmpty) {
      return const LuxCard(
        child: Text(
          'No badge code yet. Send the registration email and one is '
          'generated automatically.',
          style: TextStyle(
              fontSize: 13.5, height: 1.5, color: AppColors.clay400),
        ),
      );
    }

    // The same URL the emailed badge encodes, so a phone screen scans exactly
    // like the printed card.
    final payload = '${AppConfig.webBaseUrl}/rops-camp/track?code=$code';

    return LuxCard(
      child: Column(
        children: [
          Center(
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(color: AppColors.clay100),
              ),
              child: QrImageView(
                data: payload,
                size: 168,
                backgroundColor: Colors.white,
                eyeStyle: const QrEyeStyle(
                  eyeShape: QrEyeShape.square,
                  color: AppColors.clay800,
                ),
                dataModuleStyle: const QrDataModuleStyle(
                  dataModuleShape: QrDataModuleShape.square,
                  color: AppColors.clay800,
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          SelectableText(
            formatMealCode(code),
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              letterSpacing: 2.4,
              color: AppColors.clay700,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'One badge for arrival, meals and the gate.',
            style: TextStyle(fontSize: 12, color: AppColors.clay400),
          ),
          if (registration.qrEmailSentAt != null) ...[
            const SizedBox(height: 10),
            Text(
              'Emailed ${D.relative(registration.qrEmailSentAt)}'
              '${registration.qrEmailSentTo == null ? '' : ' to ${registration.qrEmailSentTo}'}'
              '${registration.qrEmailCount > 1 ? ' · ${registration.qrEmailCount} times' : ''}',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11.5, color: AppColors.clay300),
            ),
          ],
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: busy ? null : onSend,
            icon: const Icon(AppIcons.send, size: 16),
            label: Text(registration.qrEmailSentAt == null
                ? 'Email the badge'
                : 'Re-send the badge'),
          ),
        ],
      ),
    );
  }
}
