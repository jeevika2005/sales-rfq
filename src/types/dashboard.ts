// Client-safe mirror of dashboard.service.ts's return shape.
export type DashboardAnalytics = {
  kpis: {
    totalQuotes: number;
    activeQuotes: number;
    winRate: number;
    wonQuotes: number;
  };
  quoteVolumeTrend: { month: string; label: string; quotes: number; won: number; lost: number }[];
  revenueTrend: { month: string; label: string; revenue: number }[];
  quotesByStatus: { status: string; count: number }[];
  conversionFunnel: { stage: string; count: number; percent: number }[];
  timeToClose: { month: string; label: string; avgDays: number }[];
  recentQuotes: {
    id: string;
    quoteNumber: string;
    customerName: string;
    status: string;
    currency: string;
    totalAmount: number;
    createdAt: string;
  }[];
  activeCustomerCount: number;
  totalRevenue: number;
};
