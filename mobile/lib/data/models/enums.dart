import '../../core/utils/firestore_parse.dart';

/// Every string-union type from `src/types/index.ts`, as Dart enums with the
/// wire value attached. `fromWire` is total — an unknown value from a newer
/// web deploy falls back rather than throwing.

enum UserRole {
  superAdmin('SUPER_ADMIN', 'Chairperson', 6),
  viceChairperson('VICE_CHAIRPERSON', 'Vice Chairperson', 5),
  admin('ADMIN', 'Admin', 4),
  departmentLead('DEPARTMENT_LEAD', 'Department Lead', 3),
  youthLeader('YOUTH_LEADER', 'Youth Leader', 2),
  member('MEMBER', 'Member', 1);

  const UserRole(this.wire, this.label, this.rank);

  final String wire;
  final String label;

  /// ROLE_HIERARCHY from access-control.ts — higher outranks lower.
  final int rank;

  static final Map<String, UserRole> _byWire = {
    for (final r in UserRole.values) r.wire: r,
  };

  static UserRole fromWire(dynamic value) =>
      parseEnum(value, _byWire, UserRole.member);

  bool atLeast(UserRole other) => rank >= other.rank;
}

enum AssignmentStatus {
  pending('PENDING', 'Pending'),
  confirmed('CONFIRMED', 'Confirmed'),
  declined('DECLINED', 'Declined'),
  noResponse('NO_RESPONSE', 'No response');

  const AssignmentStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, AssignmentStatus> _byWire = {
    for (final v in AssignmentStatus.values) v.wire: v,
  };
  static AssignmentStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, AssignmentStatus.pending);
}

enum EventType {
  pottersWheelService('POTTERS_WHEEL_SERVICE', "Potter's Wheel Service"),
  ropsCamp('ROPS_CAMP', 'ROPs Camp'),
  retreat('RETREAT', 'Retreat'),
  specialEvent('SPECIAL_EVENT', 'Special Event'),
  meeting('MEETING', 'Meeting'),
  outreach('OUTREACH', 'Outreach');

  const EventType(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, EventType> _byWire = {
    for (final v in EventType.values) v.wire: v,
  };
  static EventType fromWire(dynamic v) =>
      parseEnum(v, _byWire, EventType.specialEvent);
}

enum ReminderDay {
  monday('MONDAY', 'Monday'),
  thursday('THURSDAY', 'Thursday'),
  saturday('SATURDAY', 'Saturday');

  const ReminderDay(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, ReminderDay> _byWire = {
    for (final v in ReminderDay.values) v.wire: v,
  };
  static ReminderDay fromWire(dynamic v) =>
      parseEnum(v, _byWire, ReminderDay.monday);
  static ReminderDay? fromWireOrNull(dynamic v) => parseEnumOrNull(v, _byWire);
}

enum LifeGroup {
  bridge('BRIDGE', 'Bridge'),
  anchor('ANCHOR', 'Anchor'),
  cornerstone('CORNERSTONE', 'Cornerstone');

  const LifeGroup(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, LifeGroup> _byWire = {
    for (final v in LifeGroup.values) v.wire: v,
  };
  static LifeGroup? fromWireOrNull(dynamic v) => parseEnumOrNull(v, _byWire);
}

enum EventApprovalStatus {
  draft('DRAFT', 'Draft'),
  pendingDispatch('PENDING_DISPATCH', 'Pending dispatch'),
  pendingStakeholders('PENDING_STAKEHOLDERS', 'Pending stakeholders'),
  pendingViceChair('PENDING_VICE_CHAIR', 'Pending Vice Chair'),
  pendingChair('PENDING_CHAIR', 'Pending Chairperson'),
  approved('APPROVED', 'Approved'),
  rejected('REJECTED', 'Rejected'),
  changesRequested('CHANGES_REQUESTED', 'Changes requested');

  const EventApprovalStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, EventApprovalStatus> _byWire = {
    for (final v in EventApprovalStatus.values) v.wire: v,
  };
  static EventApprovalStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, EventApprovalStatus.draft);

  bool get isPending =>
      this == pendingDispatch ||
      this == pendingStakeholders ||
      this == pendingViceChair ||
      this == pendingChair;
}

enum TransportRequestStatus {
  pendingDetails('PENDING_DETAILS', 'Pending details'),
  pendingTreasurer('PENDING_TREASURER', 'Pending Treasurer'),
  approved('APPROVED', 'Approved'),
  rejectedTreasurer('REJECTED_TREASURER', 'Rejected'),
  cancelled('CANCELLED', 'Cancelled');

  const TransportRequestStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, TransportRequestStatus> _byWire = {
    for (final v in TransportRequestStatus.values) v.wire: v,
  };
  static TransportRequestStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, TransportRequestStatus.pendingDetails);
}

enum BudgetRequestStatus {
  pendingTreasurer('PENDING_TREASURER', 'Pending Treasurer'),
  approved('APPROVED', 'Approved'),
  rejected('REJECTED', 'Rejected'),
  cancelled('CANCELLED', 'Cancelled');

  const BudgetRequestStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, BudgetRequestStatus> _byWire = {
    for (final v in BudgetRequestStatus.values) v.wire: v,
  };
  static BudgetRequestStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, BudgetRequestStatus.pendingTreasurer);
}

enum MediaRequestStatus {
  pendingMedia('PENDING_MEDIA', 'Pending Media'),
  confirmed('CONFIRMED', 'Confirmed'),
  declined('DECLINED', 'Declined'),
  cancelled('CANCELLED', 'Cancelled');

  const MediaRequestStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, MediaRequestStatus> _byWire = {
    for (final v in MediaRequestStatus.values) v.wire: v,
  };
  static MediaRequestStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, MediaRequestStatus.pendingMedia);
}

enum FoodRequestStatus {
  pendingFood('PENDING_FOOD', 'Pending Food Logistics'),
  confirmed('CONFIRMED', 'Confirmed'),
  declined('DECLINED', 'Declined'),
  cancelled('CANCELLED', 'Cancelled');

  const FoodRequestStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, FoodRequestStatus> _byWire = {
    for (final v in FoodRequestStatus.values) v.wire: v,
  };
  static FoodRequestStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, FoodRequestStatus.pendingFood);
}

enum DepartmentJoinRequestStatus {
  pendingManager('PENDING_MANAGER', 'Pending Manager'),
  pendingChair('PENDING_CHAIR', 'Pending Chairperson'),
  approved('APPROVED', 'Approved'),
  rejected('REJECTED', 'Rejected'),
  cancelled('CANCELLED', 'Cancelled');

  const DepartmentJoinRequestStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, DepartmentJoinRequestStatus> _byWire = {
    for (final v in DepartmentJoinRequestStatus.values) v.wire: v,
  };
  static DepartmentJoinRequestStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, DepartmentJoinRequestStatus.pendingManager);
}

enum FollowUpStatus {
  pendingLeadApproval('PENDING_LEAD_APPROVAL', 'Pending lead approval'),
  rejected('REJECTED', 'Rejected'),
  newContact('NEW_CONTACT', 'New contact'),
  assigned('ASSIGNED', 'Assigned'),
  contacted('CONTACTED', 'Contacted'),
  firstVisit('FIRST_VISIT', 'First visit'),
  regularAttendee('REGULAR_ATTENDEE', 'Regular attendee'),
  member('MEMBER', 'Member');

  const FollowUpStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, FollowUpStatus> _byWire = {
    for (final v in FollowUpStatus.values) v.wire: v,
  };
  static FollowUpStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, FollowUpStatus.newContact);

  /// The pipeline columns, in order — pending/rejected sit outside it.
  static const List<FollowUpStatus> pipeline = [
    newContact,
    assigned,
    contacted,
    firstVisit,
    regularAttendee,
    member,
  ];
}

enum FollowUpSource {
  campusMinistry('CAMPUS_MINISTRY', 'Campus Ministry'),
  lifeGroups('LIFE_GROUPS', 'Life Groups');

  const FollowUpSource(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, FollowUpSource> _byWire = {
    for (final v in FollowUpSource.values) v.wire: v,
  };
  static FollowUpSource fromWire(dynamic v) =>
      parseEnum(v, _byWire, FollowUpSource.campusMinistry);
}

enum FollowUpReason {
  newVisitor('NEW_VISITOR', 'New visitor'),
  returningAfterAbsence('RETURNING_AFTER_ABSENCE', 'Returning after absence'),
  needsPastoralSupport('NEEDS_PASTORAL_SUPPORT', 'Needs pastoral support'),
  other('OTHER', 'Other');

  const FollowUpReason(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, FollowUpReason> _byWire = {
    for (final v in FollowUpReason.values) v.wire: v,
  };
  static FollowUpReason? fromWireOrNull(dynamic v) =>
      parseEnumOrNull(v, _byWire);
}

enum TalentSubmissionStatus {
  pendingReview('PENDING_REVIEW', 'Pending review'),
  shortlisted('SHORTLISTED', 'Shortlisted'),
  slotted('SLOTTED', 'Slotted'),
  completed('COMPLETED', 'Completed'),
  declined('DECLINED', 'Declined'),
  withdrawn('WITHDRAWN', 'Withdrawn');

  const TalentSubmissionStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, TalentSubmissionStatus> _byWire = {
    for (final v in TalentSubmissionStatus.values) v.wire: v,
  };
  static TalentSubmissionStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, TalentSubmissionStatus.pendingReview);
}

enum TalentCategory {
  singing('SINGING', 'Singing'),
  instruments('INSTRUMENTS', 'Instruments'),
  dance('DANCE', 'Dance'),
  drama('DRAMA', 'Drama'),
  poetrySpokenWord('POETRY_SPOKEN_WORD', 'Poetry / spoken word'),
  preachingTeaching('PREACHING_TEACHING', 'Preaching / teaching'),
  mediaCreative('MEDIA_CREATIVE', 'Media / creative'),
  artDesign('ART_DESIGN', 'Art & design'),
  tech('TECH', 'Tech'),
  other('OTHER', 'Other');

  const TalentCategory(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, TalentCategory> _byWire = {
    for (final v in TalentCategory.values) v.wire: v,
  };
  static TalentCategory fromWire(dynamic v) =>
      parseEnum(v, _byWire, TalentCategory.other);
}

enum EventRoleTier {
  core('CORE', 'Core'),
  department('DEPARTMENT', 'Department');

  const EventRoleTier(this.wire, this.label);
  final String wire;
  final String label;
}

enum EventReportStatus {
  draft('DRAFT', 'Draft'),
  submitted('SUBMITTED', 'Submitted'),
  reviewed('REVIEWED', 'Reviewed'),
  changesRequested('CHANGES_REQUESTED', 'Changes requested');

  const EventReportStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, EventReportStatus> _byWire = {
    for (final v in EventReportStatus.values) v.wire: v,
  };
  static EventReportStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, EventReportStatus.draft);
}

enum TaskStatus {
  todo('TODO', 'To do'),
  inProgress('IN_PROGRESS', 'In progress'),
  done('DONE', 'Done');

  const TaskStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, TaskStatus> _byWire = {
    for (final v in TaskStatus.values) v.wire: v,
  };
  static TaskStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, TaskStatus.todo);
}

enum TaskPriority {
  low('LOW', 'Low'),
  medium('MEDIUM', 'Medium'),
  high('HIGH', 'High'),
  urgent('URGENT', 'Urgent');

  const TaskPriority(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, TaskPriority> _byWire = {
    for (final v in TaskPriority.values) v.wire: v,
  };
  static TaskPriority fromWire(dynamic v) =>
      parseEnum(v, _byWire, TaskPriority.medium);
}

enum DevotionalScope {
  campusMinistry('CAMPUS_MINISTRY', 'Campus Ministry'),
  lifeGroups('LIFE_GROUPS', 'Life Groups');

  const DevotionalScope(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, DevotionalScope> _byWire = {
    for (final v in DevotionalScope.values) v.wire: v,
  };

  /// Older posts predate the field and are Campus Ministry by convention.
  static DevotionalScope fromWire(dynamic v) =>
      parseEnum(v, _byWire, DevotionalScope.campusMinistry);
}

enum EmailDeliveryStatus {
  pending('pending', 'Pending'),
  queued('queued', 'Queued'),
  delivered('delivered', 'Delivered'),
  failed('failed', 'Failed'),
  skipped('skipped', 'Skipped');

  const EmailDeliveryStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, EmailDeliveryStatus> _byWire = {
    for (final v in EmailDeliveryStatus.values) v.wire: v,
  };
  static EmailDeliveryStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, EmailDeliveryStatus.pending);
}

enum NotificationType {
  reminder('reminder', 'Reminder'),
  assignment('assignment', 'Assignment'),
  event('event', 'Event'),
  announcement('announcement', 'Announcement');

  const NotificationType(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, NotificationType> _byWire = {
    for (final v in NotificationType.values) v.wire: v,
  };
  static NotificationType fromWire(dynamic v) =>
      parseEnum(v, _byWire, NotificationType.announcement);
}

enum BibleHighlightColor {
  gold('gold'),
  sage('sage'),
  blue('blue'),
  rose('rose'),
  lavender('lavender');

  const BibleHighlightColor(this.wire);
  final String wire;

  static final Map<String, BibleHighlightColor> _byWire = {
    for (final v in BibleHighlightColor.values) v.wire: v,
  };
  static BibleHighlightColor? fromWireOrNull(dynamic v) =>
      parseEnumOrNull(v, _byWire);
}

enum AccessLevel {
  edit('edit'),
  view('view'),
  none('none');

  const AccessLevel(this.wire);
  final String wire;

  static final Map<String, AccessLevel> _byWire = {
    for (final v in AccessLevel.values) v.wire: v,
  };
  static AccessLevel fromWire(dynamic v) =>
      parseEnum(v, _byWire, AccessLevel.none);

  bool get canView => this == edit || this == view;
  bool get canEdit => this == edit;
}

// ─── ROPs Camp ───

enum CampGender {
  male('MALE', 'Male'),
  female('FEMALE', 'Female');

  const CampGender(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, CampGender> _byWire = {
    for (final v in CampGender.values) v.wire: v,
  };
  static CampGender fromWire(dynamic v) =>
      parseEnum(v, _byWire, CampGender.male);
  static CampGender? fromWireOrNull(dynamic v) => parseEnumOrNull(v, _byWire);
}

enum CampPaymentStatus {
  unpaid('UNPAID', 'Unpaid'),
  paid('PAID', 'Paid'),
  refunded('REFUNDED', 'Refunded');

  const CampPaymentStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, CampPaymentStatus> _byWire = {
    for (final v in CampPaymentStatus.values) v.wire: v,
  };
  static CampPaymentStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, CampPaymentStatus.unpaid);
}

enum CampTShirtSize {
  xs('XS'),
  s('S'),
  m('M'),
  l('L'),
  xl('XL'),
  xxl('XXL');

  const CampTShirtSize(this.wire);
  final String wire;
  String get label => wire;

  static final Map<String, CampTShirtSize> _byWire = {
    for (final v in CampTShirtSize.values) v.wire: v,
  };
  static CampTShirtSize fromWire(dynamic v) =>
      parseEnum(v, _byWire, CampTShirtSize.m);
}

enum CampDropoffLocation {
  church('CHURCH', 'Church'),
  campsite('CAMPSITE', 'Campsite');

  const CampDropoffLocation(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, CampDropoffLocation> _byWire = {
    for (final v in CampDropoffLocation.values) v.wire: v,
  };
  static CampDropoffLocation? fromWireOrNull(dynamic v) =>
      parseEnumOrNull(v, _byWire);
}

enum CampPassStatus {
  pendingAdmissions('PENDING_ADMISSIONS', 'Pending Admissions'),
  pendingManager('PENDING_MANAGER', 'Pending Camp Manager'),
  pendingChair('PENDING_CHAIR', 'Pending Chairperson'),
  approved('APPROVED', 'Approved'),
  out('OUT', 'Out of camp'),
  returned('RETURNED', 'Returned'),
  rejected('REJECTED', 'Rejected'),
  cancelled('CANCELLED', 'Cancelled');

  const CampPassStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, CampPassStatus> _byWire = {
    for (final v in CampPassStatus.values) v.wire: v,
  };
  static CampPassStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, CampPassStatus.pendingAdmissions);

  /// ACTIVE_PASS_STATUSES from `src/lib/camp-passes.ts` — a live pass blocks
  /// a second request for the same camper.
  static const List<CampPassStatus> active = [
    pendingAdmissions,
    pendingManager,
    pendingChair,
    approved,
    out,
  ];

  bool get isActive => active.contains(this);
  bool get isPending =>
      this == pendingAdmissions ||
      this == pendingManager ||
      this == pendingChair;
}

enum CampPassStage {
  admissions('ADMISSIONS', 'Admissions', 'camp_pass_admissions'),
  manager('MANAGER', 'Camp Manager', 'camp_pass_manager'),
  chair('CHAIR', 'Chairperson', 'camp_pass_chair');

  const CampPassStage(this.wire, this.label, this.featureKey);
  final String wire;
  final String label;
  final String featureKey;

  static final Map<String, CampPassStage> _byWire = {
    for (final v in CampPassStage.values) v.wire: v,
  };
  static CampPassStage? fromWireOrNull(dynamic v) =>
      parseEnumOrNull(v, _byWire);

  /// PASS_STAGE_STATUS — the status a pass sits in awaiting this stage.
  CampPassStatus get pendingStatus => switch (this) {
        admissions => CampPassStatus.pendingAdmissions,
        manager => CampPassStatus.pendingManager,
        chair => CampPassStatus.pendingChair,
      };

  /// PASS_STAGE_NEXT_STATUS — where approval at this stage sends the pass.
  CampPassStatus get nextStatus => switch (this) {
        admissions => CampPassStatus.pendingManager,
        manager => CampPassStatus.pendingChair,
        chair => CampPassStatus.approved,
      };
}

enum CampPassRequestSource {
  camper('CAMPER', 'Camper / guardian'),
  admissions('ADMISSIONS', 'Admissions desk');

  const CampPassRequestSource(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, CampPassRequestSource> _byWire = {
    for (final v in CampPassRequestSource.values) v.wire: v,
  };
  static CampPassRequestSource fromWire(dynamic v) =>
      parseEnum(v, _byWire, CampPassRequestSource.camper);
}

enum CampSponsorshipPledgeType {
  slots('SLOTS', 'Number of youth'),
  amount('AMOUNT', 'Money amount');

  const CampSponsorshipPledgeType(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, CampSponsorshipPledgeType> _byWire = {
    for (final v in CampSponsorshipPledgeType.values) v.wire: v,
  };
  static CampSponsorshipPledgeType fromWire(dynamic v) =>
      parseEnum(v, _byWire, CampSponsorshipPledgeType.slots);
}

enum CampSponsorshipPaymentStatus {
  unpaid('UNPAID', 'Unpaid'),
  partial('PARTIAL', 'Partial'),
  paid('PAID', 'Paid');

  const CampSponsorshipPaymentStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, CampSponsorshipPaymentStatus> _byWire = {
    for (final v in CampSponsorshipPaymentStatus.values) v.wire: v,
  };
  static CampSponsorshipPaymentStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, CampSponsorshipPaymentStatus.unpaid);
}

enum CampBroadcastAudience {
  all('ALL', 'Everyone'),
  paid('PAID', 'Paid campers'),
  unpaid('UNPAID', 'Unpaid campers'),
  sponsored('SPONSORED', 'Sponsored campers'),
  unsponsored('UNSPONSORED', 'Unsponsored campers'),
  checkedIn('CHECKED_IN', 'Checked in'),
  notCheckedIn('NOT_CHECKED_IN', 'Not checked in'),
  selected('SELECTED', 'Selected campers');

  const CampBroadcastAudience(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, CampBroadcastAudience> _byWire = {
    for (final v in CampBroadcastAudience.values) v.wire: v,
  };
  static CampBroadcastAudience fromWire(dynamic v) =>
      parseEnum(v, _byWire, CampBroadcastAudience.all);
}

enum CampBroadcastOutcomeStatus {
  sent('sent', 'Sent'),
  skipped('skipped', 'Skipped'),
  failed('failed', 'Failed');

  const CampBroadcastOutcomeStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, CampBroadcastOutcomeStatus> _byWire = {
    for (final v in CampBroadcastOutcomeStatus.values) v.wire: v,
  };
  static CampBroadcastOutcomeStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, CampBroadcastOutcomeStatus.sent);
}

enum CampMealSlot {
  breakfast('BREAKFAST', 'Breakfast', '05:30', '10:59'),
  lunch('LUNCH', 'Lunch', '11:00', '16:29'),
  dinner('DINNER', 'Dinner', '16:30', '23:59');

  const CampMealSlot(this.wire, this.label, this.opensAt, this.closesAt);
  final String wire;
  final String label;

  /// MEAL_SLOT_WINDOW — deliberately generous local serving windows, used
  /// only to auto-select the sitting at the line.
  final String opensAt;
  final String closesAt;

  static final Map<String, CampMealSlot> _byWire = {
    for (final v in CampMealSlot.values) v.wire: v,
  };
  static CampMealSlot fromWire(dynamic v) =>
      parseEnum(v, _byWire, CampMealSlot.lunch);
}

// ─── Fundraising ───

enum BraaiPhase {
  preparation('PREPARATION', 'Preparation'),
  eventDay('EVENT_DAY', 'Event day');

  const BraaiPhase(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, BraaiPhase> _byWire = {
    for (final v in BraaiPhase.values) v.wire: v,
  };
  static BraaiPhase fromWire(dynamic v) =>
      parseEnum(v, _byWire, BraaiPhase.preparation);
}

enum FundraisingPaymentStatus {
  unpaid('UNPAID', 'Unpaid'),
  paid('PAID', 'Paid');

  const FundraisingPaymentStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, FundraisingPaymentStatus> _byWire = {
    for (final v in FundraisingPaymentStatus.values) v.wire: v,
  };
  static FundraisingPaymentStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, FundraisingPaymentStatus.unpaid);
}

enum FundraisingPaymentMethod {
  momo('momo', 'Mobile money'),
  cash('cash', 'Cash');

  const FundraisingPaymentMethod(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, FundraisingPaymentMethod> _byWire = {
    for (final v in FundraisingPaymentMethod.values) v.wire: v,
  };
  static FundraisingPaymentMethod? fromWireOrNull(dynamic v) =>
      parseEnumOrNull(v, _byWire);
}

enum FundraisingPreparationStatus {
  pending('PENDING', 'Pending'),
  inPrep('IN_PREP', 'In prep'),
  ready('READY', 'Ready'),
  collected('COLLECTED', 'Collected');

  const FundraisingPreparationStatus(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, FundraisingPreparationStatus> _byWire = {
    for (final v in FundraisingPreparationStatus.values) v.wire: v,
  };
  static FundraisingPreparationStatus fromWire(dynamic v) =>
      parseEnum(v, _byWire, FundraisingPreparationStatus.pending);
}

enum FundraisingPickupTimeOption {
  after1st('after_1st', 'After 1st service'),
  after2nd('after_2nd', 'After 2nd service'),
  lunchHour('lunch_hour', 'Lunch hour'),
  custom('custom', 'Custom time');

  const FundraisingPickupTimeOption(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, FundraisingPickupTimeOption> _byWire = {
    for (final v in FundraisingPickupTimeOption.values) v.wire: v,
  };
  static FundraisingPickupTimeOption fromWire(dynamic v) =>
      parseEnum(v, _byWire, FundraisingPickupTimeOption.after1st);
}

enum FundraisingOrderSource {
  buyer('buyer', 'Buyer'),
  member('member', 'Member');

  const FundraisingOrderSource(this.wire, this.label);
  final String wire;
  final String label;

  static final Map<String, FundraisingOrderSource> _byWire = {
    for (final v in FundraisingOrderSource.values) v.wire: v,
  };
  static FundraisingOrderSource fromWire(dynamic v) =>
      parseEnum(v, _byWire, FundraisingOrderSource.buyer);
}
