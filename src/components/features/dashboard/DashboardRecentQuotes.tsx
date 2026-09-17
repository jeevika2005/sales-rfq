import Link from "next/link";
import { Users, DollarSign } from "lucide-react";

import type { DashboardAnalytics } from "@/types/dashboard";
import { QUOTE_STATUS_STYLES } from "@/lib/quote-ui";

export function DashboardRecentQuotes({
  recentQuotes,
  activeCustomerCount,
  totalRevenue,
}: Pick<DashboardAnalytics, "recentQuotes" | "activeCustomerCount" | "totalRevenue">) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Recent Quotes Table */}
      <div className="lg:col-span-2 rounded-[8px] border border-border bg-card shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Recent Quotes</h3>
          <Link href="/quotes" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            View all &rarr;
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-muted-foreground uppercase bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium">Quote #</th>
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentQuotes.length > 0 ? (
                recentQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 font-medium text-primary">
                      <Link href={`/quotes/${quote.id}`} className="group-hover:underline">
                        {quote.quoteNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-foreground">{quote.customerName}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          QUOTE_STATUS_STYLES[quote.status] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {quote.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-foreground font-medium">
                      {quote.currency} {quote.totalAmount.toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground text-xs">
                    No analytics data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extra Metrics */}
      <div className="flex flex-col gap-6">
        <div className="relative overflow-hidden rounded-lg border border-border bg-card p-5 shadow-sm flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Active Customers
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{activeCustomerCount}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Quotes in last 90 days</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-lg border border-border bg-card p-5 shadow-sm flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Revenue
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {totalRevenue.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Won + completed quotes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
