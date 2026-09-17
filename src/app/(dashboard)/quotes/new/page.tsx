"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Plus, Trash2, FileText, Upload, CheckCircle2 } from "lucide-react";

import { VALVE_TYPES } from "@/types/valve";
import { AttachmentsPanel, MAX_FILE_BYTES } from "@/components/features/quotes/AttachmentsPanel";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  archived: boolean;
};

type ValveItemForm = {
  id: string;
  valveType: string;
  quantity: number;
  unitPrice: number | undefined;
  attributes: Record<string, string>;
};

type ParseMode = "text" | "pdf" | "excel";

function makeLineId() {
  return crypto.randomUUID();
}

function emptyItem(): ValveItemForm {
  return { id: makeLineId(), valveType: VALVE_TYPES[0], quantity: 1, unitPrice: undefined, attributes: {} };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const result = reader.result as string;
      // Gemini expects raw base64 — strip the "data:<mime>;base64," prefix.
      resolve(result.replace(/^data:.*;base64,/, ""));
    };
    reader.readAsDataURL(file);
  });
}

export default function NewQuotePage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");

  const [mode, setMode] = useState<ParseMode>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [items, setItems] = useState<ValveItemForm[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createdQuote, setCreatedQuote] = useState<{ id: string; quoteNumber: string } | null>(null);

  useEffect(() => {
    fetch("/api/customers")
      .then((response) => response.json())
      .then((result) => {
        if (result.success) setCustomers(result.data);
      });
  }, []);

  const grandTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * (item.unitPrice ?? 0), 0),
    [items],
  );

  function resetForCreateAnother() {
    setCustomerId("");
    setDeliveryDate("");
    setCurrency("USD");
    setNotes("");
    setText("");
    setFile(null);
    setItems([]);
    setCreatedQuote(null);
    setSaveError(null);
    setParseError(null);
  }

  async function handleParse() {
    setParseError(null);

    if (mode === "text" && !text.trim()) {
      setParseError("Paste some RFQ text first.");
      return;
    }
    if (mode !== "text" && !file) {
      setParseError("Choose a file first.");
      return;
    }
    if (file && file.size > MAX_FILE_BYTES) {
      setParseError("File exceeds the 25MB upload limit.");
      return;
    }

    setIsParsing(true);
    try {
      const body =
        mode === "text"
          ? { mode, text }
          : { mode, fileName: file!.name, base64Data: await fileToBase64(file!) };

      const response = await fetch("/api/quotes/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);

      const parsed: Array<{
        id?: string | number;
        valveType: string;
        quantity: number;
        unitPrice?: number;
        attributes: Record<string, unknown>;
      }> = result.data.valveItems;

      setItems(
        parsed.map((item) => ({
          id: makeLineId(),
          valveType: item.valveType,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          attributes: Object.fromEntries(
            Object.entries(item.attributes ?? {})
              .filter(([, value]) => value !== undefined)
              .map(([key, value]) => [key, String(value)]),
          ),
        })),
      );
    } catch (exception) {
      setParseError(exception instanceof Error ? exception.message : "Parsing failed.");
    } finally {
      setIsParsing(false);
    }
  }

  function updateItem(index: number, patch: Partial<ValveItemForm>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAttribute(index: number, key: string, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, attributes: { ...item.attributes, [key]: value } } : item)),
    );
  }

  function removeAttribute(index: number, key: string) {
    setItems((prev) =>
      prev.map((item, i) => {
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

  async function handleCreateQuote() {
    setSaveError(null);

    if (!customerId) {
      setSaveError("Select a customer first.");
      return;
    }
    if (items.length === 0) {
      setSaveError("Add at least one valve item.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          ...(deliveryDate ? { deliveryDate } : {}),
          ...(currency ? { currency } : {}),
          ...(notes ? { notes } : {}),
          valveItems: items.map((item) => ({
            id: item.id,
            valveType: item.valveType,
            quantity: item.quantity,
            ...(item.unitPrice !== undefined ? { unitPrice: item.unitPrice } : {}),
            attributes: item.attributes,
          })),
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);

      setCreatedQuote({ id: result.data.id, quoteNumber: result.data.quoteNumber });
    } catch (exception) {
      setSaveError(exception instanceof Error ? exception.message : "Could not create quote.");
    } finally {
      setIsSaving(false);
    }
  }

  if (createdQuote) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-[8px] border border-border bg-card px-6 py-16 text-center shadow-sm">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Quote created</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{createdQuote.quoteNumber}</span> was saved as a
            draft.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={resetForCreateAnother}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create another
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Back to dashboard
          </button>
        </div>

        <div className="w-full max-w-lg">
          <AttachmentsPanel quoteId={createdQuote.id} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Add Quote</h2>
        <p className="text-xs text-muted-foreground">
          Extract valve line items with AI from RFQ text, a PDF, or an Excel sheet — then review and save.
        </p>
      </div>

      {/* Quote details */}
      <div className="rounded-[8px] border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Quote Details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customerId" className="text-[12px] font-medium text-foreground">
              Customer <span className="text-destructive">*</span>
            </label>
            <select
              id="customerId"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
            >
              <option value="">Select a customer…</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="deliveryDate" className="text-[12px] font-medium text-foreground">
              Delivery Date
            </label>
            <input
              id="deliveryDate"
              type="date"
              value={deliveryDate}
              onChange={(event) => setDeliveryDate(event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="currency" className="text-[12px] font-medium text-foreground">
              Currency
            </label>
            <input
              id="currency"
              type="text"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              placeholder="USD"
              className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
            <label htmlFor="notes" className="text-[12px] font-medium text-foreground">
              Notes
            </label>
            <input
              id="notes"
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional"
              className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
            />
          </div>
        </div>
      </div>

      {/* AI extraction */}
      <div className="rounded-[8px] border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Extract Valve Items with AI</h3>
        </div>

        <div className="mb-4 inline-flex rounded-lg border border-border p-1">
          {(["text", "pdf", "excel"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setMode(option);
                setParseError(null);
              }}
              className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                mode === option
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {option === "text" ? "Paste Text" : option}
            </button>
          ))}
        </div>

        {mode === "text" ? (
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={6}
            placeholder="Paste the RFQ email or spec text here…"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
          />
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-6 py-10 text-center transition-colors hover:border-primary"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={mode === "pdf" ? "application/pdf" : ".xlsx,.xls,.csv"}
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <Upload className="h-6 w-6 text-muted-foreground" />
            {file ? (
              <p className="text-[12px] font-medium text-foreground">{file.name}</p>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                Click to choose a {mode === "pdf" ? "PDF" : "spreadsheet"} file (max 25MB)
              </p>
            )}
          </div>
        )}

        {parseError ? (
          <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
            {parseError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleParse}
          disabled={isParsing}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isParsing ? "Extracting…" : "Parse with AI"}
        </button>
      </div>

      {/* Valve items */}
      <div className="rounded-[8px] border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Valve Items</h3>
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
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

      {/* Footer */}
      <div className="flex items-center justify-between rounded-[8px] border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span>
            {items.length} item{items.length === 1 ? "" : "s"} · Total{" "}
            <span className="font-semibold">
              {currency} {grandTotal.toFixed(2)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {saveError ? <p className="text-[11px] text-destructive">{saveError}</p> : null}
          <button
            type="button"
            onClick={handleCreateQuote}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[12px] font-semibold text-primary-foreground shadow-sm shadow-primary/30 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSaving ? "Creating…" : "Create Quote"}
          </button>
        </div>
      </div>
    </div>
  );
}

