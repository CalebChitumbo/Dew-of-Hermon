// ─── Enums ───

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "DEPARTMENT_LEAD" | "YOUTH_LEADER" | "MEMBER";

export type AssignmentStatus = "PENDING" | "CONFIRMED" | "DECLINED" | "NO_RESPONSE";

export type EventType = "POTTERS_WHEEL_SERVICE" | "ROPS_CAMP" | "RETREAT" | "SPECIAL_EVENT" | "MEETING" | "OUTREACH";

export type ReminderDay = "MONDAY" | "THURSDAY" | "SATURDAY";

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
