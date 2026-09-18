import type { Session } from "next-auth";

import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { QUOTE_STATUSES } from "@/types/quote-status";

// §FR-7 — single source of truth for every KPI/chart formula. The
// dashboard page renders whatever this returns; nothing is recomputed
// client-side, so the numbers on the cards and the charts can never drift
// apart from each other.

const WON_STATUSES = ["won", "completed"] as const;
const ACTIVE_STATUSES = ["draft", "pending", "quoted"] as const;
const FUNNEL_STAGES = ["draft", "pending", "quoted", "approved", "won"] as const;
// Position of each status in the linear pipeline, for the cumulative
// funnel below — "completed" reads as having reached the "won" stage.
const PIPELINE_INDEX: Record<string, number> = {
  draft: 0,
  pending: 1,
  quoted: 2,
  approved: 3,
  won: 4,
  completed: 4,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_LABELS[Number(month) - 1]} ${year}`;
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export async function getDashboardAnalytics(session: Session) {
  const isPrivileged = session.user.role === UserRole.admin || session.user.role === UserRole.manager;

  // Same §3.1 visibility rule as the quote list — the dashboard never
  // shows more than the user could already see on /quotes.
  const quotes = await prisma.quote.findMany({
    where: isPrivileged ? {} : { createdBy: session.user.id },
    select: {
      id: true,
      quoteNumber: true,
      customerName: true,
      status: true,
      currency: true,
      totalAmount: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const totalQuotes = quotes.length;
  const activeQuotes = quotes.filter((q) => (ACTIVE_STATUSES as readonly string[]).includes(q.status)).length;
  const wonQuotesList = quotes.filter((q) => (WON_STATUSES as readonly string[]).includes(q.status));
  const lostQuotesList = quotes.filter((q) => q.status === "lost");
  const wonQuotes = wonQuotesList.length;

  const closedCount = wonQuotes + lostQuotesList.length;
  const winRate = closedCount > 0 ? round((100 * wonQuotes) / closedCount) : 0;

  const totalRevenue = round(wonQuotesList.reduce((sum, q) => sum + q.totalAmount, 0), 2);

  const ninetyDaysAgo = new Date(Date.now() - 90 * MS_PER_DAY);
  const activeCustomerCount = new Set(
    quotes.filter((q) => q.createdAt >= ninetyDaysAgo).map((q) => q.customerName),
  ).size;

  // Quote volume trend — bucketed by creation month; each bucket also
  // reports how many of those quotes currently sit in won/lost.
  const volumeBuckets = new Map<string, { quotes: number; won: number; lost: number }>();
  for (const q of quotes) {
    const key = monthKey(q.createdAt);
    const bucket = volumeBuckets.get(key) ?? { quotes: 0, won: 0, lost: 0 };
    bucket.quotes += 1;
    if ((WON_STATUSES as readonly string[]).includes(q.status)) bucket.won += 1;
    if (q.status === "lost") bucket.lost += 1;
    volumeBuckets.set(key, bucket);
  }
  const quoteVolumeTrend = [...volumeBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]) => ({ month: key, label: monthLabel(key), ...bucket }));

  // Revenue trend and time-to-close both use updatedAt as a proxy "closed
  // date" — the schema has no dedicated closedAt field (§10 note: "proxy").
  const revenueBuckets = new Map<string, number>();
  const closeDurationBuckets = new Map<string, number[]>();
  for (const q of wonQuotesList) {
    const key = monthKey(q.updatedAt);
    revenueBuckets.set(key, (revenueBuckets.get(key) ?? 0) + q.totalAmount);

    const days = (q.updatedAt.getTime() - q.createdAt.getTime()) / MS_PER_DAY;
    const list = closeDurationBuckets.get(key) ?? [];
    list.push(days);
    closeDurationBuckets.set(key, list);
  }
  const revenueTrend = [...revenueBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, revenue]) => ({ month: key, label: monthLabel(key), revenue: round(revenue, 2) }));
  const timeToClose = [...closeDurationBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, days]) => ({
      month: key,
      label: monthLabel(key),
      avgDays: round(days.reduce((sum, d) => sum + d, 0) / days.length),
    }));

  const quotesByStatus = QUOTE_STATUSES.map((status) => ({
    status,
    count: quotes.filter((q) => q.status === status).length,
  }));

  // Cumulative funnel: a quote "reached" a stage if its current status's
  // pipeline position is at or beyond that stage. lost/rejected quotes
  // aren't attributed to any stage (their history isn't tracked), but
  // still count in the "% of total" denominator.
  const conversionFunnel = FUNNEL_STAGES.map((stage, stageIndex) => {
    const count = quotes.filter((q) => (PIPELINE_INDEX[q.status] ?? -1) >= stageIndex).length;
    return { stage, count, percent: totalQuotes > 0 ? round((100 * count) / totalQuotes) : 0 };
  });

  const recentQuotes = quotes.slice(0, 10).map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    customerName: q.customerName,
    status: q.status,
    currency: q.currency,
    totalAmount: q.totalAmount,
    createdAt: q.createdAt,
  }));

  return {
    kpis: { totalQuotes, activeQuotes, winRate, wonQuotes },
    quoteVolumeTrend,
    revenueTrend,
    quotesByStatus,
    conversionFunnel,
    timeToClose,
    recentQuotes,
    activeCustomerCount,
    totalRevenue,
  };
}
