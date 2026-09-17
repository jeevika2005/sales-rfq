"use client";

import { useEffect, useState } from "react";

import { DashboardKPICards } from "@/components/features/dashboard/DashboardKPICards";
import { DashboardCharts } from "@/components/features/dashboard/DashboardCharts";
import { DashboardRecentQuotes } from "@/components/features/dashboard/DashboardRecentQuotes";
import type { DashboardAnalytics } from "@/types/dashboard";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => response.json())
      .then((result) => {
        if (!result.success) throw new Error(result.message);
        setData(result.data);
      })
      .catch((exception) => setError(exception instanceof Error ? exception.message : "Failed to load dashboard."))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  if (error || !data) {
    return <p className="py-16 text-center text-sm text-destructive">{error ?? "Failed to load dashboard."}</p>;
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      <DashboardKPICards kpis={data.kpis} />
      <DashboardCharts
        quoteVolumeTrend={data.quoteVolumeTrend}
        revenueTrend={data.revenueTrend}
        quotesByStatus={data.quotesByStatus}
        conversionFunnel={data.conversionFunnel}
        timeToClose={data.timeToClose}
      />
      <DashboardRecentQuotes
        recentQuotes={data.recentQuotes}
        activeCustomerCount={data.activeCustomerCount}
        totalRevenue={data.totalRevenue}
      />
    </div>
  );
}
