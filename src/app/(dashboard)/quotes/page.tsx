"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Paperclip, Plus, FileText } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { QUOTE_STATUS_STYLES } from "@/lib/quote-ui";

type Quote = {
  id: string;
  quoteNumber: string;
  customerName: string;
  status: string;
  currency: string;
  totalAmount: number;
  createdAt: string;
  attachments: { id: string; fileName: string }[];
};

const PAGE_SIZE = 10;

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  async function loadQuotes() {
    try {
      const response = await fetch("/api/quotes");
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setQuotes(result.data);
      setError(null);
    } catch {
      setError("Failed to load quotes.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadQuotes();
  }, []);

  const filteredQuotes = useMemo(
    () =>
      quotes.filter(
        (quote) =>
          quote.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
          quote.customerName.toLowerCase().includes(search.toLowerCase()),
      ),
    [quotes, search],
  );
  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / PAGE_SIZE));
  const pagedQuotes = filteredQuotes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: DataTableColumn<Quote>[] = [
    {
      header: "Quote",
      cell: (quote) => (
        <Link href={`/quotes/${quote.id}`} className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <p className="font-mono font-medium text-foreground hover:underline">{quote.quoteNumber}</p>
            <p className="text-[10px] text-muted-foreground">{quote.customerName}</p>
          </div>
        </Link>
      ),
    },
    {
      header: "Status",
      cell: (quote) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            QUOTE_STATUS_STYLES[quote.status] ?? "text-muted-foreground bg-muted"
          }`}
        >
          {quote.status}
        </span>
      ),
    },
    {
      header: "Total",
      cell: (quote) => (
        <span className="font-medium text-foreground">
          {quote.currency} {quote.totalAmount.toFixed(2)}
        </span>
      ),
    },
    {
      header: "Created",
      cell: (quote) => (
        <span className="text-muted-foreground">{new Date(quote.createdAt).toLocaleDateString()}</span>
      ),
    },
    {
      header: "Source Doc",
      cell: (quote) =>
        quote.attachments?.[0] ? (
          <a
            href={`/api/quotes/${quote.id}/attachments/${quote.attachments[0].id}`}
            onClick={(event) => event.stopPropagation()}
            title={quote.attachments[0].fileName}
            className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary hover:underline"
          >
            <Paperclip className="h-3.5 w-3.5" />
            <span className="max-w-[10rem] truncate">{quote.attachments[0].fileName}</span>
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">RFQ List</h2>
          <p className="text-xs text-muted-foreground">Quotes you have access to, newest first.</p>
        </div>
        <Link
          href="/quotes/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Quote
        </Link>
      </div>

      <DataTable
        data={pagedQuotes}
        columns={columns}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search quotes..."
        isLoading={isLoading}
        error={error}
        emptyMessage="No quotes found."
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
