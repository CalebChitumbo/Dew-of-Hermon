import type { Firestore, DocumentSnapshot } from "firebase-admin/firestore";
import {
  CAMPAIGN_NAME,
  CURRENCY,
  DEFAULT_ITEM_PRICES,
  DEFAULT_MOMO_NUMBER,
  FUNDRAISING_MENU_ITEMS,
  FUNDRAISING_MENU_ITEM_KEYS,
} from "@/lib/fundraising-menu";
import type {
  FundraisingMenuConfig,
  FundraisingMenuItem,
  FundraisingOrder,
  FundraisingOrderItem,
  FundraisingPickupTimeOption,
} from "@/types";

const MENU_DOC_PATH = "fundraisingConfig/menu";
const ORDERS_COLLECTION = "fundraisingOrders";

interface StoredMenuConfig {
  itemPrices?: Record<string, number>;
  /**
   * Item keys the Fundraising lead has hidden from the public order form.
   * Anything not in this list is considered enabled, so new menu items
   * added to FUNDRAISING_MENU_ITEMS show up automatically.
   */
  disabledItemKeys?: string[];
  momoNumber?: string;
  currency?: string;
}

/**
 * Load the menu config from Firestore. Missing fields fall back to the
 * hardcoded defaults so the order form always renders even if the config
 * doc has never been written. Includes ALL items (enabled + disabled);
 * the public API filters to enabled-only before serving buyers.
 */
export async function loadMenuConfig(
  db: Firestore
): Promise<FundraisingMenuConfig> {
  const snap = await db.doc(MENU_DOC_PATH).get();
  const stored = (snap.exists ? snap.data() : {}) as StoredMenuConfig;
  const prices = { ...DEFAULT_ITEM_PRICES, ...(stored.itemPrices || {}) };
  const disabled = new Set(stored.disabledItemKeys || []);

  const items: FundraisingMenuItem[] = FUNDRAISING_MENU_ITEMS.map((def) => ({
    key: def.key,
    name: def.name,
    description: def.description,
    emoji: def.emoji,
    imagePath: def.imagePath,
    price: prices[def.key] ?? def.defaultPrice,
    enabled: !disabled.has(def.key),
  }));

  return {
    items,
    momoNumber: stored.momoNumber || DEFAULT_MOMO_NUMBER,
    currency: stored.currency || CURRENCY,
    campaignName: CAMPAIGN_NAME,
  };
}

/**
 * Variant of the menu config that hides disabled items entirely. Used by
 * the public order page so buyers never see something they can't buy.
 */
export function filterToEnabled(
  config: FundraisingMenuConfig
): FundraisingMenuConfig {
  return {
    ...config,
    items: config.items.filter((i) => i.enabled),
  };
}

export interface OrderItemInput {
  itemKey: string;
  qty: number;
}

export interface OrderPayloadInput {
  braaiEventId: string;
  customerName: string;
  customerPhone: string;
  pickupTime: FundraisingPickupTimeOption;
  customPickupTime?: string | null;
  notes?: string | null;
  items: OrderItemInput[];
}

export interface ValidatedOrderPayload {
  braaiEventId: string;
  customerName: string;
  customerPhone: string;
  pickupTime: FundraisingPickupTimeOption;
  customPickupTime: string | null;
  notes: string | null;
  items: FundraisingOrderItem[];
  total: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

const PICKUP_OPTIONS: FundraisingPickupTimeOption[] = [
  "after_1st",
  "after_2nd",
  "lunch_hour",
  "custom",
];

/**
 * Validate the incoming payload against the loaded menu config and recompute
 * the authoritative server-side total. Throws on any client-supplied value
 * that is missing, malformed, or doesn't match a known menu item.
 */
export function validateOrderPayload(
  raw: unknown,
  menu: FundraisingMenuConfig
): ValidatedOrderPayload {
  if (!raw || typeof raw !== "object") {
    throw new OrderValidationError("body", "Order body is required.");
  }
  const body = raw as Record<string, unknown>;

  const braaiEventId = stringOrEmpty(body.braaiEventId).trim();
  if (!braaiEventId) {
    throw new OrderValidationError("braaiEventId", "Pick a braai to order from.");
  }

  const customerName = stringOrEmpty(body.customerName).trim();
  if (!customerName) {
    throw new OrderValidationError("customerName", "Customer name is required.");
  }
  if (customerName.length > 120) {
    throw new OrderValidationError("customerName", "Name is too long.");
  }

  const customerPhone = stringOrEmpty(body.customerPhone).trim();
  if (!customerPhone) {
    throw new OrderValidationError(
      "customerPhone",
      "Phone number is required so we can find you at collection."
    );
  }
  if (customerPhone.length > 40) {
    throw new OrderValidationError("customerPhone", "Phone number is too long.");
  }

  const pickupTime = stringOrEmpty(body.pickupTime) as FundraisingPickupTimeOption;
  if (!PICKUP_OPTIONS.includes(pickupTime)) {
    throw new OrderValidationError("pickupTime", "Pickup time is required.");
  }

  let customPickupTime: string | null = null;
  if (pickupTime === "custom") {
    const ct = stringOrEmpty(body.customPickupTime).trim();
    if (!ct) {
      throw new OrderValidationError(
        "customPickupTime",
        "Pick a specific time for collection."
      );
    }
    if (!/^\d{1,2}:\d{2}$/.test(ct)) {
      throw new OrderValidationError(
        "customPickupTime",
        "Time should look like HH:mm."
      );
    }
    customPickupTime = ct;
  }

  const notesRaw = stringOrEmpty(body.notes).trim();
  const notes = notesRaw ? notesRaw.slice(0, 500) : null;

  const itemsRaw = body.items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    throw new OrderValidationError(
      "items",
      "Add at least one item to your order."
    );
  }

  // Only enabled items are in `menu.items` when callers pass the filtered
  // config; disabled items are simply treated as unavailable.
  const priceMap = new Map(menu.items.map((i) => [i.key, i]));
  const seen = new Set<string>();
  const items: FundraisingOrderItem[] = [];

  for (const rawItem of itemsRaw) {
    if (!rawItem || typeof rawItem !== "object") {
      throw new OrderValidationError("items", "Invalid item in order.");
    }
    const item = rawItem as Record<string, unknown>;
    const itemKey = stringOrEmpty(item.itemKey).trim();
    if (!FUNDRAISING_MENU_ITEM_KEYS.has(itemKey)) {
      throw new OrderValidationError("items", `Unknown menu item: ${itemKey}.`);
    }
    if (seen.has(itemKey)) {
      throw new OrderValidationError(
        "items",
        `Duplicate item ${itemKey} in order.`
      );
    }
    seen.add(itemKey);

    const menuItem = priceMap.get(itemKey);
    if (!menuItem) {
      throw new OrderValidationError(
        "items",
        `${itemKey} isn't available right now.`
      );
    }

    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new OrderValidationError(
        "items",
        `Quantity for ${itemKey} must be between 1 and 99.`
      );
    }

    const subtotal = menuItem.price * qty;
    items.push({
      itemKey,
      name: menuItem.name,
      unitPrice: menuItem.price,
      qty,
      subtotal,
    });
  }

  const total = items.reduce((sum, i) => sum + i.subtotal, 0);

  return {
    braaiEventId,
    customerName,
    customerPhone,
    pickupTime,
    customPickupTime,
    notes,
    items,
    total,
  };
}

function stringOrEmpty(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export class OrderValidationError extends Error {
  constructor(
    public field: string,
    message: string
  ) {
    super(message);
    this.name = "OrderValidationError";
  }
}

/**
 * Serialize a Firestore order document into the JSON shape consumed by the
 * client (Timestamps → ISO strings).
 */
export function serializeOrder(doc: DocumentSnapshot): FundraisingOrder {
  const data = doc.data() || {};
  const toIso = (v: unknown): Date | null => {
    if (!v) return null;
    if (typeof v === "object" && v !== null && "toDate" in v) {
      const d = (v as { toDate: () => Date }).toDate();
      return d;
    }
    if (v instanceof Date) return v;
    if (typeof v === "string") return new Date(v);
    return null;
  };

  return {
    id: doc.id,
    orderNumber: (data.orderNumber as string) || "",
    braaiEventId: (data.braaiEventId as string) || "",
    braaiEventTitle: (data.braaiEventTitle as string) || "",
    braaiEventDate: toIso(data.braaiEventDate),
    customerName: (data.customerName as string) || "",
    customerPhone: (data.customerPhone as string) || "",
    pickupTime: ((data.pickupTime as string) ||
      "after_1st") as FundraisingOrder["pickupTime"],
    customPickupTime: (data.customPickupTime as string | null) ?? null,
    notes: (data.notes as string | null) ?? null,
    items: (data.items as FundraisingOrderItem[]) || [],
    total: Number(data.total) || 0,
    currency: (data.currency as string) || CURRENCY,
    paymentStatus: ((data.paymentStatus as string) ||
      "UNPAID") as FundraisingOrder["paymentStatus"],
    paymentMethod:
      (data.paymentMethod as FundraisingOrder["paymentMethod"]) ?? null,
    paidAt: toIso(data.paidAt),
    paidBy: (data.paidBy as string | null) ?? null,
    paidByName: (data.paidByName as string | null) ?? null,
    preparationStatus: ((data.preparationStatus as string) ||
      "PENDING") as FundraisingOrder["preparationStatus"],
    preparationUpdatedAt: toIso(data.preparationUpdatedAt) || new Date(),
    preparationUpdatedBy:
      (data.preparationUpdatedBy as string | null) ?? null,
    preparationUpdatedByName:
      (data.preparationUpdatedByName as string | null) ?? null,
    submittedBy: ((data.submittedBy as string) ||
      "buyer") as FundraisingOrder["submittedBy"],
    submittedByUserId: (data.submittedByUserId as string | null) ?? null,
    isArchived: Boolean(data.isArchived),
    createdAt: toIso(data.createdAt) || new Date(),
    updatedAt: toIso(data.updatedAt) || new Date(),
  };
}

/**
 * Generate a unique order number, retrying on the (very unlikely) collision.
 * Uses up to `maxAttempts` random suffixes; throws if all attempts collide.
 */
export async function generateUniqueOrderNumber(
  db: Firestore,
  generator: () => string,
  maxAttempts = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generator();
    const existing = await db
      .collection(ORDERS_COLLECTION)
      .where("orderNumber", "==", candidate)
      .limit(1)
      .get();
    if (existing.empty) return candidate;
  }
  throw new Error("Could not allocate a unique order number, please retry.");
}

export const FUNDRAISING_ORDERS_COLLECTION = ORDERS_COLLECTION;
export const FUNDRAISING_MENU_DOC_PATH = MENU_DOC_PATH;
