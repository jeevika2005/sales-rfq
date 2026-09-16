import { DashboardKPICards } from "@/components/features/dashboard/DashboardKPICards";
import { DashboardCharts } from "@/components/features/dashboard/DashboardCharts";
import { DashboardRecentQuotes } from "@/components/features/dashboard/DashboardRecentQuotes";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 pb-12">
      <DashboardKPICards />
      <DashboardCharts />
      <DashboardRecentQuotes />
    </div>
  );
}
