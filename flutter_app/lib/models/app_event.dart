import '../core/firebase_helpers.dart';
import 'enums.dart';

class EventCoreRole {
  EventCoreRole({
    required this.role,
    this.assignedUserId,
    this.assignedUserName,
  });

  final String role;
  final String? assignedUserId;
  final String? assignedUserName;

  factory EventCoreRole.fromMap(Map<String, dynamic> data) => EventCoreRole(
        role: data['role'] as String? ?? '',
        assignedUserId: data['assignedUserId'] as String?,
        assignedUserName: data['assignedUserName'] as String?,
      );

  Map<String, dynamic> toMap() => {
        'role': role,
        'assignedUserId': assignedUserId,
        'assignedUserName': assignedUserName,
      };
}

class AppEvent {
  AppEvent({
    required this.id,
    required this.title,
    required this.type,
    required this.startDate,
    required this.venue,
    required this.isRecurring,
    required this.createdBy,
    required this.approvalStatus,
    required this.coreRoles,
    required this.isPaid,
    required this.transportRequired,
    required this.budgetRequested,
    required this.createdAt,
    required this.updatedAt,
    this.description,
    this.endDate,
    this.lifeGroupTarget,
    this.approvalComments,
    this.approvedBy,
    this.approvedAt,
    this.createdByDepartmentId,
    this.speaker,
    this.objective,
    this.attendanceFee,
    this.attendanceFeeCurrency,
    this.transportNeeds,
    this.transportRequestId,
    this.budgetAmount,
    this.budgetCurrency,
    this.budgetPurpose,
    this.budgetRequestId,
  });

  final String id;
  final String title;
  final String? description;
  final EventType type;
  final DateTime startDate;
  final DateTime? endDate;
  final String venue;
  final bool isRecurring;
  final String createdBy;
  /// One of [LifeGroup] names, the literal "ALL", or null.
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
  final num? attendanceFee;
  final String? attendanceFeeCurrency;
  final bool transportRequired;
  final String? transportNeeds;
  final String? transportRequestId;
  final bool budgetRequested;
  final num? budgetAmount;
  final String? budgetCurrency;
  final String? budgetPurpose;
  final String? budgetRequestId;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory AppEvent.fromMap(String id, Map<String, dynamic> data) {
    final rolesRaw = data['coreRoles'];
    final roles = rolesRaw is List
        ? rolesRaw
            .whereType<Map<String, dynamic>>()
            .map(EventCoreRole.fromMap)
            .toList()
        : <EventCoreRole>[];

    return AppEvent(
      id: id,
      title: data['title'] as String? ?? '',
      description: data['description'] as String?,
      type: parseEnum(
        data['type'],
        EventType.values,
        EventType.POTTERS_WHEEL_SERVICE,
      ),
      startDate: readTimestampOrNow(data['startDate']),
      endDate: readTimestamp(data['endDate']),
      venue: data['venue'] as String? ?? '',
      isRecurring: data['isRecurring'] as bool? ?? false,
      createdBy: data['createdBy'] as String? ?? '',
      lifeGroupTarget: data['lifeGroupTarget'] as String?,
      approvalStatus: parseEnum(
        data['approvalStatus'],
        EventApprovalStatus.values,
        EventApprovalStatus.DRAFT,
      ),
      approvalComments: data['approvalComments'] as String?,
      approvedBy: data['approvedBy'] as String?,
      approvedAt: readTimestamp(data['approvedAt']),
      createdByDepartmentId: data['createdByDepartmentId'] as String?,
      coreRoles: roles,
      speaker: data['speaker'] as String?,
      objective: data['objective'] as String?,
      isPaid: data['isPaid'] as bool? ?? false,
      attendanceFee: data['attendanceFee'] as num?,
      attendanceFeeCurrency: data['attendanceFeeCurrency'] as String?,
      transportRequired: data['transportRequired'] as bool? ?? false,
      transportNeeds: data['transportNeeds'] as String?,
      transportRequestId: data['transportRequestId'] as String?,
      budgetRequested: data['budgetRequested'] as bool? ?? false,
      budgetAmount: data['budgetAmount'] as num?,
      budgetCurrency: data['budgetCurrency'] as String?,
      budgetPurpose: data['budgetPurpose'] as String?,
      budgetRequestId: data['budgetRequestId'] as String?,
      createdAt: readTimestampOrNow(data['createdAt']),
      updatedAt: readTimestampOrNow(data['updatedAt']),
    );
  }
}
