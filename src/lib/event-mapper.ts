import { Timestamp } from "firebase/firestore";
import { parseISO } from "date-fns";
import type { AppEvent, EventType, LifeGroup } from "@/types";

/** Parse the various shapes Firestore dates arrive in on the client. */
export function parseEventDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string") return parseISO(val);
  if (typeof val === "number") return new Date(val);
  if (val && typeof val === "object" && "seconds" in val) {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  return new Date();
}

/**
 * Map a Firestore event document to an AppEvent. Shared by every client
 * surface that reads the events collection (dashboard, calendar, ...) so the
 * field defaults can't drift between copies.
 */
export function mapEventDoc(doc: {
  id: string;
  data: () => Record<string, unknown>;
}): AppEvent {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title as string,
    description: (data.description as string) || null,
    type: data.type as EventType,
    startDate: parseEventDate(data.startDate),
    endDate: data.endDate ? parseEventDate(data.endDate) : null,
    venue: (data.venue as string) || "",
    isRecurring: (data.isRecurring as boolean) || false,
    createdBy: (data.createdBy as string) || "",
    lifeGroupTarget: (data.lifeGroupTarget as LifeGroup | "ALL") || null,
    approvalStatus:
      (data.approvalStatus as AppEvent["approvalStatus"]) || "APPROVED",
    approvalComments: (data.approvalComments as string) || null,
    approvedBy: (data.approvedBy as string) || null,
    approvedAt: data.approvedAt ? parseEventDate(data.approvedAt) : null,
    createdByDepartmentId: (data.createdByDepartmentId as string) || null,
    coreRoles: (data.coreRoles as AppEvent["coreRoles"]) || [],
    speaker: (data.speaker as string) || null,
    objective: (data.objective as string) || null,
    isPaid: (data.isPaid as boolean) || false,
    attendanceFee: (data.attendanceFee as number) ?? null,
    attendanceFeeCurrency: (data.attendanceFeeCurrency as string) || null,
    transportRequired: (data.transportRequired as boolean) || false,
    transportNeeds: (data.transportNeeds as string) || null,
    transportRequestId: (data.transportRequestId as string) || null,
    budgetRequested: (data.budgetRequested as boolean) || false,
    budgetAmount: (data.budgetAmount as number) ?? null,
    budgetCurrency: (data.budgetCurrency as string) || null,
    budgetPurpose: (data.budgetPurpose as string) || null,
    budgetRequestId: (data.budgetRequestId as string) || null,
    mediaRequired: (data.mediaRequired as boolean) || false,
    mediaNeeds: (data.mediaNeeds as string) || null,
    mediaRequestId: (data.mediaRequestId as string) || null,
    foodRequired: (data.foodRequired as boolean) || false,
    foodNeeds: (data.foodNeeds as string) || null,
    foodRequestId: (data.foodRequestId as string) || null,
    viceChairApprovedBy: (data.viceChairApprovedBy as string) || null,
    viceChairApprovedAt: data.viceChairApprovedAt
      ? parseEventDate(data.viceChairApprovedAt)
      : null,
    chairApprovedBy: (data.chairApprovedBy as string) || null,
    chairApprovedAt: data.chairApprovedAt
      ? parseEventDate(data.chairApprovedAt)
      : null,
    createdAt: parseEventDate(data.createdAt),
    updatedAt: parseEventDate(data.updatedAt),
  };
}
