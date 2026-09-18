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

// Mirrors the Gemini system prompt's field lists (quote-parse.service.ts,
// §7.2) — the canonical set of spec fields a valve of this type SHOULD
// have. Used by the review grid to show every expected field (even ones
// the AI didn't extract) and flag which are still empty.
export const COMMON_ATTRIBUTE_FIELDS = [
  "item",
  "tagNumber",
  "pid",
  "dataSheetNo",
  "operatingTempMin",
  "operatingTempMax",
  "shutOffPressure",
  "specialRequirements",
  "compliance",
  "certification",
  "deliveryDate",
] as const;

const BALL_VALVE_FIELDS = [
  "valveModel",
  "construction",
  "size",
  "class",
  "endConnection",
  "body",
  "gasket",
  "packing",
  "seals",
  "bolting",
  "operator",
  "bore",
  "seat",
  "ball",
  "stem",
  "trim",
] as const;

const GATE_GLOBE_FIELDS = [
  "construction",
  "size",
  "class",
  "endConnection",
  "body",
  "trimNo",
  "seat",
  "disc",
  "stem",
  "backSeat",
  "gland",
  "gasket",
  "packing",
  "bolting",
  "operator",
] as const;

const CHECK_VALVE_FIELDS = [
  "construction",
  "size",
  "class",
  "endConnection",
  "body",
  "trimNo",
  "seat",
  "disc",
  "hinge",
  "hingePin",
  "gasket",
  "bolting",
] as const;

export const TYPE_SPECIFIC_FIELDS: Record<string, readonly string[]> = {
  "FLOATING BALL VALVE": BALL_VALVE_FIELDS,
  "TRUNNION BALL VALVE": [...BALL_VALVE_FIELDS, "seatCarrier", "seatInsert", "trunnion"],
  "GATE VALVE": GATE_GLOBE_FIELDS,
  "GLOBE VALVE": GATE_GLOBE_FIELDS,
  "CHECK VALVE": CHECK_VALVE_FIELDS,
  "PLUG VALVE": GATE_GLOBE_FIELDS,
};

// "size" is the one field the prompt marks required for every type — it's
// the field most worth flagging if a row is missing it.
export const REQUIRED_ATTRIBUTE_FIELD = "size";

export function expectedFieldsForType(valveType: string): readonly string[] {
  return [...COMMON_ATTRIBUTE_FIELDS, ...(TYPE_SPECIFIC_FIELDS[valveType] ?? [])];
}

// Human labels for the canonical attribute keys — §7.1's own LABEL column
// for the common fields (verbatim), plus standard valve-engineering terms
// for the §7.2 type-specific ones (the PRD only gives keys there, no labels).
export const ATTRIBUTE_FIELD_LABELS: Record<string, string> = {
  item: "Item",
  tagNumber: "Tag Number",
  pid: "P&ID",
  dataSheetNo: "Data Sheet No",
  operatingTempMin: "Operating Temp (Min)",
  operatingTempMax: "Operating Temp (Max)",
  shutOffPressure: "Shut off Pressure (Barg)",
  specialRequirements: "Special Requirements",
  compliance: "Compliance / NACE / API",
  certification: "Certification / MTC",
  deliveryDate: "Line Delivery",
  valveModel: "Valve Model",
  construction: "Construction",
  size: "Size",
  class: "Class",
  endConnection: "End Connection",
  body: "Body",
  gasket: "Gasket",
  packing: "Packing",
  seals: "Seals",
  bolting: "Bolting",
  operator: "Operator",
  bore: "Bore",
  seat: "Seat",
  ball: "Ball",
  stem: "Stem",
  trim: "Trim",
  seatCarrier: "Seat Carrier",
  seatInsert: "Seat Insert",
  trunnion: "Trunnion",
  trimNo: "Trim No",
  disc: "Disc",
  backSeat: "Back Seat",
  gland: "Gland",
  hinge: "Hinge",
  hingePin: "Hinge Pin",
};

// Fallback for any extra/unknown key the AI emits beyond the canonical
// list above (valve.ts's own contract: "extra unknown keys are kept, not
// dropped, and become extra Excel columns").
export function humanizeFieldKey(key: string): string {
  const withSpaces = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

export function labelForField(key: string): string {
  return ATTRIBUTE_FIELD_LABELS[key] ?? humanizeFieldKey(key);
}
