"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, FileText, Loader2, Paperclip, Pencil, X } from "lucide-react";

import { useToast } from "@/components/providers/ToastProvider";
import { ActivityLogPanel, VersionHistoryPanel } from "@/components/features/quotes/HistoryPanels";
import { ValveItemsEditor, makeLineId, type ValveItemForm } from "@/components/features/quotes/ValveItemsEditor";
import { ALLOWED_STATUS_TRANSITIONS, QUOTE_STATUS_ACTIONS, QUOTE_STATUS_PIPELINE, QUOTE_STATUS_STYLES } from "@/lib/quote-ui";
import { VALVE_TYPES } from "@/types/valve";

type Customer = {
  id: string;
  name: string;
  archived: boolean;
};

const ACTION_VARIANT_CLASSES: Record<string, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  muted: "border border-border text-foreground hover:bg-muted",
  destructive: "border border-destructive/30 text-destructive hover:bg-destructive/10",
};

type QuoteItem = {
  id: string;
  itemName: string;
  specification: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  attributes: Record<string, unknown>;
};

type QuoteDetail = {
  id: string;
  quoteNumber: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
  currency: string;
  totalAmount: number;
  deliveryDate: string | null;
  notes: string | null;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
  attachments: { id: string; fileName: string }[];
};

// Reconstructs the editable form shape from a persisted QuoteItem — its
// `attributes` blob carries valveType/_lineId mixed in with the real spec
// fields (see buildItemsData in quote.service.ts), so pull those back out.
function quoteItemToForm(item: QuoteItem): ValveItemForm {
  const raw = item.attributes ?? {};
  const lineId = typeof raw._lineId === "string" ? raw._lineId : makeLineId();
  const valveType = typeof raw.valveType === "string" ? raw.valveType : item.itemName;
  const attributes = Object.fromEntries(
    Object.entries(raw)
      .filter(([key]) => key !== "valveType" && key !== "_lineId")
      .map(([key, value]) => [key, String(value)]),
  );

  return { id: lineId, valveType, quantity: item.quantity, unitPrice: item.unitPrice, attributes };
}

// §FR4.6 — valve tables grouped by type, one table per type. VALVE_TYPES
// order first, then any custom/unrecognized type strings.
function groupItemsByType(items: QuoteItem[]): { valveType: string; items: QuoteItem[] }[] {
  const byType = new Map<string, QuoteItem[]>();
  for (const item of items) {
    const valveType =
      typeof item.attributes.valveType === "string" ? item.attributes.valveType : item.itemName;
    const list = byType.get(valveType) ?? [];
    list.push(item);
    byType.set(valveType, list);
  }

  const ordered: { valveType: string; items: QuoteItem[] }[] = [];
  for (const type of VALVE_TYPES) {
    const groupItems = byType.get(type);
    if (groupItems?.length) ordered.push({ valveType: type, items: groupItems });
    byType.delete(type);
  }
  for (const [valveType, groupItems] of byType) ordered.push({ valveType, items: groupItems });
  return ordered;
}

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const quoteId = params.id;
  const { showToast } = useToast();

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const [refreshToken, setRefreshToken] = useState(0);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editDeliveryDate, setEditDeliveryDate] = useState("");
  const [editCurrency, setEditCurrency] = useState("USD");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editItems, setEditItems] = useState<ValveItemForm[]>([]);
  const [editChangeNotes, setEditChangeNotes] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  async function loadQuote() {
    try {
      const response = await fetch(`/api/quotes/${quoteId}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setQuote(result.data);
      setError(null);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Failed to load quote.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadQuote();
    fetch("/api/customers")
      .then((response) => response.json())
      .then((result) => {
        if (result.success) setCustomers(result.data);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  function openEdit() {
    if (!quote) return;
    setEditCustomerId(quote.customerId ?? "");
    setEditDeliveryDate(quote.deliveryDate ?? "");
    setEditCurrency(quote.currency);
    setEditNotes(quote.notes ?? "");
    setEditStatus(quote.status);
    setEditItems(quote.items.map(quoteItemToForm));
    setEditChangeNotes("");
    setEditError(null);
    setEditMessage(null);
    setIsEditing(true);
  }

  async function handleSaveEdit() {
    if (!quote) return;
    setEditError(null);

    if (!editCustomerId) {
      setEditError("Select a customer.");
      return;
    }
    if (editItems.length === 0) {
      setEditError("Add at least one valve item.");
      return;
    }

    setIsSavingEdit(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: editCustomerId,
          deliveryDate: editDeliveryDate || null,
          currency: editCurrency,
          notes: editNotes || null,
          status: editStatus,
          valveItems: editItems.map((item) => ({
            id: item.id,
            valveType: item.valveType,
            quantity: item.quantity,
            ...(item.unitPrice !== undefined ? { unitPrice: item.unitPrice } : {}),
            attributes: item.attributes,
          })),
          ...(editChangeNotes ? { changeNotes: editChangeNotes } : {}),
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);

      setQuote(result.data);
      setEditMessage(result.message);
      showToast("success", result.message);
      setIsEditing(false);
      setRefreshToken((token) => token + 1);
    } catch (exception) {
      setEditError(exception instanceof Error ? exception.message : "Could not save changes.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleTransition(nextStatus: string) {
    setTransitionError(null);
    setIsTransitioning(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setQuote(result.data);
      showToast("success", `Status updated to ${nextStatus}`);
      setRefreshToken((token) => token + 1);
    } catch (exception) {
      setTransitionError(exception instanceof Error ? exception.message : "Could not update status.");
    } finally {
      setIsTransitioning(false);
    }
  }

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  if (error || !quote) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-destructive">{error ?? "Quote not found."}</p>
        <Link href="/quotes" className="text-xs font-medium text-primary hover:underline">
          Back to RFQ list
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/quotes"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to RFQ list
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-lg font-semibold text-foreground">{quote.quoteNumber}</h2>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${QUOTE_STATUS_STYLES[quote.status] ?? "text-muted-foreground bg-muted"
                }`}
            >
              {quote.status}
            </span>
            <span className="text-[11px] text-muted-foreground">v{quote.currentVersion}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isEditing ? (
            <button
              type="button"
              onClick={openEdit}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          ) : null}
          <a
            href={`/api/quotes/${quote.id}/export`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <FileText className="h-4 w-4" />
            Export to Excel
          </a>
        </div>
      </div>

      {editMessage ? (
        <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-[12px] text-foreground">
          {editMessage}
        </p>
      ) : null}

      {/* Status */}
      <div className="rounded-[8px] border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-5 text-sm font-semibold text-foreground">Status</h3>

        {QUOTE_STATUS_PIPELINE.includes(quote.status as (typeof QUOTE_STATUS_PIPELINE)[number]) ? (
          <div className="flex items-center">
            {QUOTE_STATUS_PIPELINE.map((step, index) => {
              const currentIndex = QUOTE_STATUS_PIPELINE.indexOf(
                quote.status as (typeof QUOTE_STATUS_PIPELINE)[number],
              );
              const isDone = index < currentIndex;
              const isCurrent = index === currentIndex;
              return (
                <div key={step} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${isDone
                        ? "bg-primary text-primary-foreground"
                        : isCurrent
                          ? "bg-primary/15 text-primary ring-2 ring-primary"
                          : "bg-muted text-muted-foreground"
                        }`}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </div>
                    <span
                      className={`whitespace-nowrap text-[10px] font-medium uppercase tracking-wide ${isCurrent ? "text-foreground" : "text-muted-foreground"
                        }`}
                    >
                      {step}
                    </span>
                  </div>
                  {index < QUOTE_STATUS_PIPELINE.length - 1 ? (
                    <div className={`mx-2 h-0.5 flex-1 ${isDone ? "bg-primary" : "bg-border"}`} />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            This quote is on a side branch of the pipeline (
            <span className="font-medium text-foreground">{quote.status}</span>), not the main draft → completed
            path.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {(ALLOWED_STATUS_TRANSITIONS[quote.status] ?? []).map((nextStatus) => {
            const action = QUOTE_STATUS_ACTIONS[nextStatus] ?? { label: `Move to ${nextStatus}`, variant: "muted" };
            return (
              <button
                key={nextStatus}
                type="button"
                disabled={isTransitioning}
                onClick={() => handleTransition(nextStatus)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${ACTION_VARIANT_CLASSES[action.variant]}`}
              >
                {isTransitioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {action.label}
              </button>
            );
          })}
          {(ALLOWED_STATUS_TRANSITIONS[quote.status] ?? []).length === 0 ? (
            <p className="text-[12px] text-muted-foreground">This is a final status — no further moves.</p>
          ) : null}
        </div>

        {transitionError ? (
          <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
            {transitionError}
          </p>
        ) : null}
      </div>

      {isEditing ? (
        <>
          {/* Edit form */}
          <div className="rounded-[8px] border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Edit Quote Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="editCustomerId" className="text-[12px] font-medium text-foreground">
                  Customer <span className="text-destructive">*</span>
                </label>
                <select
                  id="editCustomerId"
                  value={editCustomerId}
                  onChange={(event) => setEditCustomerId(event.target.value)}
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
                <label htmlFor="editDeliveryDate" className="text-[12px] font-medium text-foreground">
                  Delivery Date
                </label>
                <input
                  id="editDeliveryDate"
                  type="date"
                  value={editDeliveryDate}
                  onChange={(event) => setEditDeliveryDate(event.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="editCurrency" className="text-[12px] font-medium text-foreground">
                  Currency
                </label>
                <input
                  id="editCurrency"
                  type="text"
                  value={editCurrency}
                  onChange={(event) => setEditCurrency(event.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="editStatus" className="text-[12px] font-medium text-foreground">
                  Status
                </label>
                <select
                  id="editStatus"
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
                >
                  <option value={quote.status}>{quote.status} (unchanged)</option>
                  {(ALLOWED_STATUS_TRANSITIONS[quote.status] ?? []).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor="editNotes" className="text-[12px] font-medium text-foreground">
                Notes
              </label>
              <textarea
                id="editNotes"
                rows={2}
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
                className="resize-none rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              />
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor="editChangeNotes" className="text-[12px] font-medium text-foreground">
                Version Notes <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="editChangeNotes"
                type="text"
                value={editChangeNotes}
                onChange={(event) => setEditChangeNotes(event.target.value)}
                placeholder="e.g. Adjusted pricing per customer request"
                className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              />
            </div>
          </div>

          <ValveItemsEditor
            items={editItems}
            onChange={setEditItems}
            exportContext={{
              customerName: customers.find((customer) => customer.id === editCustomerId)?.name,
              deliveryDate: editDeliveryDate,
              notes: editNotes,
              sourceFileName: quote.attachments?.[0]?.fileName,
            }}
          />

          <div className="flex items-center justify-end gap-3 rounded-[8px] border border-border bg-card p-6 shadow-sm">
            {editError ? <p className="text-[11px] text-destructive">{editError}</p> : null}
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isSavingEdit}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[12px] font-semibold text-primary-foreground shadow-sm shadow-primary/30 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSavingEdit ? "Saving…" : "Save changes"}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Quote details */}
          <div className="rounded-[8px] border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Quote Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Customer</p>
                <p className="mt-1 text-[12px] text-foreground">{quote.customerName}</p>
                {quote.customerEmail ? (
                  <p className="text-[11px] text-muted-foreground">{quote.customerEmail}</p>
                ) : null}
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total Amount</p>
                <p className="mt-1 text-[12px] font-semibold text-foreground">
                  {quote.currency} {quote.totalAmount.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Delivery Date
                </p>
                <p className="mt-1 text-[12px] text-foreground">{quote.deliveryDate ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Created</p>
                <p className="mt-1 text-[12px] text-foreground">{new Date(quote.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Source Document</p>
                {quote.attachments?.[0] ? (
                  <a
                    href={`/api/quotes/${quote.id}/attachments/${quote.attachments[0].id}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {quote.attachments[0].fileName}
                  </a>
                ) : (
                  <p className="mt-1 text-[12px] text-muted-foreground">—</p>
                )}
              </div>
            </div>
            {quote.notes ? (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="mt-1 text-[12px] text-foreground">{quote.notes}</p>
              </div>
            ) : null}
          </div>

          {/* Valve items — §FR4.6: grouped by type, one table per type */}
          {groupItemsByType(quote.items).map((group) => (
            <div key={group.valveType} className="rounded-[8px] border border-border bg-card p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">
                {group.valveType}{" "}
                <span className="font-normal normal-case text-muted-foreground">
                  ({group.items.length} item{group.items.length === 1 ? "" : "s"})
                </span>
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-border bg-muted/50 uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Item</th>
                      <th className="px-4 py-2 font-medium">Specification</th>
                      <th className="px-4 py-2 font-medium">Qty</th>
                      <th className="px-4 py-2 font-medium">Unit Price</th>
                      <th className="px-4 py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {group.items.map((item) => (
                      <tr key={item.id}>
                        <td className="flex items-center gap-2 px-4 py-3">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="font-medium text-foreground">{item.itemName}</span>
                        </td>
                        <td className="max-w-xs px-4 py-3 text-muted-foreground">{item.specification ?? "—"}</td>
                        <td className="px-4 py-3 text-foreground">{item.quantity}</td>
                        <td className="px-4 py-3 text-foreground">{item.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{item.totalPrice.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}

      <VersionHistoryPanel
        quoteId={quote.id}
        currentVersion={quote.currentVersion}
        onRestored={() => {
          loadQuote();
          setRefreshToken((token) => token + 1);
        }}
        refreshToken={refreshToken}
      />

      <ActivityLogPanel quoteId={quote.id} refreshToken={refreshToken} />
    </div>
  );
}
