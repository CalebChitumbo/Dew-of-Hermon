import '../core/firebase_helpers.dart';

class Service {
  Service({
    required this.id,
    required this.eventId,
    required this.serviceTime,
    required this.isArchived,
    required this.createdAt,
    required this.updatedAt,
    this.theme,
    this.programNotes,
    this.attendanceCount,
  });

  final String id;
  final String eventId;
  final String? theme;
  final String serviceTime;
  final String? programNotes;
  final int? attendanceCount;
  final bool isArchived;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory Service.fromMap(String id, Map<String, dynamic> data) {
    return Service(
      id: id,
      eventId: data['eventId'] as String? ?? '',
      theme: data['theme'] as String?,
      serviceTime: data['serviceTime'] as String? ?? '',
      programNotes: data['programNotes'] as String?,
      attendanceCount: (data['attendanceCount'] as num?)?.toInt(),
      isArchived: data['isArchived'] as bool? ?? false,
      createdAt: readTimestampOrNow(data['createdAt']),
      updatedAt: readTimestampOrNow(data['updatedAt']),
    );
  }
}
