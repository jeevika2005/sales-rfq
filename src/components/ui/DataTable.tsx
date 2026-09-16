"use client";

import { Search } from "lucide-react";
import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
};

export function DataTable<T extends { id: string }>({
  data,
  columns,
  actions,
  search,
  onSearchChange,
  searchPlaceholder,
  isLoading,
  error,
  emptyMessage,
  page,
  totalPages,
  onPageChange,
}: {
  data: T[];
  columns: DataTableColumn<T>[];
  actions?: (row: T) => ReactNode;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  isLoading: boolean;
  error: string | null;
  emptyMessage: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const columnCount = columns.length + (actions ? 1 : 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
        />
      </div>

      <div className="overflow-hidden rounded-[8px] border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/50 uppercase text-muted-foreground">
              <tr>
                {columns.map((column) => (
                  <th key={column.header} className={`px-6 py-3 font-medium ${column.headerClassName ?? ""}`}>
                    {column.header}
                  </th>
                ))}
                {actions ? <th className="px-6 py-3 text-right font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={columnCount} className="px-6 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={columnCount} className="px-6 py-8 text-center text-destructive">
                    {error}
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-6 py-8 text-center text-muted-foreground">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-muted/30">
                    {columns.map((column) => (
                      <td key={column.header} className={`px-6 py-4 ${column.cellClassName ?? ""}`}>
                        {column.cell(row)}
                      </td>
                    ))}
                    {actions ? <td className="px-6 py-4 text-right">{actions(row)}</td> : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-3 text-xs text-muted-foreground">
          <span>
            Page <span className="font-medium text-foreground">{page}</span> of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
              className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
