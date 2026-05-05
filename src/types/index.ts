// ─── Enums ───

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "DEPARTMENT_LEAD" | "YOUTH_LEADER" | "MEMBER";

export type AssignmentStatus = "PENDING" | "CONFIRMED" | "DECLINED" | "NO_RESPONSE";

export type EventType = "POTTERS_WHEEL_SERVICE" | "ROPS_CAMP" | "RETREAT" | "SPECIAL_EVENT" | "MEETING" | "OUTREACH";

export type ReminderDay = "MONDAY" | "THURSDAY" | "SATURDAY";

export type LifeGroup = "BRIDGE" | "ANCHOR" | "CORNERSTONE";

export type EventApprovalStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

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
  medicalNotes: string | null;
  tshirtSize: CampTShirtSize;
  dietaryPreference: string | null;
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
