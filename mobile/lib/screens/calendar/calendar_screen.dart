import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:table_calendar/table_calendar.dart';

import '../../models/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../events/event_detail_screen.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  DateTime _focusedDay = DateTime.now();
  DateTime _selectedDay = DateTime.now();

  DateTime get _rangeStart =>
      DateTime(_focusedDay.year, _focusedDay.month - 1, 1);
  DateTime get _rangeEnd =>
      DateTime(_focusedDay.year, _focusedDay.month + 2, 0, 23, 59);

  static DateTime _dayKey(DateTime d) => DateTime(d.year, d.month, d.day);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Calendar')),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        // One window query around the visible month; same single-field
        // range+order the web calendar uses, so no extra indexes needed.
        stream: FirebaseFirestore.instance
            .collection('events')
            .where('startDate',
                isGreaterThanOrEqualTo: Timestamp.fromDate(_rangeStart))
            .where('startDate',
                isLessThanOrEqualTo: Timestamp.fromDate(_rangeEnd))
            .orderBy('startDate')
            .snapshots(),
        builder: (context, snapshot) {
          final byDay = <DateTime, List<AppEvent>>{};
          for (final doc in snapshot.data?.docs ?? const []) {
            final event = AppEvent.fromMap(doc.id, doc.data());
            if (!event.isApproved) continue;
            byDay.putIfAbsent(_dayKey(event.startDate), () => []).add(event);
          }
          final selectedEvents = byDay[_dayKey(_selectedDay)] ?? const [];

          return Column(
            children: [
              Card(
                margin: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: TableCalendar<AppEvent>(
                  firstDay: DateTime.utc(2023, 1, 1),
                  lastDay: DateTime.utc(2032, 12, 31),
                  focusedDay: _focusedDay,
                  selectedDayPredicate: (day) =>
                      isSameDay(day, _selectedDay),
                  eventLoader: (day) => byDay[_dayKey(day)] ?? const [],
                  onDaySelected: (selected, focused) => setState(() {
                    _selectedDay = selected;
                    _focusedDay = focused;
                  }),
                  onPageChanged: (focused) =>
                      setState(() => _focusedDay = focused),
                  availableCalendarFormats: const {
                    CalendarFormat.month: 'Month',
                  },
                  headerStyle: HeaderStyle(
                    formatButtonVisible: false,
                    titleCentered: true,
                    titleTextStyle: Theme.of(context)
                        .textTheme
                        .titleMedium!
                        .copyWith(color: PWColors.clay700),
                    leftChevronIcon: const Icon(Icons.chevron_left,
                        color: PWColors.clay500),
                    rightChevronIcon: const Icon(Icons.chevron_right,
                        color: PWColors.clay500),
                  ),
                  daysOfWeekStyle: DaysOfWeekStyle(
                    weekdayStyle: Theme.of(context)
                        .textTheme
                        .labelSmall!
                        .copyWith(color: PWColors.clay400),
                    weekendStyle: Theme.of(context)
                        .textTheme
                        .labelSmall!
                        .copyWith(color: PWColors.gold),
                  ),
                  calendarStyle: CalendarStyle(
                    todayDecoration: BoxDecoration(
                      color: PWColors.gold.withValues(alpha: 0.25),
                      shape: BoxShape.circle,
                    ),
                    todayTextStyle:
                        const TextStyle(color: PWColors.clay700),
                    selectedDecoration: const BoxDecoration(
                      color: PWColors.clay700,
                      shape: BoxShape.circle,
                    ),
                    markerDecoration: const BoxDecoration(
                      color: PWColors.teal,
                      shape: BoxShape.circle,
                    ),
                    markersMaxCount: 3,
                    outsideDaysVisible: false,
                  ),
                ),
              ),
              Expanded(
                child: selectedEvents.isEmpty
                    ? EmptyState(
                        icon: Icons.event_available_outlined,
                        title:
                            'Nothing on ${DateFormat('MMM d').format(_selectedDay)}',
                        subtitle: 'Pick a day with a teal marker to see '
                            'what’s happening.',
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                        itemCount: selectedEvents.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final event = selectedEvents[i];
                          return Card(
                            child: ListTile(
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) =>
                                      EventDetailScreen(event: event),
                                ),
                              ),
                              leading: Column(
                                mainAxisAlignment:
                                    MainAxisAlignment.center,
                                children: [
                                  Text(
                                    DateFormat('HH:mm')
                                        .format(event.startDate),
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleSmall
                                        ?.copyWith(
                                            color: PWColors.clay700),
                                  ),
                                ],
                              ),
                              title: Text(
                                event.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(
                                        fontWeight: FontWeight.w600),
                              ),
                              subtitle: Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Row(
                                  children: [
                                    EventTypeChip(
                                      type: event.type,
                                      label: event.typeLabel,
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        event.venue,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodySmall
                                            ?.copyWith(
                                                color: PWColors.clay400),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              trailing: const Icon(Icons.chevron_right,
                                  color: PWColors.clay300),
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}
