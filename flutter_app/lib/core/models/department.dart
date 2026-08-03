import '../firestore/converters.dart';

class Department {
  final String id;
  final String name;
  final String? description;
  final String icon;
  final int order;
  final DateTime createdAt;

  const Department({
    required this.id,
    required this.name,
    this.description,
    this.icon = '',
    this.order = 0,
    required this.createdAt,
  });

  factory Department.fromMap(Map<String, dynamic> map) => Department(
        id: asString(map['id']),
        name: asString(map['name']),
        description: asStringOrNull(map['description']),
        icon: asString(map['icon']),
        order: asInt(map['order']),
        createdAt: parseDate(map['createdAt']),
      );
}

class DepartmentJoinRequestStatus {
  static const pendingManager = 'PENDING_MANAGER';
  static const pendingChair = 'PENDING_CHAIR';
  static const approved = 'APPROVED';
  static const rejected = 'REJECTED';
  static const cancelled = 'CANCELLED';
}

class StatusHistoryEntry {
  final String status;
  final String changedBy;
  final String changedByName;
  final DateTime changedAt;
  final String? comments;

  const StatusHistoryEntry({
    required this.status,
    required this.changedBy,
    required this.changedByName,
    required this.changedAt,
    this.comments,
  });

  factory StatusHistoryEntry.fromMap(Map<String, dynamic> map) =>
      StatusHistoryEntry(
        status: asString(map['status']),
        changedBy: asString(map['changedBy']),
        changedByName: asString(map['changedByName']),
        changedAt: parseDate(map['changedAt']),
        comments: asStringOrNull(map['comments']),
      );

  static List<StatusHistoryEntry> listFrom(dynamic value) =>
      asMapList(value).map(StatusHistoryEntry.fromMap).toList();
}

class DepartmentJoinRequest {
  final String id;
  final String departmentId;
  final String departmentName;
  final String userId;
  final String userName;
  final String? userEmail;
  final String? message;
  final String status;
  final String? managerId;
  final String? managerName;
  final DateTime? managerDecidedAt;
  final String? managerComments;
  final String? chairId;
  final String? chairName;
  final DateTime? chairDecidedAt;
  final String? chairComments;
  final List<StatusHistoryEntry> statusHistory;
  final DateTime createdAt;
  final DateTime updatedAt;

  const DepartmentJoinRequest({
    required this.id,
    required this.departmentId,
    required this.departmentName,
    required this.userId,
    required this.userName,
    this.userEmail,
    this.message,
    required this.status,
    this.managerId,
    this.managerName,
    this.managerDecidedAt,
    this.managerComments,
    this.chairId,
    this.chairName,
    this.chairDecidedAt,
    this.chairComments,
    this.statusHistory = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  factory DepartmentJoinRequest.fromMap(Map<String, dynamic> map) =>
      DepartmentJoinRequest(
        id: asString(map['id']),
        departmentId: asString(map['departmentId']),
        departmentName: asString(map['departmentName']),
        userId: asString(map['userId']),
        userName: asString(map['userName']),
        userEmail: asStringOrNull(map['userEmail']),
        message: asStringOrNull(map['message']),
        status: asString(map['status']),
        managerId: asStringOrNull(map['managerId']),
        managerName: asStringOrNull(map['managerName']),
        managerDecidedAt: parseDateOrNull(map['managerDecidedAt']),
        managerComments: asStringOrNull(map['managerComments']),
        chairId: asStringOrNull(map['chairId']),
        chairName: asStringOrNull(map['chairName']),
        chairDecidedAt: parseDateOrNull(map['chairDecidedAt']),
        chairComments: asStringOrNull(map['chairComments']),
        statusHistory: StatusHistoryEntry.listFrom(map['statusHistory']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class TaskStatus {
  static const todo = 'TODO';
  static const inProgress = 'IN_PROGRESS';
  static const done = 'DONE';
}

class TaskPriority {
  static const low = 'LOW';
  static const medium = 'MEDIUM';
  static const high = 'HIGH';
  static const urgent = 'URGENT';
}

class DepartmentTask {
  final String id;
  final String departmentId;
  final String title;
  final String? description;
  final String status;
  final String priority;
  final String? assigneeId;
  final String? assigneeName;
  final DateTime? dueDate;
  final String createdBy;
  final String createdByName;
  final DateTime? completedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  const DepartmentTask({
    required this.id,
    required this.departmentId,
    required this.title,
    this.description,
    required this.status,
    required this.priority,
    this.assigneeId,
    this.assigneeName,
    this.dueDate,
    required this.createdBy,
    required this.createdByName,
    this.completedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory DepartmentTask.fromMap(Map<String, dynamic> map) => DepartmentTask(
        id: asString(map['id']),
        departmentId: asString(map['departmentId']),
        title: asString(map['title']),
        description: asStringOrNull(map['description']),
        status: asString(map['status'], TaskStatus.todo),
        priority: asString(map['priority'], TaskPriority.medium),
        assigneeId: asStringOrNull(map['assigneeId']),
        assigneeName: asStringOrNull(map['assigneeName']),
        dueDate: parseDateOrNull(map['dueDate']),
        createdBy: asString(map['createdBy']),
        createdByName: asString(map['createdByName']),
        completedAt: parseDateOrNull(map['completedAt']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}
