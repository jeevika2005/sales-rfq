import { DashboardKPICards } from "@/components/features/sales/DashboardKPICards";
import { DashboardCharts } from "@/components/features/sales/DashboardCharts";
import { DashboardRecentQuotes } from "@/components/features/sales/DashboardRecentQuotes";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 pb-12">
      <DashboardKPICards />
      <DashboardCharts />
      <DashboardRecentQuotes />
    </div>
  );
}
