import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/money.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/event.dart';
import 'calendar_screen.dart';

/// Everything about an event, in a sheet — so tapping a calendar entry never
/// loses the person's place in the month.
Future<void> showEventDetail(BuildContext context, AppEvent event) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.72,
      maxChildSize: 0.95,
      minChildSize: 0.4,
      builder: (context, controller) =>
          EventDetailSheet(event: event, controller: controller),
    ),
  );
}

class EventDetailSheet extends StatelessWidget {
  const EventDetailSheet({
    super.key,
    required this.event,
    this.controller,
  });

  final AppEvent event;
  final ScrollController? controller;

  @override
  Widget build(BuildContext context) {
    final needs = event.stakeholderNeeds;
    final filledRoles = event.coreRoles.where((r) => r.isFilled).length;

    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            IconChip(eventIcon(event.type),
                tone: eventTone(event.type), size: 48),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    event.title,
                    style: AppFonts.display(const TextStyle(
                      fontSize: 23,
                      height: 1.12,
                      color: AppColors.clay700,
                    )),
                  ),
                  const SizedBox(height: 6),
                  StatusBadge(event.type.label,
                      tone: eventTone(event.type), dense: true),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),

        LuxCard(
          child: Column(
            children: [
              DetailRow(
                label: 'When',
                value: event.endDate == null ||
                        D.isSameDay(event.startDate, event.endDate)
                    ? '${D.long(event.startDate)} · ${D.time(event.startDate)}'
                    : D.range(event.startDate, event.endDate),
                icon: AppIcons.calendar,
              ),
              DetailRow(
                label: 'Venue',
                value: event.venue,
                icon: AppIcons.mapPin,
              ),
              if (event.speaker != null && event.speaker!.isNotEmpty)
                DetailRow(
                  label: 'Speaker',
                  value: event.speaker!,
                  icon: AppIcons.mic,
                ),
              if (event.lifeGroupTarget != null &&
                  event.lifeGroupTarget != 'ALL')
                DetailRow(
                  label: 'For',
                  value: event.lifeGroupTarget!,
                  icon: AppIcons.usersRound,
                ),
              if (event.isPaid && event.attendanceFee != null)
                DetailRow(
                  label: 'Fee',
                  value: Money.format(
                      event.attendanceFee, event.attendanceFeeCurrency),
                  icon: AppIcons.money,
                ),
            ],
          ),
        ),

        if (event.objective != null && event.objective!.isNotEmpty) ...[
          const SizedBox(height: 20),
          const SectionHeading(
            title: 'Why we are doing this',
            icon: AppIcons.star,
            tone: IconTone.gold,
          ),
          const SizedBox(height: 12),
          LuxCard(
            child: Text(
              event.objective!,
              style: const TextStyle(
                  fontSize: 14, height: 1.6, color: AppColors.clay600),
            ),
          ),
        ],

        if (event.description != null && event.description!.isNotEmpty) ...[
          const SizedBox(height: 20),
          const SectionHeading(
            title: 'Details',
            icon: AppIcons.info,
            tone: IconTone.periwinkle,
          ),
          const SizedBox(height: 12),
          LuxCard(
            child: Text(
              event.description!,
              style: const TextStyle(
                  fontSize: 14, height: 1.6, color: AppColors.clay600),
            ),
          ),
        ],

        if (event.coreRoles.isNotEmpty) ...[
          const SizedBox(height: 20),
          SectionHeading(
            title: 'Who is doing what',
            icon: AppIcons.clipboardCheck,
            tone: IconTone.sage,
            subtitle: '$filledRoles of ${event.coreRoles.length} filled',
          ),
          const SizedBox(height: 12),
          LuxCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                for (var i = 0; i < event.coreRoles.length; i++) ...[
                  if (i > 0) const LuxDivider(),
                  LuxTile(
                    title: event.coreRoles[i].role,
                    subtitle: event.coreRoles[i].assignedUserName ??
                        'Not assigned yet',
                    icon: event.coreRoles[i].isFilled
                        ? AppIcons.checkCircle
                        : AppIcons.user,
                    tone: event.coreRoles[i].isFilled
                        ? IconTone.emerald
                        : IconTone.clay,
                    dense: true,
                  ),
                ],
              ],
            ),
          ),
        ],

        if (needs.isNotEmpty) ...[
          const SizedBox(height: 20),
          const SectionHeading(
            title: 'What this event needs',
            icon: AppIcons.inbox,
            tone: IconTone.amber,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final need in needs)
                StatusBadge(need, tone: IconTone.amber, icon: _needIcon(need)),
            ],
          ),
          if (event.budgetRequested && event.budgetAmount != null) ...[
            const SizedBox(height: 12),
            NoticeCard(
              tone: IconTone.emerald,
              icon: AppIcons.money,
              title: 'Budget requested',
              message:
                  '${Money.format(event.budgetAmount, event.budgetCurrency)}'
                  '${event.budgetPurpose == null ? '' : ' — ${event.budgetPurpose}'}',
            ),
          ],
        ],

        const SizedBox(height: 24),
      ],
    );
  }

  static IconData _needIcon(String need) => switch (need) {
        'Transport' => AppIcons.transport,
        'Media' => AppIcons.media,
        'Food' => AppIcons.food,
        _ => AppIcons.money,
      };
}
