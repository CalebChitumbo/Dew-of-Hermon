import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/firestore/streams.dart';
import '../../data/models/enums.dart';
import '../../data/models/event.dart';
import 'event_detail_sheet.dart';

/// Approved events, live. The calendar reads Firestore directly so an event
/// the Chairperson approves appears without anyone pulling to refresh.
final calendarEventsProvider = StreamProvider<List<AppEvent>>((ref) {
  return collectionStream(
    db
        .collection('events')
        .where('approvalStatus', isEqualTo: 'APPROVED')
        .orderBy('startDate'),
    AppEvent.fromMap,
  ).handleError((_) => <AppEvent>[]);
});

/// The ministry calendar — a month grid with the days that have something on
/// them marked, and the chosen day's events below it.
class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  late DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  DateTime _selected = D.startOfDay(DateTime.now());

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(calendarEventsProvider);

    return AppScaffold(
      title: 'Calendar',
      onRefresh: () async => ref.invalidate(calendarEventsProvider),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(calendarEventsProvider),
        ),
        data: (events) {
          final byDay = <DateTime, List<AppEvent>>{};
          for (final event in events) {
            // A multi-day event (camp, retreat) belongs on every day it runs.
            final start = D.startOfDay(event.startDate);
            final end = D.startOfDay(event.endDate ?? event.startDate);
            for (var day = start;
                !day.isAfter(end);
                day = day.add(const Duration(days: 1))) {
              byDay.putIfAbsent(day, () => []).add(event);
            }
          }

          final selectedEvents = byDay[_selected] ?? const <AppEvent>[];
          final upcoming = events
              .where((e) => !e.startDate.isBefore(D.startOfDay(DateTime.now())))
              .take(6)
              .toList();

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              LuxCard(
                padding: const EdgeInsets.fromLTRB(12, 14, 12, 16),
                child: Column(
                  children: [
                    _MonthHeader(
                      month: _month,
                      onPrevious: () => setState(() => _month =
                          DateTime(_month.year, _month.month - 1)),
                      onNext: () => setState(() =>
                          _month = DateTime(_month.year, _month.month + 1)),
                      onToday: () => setState(() {
                        final now = DateTime.now();
                        _month = DateTime(now.year, now.month);
                        _selected = D.startOfDay(now);
                      }),
                    ),
                    const SizedBox(height: 12),
                    _MonthGrid(
                      month: _month,
                      selected: _selected,
                      markedDays: byDay.keys.toSet(),
                      onSelect: (day) => setState(() => _selected = day),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              SectionHeading(
                title: D.isToday(_selected) ? 'Today' : D.long(_selected),
                icon: AppIcons.calendarDays,
                tone: IconTone.gold,
                subtitle: selectedEvents.isEmpty
                    ? 'Nothing scheduled'
                    : '${selectedEvents.length} '
                        '${selectedEvents.length == 1 ? 'event' : 'events'}',
              ),
              const SizedBox(height: 12),

              if (selectedEvents.isEmpty)
                const LuxCard(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      'A quiet day. Pick another date, or see what is coming '
                      'up below.',
                      style: TextStyle(
                          fontSize: 13.5,
                          height: 1.5,
                          color: AppColors.clay400),
                    ),
                  ),
                )
              else
                for (final event in selectedEvents)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: EventCard(event: event),
                  ),

              if (upcoming.isNotEmpty) ...[
                const SizedBox(height: 22),
                const SectionHeading(
                  title: 'Coming up',
                  icon: AppIcons.calendarRange,
                  tone: IconTone.teal,
                ),
                const SizedBox(height: 12),
                LuxCard(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    children: [
                      for (var i = 0; i < upcoming.length; i++) ...[
                        if (i > 0) const LuxDivider(),
                        LuxTile(
                          title: upcoming[i].title,
                          subtitle:
                              '${D.dayMedium(upcoming[i].startDate)} · '
                              '${upcoming[i].venue}',
                          icon: eventIcon(upcoming[i].type),
                          tone: eventTone(upcoming[i].type),
                          dense: true,
                          trailing: Text(
                            D.relative(upcoming[i].startDate),
                            style: const TextStyle(
                                fontSize: 11.5, color: AppColors.clay400),
                          ),
                          onTap: () => showEventDetail(context, upcoming[i]),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _MonthHeader extends StatelessWidget {
  const _MonthHeader({
    required this.month,
    required this.onPrevious,
    required this.onNext,
    required this.onToday,
  });

  final DateTime month;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final VoidCallback onToday;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          icon: const Icon(AppIcons.chevronLeft, size: 19),
          color: AppColors.clay500,
          onPressed: onPrevious,
          tooltip: 'Previous month',
        ),
        Expanded(
          child: GestureDetector(
            onTap: onToday,
            child: Text(
              D.monthYear(month),
              textAlign: TextAlign.center,
              style: AppFonts.display(const TextStyle(
                fontSize: 19,
                color: AppColors.clay700,
              )),
            ),
          ),
        ),
        IconButton(
          icon: const Icon(AppIcons.chevronRight, size: 19),
          color: AppColors.clay500,
          onPressed: onNext,
          tooltip: 'Next month',
        ),
      ],
    );
  }
}

class _MonthGrid extends StatelessWidget {
  const _MonthGrid({
    required this.month,
    required this.selected,
    required this.markedDays,
    required this.onSelect,
  });

  final DateTime month;
  final DateTime selected;
  final Set<DateTime> markedDays;
  final ValueChanged<DateTime> onSelect;

  static const _weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  @override
  Widget build(BuildContext context) {
    final first = DateTime(month.year, month.month);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    // Weeks run Monday-first, matching the web's grid.
    final leadingBlanks = first.weekday - DateTime.monday;

    final cells = <Widget>[
      for (final label in _weekdayLabels)
        Center(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.clay300,
            ),
          ),
        ),
      for (var i = 0; i < leadingBlanks; i++) const SizedBox.shrink(),
      for (var day = 1; day <= daysInMonth; day++)
        _DayCell(
          date: DateTime(month.year, month.month, day),
          selected: D.isSameDay(
              DateTime(month.year, month.month, day), selected),
          marked: markedDays.contains(DateTime(month.year, month.month, day)),
          onTap: onSelect,
        ),
    ];

    return GridView.count(
      crossAxisCount: 7,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 2,
      crossAxisSpacing: 2,
      children: cells,
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.date,
    required this.selected,
    required this.marked,
    required this.onTap,
  });

  final DateTime date;
  final bool selected;
  final bool marked;
  final ValueChanged<DateTime> onTap;

  @override
  Widget build(BuildContext context) {
    final today = D.isToday(date);
    return InkWell(
      onTap: () => onTap(D.startOfDay(date)),
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Container(
        decoration: BoxDecoration(
          color: selected ? AppColors.clay700 : Colors.transparent,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: today && !selected
              ? Border.all(color: AppColors.gold, width: 1.4)
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '${date.day}',
              style: TextStyle(
                fontSize: 13,
                fontWeight: selected || today
                    ? FontWeight.w700
                    : FontWeight.w500,
                color: selected ? AppColors.cream : AppColors.clay600,
              ),
            ),
            const SizedBox(height: 2),
            Container(
              height: 4,
              width: 4,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: marked
                    ? (selected ? AppColors.goldLight : AppColors.gold)
                    : Colors.transparent,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A full event card — used on the calendar and anywhere an event is listed
/// at full width.
class EventCard extends StatelessWidget {
  const EventCard({super.key, required this.event});

  final AppEvent event;

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      onTap: () => showEventDetail(context, event),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconChip(eventIcon(event.type), tone: eventTone(event.type), size: 44),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  event.title,
                  style: AppFonts.display(const TextStyle(
                    fontSize: 18,
                    height: 1.2,
                    color: AppColors.clay700,
                  )),
                ),
                const SizedBox(height: 5),
                Row(
                  children: [
                    const Icon(AppIcons.clock,
                        size: 13, color: AppColors.clay300),
                    const SizedBox(width: 5),
                    Text(
                      D.time(event.startDate),
                      style: const TextStyle(
                          fontSize: 12.5, color: AppColors.clay400),
                    ),
                    const SizedBox(width: 12),
                    const Icon(AppIcons.mapPin,
                        size: 13, color: AppColors.clay300),
                    const SizedBox(width: 5),
                    Flexible(
                      child: Text(
                        event.venue,
                        style: const TextStyle(
                            fontSize: 12.5, color: AppColors.clay400),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                if (event.description != null &&
                    event.description!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    event.description!,
                    style: const TextStyle(
                        fontSize: 13, height: 1.45, color: AppColors.clay500),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                if (event.speaker != null && event.speaker!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  StatusBadge(event.speaker!,
                      tone: IconTone.periwinkle,
                      icon: AppIcons.mic,
                      dense: true),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

IconData eventIcon(EventType type) => switch (type) {
      EventType.pottersWheelService => AppIcons.church,
      EventType.ropsCamp => AppIcons.tent,
      EventType.retreat => AppIcons.church,
      EventType.specialEvent => AppIcons.sparkles,
      EventType.meeting => AppIcons.users,
      EventType.outreach => AppIcons.heart,
    };

IconTone eventTone(EventType type) => switch (type) {
      EventType.pottersWheelService => IconTone.gold,
      EventType.ropsCamp => IconTone.teal,
      EventType.retreat => IconTone.lavender,
      EventType.specialEvent => IconTone.blue,
      EventType.meeting => IconTone.clay,
      EventType.outreach => IconTone.emerald,
    };
