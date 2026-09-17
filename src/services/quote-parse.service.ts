import type { PartUnion } from "@google/genai";
import ExcelJS from "exceljs";

import { GEMINI_MAX_OUTPUT_TOKENS, GEMINI_MODEL, gemini } from "@/lib/gemini";
import { ExtractionError } from "@/lib/response";
import { applyTrimDistribution, VALVE_TYPES, type SalesValveItem } from "@/types/valve";
import { valveItemsResponseSchema } from "@/validations/quote-parse.validation";

const SYSTEM_INSTRUCTION = `You are an expert industrial valve engineer reading an RFQ (request for quote) document for a valve distributor.

Extract every valve line item into structured JSON. Follow these rules exactly:

1. Return JSON only. No prose, no markdown fences, no explanation — just the JSON object.
2. The JSON has exactly one top-level key: "valveItems", an array of objects.
3. Do NOT extract customer name, email, phone, or company identity from the document — that is entered separately by the user, never by you.
4. Each item's "valveType" must be exactly one of these strings (uppercase, no variation):
   ${VALVE_TYPES.join(", ")}
5. Each item has this shape:
   { "id": "<stable string, e.g. the RFQ item/line number>", "valveType": "<one of the types above>", "quantity": <number>, "unitPrice": <number, omit if unknown>, "totalPrice": <number, omit if unknown>, "attributes": { ...spec fields... } }
6. Common attribute keys (any type): item, tagNumber, pid, dataSheetNo, operatingTempMin, operatingTempMax, shutOffPressure, specialRequirements, compliance, certification, deliveryDate.
7. Type-specific attribute keys:
   - FLOATING BALL VALVE: valveModel, construction, size (required), class, endConnection, body, gasket, packing, seals, bolting, operator, bore, seat, ball, stem, trim
   - TRUNNION BALL VALVE: same as floating ball, plus seatCarrier, seatInsert, trunnion
   - GATE VALVE / GLOBE VALVE: construction, size (required), class, endConnection, body, trimNo, seat, disc, stem, backSeat, gland, gasket, packing, bolting, operator
   - CHECK VALVE: construction, size (required), class, endConnection, body, trimNo, seat, disc, hinge, hingePin, gasket, bolting
   - PLUG VALVE: treat like GATE VALVE's fields
8. Map synonyms to the exact keys above: NPS or DN -> size, "#150"/"150#" style ratings -> class, "SS" -> stainless (inside whichever field it modifies, e.g. body material). Keep the mapped value as the text found in the document (e.g. size stays "4\\"" or "DN100" as written, just stored under the "size" key).
9. Scan the ENTIRE document, every page. RFQs often have multi-page tables — do not stop after the first table or the first page.
10. A line item's specs are sometimes split across multiple rows (item number on one row, specs on following rows). Merge those into ONE item. Rows with a NEW, distinct item number are separate items.
11. Ignore summary, subtotal, and total rows — extract line items only.
12. "quantity" is required on every item; default to 1 if the document doesn't state one.
13. If unitPrice is present but totalPrice is not, leave totalPrice out (it will be computed as quantity * unitPrice downstream) — never guess a price that is not in the document.
14. Omit attribute keys the document doesn't mention — do not invent values. An empty/unknown field should simply not appear in "attributes".`;

const RETRY_SUFFIX = `

IMPORTANT: Your previous response was truncated or invalid. Keep this response SHORTER — omit the "specialRequirements"/"compliance"/"certification" attributes if space is tight, and prioritize returning valid, complete JSON for every item over including every optional field.`;

function extractJsonText(rawText: string): string {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

async function callGemini(contents: PartUnion[], isRetry: boolean) {
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION + (isRetry ? RETRY_SUFFIX : ""),
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
      temperature: 0,
    },
  });

  const truncated = response.candidates?.[0]?.finishReason === "MAX_TOKENS";
  const text = response.text;

  return { text, truncated };
}

function parseValveItems(rawText: string | undefined): SalesValveItem[] | null {
  if (!rawText) return null;

  let json: unknown;
  try {
    json = JSON.parse(extractJsonText(rawText));
  } catch {
    return null;
  }

  const parsed = valveItemsResponseSchema.safeParse(json);
  if (!parsed.success) return null;

  return parsed.data.valveItems.map((item, index) => {
    const quantity = item.quantity ?? 1;
    const unitPrice = item.unitPrice;
    const totalPrice = item.totalPrice ?? (unitPrice !== undefined ? quantity * unitPrice : undefined);

    return applyTrimDistribution({
      id: String(item.id ?? index + 1),
      valveType: item.valveType,
      quantity,
      unitPrice,
      totalPrice,
      attributes: (item.attributes as SalesValveItem["attributes"]) ?? {},
    });
  });
}

// FR-3.12: one automatic retry with a shorter prompt on truncated/invalid
// JSON, then a 422 with a readable error. Shared by every input mode —
// only `contents` (what we hand Gemini) differs per mode.
async function runExtraction(contents: PartUnion[]): Promise<SalesValveItem[]> {
  const first = await callGemini(contents, false);
  let items = first.truncated ? null : parseValveItems(first.text);

  if (!items) {
    const retry = await callGemini(contents, true);
    items = retry.truncated ? null : parseValveItems(retry.text);
  }

  if (!items || items.length === 0) {
    throw new ExtractionError();
  }

  return items;
}

export function parseValveItemsFromText(text: string): Promise<SalesValveItem[]> {
  return runExtraction([{ text }]);
}

// FR-3.4: PDF parse via Gemini multimodal, entire document.
export function parseValveItemsFromPdf(base64Data: string): Promise<SalesValveItem[]> {
  return runExtraction([
    { text: "Extract every valve line item from this RFQ PDF, scanning all pages." },
    { inlineData: { mimeType: "application/pdf", data: base64Data } },
  ]);
}

// FR-3.3 / §11.4 GEMINI_SALES_PDF_DOCUMENT_MAX_BYTES — both limits are
// checked against the decoded byte size, not the (larger) base64 string
// length.
export function getBase64ByteSize(base64Data: string): number {
  const clean = base64Data.replace(/^data:.*;base64,/, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return (clean.length * 3) / 4 - padding;
}

// ==================== Excel (FR-3.5) ====================

// §11.4 Excel guards.
const MAX_ROWS = Number(process.env.SALES_RFQ_PARSE_MAX_ROWS ?? 320);
const MAX_COLS = Number(process.env.SALES_RFQ_PARSE_MAX_COLS ?? 50);
const MAX_CELL = Number(process.env.SALES_RFQ_PARSE_MAX_CELL ?? 500);

// Recognized header text -> canonical key. Deterministic parsing only
// kicks in when a sheet's headers clearly map to this known schema
// (FR-3.5); anything else falls back to the Gemini text path.
const HEADER_ALIASES: Record<string, string> = {
  "valve type": "valveType",
  type: "valveType",
  "item description": "valveType",
  description: "valveType",
  size: "size",
  nps: "size",
  dn: "size",
  qty: "quantity",
  quantity: "quantity",
  "unit price": "unitPrice",
  price: "unitPrice",
  "total price": "totalPrice",
  total: "totalPrice",
  class: "class",
  rating: "class",
  "end connection": "endConnection",
  ends: "endConnection",
  body: "body",
  "body material": "body",
  item: "item",
  "item no": "item",
  "sr no": "item",
  "s.no": "item",
  tag: "tagNumber",
  "tag number": "tagNumber",
  "tag no": "tagNumber",
  trim: "trim",
  "trim no": "trimNo",
};

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.text ?? String(cell.value ?? "");
  return value.trim().slice(0, MAX_CELL);
}

async function loadFirstWorksheet(base64Data: string): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(base64Data, "base64");
  // exceljs declares its own ambient `Buffer extends ArrayBuffer` type that
  // conflicts with Node's real Buffer (@types/node) — a type-def bug in the
  // package, not a real runtime mismatch. Cast through unknown to bridge it.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const worksheet = workbook.worksheets.find((sheet) => sheet.rowCount > 1);
  if (!worksheet) {
    throw new ExtractionError("The workbook has no data to parse");
  }
  return worksheet;
}

// Returns a column-index -> canonical-key map if the header row clearly
// matches the known schema (a valve-type column plus at least one of
// size/quantity), or null if it doesn't — the caller falls back to
// Gemini in that case.
function detectColumnMap(headerRow: ExcelJS.Row): Map<number, string> | null {
  const map = new Map<number, string>();

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (colNumber > MAX_COLS) return;
    const key = HEADER_ALIASES[cellText(cell).toLowerCase()];
    if (key) map.set(colNumber, key);
  });

  const keys = new Set(map.values());
  const hasValveType = keys.has("valveType");
  const hasSizeOrQty = keys.has("size") || keys.has("quantity");

  return hasValveType && hasSizeOrQty ? map : null;
}

function parseDeterministic(
  worksheet: ExcelJS.Worksheet,
  columnMap: Map<number, string>,
): SalesValveItem[] {
  const items: SalesValveItem[] = [];
  const lastRow = Math.min(worksheet.rowCount, MAX_ROWS + 1); // +1 for header

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    if (row.actualCellCount === 0) continue;

    const attributes: SalesValveItem["attributes"] = {};
    let valveType = "";
    let quantity: number | undefined;
    let unitPrice: number | undefined;
    let totalPrice: number | undefined;

    for (const [colNumber, key] of columnMap) {
      const text = cellText(row.getCell(colNumber));
      if (!text) continue;

      if (key === "valveType") valveType = text.toUpperCase();
      else if (key === "quantity") quantity = Number(text) || undefined;
      else if (key === "unitPrice") unitPrice = Number(text) || undefined;
      else if (key === "totalPrice") totalPrice = Number(text) || undefined;
      else attributes[key] = text;
    }

    if (!valveType) continue; // no valve type on this row — likely a summary/blank row

    const qty = quantity ?? 1;
    items.push(
      applyTrimDistribution({
        id: String(rowNumber - 1),
        valveType,
        quantity: qty,
        unitPrice,
        totalPrice: totalPrice ?? (unitPrice !== undefined ? qty * unitPrice : undefined),
        attributes,
      }),
    );
  }

  return items;
}

function worksheetToText(worksheet: ExcelJS.Worksheet): string {
  const lines: string[] = [];
  const lastRow = Math.min(worksheet.rowCount, MAX_ROWS);

  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    if (row.actualCellCount === 0) continue;

    const cells: string[] = [];
    const lastCol = Math.min(row.cellCount, MAX_COLS);
    for (let colNumber = 1; colNumber <= lastCol; colNumber++) {
      cells.push(cellText(row.getCell(colNumber)));
    }
    lines.push(cells.join(" | "));
  }

  return lines.join("\n");
}

// FR-3.5: deterministic parse (no LLM) when headers match the known
// schema; otherwise the sheet is flattened to text and sent through the
// same Gemini pipeline as text mode.
export async function parseValveItemsFromExcel(base64Data: string): Promise<SalesValveItem[]> {
  const worksheet = await loadFirstWorksheet(base64Data);
  const headerRow = worksheet.getRow(1);
  const columnMap = detectColumnMap(headerRow);

  if (columnMap) {
    const items = parseDeterministic(worksheet, columnMap);
    if (items.length > 0) return items;
    // Matched the schema but produced nothing usable — fall through to
    // Gemini rather than failing outright.
  }

  const sheetText = worksheetToText(worksheet);
  return runExtraction([
    {
      text: `The following is a spreadsheet (rows separated by newlines, cells by " | ") containing an RFQ. Extract every valve line item.\n\n${sheetText}`,
    },
  ]);
}
