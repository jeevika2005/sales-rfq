import { FileText, CheckCircle2, TrendingUp, Trophy } from "lucide-react";

import type { DashboardAnalytics } from "@/types/dashboard";

export function DashboardKPICards({ kpis }: { kpis: DashboardAnalytics["kpis"] }) {
  const cards = [
    {
      title: "Total Quotes",
      value: kpis.totalQuotes.toLocaleString(),
      icon: FileText,
      description: "All visible quotes",
      accent: "bg-primary",
      badge: "bg-primary/10 text-primary",
    },
    {
      title: "Active Quotes",
      value: kpis.activeQuotes.toLocaleString(),
      icon: TrendingUp,
      description: "Draft, pending, quoted",
      accent: "bg-amber-500",
      badge: "bg-amber-500/10 text-amber-600",
    },
    {
      title: "Win Rate",
      value: `${kpis.winRate}%`,
      icon: Trophy,
      description: "Based on closed quotes",
      accent: "bg-emerald-500",
      badge: "bg-emerald-500/10 text-emerald-600",
    },
    {
      title: "Won Quotes",
      value: kpis.wonQuotes.toLocaleString(),
      icon: CheckCircle2,
      description: "Won or completed",
      accent: "bg-violet-500",
      badge: "bg-violet-500/10 text-violet-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="relative overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
        >
          <div className={`absolute inset-x-0 top-0 h-1 ${card.accent}`} />
          <div className="flex items-start justify-between gap-3 p-5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {card.title}
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{card.value}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{card.description}</p>
            </div>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.badge}`}>
              <card.icon className="h-5 w-5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
