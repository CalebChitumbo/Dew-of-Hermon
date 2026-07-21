import type { CampDefinition } from "@/types";

/**
 * Name of the Firestore department whose lead is treated as a ROPs Camp
 * Admin Lead. Any DEPARTMENT_LEAD on this department gets the same access
 * to camp registrations as a full admin.
 */
export const ROPS_CAMP_DEPARTMENT_NAME = "ROPs Camp";

/**
 * Static catalog of camps people can register for. The ID is the Firestore
 * `campId` used to scope registrations.
 */
export const CAMPS: CampDefinition[] = [
  {
    id: "rops-x-2026",
    name: "ROPs X Camp 2026",
    startDate: "2026-08-27",
    endDate: "2026-08-31",
    capacity: 80,
    fee: 400,
    currency: "ZMW",
    venue: "Crested Crane Academy",
  },
];

/** Mobile money number campers send payment + proof of payment to. */
export const CAMP_PAYMENT_NUMBER = "0975088939";

/** Short payment reference derived from the registration document ID. */
export function buildCampPaymentReference(registrationId: string): string {
  return registrationId.toUpperCase().slice(-8);
}

/** People to contact for camp questions (shown in public page footers). */
export const CAMP_CONTACTS = [
  { name: "Caleb Chitumbo", role: "Chairperson", phone: "0979 414 477" },
  { name: "Joseph Mizinga", role: "ROPs Manager", phone: "0972 894 046" },
  { name: "Mercy Kosta Kaonda", role: "Vice Chairperson", phone: "0977 806 404" },
];

export function getCamp(campId: string): CampDefinition | undefined {
  return CAMPS.find((c) => c.id === campId);
}

export const DEFAULT_CAMP_ID = CAMPS[0].id;
