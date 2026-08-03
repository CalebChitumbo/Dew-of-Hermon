import '../firestore/converters.dart';

class EventType {
  static const pottersWheelService = 'POTTERS_WHEEL_SERVICE';
  static const ropsCamp = 'ROPS_CAMP';
  static const retreat = 'RETREAT';
  static const specialEvent = 'SPECIAL_EVENT';
  static const meeting = 'MEETING';
  static const outreach = 'OUTREACH';

  static const all = [
    pottersWheelService,
    ropsCamp,
    retreat,
    specialEvent,
    meeting,
    outreach,
  ];

  static const labels = <String, String>{
    pottersWheelService: "Potter's Wheel Service",
    ropsCamp: 'ROPs Camp',
    retreat: 'Retreat',
    specialEvent: 'Special Event',
    meeting: 'Meeting',
    outreach: 'Outreach',
  };
}

class EventApprovalStatus {
  static const draft = 'DRAFT';
  static const pendingDispatch = 'PENDING_DISPATCH';
  static const pendingStakeholders = 'PENDING_STAKEHOLDERS';
  static const pendingViceChair = 'PENDING_VICE_CHAIR';
  static const pendingChair = 'PENDING_CHAIR';
  static const approved = 'APPROVED';
  static const rejected = 'REJECTED';
  static const changesRequested = 'CHANGES_REQUESTED';
}

class EventCoreRole {
  final String role;
  final String? assignedUserId;
  final String? assignedUserName;

  const EventCoreRole({
    required this.role,
    this.assignedUserId,
    this.assignedUserName,
  });

  factory EventCoreRole.fromMap(Map<String, dynamic> map) => EventCoreRole(
        role: asString(map['role']),
        assignedUserId: asStringOrNull(map['assignedUserId']),
        assignedUserName: asStringOrNull(map['assignedUserName']),
      );

  Map<String, dynamic> toMap() => {
        'role': role,
        'assignedUserId': assignedUserId,
        'assignedUserName': assignedUserName,
      };

  static List<EventCoreRole> listFrom(dynamic value) =>
      asMapList(value).map(EventCoreRole.fromMap).toList();
}

class AppEvent {
  final String id;
  final String title;
  final String? description;
  final String type;
  final DateTime startDate;
  final DateTime? endDate;
  final String venue;
  final bool isRecurring;
  final String createdBy;
  final String? lifeGroupTarget; // BRIDGE | ANCHOR | CORNERSTONE | ALL | null
  final String approvalStatus;
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
  final String? viceChairApprovedBy;
  final DateTime? viceChairApprovedAt;
  final String? chairApprovedBy;
  final DateTime? chairApprovedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

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

  factory AppEvent.fromMap(Map<String, dynamic> map) => AppEvent(
        id: asString(map['id']),
        title: asString(map['title']),
        description: asStringOrNull(map['description']),
        type: asString(map['type'], EventType.specialEvent),
        startDate: parseDate(map['startDate']),
        endDate: parseDateOrNull(map['endDate']),
        venue: asString(map['venue']),
        isRecurring: asBool(map['isRecurring']),
        createdBy: asString(map['createdBy']),
        lifeGroupTarget: asStringOrNull(map['lifeGroupTarget']),
        approvalStatus:
            asString(map['approvalStatus'], EventApprovalStatus.draft),
        approvalComments: asStringOrNull(map['approvalComments']),
        approvedBy: asStringOrNull(map['approvedBy']),
        approvedAt: parseDateOrNull(map['approvedAt']),
        createdByDepartmentId: asStringOrNull(map['createdByDepartmentId']),
        coreRoles: EventCoreRole.listFrom(map['coreRoles']),
        speaker: asStringOrNull(map['speaker']),
        objective: asStringOrNull(map['objective']),
        isPaid: asBool(map['isPaid']),
        attendanceFee: asDoubleOrNull(map['attendanceFee']),
        attendanceFeeCurrency: asStringOrNull(map['attendanceFeeCurrency']),
        transportRequired: asBool(map['transportRequired']),
        transportNeeds: asStringOrNull(map['transportNeeds']),
        transportRequestId: asStringOrNull(map['transportRequestId']),
        budgetRequested: asBool(map['budgetRequested']),
        budgetAmount: asDoubleOrNull(map['budgetAmount']),
        budgetCurrency: asStringOrNull(map['budgetCurrency']),
        budgetPurpose: asStringOrNull(map['budgetPurpose']),
        budgetRequestId: asStringOrNull(map['budgetRequestId']),
        mediaRequired: asBool(map['mediaRequired']),
        mediaNeeds: asStringOrNull(map['mediaNeeds']),
        mediaRequestId: asStringOrNull(map['mediaRequestId']),
        foodRequired: asBool(map['foodRequired']),
        foodNeeds: asStringOrNull(map['foodNeeds']),
        foodRequestId: asStringOrNull(map['foodRequestId']),
        viceChairApprovedBy: asStringOrNull(map['viceChairApprovedBy']),
        viceChairApprovedAt: parseDateOrNull(map['viceChairApprovedAt']),
        chairApprovedBy: asStringOrNull(map['chairApprovedBy']),
        chairApprovedAt: parseDateOrNull(map['chairApprovedAt']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class EventDepartmentRole {
  final String id;
  final String eventId;
  final String departmentId;
  final String departmentName;
  final String role;
  final String? assignedUserId;
  final String? assignedUserName;
  final DateTime? assignedAt;
  final DateTime createdAt;

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
        id: asString(map['id']),
        eventId: asString(map['eventId']),
        departmentId: asString(map['departmentId']),
        departmentName: asString(map['departmentName']),
        role: asString(map['role']),
        assignedUserId: asStringOrNull(map['assignedUserId']),
        assignedUserName: asStringOrNull(map['assignedUserName']),
        assignedAt: parseDateOrNull(map['assignedAt']),
        createdAt: parseDate(map['createdAt']),
      );
}

class EventReportStatus {
  static const draft = 'DRAFT';
  static const submitted = 'SUBMITTED';
  static const reviewed = 'REVIEWED';
  static const changesRequested = 'CHANGES_REQUESTED';
}

class EventReportFinances {
  final double? budget;
  final double? actualSpend;
  final String? notes;

  const EventReportFinances({this.budget, this.actualSpend, this.notes});

  factory EventReportFinances.fromMap(Map<String, dynamic> map) =>
      EventReportFinances(
        budget: asDoubleOrNull(map['budget']),
        actualSpend: asDoubleOrNull(map['actualSpend']),
        notes: asStringOrNull(map['notes']),
      );

  Map<String, dynamic> toMap() => {
        'budget': budget,
        'actualSpend': actualSpend,
        'notes': notes,
      };
}

class EventReport {
  final String id;
  final String eventId;
  final String eventTitle;
  final DateTime eventStartDate;
  final DateTime? eventEndDate;
  final String eventType;
  final String? createdByDepartmentId;
  final String initiatorId;
  final String initiatorName;
  final String? initiatorEmail;
  final int? attendanceCount;
  final int? objectivesMetRating; // 1–5
  final String highlights;
  final String challenges;
  final String lessonsLearned;
  final String recommendations;
  final EventReportFinances? finances;
  final String? mediaLink;
  final String? additionalComments;
  final String status;
  final DateTime? submittedAt;
  final String? reviewedBy;
  final String? reviewedByName;
  final DateTime? reviewedAt;
  final String? reviewComments;
  final DateTime createdAt;
  final DateTime updatedAt;

  const EventReport({
    required this.id,
    required this.eventId,
    required this.eventTitle,
    required this.eventStartDate,
    this.eventEndDate,
    required this.eventType,
    this.createdByDepartmentId,
    required this.initiatorId,
    required this.initiatorName,
    this.initiatorEmail,
    this.attendanceCount,
    this.objectivesMetRating,
    this.highlights = '',
    this.challenges = '',
    this.lessonsLearned = '',
    this.recommendations = '',
    this.finances,
    this.mediaLink,
    this.additionalComments,
    required this.status,
    this.submittedAt,
    this.reviewedBy,
    this.reviewedByName,
    this.reviewedAt,
    this.reviewComments,
    required this.createdAt,
    required this.updatedAt,
  });

  factory EventReport.fromMap(Map<String, dynamic> map) => EventReport(
        id: asString(map['id']),
        eventId: asString(map['eventId']),
        eventTitle: asString(map['eventTitle']),
        eventStartDate: parseDate(map['eventStartDate']),
        eventEndDate: parseDateOrNull(map['eventEndDate']),
        eventType: asString(map['eventType']),
        createdByDepartmentId: asStringOrNull(map['createdByDepartmentId']),
        initiatorId: asString(map['initiatorId']),
        initiatorName: asString(map['initiatorName']),
        initiatorEmail: asStringOrNull(map['initiatorEmail']),
        attendanceCount: asIntOrNull(map['attendanceCount']),
        objectivesMetRating: asIntOrNull(map['objectivesMetRating']),
        highlights: asString(map['highlights']),
        challenges: asString(map['challenges']),
        lessonsLearned: asString(map['lessonsLearned']),
        recommendations: asString(map['recommendations']),
        finances: map['finances'] is Map
            ? EventReportFinances.fromMap(
                Map<String, dynamic>.from(map['finances'] as Map))
            : null,
        mediaLink: asStringOrNull(map['mediaLink']),
        additionalComments: asStringOrNull(map['additionalComments']),
        status: asString(map['status'], EventReportStatus.draft),
        submittedAt: parseDateOrNull(map['submittedAt']),
        reviewedBy: asStringOrNull(map['reviewedBy']),
        reviewedByName: asStringOrNull(map['reviewedByName']),
        reviewedAt: parseDateOrNull(map['reviewedAt']),
        reviewComments: asStringOrNull(map['reviewComments']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}
