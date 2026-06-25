// ─── Enums ───

export type UserRole = "SUPER_ADMIN" | "VICE_CHAIRPERSON" | "ADMIN" | "DEPARTMENT_LEAD" | "YOUTH_LEADER" | "MEMBER";

export type AssignmentStatus = "PENDING" | "CONFIRMED" | "DECLINED" | "NO_RESPONSE";

export type EventType = "POTTERS_WHEEL_SERVICE" | "ROPS_CAMP" | "RETREAT" | "SPECIAL_EVENT" | "MEETING" | "OUTREACH";

export type ReminderDay = "MONDAY" | "THURSDAY" | "SATURDAY";

export type LifeGroup = "BRIDGE" | "ANCHOR" | "CORNERSTONE";

export type EventApprovalStatus =
  | "DRAFT"
  | "PENDING_DISPATCH"
  | "PENDING_STAKEHOLDERS"
  | "PENDING_VICE_CHAIR"
  | "PENDING_CHAIR"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED";

export type TransportRequestStatus =
  | "PENDING_DETAILS"
  | "PENDING_TREASURER"
  | "APPROVED"
  | "REJECTED_TREASURER"
  | "CANCELLED";

export type BudgetRequestStatus =
  | "PENDING_TREASURER"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type MediaRequestStatus =
  | "PENDING_MEDIA"
  | "CONFIRMED"
  | "DECLINED"
  | "CANCELLED";

export type FoodRequestStatus =
  | "PENDING_FOOD"
  | "CONFIRMED"
  | "DECLINED"
  | "CANCELLED";

export type DepartmentJoinRequestStatus =
  | "PENDING_MANAGER"
  | "PENDING_CHAIR"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type FollowUpStatus =
  | "PENDING_LEAD_APPROVAL"
  | "REJECTED"
  | "NEW_CONTACT"
  | "ASSIGNED"
  | "CONTACTED"
  | "FIRST_VISIT"
  | "REGULAR_ATTENDEE"
  | "MEMBER";

export type FollowUpSource = "CAMPUS_MINISTRY" | "LIFE_GROUPS";

export type FollowUpReason = "NEW_VISITOR" | "RETURNING_AFTER_ABSENCE" | "NEEDS_PASTORAL_SUPPORT" | "OTHER";

export type EventRoleTier = "CORE" | "DEPARTMENT";

// ─── Document Types ───

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  departmentIds: string[];
  leadsDepartmentIds: string[];
  profileImage: string | null;
  isActive: boolean;
  pushEnabled?: boolean;
  lifeGroup: LifeGroup | null;
  isStudent: boolean;
  institutionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  order: number;
  createdAt: Date;
}

export interface ServiceRole {
  id: string;
  name: string;
  departmentId: string;
  description: string | null;
  emailSubject: string;
  emailBody: string;
  reminderSchedule: ReminderDay[];
  arrivalTime: string | null;
  timeSlot: string | null;
  order: number;
}

export interface AppEvent {
  id: string;
  title: string;
  description: string | null;
  type: EventType;
  startDate: Date;
  endDate: Date | null;
  venue: string;
  isRecurring: boolean;
  createdBy: string;
  lifeGroupTarget: LifeGroup | "ALL" | null;
  approvalStatus: EventApprovalStatus;
  approvalComments: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdByDepartmentId: string | null;
  coreRoles: EventCoreRole[];
  speaker: string | null;
  objective: string | null;
  isPaid: boolean;
  attendanceFee: number | null;
  attendanceFeeCurrency: string | null;
  transportRequired: boolean;
  transportNeeds: string | null;
  transportRequestId: string | null;
  budgetRequested: boolean;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  budgetPurpose: string | null;
  budgetRequestId: string | null;
  mediaRequired: boolean;
  mediaNeeds: string | null;
  mediaRequestId: string | null;
  foodRequired: boolean;
  foodNeeds: string | null;
  foodRequestId: string | null;
  // Executive sign-off audit trail (Events Lead → Vice Chair → Chairperson)
  viceChairApprovedBy: string | null;
  viceChairApprovedAt: Date | null;
  chairApprovedBy: string | null;
  chairApprovedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransportRequestStatusHistoryEntry {
  status: TransportRequestStatus;
  changedBy: string;
  changedByName: string;
  changedAt: Date;
  comments: string | null;
}

export interface TransportRequest {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartDate: Date;
  needsDescription: string;
  status: TransportRequestStatus;

  // Coordinator-supplied
  vehicleType: string | null;
  vehicleCount: number | null;
  estimatedCost: number | null;
  currency: string | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  pickupTime: Date | null;
  returnTime: Date | null;
  coordinatorNotes: string | null;

  // Actor metadata
  routedBy: string | null;
  routedByName: string | null;
  routedAt: Date | null;
  filledBy: string | null;
  filledByName: string | null;
  filledAt: Date | null;
  treasurerId: string | null;
  treasurerName: string | null;
  treasurerDecidedAt: Date | null;
  treasurerComments: string | null;

  statusHistory: TransportRequestStatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetRequestStatusHistoryEntry {
  status: BudgetRequestStatus;
  changedBy: string;
  changedByName: string;
  changedAt: Date;
  comments: string | null;
}

export interface BudgetRequest {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartDate: Date;

  requestedAmount: number;
  currency: string;
  purpose: string;
  requestedBy: string;
  requestedByName: string;

  status: BudgetRequestStatus;

  // Treasurer decision
  approvedAmount: number | null;
  treasurerId: string | null;
  treasurerName: string | null;
  treasurerDecidedAt: Date | null;
  treasurerComments: string | null;

  statusHistory: BudgetRequestStatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaRequestStatusHistoryEntry {
  status: MediaRequestStatus;
  changedBy: string;
  changedByName: string;
  changedAt: Date;
  comments: string | null;
}

export interface MediaRequest {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartDate: Date;
  needsDescription: string;
  status: MediaRequestStatus;

  // The three media roles, assigned by the Media coordinator at confirmation.
  soundUserId: string | null;
  soundUserName: string | null;
  publicityUserId: string | null;
  publicityUserName: string | null;
  coverageUserId: string | null;
  coverageUserName: string | null;
  coordinatorNotes: string | null;

  // Actor metadata
  routedBy: string | null;
  routedByName: string | null;
  routedAt: Date | null;
  confirmedBy: string | null;
  confirmedByName: string | null;
  confirmedAt: Date | null;

  statusHistory: MediaRequestStatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FoodRequestStatusHistoryEntry {
  status: FoodRequestStatus;
  changedBy: string;
  changedByName: string;
  changedAt: Date;
  comments: string | null;
}

export interface FoodRequest {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartDate: Date;
  needsDescription: string;
  status: FoodRequestStatus;

  // Food Logistics planning, supplied at confirmation.
  headcount: number | null;
  menuPlan: string | null;
  coordinatorNotes: string | null;

  // FK to a food-originated budget request (reuses the budgetRequests collection).
  budgetRequestId: string | null;

  // Actor metadata
  routedBy: string | null;
  routedByName: string | null;
  routedAt: Date | null;
  confirmedBy: string | null;
  confirmedByName: string | null;
  confirmedAt: Date | null;

  statusHistory: FoodRequestStatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DepartmentJoinRequestHistoryEntry {
  status: DepartmentJoinRequestStatus;
  changedBy: string;
  changedByName: string;
  changedAt: Date;
  comments: string | null;
}

/**
 * A member's request to join a department. Flows through a two-stage
 * approval chain: the department Manager (DEPARTMENT_LEAD) recommends it,
 * then the Chairperson (SUPER_ADMIN) gives final approval, at which point
 * the member is added to the department. Departments with no manager skip
 * straight to the Chairperson.
 */
export interface DepartmentJoinRequest {
  id: string;
  departmentId: string;
  departmentName: string;

  userId: string;
  userName: string;
  userEmail: string | null;
  /** Optional note from the requester ("why I'd like to join"). */
  message: string | null;

  status: DepartmentJoinRequestStatus;

  // Manager recommendation stage
  managerId: string | null;
  managerName: string | null;
  managerDecidedAt: Date | null;
  managerComments: string | null;

  // Chairperson final decision stage
  chairId: string | null;
  chairName: string | null;
  chairDecidedAt: Date | null;
  chairComments: string | null;

  statusHistory: DepartmentJoinRequestHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Service {
  id: string;
  eventId: string;
  theme: string | null;
  serviceTime: string;
  programNotes: string | null;
  attendanceCount: number | null;
  isArchived: boolean;
  /** True when the rota was opened automatically ahead of the Sunday. */
  autoProvisioned?: boolean;
  /** Set once department heads have been notified the rota is open. */
  rotaOpenNotifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceAssignment {
  id: string;
  serviceId: string;
  roleId: string;
  roleName: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  status: AssignmentStatus;
  emailSent: boolean;
  emailSentAt: Date | null;
  confirmedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChecklistItem {
  id: string;
  serviceId: string;
  task: string;
  category: string;
  isCompleted: boolean;
  completedBy: string | null;
  order: number;
  updatedAt: Date;
}

export interface Affirmation {
  id: string;
  title: string;
  content: string;
  serviceId: string | null;
  authorId: string;
  authorName: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Colour a user can apply when highlighting a Bible verse. */
export type BibleHighlightColor = "gold" | "sage" | "blue" | "rose" | "lavender";

/**
 * A verse a user has saved or highlighted in the Bible reader. Stored per-user
 * in the `bibleBookmarks` collection, keyed by `verseKey` (see lib/bible/api).
 */
export interface BibleBookmark {
  id: string;
  userId: string;
  translation: string;
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  /** Snapshot of the verse text at save time, for the bookmarks list. */
  text: string;
  /** A highlight colour, or null for a plain (uncoloured) bookmark. */
  color: BibleHighlightColor | null;
  note: string | null;
  createdAt: Date;
}

export type EmailDeliveryStatus = "pending" | "queued" | "delivered" | "failed" | "skipped";

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "reminder" | "assignment" | "event" | "announcement";
  isRead: boolean;
  link: string | null;
  emailStatus: EmailDeliveryStatus;
  emailDocId: string | null;
  emailError: string | null;
  createdAt: Date;
}

export interface ReminderLog {
  id: string;
  serviceId: string;
  reminderDay: ReminderDay;
  sentAt: Date;
  recipientCount: number;
  errors: string | null;
}

export interface UserAvailability {
  date: string;
  available: boolean;
  reason: string | null;
}

// ─── Department Tasks ───

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface DepartmentTask {
  id: string;
  departmentId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: Date | null;
  createdBy: string;
  createdByName: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Event Roles ───

export interface EventCoreRole {
  role: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
}

export interface EventDepartmentRole {
  id: string;
  eventId: string;
  departmentId: string;
  departmentName: string;
  role: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedAt: Date | null;
  createdAt: Date;
}

// ─── Event Reports (Post-Event Reporting) ───

export type EventReportStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "REVIEWED"
  | "CHANGES_REQUESTED";

export type ObjectivesMetRating = 1 | 2 | 3 | 4 | 5;

export interface EventReportFinances {
  budget: number | null;
  actualSpend: number | null;
  notes: string | null;
}

export interface EventReport {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartDate: Date;
  eventEndDate: Date | null;
  eventType: EventType;
  createdByDepartmentId: string | null;

  initiatorId: string;
  initiatorName: string;
  initiatorEmail: string | null;

  attendanceCount: number | null;
  objectivesMetRating: ObjectivesMetRating | null;
  highlights: string;
  challenges: string;
  lessonsLearned: string;
  recommendations: string;
  finances: EventReportFinances | null;
  mediaLink: string | null;
  additionalComments: string | null;

  status: EventReportStatus;
  submittedAt: Date | null;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  reviewComments: string | null;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Follow-Up Pipeline ───

export interface FollowUpCard {
  id: string;
  name: string;
  phone: string;
  source: FollowUpSource;
  sourceDetail: string;
  status: FollowUpStatus;
  reason: FollowUpReason | null;
  notes: string;
  dateOfContact: Date;
  assigneeId: string | null;
  assigneeName: string | null;
  createdBy: string;
  createdByName: string;
  /** Role of the person who submitted the card. Used to gate the dept-lead approval flow. */
  submittedByRole: UserRole | null;
  /** When approval is required, the dept lead that approved/rejected the card. */
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  statusHistory: { status: FollowUpStatus; changedBy: string; changedAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Campus Ministry / Life Groups Devotionals ───

export type DevotionalScope = "CAMPUS_MINISTRY" | "LIFE_GROUPS";

export interface Devotional {
  id: string;
  /** Which audience this devotional was posted for. Defaults to
   * CAMPUS_MINISTRY for backwards compatibility with older posts that
   * predate the scope field. */
  scope: DevotionalScope;
  title: string;
  content: string;
  /** ISO date (yyyy-mm-dd) for the start of the week this devotional covers */
  weekStartDate: string;
  /** Optional theme/scripture reference shown alongside the title */
  scriptureReference: string | null;
  authorId: string;
  authorName: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Institutions ───

export interface Institution {
  id: string;
  name: string;
  isActive: boolean;
  order: number;
  createdAt: Date;
}

// ─── ROPs Camp Registrations ───

export type CampGender = "MALE" | "FEMALE";

export type CampPaymentStatus = "UNPAID" | "PAID" | "REFUNDED";

export type CampTShirtSize = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export type CampDropoffLocation = "CHURCH" | "CAMPSITE";

export interface CampRegistration {
  id: string;
  /** Identifier for the camp the person is registering for, e.g. "rops-x-2026". */
  campId: string;
  firstName: string;
  lastName: string;
  /** ISO date string (yyyy-mm-dd). */
  dateOfBirth: string;
  gender: CampGender;
  phone: string;
  email: string | null;
  churchOrSchool: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string | null;
  medicalNotes: string | null;
  allergies: string | null;
  medications: string | null;
  tshirtSize: CampTShirtSize;
  dietaryPreference: string | null;
  parentName: string | null;
  parentRelationship: string | null;
  parentAltPhone: string | null;
  parentEmail: string | null;
  address: string | null;
  dropoffLocation: CampDropoffLocation | null;
  notes: string | null;
  consentGiven: boolean;
  paymentStatus: CampPaymentStatus;
  paymentAmount: number | null;
  paymentReference: string | null;
  paymentNotes: string | null;
  paymentMarkedBy: string | null;
  paymentMarkedByName: string | null;
  paymentMarkedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampDefinition {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  fee: number;
  currency: string;
}

// ─── Access Control ───

export type AccessLevel = "edit" | "view" | "none";

/** A page key maps to the permission each role has for that page */
export type PagePermissions = Record<string, Record<UserRole, AccessLevel>>;

/** Minimum role required for each feature action */
export type FeatureMinRoles = Record<string, UserRole>;

/** A department-based access rule that grants a feature to users in a specific department */
export interface DepartmentAccessRule {
  featureKey: string;
  departmentName: string;
  /** true = user must lead this dept (leadsDepartmentIds), false = membership is enough (departmentIds) */
  requiresLeadership: boolean;
  /** If non-empty, only these roles get department-based access. Empty = any role with the membership qualifies. */
  allowedRoles: UserRole[];
}

export interface AccessControlConfig {
  pagePermissions: PagePermissions;
  featureMinRoles?: FeatureMinRoles;
  departmentAccessRules?: DepartmentAccessRule[];
  updatedAt: Date;
  updatedBy: string;
}

/** Metadata about a configurable page */
export interface PageDefinition {
  key: string;
  label: string;
  description: string;
  route: string;
  /** Roles that can never lose access (e.g. SUPER_ADMIN always has edit) */
  lockedRoles?: Partial<Record<UserRole, AccessLevel>>;
}

/** Metadata about a configurable feature permission */
export interface FeatureDefinition {
  key: string;
  label: string;
  description: string;
  category: string;
  /** If set, the minimum role cannot be lowered below this */
  lockedMinRole?: UserRole;
  /** Whether this feature supports department-based access rules */
  supportsDepartmentRules: boolean;
}

// ─── Fundraising / Braai ───

export type BraaiPhase = "PREPARATION" | "EVENT_DAY";

/** A planned Sunday fundraising braai. */
export interface BraaiEvent {
  id: string;
  title: string;
  /** Date of the braai (event day). */
  eventDate: Date;
  venue: string | null;
  notes: string | null;
  createdBy: string;
  createdByName: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** One responsibility on the braai roster assigned to a Fundraising team member. */
export interface BraaiAssignment {
  id: string;
  braaiEventId: string;
  /** Stable key for the responsibility (matches BRAAI_RESPONSIBILITIES). */
  responsibilityKey: string;
  responsibilityName: string;
  phase: BraaiPhase;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  status: AssignmentStatus;
  emailSent: boolean;
  emailSentAt: Date | null;
  confirmedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Fundraising / Orders (Potter's Shockers) ───

export type FundraisingPaymentStatus = "UNPAID" | "PAID";

export type FundraisingPaymentMethod = "momo" | "cash";

export type FundraisingPreparationStatus =
  | "PENDING"
  | "IN_PREP"
  | "READY"
  | "COLLECTED";

export type FundraisingPickupTimeOption =
  | "after_1st"
  | "after_2nd"
  | "lunch_hour"
  | "custom";

export type FundraisingOrderSource = "buyer" | "member";

export interface FundraisingMenuItemDef {
  /** Stable key (also used as Firestore field key for itemPrices). */
  key: string;
  name: string;
  description: string;
  emoji: string;
  /**
   * Optional URL of a photo to show instead of the emoji. Defaults to a
   * convention path under /images/fundraising/{key}.jpg — the file just
   * needs to exist; if not, the UI falls back to the emoji at runtime.
   */
  imagePath: string;
  defaultPrice: number;
}

export interface FundraisingMenuItem {
  key: string;
  name: string;
  description: string;
  emoji: string;
  imagePath: string;
  price: number;
  /**
   * Whether the item is currently available for sale. The public order
   * page only shows enabled items; the manage settings page shows them
   * all so the Fundraising lead can toggle availability.
   */
  enabled: boolean;
}

export interface FundraisingMenuConfig {
  items: FundraisingMenuItem[];
  momoNumber: string;
  currency: string;
  campaignName: string;
}

export interface FundraisingOrderItem {
  itemKey: string;
  name: string;
  unitPrice: number;
  qty: number;
  subtotal: number;
}

export interface FundraisingOrder {
  id: string;
  orderNumber: string;
  braaiEventId: string;
  braaiEventTitle: string;
  braaiEventDate: Date | null;
  customerName: string;
  customerPhone: string;
  pickupTime: FundraisingPickupTimeOption;
  /** HH:mm string when pickupTime === "custom". */
  customPickupTime: string | null;
  notes: string | null;
  items: FundraisingOrderItem[];
  total: number;
  currency: string;
  paymentStatus: FundraisingPaymentStatus;
  paymentMethod: FundraisingPaymentMethod | null;
  paidAt: Date | null;
  paidBy: string | null;
  paidByName: string | null;
  preparationStatus: FundraisingPreparationStatus;
  preparationUpdatedAt: Date;
  preparationUpdatedBy: string | null;
  preparationUpdatedByName: string | null;
  /** "buyer" = self-serve public form; "member" = entered by a signed-in member. */
  submittedBy: FundraisingOrderSource;
  submittedByUserId: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
