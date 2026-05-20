import type {
  FundraisingMenuItemDef,
  FundraisingPaymentStatus,
  FundraisingPickupTimeOption,
  FundraisingPreparationStatus,
} from "@/types";

/**
 * Canonical menu for the Potter's Shockers fundraising sales page.
 * Items themselves are fixed in code; only prices and the MoMo number are
 * editable via the Fundraising settings page (stored under
 * `fundraisingConfig/menu`).
 */
/**
 * Convention for menu photos: drop a JPG at this path with a filename
 * matching the item key. If the file is missing, the UI shows the emoji
 * instead via an onError fallback — no code change required.
 */
const IMAGE_BASE = "/images/fundraising";

export const FUNDRAISING_MENU_ITEMS: ReadonlyArray<FundraisingMenuItemDef> = [
  {
    key: "chicken_piece",
    name: "1 Piece Chicken",
    description: "A grilled chicken piece, served with complimentary coleslaw.",
    emoji: "🍗",
    imagePath: `${IMAGE_BASE}/chicken_piece.jpg`,
    defaultPrice: 30,
  },
  {
    key: "sausage",
    name: "Sausage",
    description: "A grilled pork sausage, served with complimentary coleslaw.",
    emoji: "🌭",
    imagePath: `${IMAGE_BASE}/sausage.jpg`,
    defaultPrice: 30,
  },
  {
    key: "chicken_chips",
    name: "Chicken & Chips",
    description:
      "Grilled chicken with golden chips and complimentary coleslaw.",
    emoji: "🍗",
    imagePath: `${IMAGE_BASE}/chicken_chips.jpg`,
    defaultPrice: 60,
  },
  {
    key: "sausage_chips",
    name: "Sausage & Chips",
    description:
      "A grilled pork sausage with golden chips and complimentary coleslaw.",
    emoji: "🌭",
    imagePath: `${IMAGE_BASE}/sausage_chips.jpg`,
    defaultPrice: 60,
  },
];

export const FUNDRAISING_MENU_ITEM_KEYS = new Set(
  FUNDRAISING_MENU_ITEMS.map((i) => i.key)
);

export const DEFAULT_MOMO_NUMBER = "0979 414 477";
export const CAMPAIGN_NAME = "Potter's Shockers Fundraiser";
export const CURRENCY = "ZMW";
export const CURRENCY_SYMBOL = "K";
export const ORDER_NUMBER_PREFIX = "PS";

/** Default item-price map used when the Firestore config doc is missing. */
export const DEFAULT_ITEM_PRICES: Record<string, number> =
  Object.fromEntries(FUNDRAISING_MENU_ITEMS.map((i) => [i.key, i.defaultPrice]));

/**
 * Generate a human-friendly order number like `PS-2026-A7K3`.
 * Uses a 32-character alphabet that excludes visually-ambiguous letters
 * (I, O, 0, 1) so phone-relayed references are less error-prone.
 */
export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return `${ORDER_NUMBER_PREFIX}-${year}-${suffix}`;
}

const PICKUP_LABELS: Record<FundraisingPickupTimeOption, string> = {
  after_1st: "After 1st Service",
  after_2nd: "After 2nd Service",
  lunch_hour: "Lunch hour",
  custom: "Specific time",
};

export function getPickupTimeLabel(
  option: FundraisingPickupTimeOption,
  customTime: string | null
): string {
  if (option === "custom" && customTime) {
    return `At ${customTime}`;
  }
  return PICKUP_LABELS[option];
}

export const FUNDRAISING_PICKUP_OPTIONS: ReadonlyArray<{
  value: FundraisingPickupTimeOption;
  label: string;
}> = [
  { value: "after_1st", label: PICKUP_LABELS.after_1st },
  { value: "after_2nd", label: PICKUP_LABELS.after_2nd },
  { value: "lunch_hour", label: PICKUP_LABELS.lunch_hour },
  { value: "custom", label: "Pick a specific time..." },
];

const PREP_STATUS_LABELS: Record<FundraisingPreparationStatus, string> = {
  PENDING: "Pending",
  IN_PREP: "In preparation",
  READY: "Ready",
  COLLECTED: "Collected",
};

export function getPreparationStatusLabel(
  status: FundraisingPreparationStatus
): string {
  return PREP_STATUS_LABELS[status];
}

const PAYMENT_STATUS_LABELS: Record<FundraisingPaymentStatus, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
};

export function getPaymentStatusLabel(
  status: FundraisingPaymentStatus
): string {
  return PAYMENT_STATUS_LABELS[status];
}

/** Linear progression for the prep status (used by "advance" buttons). */
export const PREP_STATUS_ORDER: FundraisingPreparationStatus[] = [
  "PENDING",
  "IN_PREP",
  "READY",
  "COLLECTED",
];

export function getNextPrepStatus(
  current: FundraisingPreparationStatus
): FundraisingPreparationStatus | null {
  const idx = PREP_STATUS_ORDER.indexOf(current);
  if (idx < 0 || idx === PREP_STATUS_ORDER.length - 1) return null;
  return PREP_STATUS_ORDER[idx + 1];
}

export function getPrevPrepStatus(
  current: FundraisingPreparationStatus
): FundraisingPreparationStatus | null {
  const idx = PREP_STATUS_ORDER.indexOf(current);
  if (idx <= 0) return null;
  return PREP_STATUS_ORDER[idx - 1];
}

export function formatCurrency(amount: number): string {
  return `${CURRENCY_SYMBOL}${amount}`;
}
