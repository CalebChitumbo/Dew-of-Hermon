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
  },
];

export function getCamp(campId: string): CampDefinition | undefined {
  return CAMPS.find((c) => c.id === campId);
}

export const DEFAULT_CAMP_ID = CAMPS[0].id;
