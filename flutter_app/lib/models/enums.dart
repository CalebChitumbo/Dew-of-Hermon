/// Wire-format enums that mirror the TypeScript string union types in
/// `src/types/index.ts`. The Dart enum `.name` must match the string stored
/// in Firestore exactly — do not rename without updating the web app.

// ignore_for_file: constant_identifier_names

enum UserRole {
  SUPER_ADMIN,
  ADMIN,
  DEPARTMENT_LEAD,
  YOUTH_LEADER,
  MEMBER,
}

enum AssignmentStatus { PENDING, CONFIRMED, DECLINED, NO_RESPONSE }

enum EventType {
  POTTERS_WHEEL_SERVICE,
  ROPS_CAMP,
  RETREAT,
  SPECIAL_EVENT,
  MEETING,
  OUTREACH,
}

enum ReminderDay { MONDAY, THURSDAY, SATURDAY }

enum LifeGroup { BRIDGE, ANCHOR, CORNERSTONE }

enum EventApprovalStatus {
  DRAFT,
  PENDING_APPROVAL,
  APPROVED,
  REJECTED,
  CHANGES_REQUESTED,
}

enum TransportRequestStatus {
  PENDING_DETAILS,
  PENDING_TREASURER,
  APPROVED,
  REJECTED_TREASURER,
  CANCELLED,
}

enum BudgetRequestStatus { PENDING_TREASURER, APPROVED, REJECTED, CANCELLED }

enum FollowUpStatus {
  PENDING_LEAD_APPROVAL,
  REJECTED,
  NEW_CONTACT,
  ASSIGNED,
  CONTACTED,
  FIRST_VISIT,
  REGULAR_ATTENDEE,
  MEMBER,
}

enum FollowUpSource { CAMPUS_MINISTRY, LIFE_GROUPS }

enum FollowUpReason {
  NEW_VISITOR,
  RETURNING_AFTER_ABSENCE,
  NEEDS_PASTORAL_SUPPORT,
  OTHER,
}

enum EventReportStatus { DRAFT, SUBMITTED, REVIEWED, CHANGES_REQUESTED }

enum DevotionalScope { CAMPUS_MINISTRY, LIFE_GROUPS }

enum CampGender { MALE, FEMALE }

enum CampPaymentStatus { UNPAID, PAID, REFUNDED }

enum CampTShirtSize { XS, S, M, L, XL, XXL }

enum CampDropoffLocation { CHURCH, CAMPSITE }

enum BraaiPhase { PREPARATION, EVENT_DAY }

enum FundraisingPaymentStatus { UNPAID, PAID }

enum FundraisingPaymentMethod { momo, cash }

enum FundraisingPreparationStatus { PENDING, IN_PREP, READY, COLLECTED }

enum FundraisingPickupTimeOption {
  after_1st,
  after_2nd,
  lunch_hour,
  custom,
}

enum FundraisingOrderSource { buyer, member }

enum NotificationType { reminder, assignment, event, announcement }

enum EmailDeliveryStatus { pending, queued, delivered, failed, skipped }

enum TaskStatus { TODO, IN_PROGRESS, DONE }

enum TaskPriority { LOW, MEDIUM, HIGH, URGENT }
