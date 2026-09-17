export const VALVE_TYPES = [
  "FLOATING BALL VALVE",
  "TRUNNION BALL VALVE",
  "GATE VALVE",
  "GLOBE VALVE",
  "CHECK VALVE",
  "PLUG VALVE",
] as const;

export type ValveType = (typeof VALVE_TYPES)[number];

// SalesValveItem — the canonical line-item shape (PRD §7.3).
// `attributes` holds every spec field (common + type-specific); it's
// intentionally open (model may emit extra unknown keys — those get kept,
// not dropped, and become extra Excel columns later).
export type SalesValveItem = {
  id: string;
  valveType: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  attributes: Record<string, string | number | undefined>;
};

// PRD §7.4 — when only "trim" is present, copy it into the type-specific
// fields below if those fields are still empty.
export const TRIM_DISTRIBUTION: Record<string, readonly string[]> = {
  "FLOATING BALL VALVE": ["ball", "stem"],
  "TRUNNION BALL VALVE": ["seatCarrier", "ball", "stem", "trunnion"],
  "GATE VALVE": ["seat", "disc", "stem", "backSeat", "gland"],
  "GLOBE VALVE": ["seat", "disc", "stem", "backSeat", "gland"],
  "CHECK VALVE": ["seat", "disc", "hingePin"],
};

export function applyTrimDistribution(item: SalesValveItem): SalesValveItem {
  const targets = TRIM_DISTRIBUTION[item.valveType];
  const trim = item.attributes.trim;
  if (!targets || trim === undefined || trim === "") return item;

  const attributes = { ...item.attributes };
  for (const key of targets) {
    if (attributes[key] === undefined || attributes[key] === "") {
      attributes[key] = trim;
    }
  }
  return { ...item, attributes };
}
