import '../firestore/converters.dart';

class AssignmentStatus {
  static const pending = 'PENDING';
  static const confirmed = 'CONFIRMED';
  static const declined = 'DECLINED';
  static const noResponse = 'NO_RESPONSE';
}

class ReminderDay {
  static const monday = 'MONDAY';
  static const thursday = 'THURSDAY';
  static const saturday = 'SATURDAY';
  static const all = [monday, thursday, saturday];
}

class ServiceRole {
  final String id;
  final String name;
  final String departmentId;
  final String? description;
  final String emailSubject;
  final String emailBody;
  final List<String> reminderSchedule;
  final String? arrivalTime;
  final String? timeSlot;
  final int order;

  const ServiceRole({
    required this.id,
    required this.name,
    required this.departmentId,
    this.description,
    this.emailSubject = '',
    this.emailBody = '',
    this.reminderSchedule = const [],
    this.arrivalTime,
    this.timeSlot,
    this.order = 0,
  });

  factory ServiceRole.fromMap(Map<String, dynamic> map) => ServiceRole(
        id: asString(map['id']),
        name: asString(map['name']),
        departmentId: asString(map['departmentId']),
        description: asStringOrNull(map['description']),
        emailSubject: asString(map['emailSubject']),
        emailBody: asString(map['emailBody']),
        reminderSchedule: asStringList(map['reminderSchedule']),
        arrivalTime: asStringOrNull(map['arrivalTime']),
        timeSlot: asStringOrNull(map['timeSlot']),
        order: asInt(map['order']),
      );
}

class ChurchService {
  final String id;
  final String eventId;
  final String? theme;
  final String serviceTime;
  final String? programNotes;
  final int? attendanceCount;
  final bool isArchived;
  final bool autoProvisioned;
  final DateTime? rotaOpenNotifiedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  const ChurchService({
    required this.id,
    required this.eventId,
    this.theme,
    required this.serviceTime,
    this.programNotes,
    this.attendanceCount,
    this.isArchived = false,
    this.autoProvisioned = false,
    this.rotaOpenNotifiedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ChurchService.fromMap(Map<String, dynamic> map) => ChurchService(
        id: asString(map['id']),
        eventId: asString(map['eventId']),
        theme: asStringOrNull(map['theme']),
        serviceTime: asString(map['serviceTime']),
        programNotes: asStringOrNull(map['programNotes']),
        attendanceCount: asIntOrNull(map['attendanceCount']),
        isArchived: asBool(map['isArchived']),
        autoProvisioned: asBool(map['autoProvisioned']),
        rotaOpenNotifiedAt: parseDateOrNull(map['rotaOpenNotifiedAt']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class ServiceAssignment {
  final String id;
  final String serviceId;
  final String roleId;
  final String roleName;
  final String userId;
  final String userName;
  final String userEmail;
  final String? userPhone;
  final String status;
  final bool emailSent;
  final DateTime? emailSentAt;
  final DateTime? confirmedAt;
  final String? notes;
  final DateTime createdAt;
  final DateTime updatedAt;

  const ServiceAssignment({
    required this.id,
    required this.serviceId,
    required this.roleId,
    required this.roleName,
    required this.userId,
    required this.userName,
    required this.userEmail,
    this.userPhone,
    required this.status,
    this.emailSent = false,
    this.emailSentAt,
    this.confirmedAt,
    this.notes,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ServiceAssignment.fromMap(Map<String, dynamic> map) =>
      ServiceAssignment(
        id: asString(map['id']),
        serviceId: asString(map['serviceId']),
        roleId: asString(map['roleId']),
        roleName: asString(map['roleName']),
        userId: asString(map['userId']),
        userName: asString(map['userName']),
        userEmail: asString(map['userEmail']),
        userPhone: asStringOrNull(map['userPhone']),
        status: asString(map['status'], AssignmentStatus.pending),
        emailSent: asBool(map['emailSent']),
        emailSentAt: parseDateOrNull(map['emailSentAt']),
        confirmedAt: parseDateOrNull(map['confirmedAt']),
        notes: asStringOrNull(map['notes']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class ChecklistItem {
  final String id;
  final String serviceId;
  final String task;
  final String category;
  final bool isCompleted;
  final String? completedBy;
  final int order;
  final DateTime updatedAt;

  const ChecklistItem({
    required this.id,
    required this.serviceId,
    required this.task,
    required this.category,
    this.isCompleted = false,
    this.completedBy,
    this.order = 0,
    required this.updatedAt,
  });

  factory ChecklistItem.fromMap(Map<String, dynamic> map) => ChecklistItem(
        id: asString(map['id']),
        serviceId: asString(map['serviceId']),
        task: asString(map['task']),
        category: asString(map['category']),
        isCompleted: asBool(map['isCompleted']),
        completedBy: asStringOrNull(map['completedBy']),
        order: asInt(map['order']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class UserAvailability {
  final String date;
  final bool available;
  final String? reason;

  const UserAvailability({
    required this.date,
    required this.available,
    this.reason,
  });

  factory UserAvailability.fromMap(Map<String, dynamic> map) =>
      UserAvailability(
        date: asString(map['date']),
        available: asBool(map['available'], true),
        reason: asStringOrNull(map['reason']),
      );

  Map<String, dynamic> toMap() => {
        'date': date,
        'available': available,
        'reason': reason,
      };
}
