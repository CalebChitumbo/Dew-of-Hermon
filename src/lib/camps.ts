import type { CampDefinition } from "@/types";

/**
 * Static catalog of camps people can register for. The ID is the Firestore
 * `campId` used to scope registrations.
 */
export const CAMPS: CampDefinition[] = [
  {
    id: "rops-x-2026",
    name: "ROPs X Camp 2026",
    startDate: "2026-08-20",
    endDate: "2026-08-24",
    capacity: 80,
    fee: 850,
    currency: "ZMW",
  },
];

export function getCamp(campId: string): CampDefinition | undefined {
  return CAMPS.find((c) => c.id === campId);
}

export const DEFAULT_CAMP_ID = CAMPS[0].id;
