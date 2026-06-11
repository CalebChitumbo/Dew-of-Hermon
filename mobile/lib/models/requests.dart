import '../core/fire.dart';

// Stakeholder request documents (budgetRequests / transportRequests /
// mediaRequests / foodRequests collections) — slim ports of the fields the
// coordinator queues display. Parsed from REST responses or Firestore maps;
// both serialize dates the converters in core/fire.dart understand.

class BudgetRequest {
  BudgetRequest({
    required this.id,
    required this.eventId,
    required this.eventTitle,
    required this.eventStartDate,
    required this.requestedAmount,
    required this.currency,
    required this.purpose,
    required this.requestedByName,
    required this.status,
    required this.approvedAmount,
    required this.treasurerName,
    required this.treasurerComments,
    required this.createdAt,
  });

  final String id;
  final String eventId;
  final String eventTitle;
  final DateTime? eventStartDate;
  final num requestedAmount;
  final String currency;
  final String purpose;
  final String requestedByName;
  final String status; // PENDING_TREASURER | APPROVED | REJECTED | CANCELLED
  final num? approvedAmount;
  final String? treasurerName;
  final String? treasurerComments;
  final DateTime? createdAt;

  bool get isPending => status == 'PENDING_TREASURER';

  factory BudgetRequest.fromJson(String id, Map<String, dynamic> m) {
    return BudgetRequest(
      id: id,
      eventId: asString(m['eventId']),
      eventTitle: asString(m['eventTitle'], 'Event'),
      eventStartDate: asDateOrNull(m['eventStartDate']),
      requestedAmount: asNumOrNull(m['requestedAmount']) ?? 0,
      currency: asString(m['currency'], 'ZMW'),
      purpose: asString(m['purpose']),
      requestedByName: asString(m['requestedByName']),
      status: asString(m['status'], 'PENDING_TREASURER'),
      approvedAmount: asNumOrNull(m['approvedAmount']),
      treasurerName: asStringOrNull(m['treasurerName']),
      treasurerComments: asStringOrNull(m['treasurerComments']),
      createdAt: asDateOrNull(m['createdAt']),
    );
  }
}

class TransportRequest {
  TransportRequest({
    required this.id,
    required this.eventId,
    required this.eventTitle,
    required this.eventStartDate,
    required this.needsDescription,
    required this.status,
    required this.vehicleType,
    required this.vehicleCount,
    required this.estimatedCost,
    required this.currency,
    required this.pickupLocation,
    required this.dropoffLocation,
    required this.pickupTime,
    required this.returnTime,
    required this.coordinatorNotes,
    required this.treasurerComments,
    required this.createdAt,
  });

  final String id;
  final String eventId;
  final String eventTitle;
  final DateTime? eventStartDate;
  final String needsDescription;
  // PENDING_DETAILS | PENDING_TREASURER | APPROVED | REJECTED_TREASURER | CANCELLED
  final String status;
  final String? vehicleType;
  final int? vehicleCount;
  final num? estimatedCost;
  final String? currency;
  final String? pickupLocation;
  final String? dropoffLocation;
  final DateTime? pickupTime;
  final DateTime? returnTime;
  final String? coordinatorNotes;
  final String? treasurerComments;
  final DateTime? createdAt;

  factory TransportRequest.fromJson(String id, Map<String, dynamic> m) {
    return TransportRequest(
      id: id,
      eventId: asString(m['eventId']),
      eventTitle: asString(m['eventTitle'], 'Event'),
      eventStartDate: asDateOrNull(m['eventStartDate']),
      needsDescription: asString(m['needsDescription']),
      status: asString(m['status'], 'PENDING_DETAILS'),
      vehicleType: asStringOrNull(m['vehicleType']),
      vehicleCount: asNumOrNull(m['vehicleCount'])?.toInt(),
      estimatedCost: asNumOrNull(m['estimatedCost']),
      currency: asStringOrNull(m['currency']),
      pickupLocation: asStringOrNull(m['pickupLocation']),
      dropoffLocation: asStringOrNull(m['dropoffLocation']),
      pickupTime: asDateOrNull(m['pickupTime']),
      returnTime: asDateOrNull(m['returnTime']),
      coordinatorNotes: asStringOrNull(m['coordinatorNotes']),
      treasurerComments: asStringOrNull(m['treasurerComments']),
      createdAt: asDateOrNull(m['createdAt']),
    );
  }
}

class MediaRequest {
  MediaRequest({
    required this.id,
    required this.eventId,
    required this.eventTitle,
    required this.eventStartDate,
    required this.needsDescription,
    required this.status,
    required this.soundUserName,
    required this.publicityUserName,
    required this.coverageUserName,
    required this.coordinatorNotes,
    required this.createdAt,
  });

  final String id;
  final String eventId;
  final String eventTitle;
  final DateTime? eventStartDate;
  final String needsDescription;
  final String status; // PENDING_MEDIA | CONFIRMED | DECLINED | CANCELLED
  final String? soundUserName;
  final String? publicityUserName;
  final String? coverageUserName;
  final String? coordinatorNotes;
  final DateTime? createdAt;

  factory MediaRequest.fromJson(String id, Map<String, dynamic> m) {
    return MediaRequest(
      id: id,
      eventId: asString(m['eventId']),
      eventTitle: asString(m['eventTitle'], 'Event'),
      eventStartDate: asDateOrNull(m['eventStartDate']),
      needsDescription: asString(m['needsDescription']),
      status: asString(m['status'], 'PENDING_MEDIA'),
      soundUserName: asStringOrNull(m['soundUserName']),
      publicityUserName: asStringOrNull(m['publicityUserName']),
      coverageUserName: asStringOrNull(m['coverageUserName']),
      coordinatorNotes: asStringOrNull(m['coordinatorNotes']),
      createdAt: asDateOrNull(m['createdAt']),
    );
  }
}

class FoodRequest {
  FoodRequest({
    required this.id,
    required this.eventId,
    required this.eventTitle,
    required this.eventStartDate,
    required this.needsDescription,
    required this.status,
    required this.headcount,
    required this.menuPlan,
    required this.coordinatorNotes,
    required this.budgetRequestId,
    required this.createdAt,
  });

  final String id;
  final String eventId;
  final String eventTitle;
  final DateTime? eventStartDate;
  final String needsDescription;
  final String status; // PENDING_FOOD | CONFIRMED | DECLINED | CANCELLED
  final int? headcount;
  final String? menuPlan;
  final String? coordinatorNotes;
  final String? budgetRequestId;
  final DateTime? createdAt;

  factory FoodRequest.fromJson(String id, Map<String, dynamic> m) {
    return FoodRequest(
      id: id,
      eventId: asString(m['eventId']),
      eventTitle: asString(m['eventTitle'], 'Event'),
      eventStartDate: asDateOrNull(m['eventStartDate']),
      needsDescription: asString(m['needsDescription']),
      status: asString(m['status'], 'PENDING_FOOD'),
      headcount: asNumOrNull(m['headcount'])?.toInt(),
      menuPlan: asStringOrNull(m['menuPlan']),
      coordinatorNotes: asStringOrNull(m['coordinatorNotes']),
      budgetRequestId: asStringOrNull(m['budgetRequestId']),
      createdAt: asDateOrNull(m['createdAt']),
    );
  }
}

/// Per-event stakeholder status bundle from
/// POST /api/events/stakeholder-statuses.
class StakeholderStatuses {
  StakeholderStatuses({this.transport, this.budget, this.media, this.food});

  final String? transport;
  final String? budget;
  final String? media;
  final String? food;

  factory StakeholderStatuses.fromJson(Map<String, dynamic> m) {
    return StakeholderStatuses(
      transport: asStringOrNull(m['transport']),
      budget: asStringOrNull(m['budget']),
      media: asStringOrNull(m['media']),
      food: asStringOrNull(m['food']),
    );
  }
}
