import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_providers.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/firestore_parse.dart';
import '../../data/firestore/streams.dart';
import '../../data/models/enums.dart';
import '../../data/models/event.dart';

/// Approved events from today onwards, soonest first.
final upcomingEventsProvider = StreamProvider<List<AppEvent>>((ref) {
  final today = D.startOfDay(DateTime.now());
  return collectionStream(
    db
        .collection('events')
        .where('approvalStatus', isEqualTo: 'APPROVED')
        .where('startDate', isGreaterThanOrEqualTo: today)
        .orderBy('startDate')
        .limit(20),
    AppEvent.fromMap,
  ).handleError((_) => <AppEvent>[]);
});

/// A duty on the signed-in member's own schedule.
class MyAssignment {
  const MyAssignment({
    required this.id,
    required this.roleName,
    required this.serviceLabel,
    required this.status,
    this.serviceId,
    this.date,
  });

  factory MyAssignment.fromMap(Map<String, dynamic> map) {
    final date = parseDate(map['serviceDate'] ?? map['date']);
    final theme = parseString(map['serviceTheme']) ??
        parseString(map['eventTitle']) ??
        "Potter's Wheel service";
    return MyAssignment(
      id: parseStringOr(map['id']),
      roleName: parseStringOr(map['roleName'], 'Assignment'),
      serviceLabel:
          date == null ? theme : '${D.dayMedium(date)} · $theme',
      status: AssignmentStatus.fromWire(map['status']),
      serviceId: parseString(map['serviceId']),
      date: date,
    );
  }

  final String id;
  final String roleName;
  final String serviceLabel;
  final AssignmentStatus status;
  final String? serviceId;
  final DateTime? date;
}

/// The member's next few duties, from `/api/my-assignments` — the server
/// joins the service and event so the row renders without extra reads.
final myUpcomingAssignmentsProvider =
    FutureProvider<List<MyAssignment>>((ref) async {
  final user = ref.watch(userOrNullProvider);
  if (user == null) return const [];

  try {
    final rows = await ref
        .read(apiClientProvider)
        .getList('/api/my-assignments', key: 'assignments');
    final now = D.startOfDay(DateTime.now());
    final items = rows
        .map(MyAssignment.fromMap)
        .where((a) => a.date == null || !a.date!.isBefore(now))
        .toList()
      ..sort((a, b) {
        if (a.date == null) return 1;
        if (b.date == null) return -1;
        return a.date!.compareTo(b.date!);
      });
    return items.take(4).toList();
  } on ApiException {
    // A member with no assignments (or a queue the server declines to show)
    // should see an empty section, not an error.
    return const [];
  }
});
