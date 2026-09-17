import ExcelJS from "exceljs";

import { COMMON_ATTRIBUTE_FIELDS, REQUIRED_ATTRIBUTE_FIELD, TYPE_SPECIFIC_FIELDS, VALVE_TYPES, labelForField } from "@/types/valve";

export type ExportableValveItem = {
  valveType: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  attributes: Record<string, unknown>;
};

type PersistedQuoteItem = {
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  attributes: unknown;
};

// A persisted QuoteItem's `attributes` blob carries valveType/_lineId mixed
// in with the real spec fields (see buildItemsData in quote.service.ts) —
// strip those two internal keys back out for a clean exported sheet.
export function toExportableItems(items: PersistedQuoteItem[]): ExportableValveItem[] {
  return items.map((item) => {
    const raw = (item.attributes ?? {}) as Record<string, unknown>;
    const specAttributes = Object.fromEntries(
      Object.entries(raw).filter(([key]) => key !== "valveType" && key !== "_lineId"),
    );

    return {
      valveType: typeof raw.valveType === "string" ? raw.valveType : item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      attributes: specAttributes,
    };
  });
}

export type WorkbookContext = {
  quoteNumber?: string;
  customerName?: string;
  customerEmail?: string;
  deliveryDate?: string;
  notes?: string;
  sourceFileName?: string;
  sourceType: "pdf" | "excel" | "text" | "quote";
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function lineTotal(item: ExportableValveItem): number {
  const unitPrice = item.unitPrice ?? 0;
  return item.totalPrice ?? round2(item.quantity * unitPrice);
}

// §FR-6 — RFQ_Info: quote/customer/source metadata, formatVersion 1.1.
function addRfqInfoSheet(workbook: ExcelJS.Workbook, context: WorkbookContext) {
  const sheet = workbook.addWorksheet("RFQ_Info");
  sheet.columns = [
    { header: "Field", key: "field", width: 20 },
    { header: "Value", key: "value", width: 50 },
  ];
  sheet.getRow(1).font = { bold: true };

  const rows: [string, string][] = [
    ["Quote Number", context.quoteNumber ?? ""],
    ["Customer", context.customerName ?? ""],
    ["Email", context.customerEmail ?? ""],
    ["Delivery", context.deliveryDate ?? ""],
    ["Source File", context.sourceFileName ?? ""],
    ["Source Type", context.sourceType],
    ["Notes", context.notes ?? ""],
    ["Format Version", "1.1"],
    ["Exported At", new Date().toISOString()],
  ];
  for (const [field, value] of rows) sheet.addRow({ field, value });
}

// §FR-6 — All_LineItems: every line, Line No/Item pulled out as their own
// columns, then the union of every other attribute key across all items.
function addAllLineItemsSheet(workbook: ExcelJS.Workbook, items: ExportableValveItem[]) {
  const sheet = workbook.addWorksheet("All_LineItems");
  const attributeKeys = [...new Set(items.flatMap((item) => Object.keys(item.attributes)))]
    .filter((key) => key !== "item")
    .sort();

  sheet.columns = [
    { header: "Line No", key: "lineNo", width: 8 },
    { header: "Item", key: "item", width: 10 },
    { header: "Valve Type", key: "valveType", width: 22 },
    { header: "Quantity", key: "quantity", width: 10 },
    { header: "Unit Price", key: "unitPrice", width: 12 },
    { header: "Total Price", key: "totalPrice", width: 12 },
    ...attributeKeys.map((key) => ({ header: labelForField(key), key, width: 18 })),
  ];
  sheet.getRow(1).font = { bold: true };

  items.forEach((item, index) => {
    sheet.addRow({
      lineNo: index + 1,
      item: item.attributes.item ?? "",
      valveType: item.valveType,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? 0,
      totalPrice: lineTotal(item),
      ...Object.fromEntries(attributeKeys.map((key) => [key, item.attributes[key] ?? ""])),
    });
  });
}

// §FR-6 — one sheet per valve type present, same columns as that type's
// on-screen review grid (human labels on row 1).
function addPerTypeSheets(workbook: ExcelJS.Workbook, items: ExportableValveItem[]) {
  const byType = new Map<string, ExportableValveItem[]>();
  for (const item of items) {
    const list = byType.get(item.valveType) ?? [];
    list.push(item);
    byType.set(item.valveType, list);
  }

  const usedSheetNames = new Set<string>();

  for (const [valveType, typeItems] of byType) {
    const expectedKeys = [
      ...COMMON_ATTRIBUTE_FIELDS,
      ...(TYPE_SPECIFIC_FIELDS[valveType] ?? []),
    ].filter((key) => key !== "item");

    let sheetName = valveType.slice(0, 31);
    while (usedSheetNames.has(sheetName)) sheetName = `${sheetName.slice(0, 28)}...`;
    usedSheetNames.add(sheetName);

    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = [
      { header: "Line No", key: "lineNo", width: 8 },
      { header: "Item", key: "item", width: 10 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Unit Price", key: "unitPrice", width: 12 },
      { header: "Total Price", key: "totalPrice", width: 12 },
      ...expectedKeys.map((key) => ({ header: labelForField(key), key, width: 18 })),
    ];
    sheet.getRow(1).font = { bold: true };

    typeItems.forEach((item, index) => {
      sheet.addRow({
        lineNo: index + 1,
        item: item.attributes.item ?? "",
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? 0,
        totalPrice: lineTotal(item),
        ...Object.fromEntries(expectedKeys.map((key) => [key, item.attributes[key] ?? ""])),
      });
    });
  }
}

// §FR-6 — Field_Schema: key, label, group, required, appliesToValveTypes.
// A static reference sheet — doesn't depend on the items being exported.
function addFieldSchemaSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("Field_Schema");
  sheet.columns = [
    { header: "Key", key: "key", width: 20 },
    { header: "Label", key: "label", width: 28 },
    { header: "Group", key: "group", width: 12 },
    { header: "Required", key: "required", width: 10 },
    { header: "Applies To Valve Types", key: "appliesTo", width: 60 },
  ];
  sheet.getRow(1).font = { bold: true };

  sheet.addRow({ key: "valveType", label: "Valve Type", group: "core", required: true, appliesTo: "ALL" });
  sheet.addRow({ key: "quantity", label: "Quantity", group: "core", required: true, appliesTo: "ALL" });
  sheet.addRow({ key: "unitPrice", label: "Unit Price", group: "pricing", required: false, appliesTo: "ALL" });
  sheet.addRow({ key: "totalPrice", label: "Total Price", group: "pricing", required: false, appliesTo: "ALL" });

  // Which valve types each attribute key applies to — common fields apply
  // to all of them, type-specific ones only to the types that list them
  // (several keys, e.g. "size"/"seat"/"gasket", are shared by more than
  // one type, so this has to be a set per key, not first-match-wins).
  const appliesTo = new Map<string, Set<string>>();
  for (const key of COMMON_ATTRIBUTE_FIELDS) appliesTo.set(key, new Set(VALVE_TYPES));
  for (const valveType of VALVE_TYPES) {
    for (const key of TYPE_SPECIFIC_FIELDS[valveType] ?? []) {
      if (!appliesTo.has(key)) appliesTo.set(key, new Set());
      appliesTo.get(key)!.add(valveType);
    }
  }

  for (const [key, types] of appliesTo) {
    sheet.addRow({
      key,
      label: labelForField(key),
      group: "attribute",
      required: key === REQUIRED_ATTRIBUTE_FIELD,
      appliesTo: types.size === VALVE_TYPES.length ? "ALL" : [...types].sort().join(", "),
    });
  }
}

export async function buildQuoteWorkbook(
  context: WorkbookContext,
  items: ExportableValveItem[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  addRfqInfoSheet(workbook, context);
  addAllLineItemsSheet(workbook, items);
  addPerTypeSheets(workbook, items);
  addFieldSchemaSheet(workbook);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
