"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Plus, FileText, Upload, FileSpreadsheet } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { ValveItemsEditor, makeLineId, type ValveItemForm } from "@/components/features/quotes/ValveItemsEditor";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  archived: boolean;
};

type ParseMode = "text" | "pdf" | "excel";

// FR-3.3 — same 25MB ceiling enforced server-side, checked client-side too
// so the user gets instant feedback instead of waiting on a round trip.
const MAX_FILE_BYTES = 25 * 1024 * 1024;

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

  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null);

  const [mode, setMode] = useState<ParseMode>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [items, setItems] = useState<ValveItemForm[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function loadCustomers() {
    const response = await fetch("/api/customers");
    const result = await response.json();
    if (result.success) setCustomers(result.data);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadCustomers();
  }, []);

  const grandTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * (item.unitPrice ?? 0), 0),
    [items],
  );

  async function handleCreateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewCustomerError(null);
    setIsCreatingCustomer(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const phone = formData.get("phone");

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);

      await loadCustomers();
      setCustomerId(result.data.id);
      setIsNewCustomerModalOpen(false);
    } catch (exception) {
      setNewCustomerError(exception instanceof Error ? exception.message : "Could not create customer.");
    } finally {
      setIsCreatingCustomer(false);
    }
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

      router.push(`/quotes/${result.data.id}`);
    } catch (exception) {
      setSaveError(exception instanceof Error ? exception.message : "Could not create quote.");
      setIsSaving(false);
    }
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
            <div className="flex items-center justify-between">
              <label htmlFor="customerId" className="text-[12px] font-medium text-foreground">
                Customer <span className="text-destructive">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setNewCustomerError(null);
                  setIsNewCustomerModalOpen(true);
                }}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                + New Customer
              </button>
            </div>
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

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleParse}
            disabled={isParsing}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isParsing ? "Extracting…" : "Parse with AI"}
          </button>
          <span className="text-[11px] text-muted-foreground">or skip straight to manual rows below</span>
        </div>
      </div>

      <ValveItemsEditor items={items} onChange={setItems} />

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
          {exportError ? <p className="text-[11px] text-destructive">{exportError}</p> : null}
          {saveError ? <p className="text-[11px] text-destructive">{saveError}</p> : null}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Export to Excel
          </button>
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

      {isNewCustomerModalOpen ? (
        <Modal title="New Customer" onClose={() => setIsNewCustomerModalOpen(false)}>
          <form onSubmit={handleCreateCustomer} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="newCustomerName" className="text-[12px] font-medium text-foreground">
                Name
              </label>
              <input
                id="newCustomerName"
                name="name"
                type="text"
                required
                placeholder="e.g. Acme Industries"
                className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="newCustomerEmail" className="text-[12px] font-medium text-foreground">
                Email
              </label>
              <input
                id="newCustomerEmail"
                name="email"
                type="email"
                placeholder="buyer@company.com"
                className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="newCustomerPhone" className="text-[12px] font-medium text-foreground">
                Phone
              </label>
              <input
                id="newCustomerPhone"
                name="phone"
                type="text"
                placeholder="+1 555 000 0000"
                className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              />
            </div>

            {newCustomerError ? (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                {newCustomerError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isCreatingCustomer}
              className="mt-2 rounded-lg bg-primary py-2.5 text-[12px] font-semibold text-primary-foreground shadow-sm shadow-primary/30 transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingCustomer ? "Creating…" : (
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Create customer
                </span>
              )}
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
