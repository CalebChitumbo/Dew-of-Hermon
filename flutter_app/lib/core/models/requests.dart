import '../firestore/converters.dart';
import 'department.dart' show StatusHistoryEntry;

class TransportRequestStatus {
  static const pendingDetails = 'PENDING_DETAILS';
  static const pendingTreasurer = 'PENDING_TREASURER';
  static const approved = 'APPROVED';
  static const rejectedTreasurer = 'REJECTED_TREASURER';
  static const cancelled = 'CANCELLED';
}

class TransportRequest {
  final String id;
  final String eventId;
  final String eventTitle;
  final DateTime eventStartDate;
  final String needsDescription;
  final String status;
  final String? vehicleType;
  final int? vehicleCount;
  final double? estimatedCost;
  final String? currency;
  final String? pickupLocation;
  final String? dropoffLocation;
  final DateTime? pickupTime;
  final DateTime? returnTime;
  final String? coordinatorNotes;
  final String? routedBy;
  final String? routedByName;
  final DateTime? routedAt;
  final String? filledBy;
  final String? filledByName;
  final DateTime? filledAt;
  final String? treasurerId;
  final String? treasurerName;
  final DateTime? treasurerDecidedAt;
  final String? treasurerComments;
  final List<StatusHistoryEntry> statusHistory;
  final DateTime createdAt;
  final DateTime updatedAt;

  const TransportRequest({
    required this.id,
    required this.eventId,
    required this.eventTitle,
    required this.eventStartDate,
    required this.needsDescription,
    required this.status,
    this.vehicleType,
    this.vehicleCount,
    this.estimatedCost,
    this.currency,
    this.pickupLocation,
    this.dropoffLocation,
    this.pickupTime,
    this.returnTime,
    this.coordinatorNotes,
    this.routedBy,
    this.routedByName,
    this.routedAt,
    this.filledBy,
    this.filledByName,
    this.filledAt,
    this.treasurerId,
    this.treasurerName,
    this.treasurerDecidedAt,
    this.treasurerComments,
    this.statusHistory = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  factory TransportRequest.fromMap(Map<String, dynamic> map) =>
      TransportRequest(
        id: asString(map['id']),
        eventId: asString(map['eventId']),
        eventTitle: asString(map['eventTitle']),
        eventStartDate: parseDate(map['eventStartDate']),
        needsDescription: asString(map['needsDescription']),
        status: asString(map['status'], TransportRequestStatus.pendingDetails),
        vehicleType: asStringOrNull(map['vehicleType']),
        vehicleCount: asIntOrNull(map['vehicleCount']),
        estimatedCost: asDoubleOrNull(map['estimatedCost']),
        currency: asStringOrNull(map['currency']),
        pickupLocation: asStringOrNull(map['pickupLocation']),
        dropoffLocation: asStringOrNull(map['dropoffLocation']),
        pickupTime: parseDateOrNull(map['pickupTime']),
        returnTime: parseDateOrNull(map['returnTime']),
        coordinatorNotes: asStringOrNull(map['coordinatorNotes']),
        routedBy: asStringOrNull(map['routedBy']),
        routedByName: asStringOrNull(map['routedByName']),
        routedAt: parseDateOrNull(map['routedAt']),
        filledBy: asStringOrNull(map['filledBy']),
        filledByName: asStringOrNull(map['filledByName']),
        filledAt: parseDateOrNull(map['filledAt']),
        treasurerId: asStringOrNull(map['treasurerId']),
        treasurerName: asStringOrNull(map['treasurerName']),
        treasurerDecidedAt: parseDateOrNull(map['treasurerDecidedAt']),
        treasurerComments: asStringOrNull(map['treasurerComments']),
        statusHistory: StatusHistoryEntry.listFrom(map['statusHistory']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class BudgetRequestStatus {
  static const pendingTreasurer = 'PENDING_TREASURER';
  static const approved = 'APPROVED';
  static const rejected = 'REJECTED';
  static const cancelled = 'CANCELLED';
}

class BudgetRequest {
  final String id;
  final String eventId;
  final String eventTitle;
  final DateTime eventStartDate;
  final double requestedAmount;
  final String currency;
  final String purpose;
  final String requestedBy;
  final String requestedByName;
  final String status;
  final double? approvedAmount;
  final String? treasurerId;
  final String? treasurerName;
  final DateTime? treasurerDecidedAt;
  final String? treasurerComments;
  final List<StatusHistoryEntry> statusHistory;
  final DateTime createdAt;
  final DateTime updatedAt;

  const BudgetRequest({
    required this.id,
    required this.eventId,
    required this.eventTitle,
    required this.eventStartDate,
    required this.requestedAmount,
    required this.currency,
    required this.purpose,
    required this.requestedBy,
    required this.requestedByName,
    required this.status,
    this.approvedAmount,
    this.treasurerId,
    this.treasurerName,
    this.treasurerDecidedAt,
    this.treasurerComments,
    this.statusHistory = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  factory BudgetRequest.fromMap(Map<String, dynamic> map) => BudgetRequest(
        id: asString(map['id']),
        eventId: asString(map['eventId']),
        eventTitle: asString(map['eventTitle']),
        eventStartDate: parseDate(map['eventStartDate']),
        requestedAmount: asDouble(map['requestedAmount']),
        currency: asString(map['currency'], 'ZMW'),
        purpose: asString(map['purpose']),
        requestedBy: asString(map['requestedBy']),
        requestedByName: asString(map['requestedByName']),
        status: asString(map['status'], BudgetRequestStatus.pendingTreasurer),
        approvedAmount: asDoubleOrNull(map['approvedAmount']),
        treasurerId: asStringOrNull(map['treasurerId']),
        treasurerName: asStringOrNull(map['treasurerName']),
        treasurerDecidedAt: parseDateOrNull(map['treasurerDecidedAt']),
        treasurerComments: asStringOrNull(map['treasurerComments']),
        statusHistory: StatusHistoryEntry.listFrom(map['statusHistory']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class MediaRequestStatus {
  static const pendingMedia = 'PENDING_MEDIA';
  static const confirmed = 'CONFIRMED';
  static const declined = 'DECLINED';
  static const cancelled = 'CANCELLED';
}

class MediaRequest {
  final String id;
  final String eventId;
  final String eventTitle;
  final DateTime eventStartDate;
  final String needsDescription;
  final String status;
  final String? soundUserId;
  final String? soundUserName;
  final String? publicityUserId;
  final String? publicityUserName;
  final String? coverageUserId;
  final String? coverageUserName;
  final String? coordinatorNotes;
  final String? routedBy;
  final String? routedByName;
  final DateTime? routedAt;
  final String? confirmedBy;
  final String? confirmedByName;
  final DateTime? confirmedAt;
  final List<StatusHistoryEntry> statusHistory;
  final DateTime createdAt;
  final DateTime updatedAt;

  const MediaRequest({
    required this.id,
    required this.eventId,
    required this.eventTitle,
    required this.eventStartDate,
    required this.needsDescription,
    required this.status,
    this.soundUserId,
    this.soundUserName,
    this.publicityUserId,
    this.publicityUserName,
    this.coverageUserId,
    this.coverageUserName,
    this.coordinatorNotes,
    this.routedBy,
    this.routedByName,
    this.routedAt,
    this.confirmedBy,
    this.confirmedByName,
    this.confirmedAt,
    this.statusHistory = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  factory MediaRequest.fromMap(Map<String, dynamic> map) => MediaRequest(
        id: asString(map['id']),
        eventId: asString(map['eventId']),
        eventTitle: asString(map['eventTitle']),
        eventStartDate: parseDate(map['eventStartDate']),
        needsDescription: asString(map['needsDescription']),
        status: asString(map['status'], MediaRequestStatus.pendingMedia),
        soundUserId: asStringOrNull(map['soundUserId']),
        soundUserName: asStringOrNull(map['soundUserName']),
        publicityUserId: asStringOrNull(map['publicityUserId']),
        publicityUserName: asStringOrNull(map['publicityUserName']),
        coverageUserId: asStringOrNull(map['coverageUserId']),
        coverageUserName: asStringOrNull(map['coverageUserName']),
        coordinatorNotes: asStringOrNull(map['coordinatorNotes']),
        routedBy: asStringOrNull(map['routedBy']),
        routedByName: asStringOrNull(map['routedByName']),
        routedAt: parseDateOrNull(map['routedAt']),
        confirmedBy: asStringOrNull(map['confirmedBy']),
        confirmedByName: asStringOrNull(map['confirmedByName']),
        confirmedAt: parseDateOrNull(map['confirmedAt']),
        statusHistory: StatusHistoryEntry.listFrom(map['statusHistory']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class FoodRequestStatus {
  static const pendingFood = 'PENDING_FOOD';
  static const confirmed = 'CONFIRMED';
  static const declined = 'DECLINED';
  static const cancelled = 'CANCELLED';
}

class FoodRequest {
  final String id;
  final String eventId;
  final String eventTitle;
  final DateTime eventStartDate;
  final String needsDescription;
  final String status;
  final int? headcount;
  final String? menuPlan;
  final String? coordinatorNotes;
  final String? budgetRequestId;
  final String? routedBy;
  final String? routedByName;
  final DateTime? routedAt;
  final String? confirmedBy;
  final String? confirmedByName;
  final DateTime? confirmedAt;
  final List<StatusHistoryEntry> statusHistory;
  final DateTime createdAt;
  final DateTime updatedAt;

  const FoodRequest({
    required this.id,
    required this.eventId,
    required this.eventTitle,
    required this.eventStartDate,
    required this.needsDescription,
    required this.status,
    this.headcount,
    this.menuPlan,
    this.coordinatorNotes,
    this.budgetRequestId,
    this.routedBy,
    this.routedByName,
    this.routedAt,
    this.confirmedBy,
    this.confirmedByName,
    this.confirmedAt,
    this.statusHistory = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  factory FoodRequest.fromMap(Map<String, dynamic> map) => FoodRequest(
        id: asString(map['id']),
        eventId: asString(map['eventId']),
        eventTitle: asString(map['eventTitle']),
        eventStartDate: parseDate(map['eventStartDate']),
        needsDescription: asString(map['needsDescription']),
        status: asString(map['status'], FoodRequestStatus.pendingFood),
        headcount: asIntOrNull(map['headcount']),
        menuPlan: asStringOrNull(map['menuPlan']),
        coordinatorNotes: asStringOrNull(map['coordinatorNotes']),
        budgetRequestId: asStringOrNull(map['budgetRequestId']),
        routedBy: asStringOrNull(map['routedBy']),
        routedByName: asStringOrNull(map['routedByName']),
        routedAt: parseDateOrNull(map['routedAt']),
        confirmedBy: asStringOrNull(map['confirmedBy']),
        confirmedByName: asStringOrNull(map['confirmedByName']),
        confirmedAt: parseDateOrNull(map['confirmedAt']),
        statusHistory: StatusHistoryEntry.listFrom(map['statusHistory']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}
