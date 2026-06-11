import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

class EventDetailScreen extends StatelessWidget {
  const EventDetailScreen({super.key, required this.event});

  final AppEvent event;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final dateLine = event.endDate != null &&
            !_sameDay(event.startDate, event.endDate!)
        ? '${DateFormat('EEE, MMM d').format(event.startDate)} – '
            '${DateFormat('EEE, MMM d, yyyy').format(event.endDate!)}'
        : DateFormat('EEEE, MMMM d, yyyy').format(event.startDate);

    return Scaffold(
      appBar: AppBar(title: const Text('Event')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          EventTypeChipRow(event: event),
          const SizedBox(height: 10),
          Text(event.title, style: textTheme.headlineSmall),
          const SizedBox(height: 18),
          Card(
            child: Column(
              children: [
                _DetailRow(
                  icon: Icons.calendar_today_outlined,
                  label: 'Date',
                  value: dateLine,
                ),
                const Divider(height: 1),
                _DetailRow(
                  icon: Icons.schedule_outlined,
                  label: 'Time',
                  value: DateFormat('HH:mm').format(event.startDate),
                ),
                const Divider(height: 1),
                _DetailRow(
                  icon: Icons.place_outlined,
                  label: 'Venue',
                  value: event.venue.isEmpty ? 'To be announced' : event.venue,
                ),
                if (event.speaker != null) ...[
                  const Divider(height: 1),
                  _DetailRow(
                    icon: Icons.record_voice_over_outlined,
                    label: 'Speaker',
                    value: event.speaker!,
                  ),
                ],
                if (event.lifeGroupTarget != null &&
                    event.lifeGroupTarget != 'ALL') ...[
                  const Divider(height: 1),
                  _DetailRow(
                    icon: Icons.groups_outlined,
                    label: 'For',
                    value: '${event.lifeGroupTarget} life group',
                  ),
                ],
                if (event.isPaid && event.attendanceFee != null) ...[
                  const Divider(height: 1),
                  _DetailRow(
                    icon: Icons.payments_outlined,
                    label: 'Fee',
                    value:
                        '${event.attendanceFeeCurrency ?? ''} ${event.attendanceFee}'
                            .trim(),
                  ),
                ],
              ],
            ),
          ),
          if (event.objective != null) ...[
            const SizedBox(height: 16),
            const SectionHeader('Objective'),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  event.objective!,
                  style: textTheme.bodyMedium?.copyWith(height: 1.5),
                ),
              ),
            ),
          ],
          if (event.description != null &&
              event.description!.trim().isNotEmpty) ...[
            const SizedBox(height: 16),
            const SectionHeader('About'),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  event.description!,
                  style: textTheme.bodyMedium?.copyWith(height: 1.5),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  static bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
}

class EventTypeChipRow extends StatelessWidget {
  const EventTypeChipRow({super.key, required this.event});

  final AppEvent event;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        EventTypeChip(type: event.type, label: event.typeLabel),
        if (event.isPaid) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: PWColors.clay100,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              'Paid event',
              style: Theme.of(context)
                  .textTheme
                  .labelSmall
                  ?.copyWith(color: PWColors.clay600),
            ),
          ),
        ],
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Icon(icon, size: 20, color: PWColors.gold),
          const SizedBox(width: 12),
          SizedBox(
            width: 64,
            child: Text(
              label,
              style: textTheme.bodySmall?.copyWith(color: PWColors.clay400),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style:
                  textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}
