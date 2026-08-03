import '../../core/utils/firestore_parse.dart';
import 'enums.dart';

/// A core role on an event (MC, Preacher…) and who holds it.
class EventCoreRole {
  const EventCoreRole({
    required this.role,
    this.assignedUserId,
    this.assignedUserName,
  });

  factory EventCoreRole.fromMap(Map<String, dynamic> map) => EventCoreRole(
        role: parseStringOr(map['role']),
        assignedUserId: parseString(map['assignedUserId']),
        assignedUserName: parseString(map['assignedUserName']),
      );

  final String role;
  final String? assignedUserId;
  final String? assignedUserName;

  bool get isFilled => (assignedUserId ?? '').isNotEmpty;

  Map<String, dynamic> toMap() => {
        'role': role,
        'assignedUserId': assignedUserId,
        'assignedUserName': assignedUserName,
      };
}

/// A department-tier role on an event.
class EventDepartmentRole {
  const EventDepartmentRole({
    required this.id,
    required this.eventId,
    required this.departmentId,
    required this.departmentName,
    required this.role,
    this.assignedUserId,
    this.assignedUserName,
    this.assignedAt,
    required this.createdAt,
  });

  factory EventDepartmentRole.fromMap(Map<String, dynamic> map) =>
      EventDepartmentRole(
        id: parseStringOr(map['id']),
        eventId: parseStringOr(map['eventId']),
        departmentId: parseStringOr(map['departmentId']),
        departmentName: parseStringOr(map['departmentName']),
        role: parseStringOr(map['role']),
        assignedUserId: parseString(map['assignedUserId']),
        assignedUserName: parseString(map['assignedUserName']),
        assignedAt: parseDate(map['assignedAt']),
        createdAt: parseDateOr(map['createdAt']),
      );

  final String id;
  final String eventId;
  final String departmentId;
  final String departmentName;
  final String role;
  final String? assignedUserId;
  final String? assignedUserName;
  final DateTime? assignedAt;
  final DateTime createdAt;

  bool get isFilled => (assignedUserId ?? '').isNotEmpty;
}

/// An event on the ministry calendar. Mirrors `AppEvent`.
class AppEvent {
  const AppEvent({
    required this.id,
    required this.title,
    this.description,
    required this.type,
    required this.startDate,
    this.endDate,
    required this.venue,
    this.isRecurring = false,
    required this.createdBy,
    this.lifeGroupTarget,
    required this.approvalStatus,
    this.approvalComments,
    this.approvedBy,
    this.approvedAt,
    this.createdByDepartmentId,
    this.coreRoles = const [],
    this.speaker,
    this.objective,
    this.isPaid = false,
    this.attendanceFee,
    this.attendanceFeeCurrency,
    this.transportRequired = false,
    this.transportNeeds,
    this.transportRequestId,
    this.budgetRequested = false,
    this.budgetAmount,
    this.budgetCurrency,
    this.budgetPurpose,
    this.budgetRequestId,
    this.mediaRequired = false,
    this.mediaNeeds,
    this.mediaRequestId,
    this.foodRequired = false,
    this.foodNeeds,
    this.foodRequestId,
    this.viceChairApprovedBy,
    this.viceChairApprovedAt,
    this.chairApprovedBy,
    this.chairApprovedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory AppEvent.fromMap(Map<String, dynamic> map) {
    return AppEvent(
      id: parseStringOr(map['id']),
      title: parseStringOr(map['title']),
      description: parseString(map['description']),
      type: EventType.fromWire(map['type']),
      startDate: parseDateOr(map['startDate']),
      endDate: parseDate(map['endDate']),
      venue: parseStringOr(map['venue']),
      isRecurring: parseBool(map['isRecurring']),
      createdBy: parseStringOr(map['createdBy']),
      lifeGroupTarget: parseString(map['lifeGroupTarget']),
      approvalStatus: EventApprovalStatus.fromWire(map['approvalStatus']),
      approvalComments: parseString(map['approvalComments']),
      approvedBy: parseString(map['approvedBy']),
      approvedAt: parseDate(map['approvedAt']),
      createdByDepartmentId: parseString(map['createdByDepartmentId']),
      coreRoles:
          parseMapList(map['coreRoles']).map(EventCoreRole.fromMap).toList(),
      speaker: parseString(map['speaker']),
      objective: parseString(map['objective']),
      isPaid: parseBool(map['isPaid']),
      attendanceFee: parseDouble(map['attendanceFee']),
      attendanceFeeCurrency: parseString(map['attendanceFeeCurrency']),
      transportRequired: parseBool(map['transportRequired']),
      transportNeeds: parseString(map['transportNeeds']),
      transportRequestId: parseString(map['transportRequestId']),
      budgetRequested: parseBool(map['budgetRequested']),
      budgetAmount: parseDouble(map['budgetAmount']),
      budgetCurrency: parseString(map['budgetCurrency']),
      budgetPurpose: parseString(map['budgetPurpose']),
      budgetRequestId: parseString(map['budgetRequestId']),
      mediaRequired: parseBool(map['mediaRequired']),
      mediaNeeds: parseString(map['mediaNeeds']),
      mediaRequestId: parseString(map['mediaRequestId']),
      foodRequired: parseBool(map['foodRequired']),
      foodNeeds: parseString(map['foodNeeds']),
      foodRequestId: parseString(map['foodRequestId']),
      viceChairApprovedBy: parseString(map['viceChairApprovedBy']),
      viceChairApprovedAt: parseDate(map['viceChairApprovedAt']),
      chairApprovedBy: parseString(map['chairApprovedBy']),
      chairApprovedAt: parseDate(map['chairApprovedAt']),
      createdAt: parseDateOr(map['createdAt']),
      updatedAt: parseDateOr(map['updatedAt']),
    );
  }

  final String id;
  final String title;
  final String? description;
  final EventType type;
  final DateTime startDate;
  final DateTime? endDate;
  final String venue;
  final bool isRecurring;
  final String createdBy;

  /// A LifeGroup wire value or "ALL".
  final String? lifeGroupTarget;

  final EventApprovalStatus approvalStatus;
  final String? approvalComments;
  final String? approvedBy;
  final DateTime? approvedAt;
  final String? createdByDepartmentId;
  final List<EventCoreRole> coreRoles;
  final String? speaker;
  final String? objective;
  final bool isPaid;
  final double? attendanceFee;
  final String? attendanceFeeCurrency;
  final bool transportRequired;
  final String? transportNeeds;
  final String? transportRequestId;
  final bool budgetRequested;
  final double? budgetAmount;
  final String? budgetCurrency;
  final String? budgetPurpose;
  final String? budgetRequestId;
  final bool mediaRequired;
  final String? mediaNeeds;
  final String? mediaRequestId;
  final bool foodRequired;
  final String? foodNeeds;
  final String? foodRequestId;

  // Executive sign-off audit trail (Events Lead → Vice Chair → Chairperson).
  final String? viceChairApprovedBy;
  final DateTime? viceChairApprovedAt;
  final String? chairApprovedBy;
  final DateTime? chairApprovedAt;

  final DateTime createdAt;
  final DateTime updatedAt;

  bool get isApproved => approvalStatus == EventApprovalStatus.approved;
  bool get isUpcoming => startDate.isAfter(DateTime.now());

  /// True while the event is running (or on its day, for a single-day event).
  bool get isLive {
    final now = DateTime.now();
    final end = endDate ?? startDate.add(const Duration(hours: 4));
    return now.isAfter(startDate) && now.isBefore(end);
  }

  /// The stakeholder requests this event raised, for the summary chips.
  List<String> get stakeholderNeeds => [
        if (transportRequired) 'Transport',
        if (mediaRequired) 'Media',
        if (foodRequired) 'Food',
        if (budgetRequested) 'Budget',
      ];
}

/// A weekly Potter's Wheel service. Mirrors `Service`.
class Service {
  const Service({
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

  factory Service.fromMap(Map<String, dynamic> map) => Service(
        id: parseStringOr(map['id']),
        eventId: parseStringOr(map['eventId']),
        theme: parseString(map['theme']),
        serviceTime: parseStringOr(map['serviceTime']),
        programNotes: parseString(map['programNotes']),
        attendanceCount: parseInt(map['attendanceCount']),
        isArchived: parseBool(map['isArchived']),
        autoProvisioned: parseBool(map['autoProvisioned']),
        rotaOpenNotifiedAt: parseDate(map['rotaOpenNotifiedAt']),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

  final String id;
  final String eventId;
  final String? theme;
  final String serviceTime;
  final String? programNotes;
  final int? attendanceCount;
  final bool isArchived;

  /// True when the rota was opened automatically ahead of the Sunday.
  final bool autoProvisioned;

  /// Set once department heads were told the rota is open.
  final DateTime? rotaOpenNotifiedAt;

  final DateTime createdAt;
  final DateTime updatedAt;
}

/// A role a member is assigned on a service. Mirrors `ServiceAssignment`.
class ServiceAssignment {
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
        id: parseStringOr(map['id']),
        serviceId: parseStringOr(map['serviceId']),
        roleId: parseStringOr(map['roleId']),
        roleName: parseStringOr(map['roleName']),
        userId: parseStringOr(map['userId']),
        userName: parseStringOr(map['userName']),
        userEmail: parseStringOr(map['userEmail']),
        userPhone: parseString(map['userPhone']),
        status: AssignmentStatus.fromWire(map['status']),
        emailSent: parseBool(map['emailSent']),
        emailSentAt: parseDate(map['emailSentAt']),
        confirmedAt: parseDate(map['confirmedAt']),
        notes: parseString(map['notes']),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

  final String id;
  final String serviceId;
  final String roleId;
  final String roleName;
  final String userId;
  final String userName;
  final String userEmail;
  final String? userPhone;
  final AssignmentStatus status;
  final bool emailSent;
  final DateTime? emailSentAt;
  final DateTime? confirmedAt;
  final String? notes;
  final DateTime createdAt;
  final DateTime updatedAt;
}

/// A role that can be assigned on a service. Mirrors `ServiceRole`.
class ServiceRole {
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
        id: parseStringOr(map['id']),
        name: parseStringOr(map['name']),
        departmentId: parseStringOr(map['departmentId']),
        description: parseString(map['description']),
        emailSubject: parseStringOr(map['emailSubject']),
        emailBody: parseStringOr(map['emailBody']),
        reminderSchedule: (map['reminderSchedule'] is List)
            ? (map['reminderSchedule'] as List)
                .map(ReminderDay.fromWireOrNull)
                .whereType<ReminderDay>()
                .toList()
            : const [],
        arrivalTime: parseString(map['arrivalTime']),
        timeSlot: parseString(map['timeSlot']),
        order: parseIntOr(map['order']),
      );

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
}

/// A pre-service checklist item. Mirrors `ChecklistItem`.
class ChecklistItem {
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
        id: parseStringOr(map['id']),
        serviceId: parseStringOr(map['serviceId']),
        task: parseStringOr(map['task']),
        category: parseStringOr(map['category'], 'General'),
        isCompleted: parseBool(map['isCompleted']),
        completedBy: parseString(map['completedBy']),
        order: parseIntOr(map['order']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

  final String id;
  final String serviceId;
  final String task;
  final String category;
  final bool isCompleted;
  final String? completedBy;
  final int order;
  final DateTime updatedAt;
}

/// A member's stated availability for a date. Mirrors `UserAvailability`.
class UserAvailability {
  const UserAvailability({
    required this.date,
    required this.available,
    this.reason,
  });

  factory UserAvailability.fromMap(Map<String, dynamic> map) =>
      UserAvailability(
        date: parseStringOr(map['date']),
        available: parseBool(map['available'], fallback: true),
        reason: parseString(map['reason']),
      );

  /// yyyy-MM-dd.
  final String date;
  final bool available;
  final String? reason;

  Map<String, dynamic> toMap() =>
      {'date': date, 'available': available, 'reason': reason};
}
