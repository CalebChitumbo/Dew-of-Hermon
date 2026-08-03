import '../../core/utils/firestore_parse.dart';
import 'camp.dart' show StatusHistoryEntry;
import 'enums.dart';

/// The five stakeholder queues share a shape: an event raised a need, someone
/// with the right permission acts on it, and every step is recorded. This is
/// the common part, so the queue screen can render any of them.
abstract class StakeholderRequest {
  const StakeholderRequest({
    required this.id,
    required this.eventId,
    required this.eventTitle,
    required this.eventStartDate,
    required this.statusWire,
    required this.statusLabel,
    required this.createdAt,
    required this.updatedAt,
    this.needsDescription,
    this.statusHistory = const [],
  });

  final String id;
  final String eventId;
  final String eventTitle;
  final DateTime eventStartDate;

  /// The raw status, so a screen can compare against the domain enum.
  final String statusWire;
  final String statusLabel;

  final String? needsDescription;
  final List<StatusHistoryEntry> statusHistory;
  final DateTime createdAt;
  final DateTime updatedAt;

  /// True while this request is waiting on someone.
  bool get isPending => statusWire.startsWith('PENDING');
}

class TransportRequest extends StakeholderRequest {
  const TransportRequest({
    required super.id,
    required super.eventId,
    required super.eventTitle,
    required super.eventStartDate,
    required this.status,
    required super.createdAt,
    required super.updatedAt,
    super.needsDescription,
    super.statusHistory,
    this.vehicleType,
    this.vehicleCount,
    this.estimatedCost,
    this.currency,
    this.pickupLocation,
    this.dropoffLocation,
    this.pickupTime,
    this.returnTime,
    this.coordinatorNotes,
    this.treasurerName,
    this.treasurerComments,
    this.treasurerDecidedAt,
  }) : super(statusWire: '', statusLabel: '');

  factory TransportRequest.fromMap(Map<String, dynamic> map) {
    final status = TransportRequestStatus.fromWire(map['status']);
    return TransportRequest(
      id: parseStringOr(map['id']),
      eventId: parseStringOr(map['eventId']),
      eventTitle: parseStringOr(map['eventTitle'], 'Event'),
      eventStartDate: parseDateOr(map['eventStartDate']),
      status: status,
      needsDescription: parseString(map['needsDescription']),
      vehicleType: parseString(map['vehicleType']),
      vehicleCount: parseInt(map['vehicleCount']),
      estimatedCost: parseDouble(map['estimatedCost']),
      currency: parseString(map['currency']),
      pickupLocation: parseString(map['pickupLocation']),
      dropoffLocation: parseString(map['dropoffLocation']),
      pickupTime: parseDate(map['pickupTime']),
      returnTime: parseDate(map['returnTime']),
      coordinatorNotes: parseString(map['coordinatorNotes']),
      treasurerName: parseString(map['treasurerName']),
      treasurerComments: parseString(map['treasurerComments']),
      treasurerDecidedAt: parseDate(map['treasurerDecidedAt']),
      statusHistory: parseMapList(map['statusHistory'])
          .map(StatusHistoryEntry.fromMap)
          .toList(),
      createdAt: parseDateOr(map['createdAt']),
      updatedAt: parseDateOr(map['updatedAt']),
    );
  }

  final TransportRequestStatus status;
  final String? vehicleType;
  final int? vehicleCount;
  final double? estimatedCost;
  final String? currency;
  final String? pickupLocation;
  final String? dropoffLocation;
  final DateTime? pickupTime;
  final DateTime? returnTime;
  final String? coordinatorNotes;
  final String? treasurerName;
  final String? treasurerComments;
  final DateTime? treasurerDecidedAt;

  @override
  String get statusWire => status.wire;

  @override
  String get statusLabel => status.label;

  /// The coordinator still has to price this before the Treasurer sees it.
  bool get awaitingDetails =>
      status == TransportRequestStatus.pendingDetails;
}

class MediaRequest extends StakeholderRequest {
  const MediaRequest({
    required super.id,
    required super.eventId,
    required super.eventTitle,
    required super.eventStartDate,
    required this.status,
    required super.createdAt,
    required super.updatedAt,
    super.needsDescription,
    super.statusHistory,
    this.soundUserName,
    this.publicityUserName,
    this.coverageUserName,
    this.coordinatorNotes,
    this.confirmedByName,
    this.confirmedAt,
  }) : super(statusWire: '', statusLabel: '');

  factory MediaRequest.fromMap(Map<String, dynamic> map) => MediaRequest(
        id: parseStringOr(map['id']),
        eventId: parseStringOr(map['eventId']),
        eventTitle: parseStringOr(map['eventTitle'], 'Event'),
        eventStartDate: parseDateOr(map['eventStartDate']),
        status: MediaRequestStatus.fromWire(map['status']),
        needsDescription: parseString(map['needsDescription']),
        soundUserName: parseString(map['soundUserName']),
        publicityUserName: parseString(map['publicityUserName']),
        coverageUserName: parseString(map['coverageUserName']),
        coordinatorNotes: parseString(map['coordinatorNotes']),
        confirmedByName: parseString(map['confirmedByName']),
        confirmedAt: parseDate(map['confirmedAt']),
        statusHistory: parseMapList(map['statusHistory'])
            .map(StatusHistoryEntry.fromMap)
            .toList(),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

  final MediaRequestStatus status;
  final String? soundUserName;
  final String? publicityUserName;
  final String? coverageUserName;
  final String? coordinatorNotes;
  final String? confirmedByName;
  final DateTime? confirmedAt;

  @override
  String get statusWire => status.wire;

  @override
  String get statusLabel => status.label;
}

class FoodRequest extends StakeholderRequest {
  const FoodRequest({
    required super.id,
    required super.eventId,
    required super.eventTitle,
    required super.eventStartDate,
    required this.status,
    required super.createdAt,
    required super.updatedAt,
    super.needsDescription,
    super.statusHistory,
    this.headcount,
    this.menuPlan,
    this.coordinatorNotes,
    this.budgetRequestId,
    this.confirmedByName,
    this.confirmedAt,
  }) : super(statusWire: '', statusLabel: '');

  factory FoodRequest.fromMap(Map<String, dynamic> map) => FoodRequest(
        id: parseStringOr(map['id']),
        eventId: parseStringOr(map['eventId']),
        eventTitle: parseStringOr(map['eventTitle'], 'Event'),
        eventStartDate: parseDateOr(map['eventStartDate']),
        status: FoodRequestStatus.fromWire(map['status']),
        needsDescription: parseString(map['needsDescription']),
        headcount: parseInt(map['headcount']),
        menuPlan: parseString(map['menuPlan']),
        coordinatorNotes: parseString(map['coordinatorNotes']),
        budgetRequestId: parseString(map['budgetRequestId']),
        confirmedByName: parseString(map['confirmedByName']),
        confirmedAt: parseDate(map['confirmedAt']),
        statusHistory: parseMapList(map['statusHistory'])
            .map(StatusHistoryEntry.fromMap)
            .toList(),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

  final FoodRequestStatus status;
  final int? headcount;
  final String? menuPlan;
  final String? coordinatorNotes;
  final String? budgetRequestId;
  final String? confirmedByName;
  final DateTime? confirmedAt;

  @override
  String get statusWire => status.wire;

  @override
  String get statusLabel => status.label;
}

class BudgetRequest extends StakeholderRequest {
  const BudgetRequest({
    required super.id,
    required super.eventId,
    required super.eventTitle,
    required super.eventStartDate,
    required this.status,
    required this.requestedAmount,
    required this.currency,
    required this.purpose,
    required this.requestedByName,
    required super.createdAt,
    required super.updatedAt,
    super.statusHistory,
    this.approvedAmount,
    this.treasurerName,
    this.treasurerComments,
    this.treasurerDecidedAt,
  }) : super(statusWire: '', statusLabel: '');

  factory BudgetRequest.fromMap(Map<String, dynamic> map) => BudgetRequest(
        id: parseStringOr(map['id']),
        eventId: parseStringOr(map['eventId']),
        eventTitle: parseStringOr(map['eventTitle'], 'Event'),
        eventStartDate: parseDateOr(map['eventStartDate']),
        status: BudgetRequestStatus.fromWire(map['status']),
        requestedAmount: parseDoubleOr(map['requestedAmount']),
        currency: parseStringOr(map['currency'], 'ZMW'),
        purpose: parseStringOr(map['purpose']),
        requestedByName: parseStringOr(map['requestedByName']),
        approvedAmount: parseDouble(map['approvedAmount']),
        treasurerName: parseString(map['treasurerName']),
        treasurerComments: parseString(map['treasurerComments']),
        treasurerDecidedAt: parseDate(map['treasurerDecidedAt']),
        statusHistory: parseMapList(map['statusHistory'])
            .map(StatusHistoryEntry.fromMap)
            .toList(),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

  final BudgetRequestStatus status;
  final double requestedAmount;
  final String currency;
  final String purpose;
  final String requestedByName;
  final double? approvedAmount;
  final String? treasurerName;
  final String? treasurerComments;
  final DateTime? treasurerDecidedAt;

  @override
  String get statusWire => status.wire;

  @override
  String get statusLabel => status.label;
}

/// A member's request to join a department, and its two-stage approval.
class DepartmentJoinRequest {
  const DepartmentJoinRequest({
    required this.id,
    required this.departmentId,
    required this.departmentName,
    required this.userId,
    required this.userName,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.userEmail,
    this.message,
    this.managerName,
    this.managerComments,
    this.managerDecidedAt,
    this.chairName,
    this.chairComments,
    this.chairDecidedAt,
    this.statusHistory = const [],
  });

  factory DepartmentJoinRequest.fromMap(Map<String, dynamic> map) =>
      DepartmentJoinRequest(
        id: parseStringOr(map['id']),
        departmentId: parseStringOr(map['departmentId']),
        departmentName: parseStringOr(map['departmentName'], 'Department'),
        userId: parseStringOr(map['userId']),
        userName: parseStringOr(map['userName']),
        userEmail: parseString(map['userEmail']),
        message: parseString(map['message']),
        status: DepartmentJoinRequestStatus.fromWire(map['status']),
        managerName: parseString(map['managerName']),
        managerComments: parseString(map['managerComments']),
        managerDecidedAt: parseDate(map['managerDecidedAt']),
        chairName: parseString(map['chairName']),
        chairComments: parseString(map['chairComments']),
        chairDecidedAt: parseDate(map['chairDecidedAt']),
        statusHistory: parseMapList(map['statusHistory'])
            .map(StatusHistoryEntry.fromMap)
            .toList(),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

  final String id;
  final String departmentId;
  final String departmentName;
  final String userId;
  final String userName;
  final String? userEmail;
  final String? message;
  final DepartmentJoinRequestStatus status;
  final String? managerName;
  final String? managerComments;
  final DateTime? managerDecidedAt;
  final String? chairName;
  final String? chairComments;
  final DateTime? chairDecidedAt;
  final List<StatusHistoryEntry> statusHistory;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get awaitingManager =>
      status == DepartmentJoinRequestStatus.pendingManager;
  bool get awaitingChair =>
      status == DepartmentJoinRequestStatus.pendingChair;
}

/// A post-event report. Mirrors `EventReport`.
class EventReport {
  const EventReport({
    required this.id,
    required this.eventId,
    required this.eventTitle,
    required this.eventStartDate,
    required this.eventType,
    required this.initiatorId,
    required this.initiatorName,
    required this.status,
    required this.highlights,
    required this.challenges,
    required this.lessonsLearned,
    required this.recommendations,
    required this.createdAt,
    required this.updatedAt,
    this.eventEndDate,
    this.initiatorEmail,
    this.attendanceCount,
    this.objectivesMetRating,
    this.budget,
    this.actualSpend,
    this.financeNotes,
    this.mediaLink,
    this.additionalComments,
    this.submittedAt,
    this.reviewedByName,
    this.reviewedAt,
    this.reviewComments,
  });

  factory EventReport.fromMap(Map<String, dynamic> map) {
    final finances = parseMap(map['finances']);
    return EventReport(
      id: parseStringOr(map['id']),
      eventId: parseStringOr(map['eventId']),
      eventTitle: parseStringOr(map['eventTitle'], 'Event'),
      eventStartDate: parseDateOr(map['eventStartDate']),
      eventEndDate: parseDate(map['eventEndDate']),
      eventType: EventType.fromWire(map['eventType']),
      initiatorId: parseStringOr(map['initiatorId']),
      initiatorName: parseStringOr(map['initiatorName']),
      initiatorEmail: parseString(map['initiatorEmail']),
      attendanceCount: parseInt(map['attendanceCount']),
      objectivesMetRating: parseInt(map['objectivesMetRating']),
      highlights: parseStringOr(map['highlights']),
      challenges: parseStringOr(map['challenges']),
      lessonsLearned: parseStringOr(map['lessonsLearned']),
      recommendations: parseStringOr(map['recommendations']),
      budget: parseDouble(finances['budget']),
      actualSpend: parseDouble(finances['actualSpend']),
      financeNotes: parseString(finances['notes']),
      mediaLink: parseString(map['mediaLink']),
      additionalComments: parseString(map['additionalComments']),
      status: EventReportStatus.fromWire(map['status']),
      submittedAt: parseDate(map['submittedAt']),
      reviewedByName: parseString(map['reviewedByName']),
      reviewedAt: parseDate(map['reviewedAt']),
      reviewComments: parseString(map['reviewComments']),
      createdAt: parseDateOr(map['createdAt']),
      updatedAt: parseDateOr(map['updatedAt']),
    );
  }

  final String id;
  final String eventId;
  final String eventTitle;
  final DateTime eventStartDate;
  final DateTime? eventEndDate;
  final EventType eventType;
  final String initiatorId;
  final String initiatorName;
  final String? initiatorEmail;
  final int? attendanceCount;

  /// 1–5.
  final int? objectivesMetRating;

  final String highlights;
  final String challenges;
  final String lessonsLearned;
  final String recommendations;
  final double? budget;
  final double? actualSpend;
  final String? financeNotes;
  final String? mediaLink;
  final String? additionalComments;
  final EventReportStatus status;
  final DateTime? submittedAt;
  final String? reviewedByName;
  final DateTime? reviewedAt;
  final String? reviewComments;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get isEditable =>
      status == EventReportStatus.draft ||
      status == EventReportStatus.changesRequested;

  double? get variance =>
      (budget == null || actualSpend == null) ? null : actualSpend! - budget!;
}
