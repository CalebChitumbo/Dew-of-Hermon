import 'enums.dart';

class ServiceRole {
  ServiceRole({
    required this.id,
    required this.name,
    required this.departmentId,
    required this.emailSubject,
    required this.emailBody,
    required this.reminderSchedule,
    required this.order,
    this.description,
    this.arrivalTime,
    this.timeSlot,
  });

  final String id;
  final String name;
  final String departmentId;
  final String? description;
  final String emailSubject;
  final String emailBody;
  final List<ReminderDay> reminderSchedule;
  final String? arrivalTime;
  final String? timeSlot;
  final int order;

  factory ServiceRole.fromMap(String id, Map<String, dynamic> data) {
    final schedule = <ReminderDay>[];
    final scheduleRaw = data['reminderSchedule'];
    if (scheduleRaw is List) {
      for (final entry in scheduleRaw) {
        if (entry is String) {
          for (final day in ReminderDay.values) {
            if (day.name == entry) {
              schedule.add(day);
              break;
            }
          }
        }
      }
    }

    return ServiceRole(
      id: id,
      name: data['name'] as String? ?? '',
      departmentId: data['departmentId'] as String? ?? '',
      description: data['description'] as String?,
      emailSubject: data['emailSubject'] as String? ?? '',
      emailBody: data['emailBody'] as String? ?? '',
      reminderSchedule: schedule,
      arrivalTime: data['arrivalTime'] as String?,
      timeSlot: data['timeSlot'] as String?,
      order: (data['order'] as num?)?.toInt() ?? 0,
    );
  }
}
