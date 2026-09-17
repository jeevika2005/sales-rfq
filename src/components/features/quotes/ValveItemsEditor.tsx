"use client";

import { Plus, Trash2 } from "lucide-react";

import { VALVE_TYPES } from "@/types/valve";

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

export function ValveItemsEditor({
  items,
  onChange,
}: {
  items: ValveItemForm[];
  onChange: (items: ValveItemForm[]) => void;
}) {
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
    updateAttribute(index, key.trim(), "");
  }

  return (
    <div className="rounded-[8px] border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Valve Items</h3>
        <button
          type="button"
          onClick={() => onChange([...items, emptyValveItem()])}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Row
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
          No valve items yet. Parse an RFQ above, or add a row manually.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item, index) => (
            <div key={item.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium text-foreground">Valve Type</label>
                  <select
                    value={item.valveType}
                    onChange={(event) => updateItem(index, { valveType: event.target.value })}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
                  >
                    {VALVE_TYPES.map((valveType) => (
                      <option key={valveType} value={valveType}>
                        {valveType}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium text-foreground">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(event) => updateItem(index, { quantity: Number(event.target.value) || 1 })}
                    className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium text-foreground">Unit Price</label>
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
                    placeholder="0.00"
                    className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-foreground">Line Total</span>
                  <span className="px-3 py-2 text-[12px] font-medium text-foreground">
                    {(item.quantity * (item.unitPrice ?? 0)).toFixed(2)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="ml-auto flex h-9 items-center gap-1.5 rounded-md px-3 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">Specifications</span>
                  <button
                    type="button"
                    onClick={() => addAttribute(index)}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    + Add spec
                  </button>
                </div>
                {Object.keys(item.attributes).length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">No specs extracted.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {Object.entries(item.attributes).map(([key, value]) => (
                      <div key={key} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {key}
                          </label>
                          <button
                            type="button"
                            onClick={() => removeAttribute(index, key)}
                            className="text-[10px] text-muted-foreground hover:text-destructive"
                          >
                            ✕
                          </button>
                        </div>
                        <input
                          type="text"
                          value={value}
                          onChange={(event) => updateAttribute(index, key, event.target.value)}
                          className="rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
