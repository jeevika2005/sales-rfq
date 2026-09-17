import ExcelJS from "exceljs";

type ExportableValveItem = {
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

// FR-3.x — lets the user export the AI-parsed/edited review grid to Excel
// before committing to a quote (a working copy, not the persisted record).
export async function buildValveItemsWorkbook(items: ExportableValveItem[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Valve Items");

  const attributeKeys = [...new Set(items.flatMap((item) => Object.keys(item.attributes)))].sort();

  sheet.columns = [
    { header: "Valve Type", key: "valveType", width: 22 },
    { header: "Quantity", key: "quantity", width: 10 },
    { header: "Unit Price", key: "unitPrice", width: 12 },
    { header: "Total Price", key: "totalPrice", width: 12 },
    ...attributeKeys.map((key) => ({ header: key, key, width: 16 })),
  ];
  sheet.getRow(1).font = { bold: true };

  for (const item of items) {
    const unitPrice = item.unitPrice ?? 0;
    sheet.addRow({
      valveType: item.valveType,
      quantity: item.quantity,
      unitPrice,
      totalPrice: item.totalPrice ?? Math.round(item.quantity * unitPrice * 100) / 100,
      ...Object.fromEntries(attributeKeys.map((key) => [key, item.attributes[key] ?? ""])),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
