"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, FileText, Loader2 } from "lucide-react";

import { AttachmentsPanel } from "@/components/features/quotes/AttachmentsPanel";
import { ActivityLogPanel, VersionHistoryPanel } from "@/components/features/quotes/HistoryPanels";
import { ALLOWED_STATUS_TRANSITIONS, QUOTE_STATUS_ACTIONS, QUOTE_STATUS_PIPELINE, QUOTE_STATUS_STYLES } from "@/lib/quote-ui";

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
};

type QuoteDetail = {
  id: string;
  quoteNumber: string;
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
};

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const quoteId = params.id;

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

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
          <a
            href={`/api/quotes/${quote.id}/export`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <FileText className="h-4 w-4" />
            Export to Excel
          </a>
        </div>
      </div>

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

      {/* Quote details */}
      <div className="rounded-[8px] border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Quote Details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Customer</p>
            <p className="mt-1 text-[12px] text-foreground">{quote.customerName}</p>
            {quote.customerEmail ? <p className="text-[11px] text-muted-foreground">{quote.customerEmail}</p> : null}
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total Amount</p>
            <p className="mt-1 text-[12px] font-semibold text-foreground">
              {quote.currency} {quote.totalAmount.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Delivery Date</p>
            <p className="mt-1 text-[12px] text-foreground">{quote.deliveryDate ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Created</p>
            <p className="mt-1 text-[12px] text-foreground">{new Date(quote.createdAt).toLocaleString()}</p>
          </div>
        </div>
        {quote.notes ? (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
            <p className="mt-1 text-[12px] text-foreground">{quote.notes}</p>
          </div>
        ) : null}
      </div>

      {/* Valve items */}
      <div className="rounded-[8px] border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Valve Items</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/50 uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-4 py-2 font-medium">Specification</th>
                <th className="px-4 py-2 font-medium">Qty</th>
                <th className="px-4 py-2 font-medium">Unit Price</th>
                <th className="px-4 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {quote.items.map((item) => (
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

      <VersionHistoryPanel quoteId={quote.id} currentVersion={quote.currentVersion} onRestored={loadQuote} />

      <ActivityLogPanel quoteId={quote.id} />

      <AttachmentsPanel quoteId={quote.id} />
    </div>
  );
}
