import React from "react";
import { Users, DollarSign } from "lucide-react";

export function DashboardRecentQuotes() {
  // Mock data for Phase 0
  const recentQuotes = [
    { id: "SAL-2026-1409205811", customer: "Acme Corp", items: 5, status: "quoted", amount: 14500, date: "2026-09-14" },
    { id: "SAL-2026-1409205812", customer: "Stark Industries", items: 12, status: "pending", amount: 32000, date: "2026-09-14" },
    { id: "SAL-2026-1509205813", customer: "Wayne Enterprises", items: 2, status: "won", amount: 5400, date: "2026-09-15" },
    { id: "SAL-2026-1509205814", customer: "Globex", items: 8, status: "draft", amount: 0, date: "2026-09-15" },
    { id: "SAL-2026-1609205815", customer: "Soylent Corp", items: 1, status: "approved", amount: 1200, date: "2026-09-16" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Recent Quotes Table - Standard Card (Flat) */}
      <div className="lg:col-span-2 rounded-[8px] border border-border bg-card shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Recent Quotes</h3>
          <span className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors">View all &rarr;</span>
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
                    <td className="px-6 py-4 font-medium text-primary cursor-pointer group-hover:underline">
                      {quote.id}
                    </td>
                    <td className="px-6 py-4 text-foreground">{quote.customer}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        quote.status === 'won' ? 'bg-emerald-500/15 text-emerald-500' :
                        quote.status === 'draft' ? 'bg-muted text-muted-foreground' :
                        quote.status === 'quoted' ? 'bg-sky-500/15 text-sky-500' :
                        'bg-amber-500/15 text-amber-500'
                      }`}>
                        {quote.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-foreground font-medium">${quote.amount.toLocaleString()}</td>
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

      {/* Extra Metrics - Glass Cards (Elevated Metric Panels) */}
      <div className="flex flex-col gap-6">
        <div className="relative overflow-hidden rounded-[8px] border border-border/40 bg-card/60 p-6 shadow-sm flex items-center gap-4 transition-all hover:shadow-md backdrop-blur-md bg-gradient-to-br from-card/80 to-muted/30">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-teal-500">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Active Customers
            </p>
            <p className="text-2xl font-semibold text-foreground">
              24
            </p>
            <p className="text-xs text-muted-foreground mt-1">Quotes in last 90 days</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[8px] border border-border/40 bg-card/60 p-6 shadow-sm flex items-center gap-4 transition-all hover:shadow-md backdrop-blur-md bg-gradient-to-br from-card/80 to-muted/30">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-500">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Total Revenue
            </p>
            <p className="text-2xl font-semibold text-foreground">
              $845k
            </p>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </div>
        </div>
      </div>
    </div>
  );
}
