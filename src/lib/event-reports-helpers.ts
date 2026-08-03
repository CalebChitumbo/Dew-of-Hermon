import { adminDb } from "@/lib/firebase-admin";
import { getCallerUid } from "@/lib/server-auth";
import {
  AppEvent,
  EventReport,
  EventReportFinances,
  EventReportStatus,
  EventType,
  UserRole,
} from "@/types";

export interface CallerInfo {
  uid: string;
  role: UserRole;
  name: string;
  email: string | null;
  departmentIds: string[];
  leadsDepartmentIds: string[];
}

export async function getCallerFromSession(): Promise<CallerInfo | null> {
  try {
    const uid = await getCallerUid();
    if (!uid) return null;

    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) return null;

    const data = userDoc.data()!;
    return {
      uid,
      role: data.role as UserRole,
      name: data.name || "",
      email: data.email || null,
      departmentIds: data.departmentIds || [],
      leadsDepartmentIds: data.leadsDepartmentIds || [],
    };
  } catch {
    return null;
  }
}

export type SerializedEventReport = Omit<
  EventReport,
  "eventStartDate" | "eventEndDate" | "submittedAt" | "reviewedAt" | "createdAt" | "updatedAt"
> & {
  eventStartDate: string | null;
  eventEndDate: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function toIso(v: unknown): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyV = v as any;
  if (!anyV) return null;
  if (typeof anyV.toDate === "function") return anyV.toDate().toISOString();
  if (anyV instanceof Date) return anyV.toISOString();
  if (typeof anyV === "string") return anyV;
  return null;
}

function toDate(v: unknown): Date | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyV = v as any;
  if (!anyV) return null;
  if (typeof anyV.toDate === "function") return anyV.toDate();
  if (anyV instanceof Date) return anyV;
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeReport(id: string, data: any): SerializedEventReport {
  return {
    id,
    eventId: data.eventId,
    eventTitle: data.eventTitle || "",
    eventStartDate: toIso(data.eventStartDate),
    eventEndDate: toIso(data.eventEndDate),
    eventType: data.eventType as EventType,
    createdByDepartmentId: data.createdByDepartmentId || null,
    initiatorId: data.initiatorId,
    initiatorName: data.initiatorName || "",
    initiatorEmail: data.initiatorEmail || null,
    attendanceCount: data.attendanceCount ?? null,
    objectivesMetRating: data.objectivesMetRating ?? null,
    highlights: data.highlights || "",
    challenges: data.challenges || "",
    lessonsLearned: data.lessonsLearned || "",
    recommendations: data.recommendations || "",
    finances: data.finances ?? null,
    mediaLink: data.mediaLink ?? null,
    additionalComments: data.additionalComments ?? null,
    status: (data.status as EventReportStatus) || "DRAFT",
    submittedAt: toIso(data.submittedAt),
    reviewedBy: data.reviewedBy ?? null,
    reviewedByName: data.reviewedByName ?? null,
    reviewedAt: toIso(data.reviewedAt),
    reviewComments: data.reviewComments ?? null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

/**
 * Resolve the effective end date for a report eligibility check.
 * Falls back to startDate if endDate is null so single-day events still work.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function effectiveEndDate(eventData: any): Date | null {
  return toDate(eventData.endDate) ?? toDate(eventData.startDate);
}

export interface QuestionnairePayload {
  attendanceCount: number | null;
  objectivesMetRating: 1 | 2 | 3 | 4 | 5 | null;
  highlights: string;
  challenges: string;
  lessonsLearned: string;
  recommendations: string;
  finances: EventReportFinances | null;
  mediaLink: string | null;
  additionalComments: string | null;
}

export function sanitizeQuestionnaire(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any
): { ok: true; value: QuestionnairePayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid payload" };
  }

  const attendanceCount =
    raw.attendanceCount === null || raw.attendanceCount === undefined
      ? null
      : Number(raw.attendanceCount);
  if (attendanceCount !== null && (!Number.isFinite(attendanceCount) || attendanceCount < 0)) {
    return { ok: false, error: "attendanceCount must be a non-negative number" };
  }

  const ratingRaw = raw.objectivesMetRating;
  let objectivesMetRating: 1 | 2 | 3 | 4 | 5 | null = null;
  if (ratingRaw !== null && ratingRaw !== undefined) {
    const r = Number(ratingRaw);
    if (![1, 2, 3, 4, 5].includes(r)) {
      return { ok: false, error: "objectivesMetRating must be 1–5" };
    }
    objectivesMetRating = r as 1 | 2 | 3 | 4 | 5;
  }

  const asText = (v: unknown): string =>
    typeof v === "string" ? v.trim() : "";

  let finances: EventReportFinances | null = null;
  if (raw.finances) {
    const f = raw.finances;
    const budget =
      f.budget === null || f.budget === undefined ? null : Number(f.budget);
    if (budget !== null && !Number.isFinite(budget)) {
      return { ok: false, error: "finances.budget must be a number" };
    }
    const actualSpend =
      f.actualSpend === null || f.actualSpend === undefined
        ? null
        : Number(f.actualSpend);
    if (actualSpend !== null && !Number.isFinite(actualSpend)) {
      return { ok: false, error: "finances.actualSpend must be a number" };
    }
    const fNotes = asText(f.notes) || null;
    if (budget === null && actualSpend === null && !fNotes) {
      finances = null;
    } else {
      finances = { budget, actualSpend, notes: fNotes };
    }
  }

  const mediaLink = asText(raw.mediaLink) || null;
  const additionalComments = asText(raw.additionalComments) || null;

  return {
    ok: true,
    value: {
      attendanceCount,
      objectivesMetRating,
      highlights: asText(raw.highlights),
      challenges: asText(raw.challenges),
      lessonsLearned: asText(raw.lessonsLearned),
      recommendations: asText(raw.recommendations),
      finances,
      mediaLink,
      additionalComments,
    },
  };
}

export function validateForSubmit(p: QuestionnairePayload): string | null {
  if (p.attendanceCount === null) return "attendanceCount is required";
  if (p.objectivesMetRating === null) return "objectivesMetRating is required";
  if (!p.highlights) return "highlights is required";
  if (!p.challenges) return "challenges is required";
  if (!p.lessonsLearned) return "lessonsLearned is required";
  if (!p.recommendations) return "recommendations is required";
  return null;
}

/**
 * Convert a Firestore event document to a thin AppEvent shape used by handlers
 * that need event metadata for denormalization onto the report doc.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readEventForReport(eventDoc: any): {
  id: string;
  title: string;
  startDate: Date | null;
  endDate: Date | null;
  type: EventType;
  createdBy: string;
  createdByDepartmentId: string | null;
  approvalStatus: AppEvent["approvalStatus"];
} {
  const data = eventDoc.data();
  return {
    id: eventDoc.id,
    title: data.title,
    startDate: toDate(data.startDate),
    endDate: toDate(data.endDate),
    type: data.type as EventType,
    createdBy: data.createdBy,
    createdByDepartmentId: data.createdByDepartmentId || null,
    approvalStatus: data.approvalStatus,
  };
}
