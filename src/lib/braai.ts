import type { BraaiPhase } from "@/types";

export interface BraaiResponsibility {
  key: string;
  name: string;
  phase: BraaiPhase;
  order: number;
  description?: string;
}

/**
 * Canonical list of responsibilities for a Sunday fundraising braai.
 * Order is preserved across two phases — preparations done before the
 * braai, and actual day duties.
 */
export const BRAAI_RESPONSIBILITIES: BraaiResponsibility[] = [
  // ── Preparations ────────────────────────────────────────────────
  {
    key: "cut_marinate_chicken",
    name: "Cutting and Marinating Chicken",
    phase: "PREPARATION",
    order: 1,
  },
  {
    key: "peel_cut_potatoes",
    name: "Peeling and Cutting Potatoes",
    phase: "PREPARATION",
    order: 2,
  },
  {
    key: "cut_grate_vegetables",
    name: "Cutting/Grating Cabbage, Capsicums and Carrots",
    phase: "PREPARATION",
    order: 3,
  },
  {
    key: "buy_drinks",
    name: "Buying and Refrigerating Drinks",
    phase: "PREPARATION",
    order: 4,
  },

  // ── Actual day ──────────────────────────────────────────────────
  {
    key: "start_fire",
    name: "Starting the Fire",
    phase: "EVENT_DAY",
    order: 5,
  },
  {
    key: "organize_area",
    name: "Organising the Braai Area",
    phase: "EVENT_DAY",
    order: 6,
  },
  {
    key: "fry_chips",
    name: "Frying Chips",
    phase: "EVENT_DAY",
    order: 7,
  },
  {
    key: "braai_meat",
    name: "Braaiing",
    phase: "EVENT_DAY",
    order: 8,
  },
  {
    key: "mix_salads",
    name: "Mixing Salads",
    phase: "EVENT_DAY",
    order: 9,
  },
  {
    key: "sales_orders",
    name: "Sales — Taking Orders & Ensuring Availability",
    phase: "EVENT_DAY",
    order: 10,
  },
  {
    key: "sales_serving",
    name: "Sales — Serving Food",
    phase: "EVENT_DAY",
    order: 11,
  },
  {
    key: "sales_money",
    name: "Sales — Receiving Money (Cash / Mobile Money)",
    phase: "EVENT_DAY",
    order: 12,
  },
  {
    key: "pack_cleanup",
    name: "Packing and Clean-up (Includes Washing Dishes)",
    phase: "EVENT_DAY",
    order: 13,
  },
];

export const BRAAI_RESPONSIBILITY_KEYS = new Set(
  BRAAI_RESPONSIBILITIES.map((r) => r.key)
);

export const BRAAI_TOTAL_RESPONSIBILITIES = BRAAI_RESPONSIBILITIES.length;

export function getBraaiResponsibility(
  key: string
): BraaiResponsibility | undefined {
  return BRAAI_RESPONSIBILITIES.find((r) => r.key === key);
}

export const BRAAI_PHASE_LABELS: Record<BraaiPhase, string> = {
  PREPARATION: "Preparations",
  EVENT_DAY: "Actual Day",
};

/** Department name used to scope which members can be assigned to braai duties. */
export const FUNDRAISING_DEPARTMENT_NAME = "Fundraising";
