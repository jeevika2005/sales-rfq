"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  FileSpreadsheet,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

import { expectedFieldsForType, VALVE_TYPES } from "@/types/valve";

export type ValveItemForm = {
  id: string;
  valveType: string;
  quantity: number;
  unitPrice: number | undefined;
  attributes: Record<string, string>;
};

export function makeLineId() {
  return crypto.randomUUID();
}

export function emptyValveItem(): ValveItemForm {
  return { id: makeLineId(), valveType: VALVE_TYPES[0], quantity: 1, unitPrice: undefined, attributes: {} };
}

function isEmpty(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

// Every expected field for the item's valve type shows as a row (even if
// the AI never extracted it) so a missing field is something to fill in,
// not something invisible — plus any extra keys the AI added beyond the
// canonical list (kept, never dropped).
function fieldRowsFor(item: ValveItemForm) {
  const expected = expectedFieldsForType(item.valveType);
  const extraKeys = Object.keys(item.attributes).filter((key) => !expected.includes(key));
  const missing = expected.filter((key) => isEmpty(item.attributes[key])).length;

  return {
    rows: [...expected.map((key) => ({ key, isExpected: true })), ...extraKeys.map((key) => ({ key, isExpected: false }))],
    missing,
  };
}

export function ValveItemsEditor({
  items,
  onChange,
  exportContext,
}: {
  items: ValveItemForm[];
  onChange: (items: ValveItemForm[]) => void;
  // Populates the exported workbook's RFQ_Info sheet — optional since this
  // component is also used inside the detail page's Edit form, where it's
  // less critical (a full per-quote export already exists on that page).
  exportContext?: {
    customerName?: string;
    customerEmail?: string;
    deliveryDate?: string;
    notes?: string;
    sourceFileName?: string;
    sourceType?: "pdf" | "excel" | "text";
  };
}) {
  // Collapsed by default — with 20+ parsed items, expanding every spec grid
  // at once would make the page unusable. Only the row header (type, qty,
  // price, total) shows until a row is expanded.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const totalMissing = useMemo(
    () => items.reduce((sum, item) => sum + fieldRowsFor(item).missing, 0),
    [items],
  );

  function updateItem(index: number, patch: Partial<ValveItemForm>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function updateAttribute(index: number, key: string, value: string) {
    onChange(
      items.map((item, i) => (i === index ? { ...item, attributes: { ...item.attributes, [key]: value } } : item)),
    );
  }

  function removeAttribute(index: number, key: string) {
    onChange(
      items.map((item, i) => {
        if (i !== index) return item;
        const attributes = { ...item.attributes };
        delete attributes[key];
        return { ...item, attributes };
      }),
    );
  }

  function addAttribute(index: number) {
    const key = window.prompt("Attribute name (e.g. size, class, endConnection)");
    if (!key?.trim()) return;
    setExpanded((prev) => new Set(prev).add(items[index].id));
    updateAttribute(index, key.trim(), "");
  }

  // Adds the new field across every item at once (a spreadsheet "add
  // column"), unlike "+ Add spec" which only touches one row.
  function addColumn() {
    const key = window.prompt("Column name (e.g. material, coating, remarks)");
    if (!key?.trim()) return;
    const trimmed = key.trim();
    onChange(items.map((item) => ({ ...item, attributes: { ...item.attributes, [trimmed]: item.attributes[trimmed] ?? "" } })));
    setExpanded(new Set(items.map((item) => item.id)));
  }

  async function handleExportExcel() {
    setExportError(null);
    if (items.length === 0) {
      setExportError("Add at least one valve item first.");
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch("/api/quotes/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...exportContext,
          valveItems: items.map((item) => ({
            id: item.id,
            valveType: item.valveType,
            quantity: item.quantity,
            ...(item.unitPrice !== undefined ? { unitPrice: item.unitPrice } : {}),
            attributes: item.attributes,
          })),
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "quote-review.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (exception) {
      setExportError(exception instanceof Error ? exception.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // §FR4.6 / §13.5 — valve grids are grouped by type (one card per type),
  // not a flat list. VALVE_TYPES order first, then any custom/unrecognized
  // type strings (defensive — the select only ever offers canonical ones).
  const groups = useMemo(() => {
    const byType = new Map<string, { item: ValveItemForm; index: number }[]>();
    items.forEach((item, index) => {
      const entries = byType.get(item.valveType) ?? [];
      entries.push({ item, index });
      byType.set(item.valveType, entries);
    });

    const ordered: { valveType: string; entries: { item: ValveItemForm; index: number }[] }[] = [];
    for (const type of VALVE_TYPES) {
      const entries = byType.get(type);
      if (entries?.length) ordered.push({ valveType: type, entries });
      byType.delete(type);
    }
    for (const [valveType, entries] of byType) ordered.push({ valveType, entries });
    return ordered;
  }, [items]);

  return (
    <div className="rounded-[8px] border border-border bg-card p-6 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Valve Items</h3>
        <div className="flex items-center gap-2">
          {items.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setExpanded(new Set(items.map((item) => item.id)))}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
                Expand all
              </button>
              <button
                type="button"
                onClick={() => setExpanded(new Set())}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
              >
                <ChevronsDownUp className="h-3.5 w-3.5" />
                Collapse all
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            Export to Excel
          </button>
          <button
            type="button"
            onClick={addColumn}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            Add column
          </button>
          <button
            type="button"
            onClick={() => onChange([...items, emptyValveItem()])}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            Add row
          </button>
        </div>
      </div>

      {exportError ? (
        <p role="alert" className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {exportError}
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-4 text-[12px]">
          <span className="inline-flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
          {totalMissing > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              {totalMissing} empty field{totalMissing === 1 ? "" : "s"} — highlighted below
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              All fields complete
            </span>
          )}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
          No valve items yet. Parse an RFQ above, or add a row manually.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => {
            const groupMissing = group.entries.reduce((sum, { item }) => sum + fieldRowsFor(item).missing, 0);
            return (
              <div key={group.valveType}>
                <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 rounded-md bg-muted px-3 py-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                    {group.valveType}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {group.entries.length} item{group.entries.length === 1 ? "" : "s"}
                  </span>
                  {groupMissing > 0 ? (
                    <span className="text-[10px] font-medium text-amber-600">{groupMissing} missing</span>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  {group.entries.map(({ item, index }) => {
                    const isExpanded = expanded.has(item.id);
                    const { rows, missing } = fieldRowsFor(item);

                    return (
                      <div key={item.id} className="rounded-lg border border-border">
                        <div className="flex flex-wrap items-center gap-3 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(item.id)}
                            className="flex shrink-0 items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "" : "-rotate-90"}`}
                            />
                            <span className="w-5 text-[11px] font-medium text-muted-foreground">{index + 1}</span>
                          </button>

                          <select
                            value={item.valveType}
                            onChange={(event) => updateItem(index, { valveType: event.target.value })}
                            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
                          >
                            {VALVE_TYPES.map((valveType) => (
                              <option key={valveType} value={valveType}>
                                {valveType}
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(event) => updateItem(index, { quantity: Number(event.target.value) || 1 })}
                            title="Quantity"
                            className="w-16 shrink-0 rounded-lg border border-border bg-background px-2 py-1.5 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
                          />

                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitPrice ?? ""}
                            onChange={(event) =>
                              updateItem(index, {
                                unitPrice: event.target.value === "" ? undefined : Number(event.target.value),
                              })
                            }
                            placeholder="Unit price"
                            title="Unit price"
                            className="w-24 shrink-0 rounded-lg border border-border bg-background px-2 py-1.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
                          />

                          <span className="w-20 shrink-0 text-right text-[12px] font-medium text-foreground">
                            {(item.quantity * (item.unitPrice ?? 0)).toFixed(2)}
                          </span>

                          <button
                            type="button"
                            onClick={() => toggleExpanded(item.id)}
                            className={`shrink-0 text-[10px] font-medium hover:underline ${
                              missing > 0
                                ? "text-amber-600 hover:text-amber-700"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {missing > 0 ? `${missing} missing` : "complete"}
                          </button>

                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {isExpanded ? (
                          <div className="border-t border-border px-4 py-3">
                            <div className="mb-3 flex items-center justify-between">
                              <p className="text-sm font-semibold uppercase tracking-wide text-foreground">
                                {item.valveType}
                              </p>
                              <button
                                type="button"
                                onClick={() => addAttribute(index)}
                                className="text-[11px] font-medium text-primary hover:underline"
                              >
                                + Add spec
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                              {rows.map(({ key, isExpected }) => {
                                const value = item.attributes[key] ?? "";
                                const empty = isEmpty(value);
                                return (
                                  <div key={key} className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                      <label
                                        className={`text-[10px] font-medium uppercase tracking-wide ${
                                          empty ? "text-amber-600" : "text-muted-foreground"
                                        }`}
                                      >
                                        {key}
                                      </label>
                                      {!isExpected ? (
                                        <button
                                          type="button"
                                          onClick={() => removeAttribute(index, key)}
                                          className="text-[10px] text-muted-foreground hover:text-destructive"
                                        >
                                          ✕
                                        </button>
                                      ) : null}
                                    </div>
                                    <input
                                      type="text"
                                      value={value}
                                      onChange={(event) => updateAttribute(index, key, event.target.value)}
                                      placeholder={empty ? "Missing" : undefined}
                                      className={`rounded-md border px-2 py-1.5 text-[11px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card ${
                                        empty
                                          ? "border-amber-400/60 bg-amber-500/5 placeholder:text-amber-600/70"
                                          : "border-border bg-background"
                                      }`}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
