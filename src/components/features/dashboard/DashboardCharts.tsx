"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
  FunnelChart, Funnel, LabelList,
} from "recharts";
import type { ValueType } from "recharts/types/component/DefaultTooltipContent";

import type { DashboardAnalytics } from "@/types/dashboard";

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  pending: "#fbbf24",
  quoted: "#38bdf8",
  approved: "#818cf8",
  won: "#34d399",
  lost: "#f87171",
  rejected: "#f87171",
  completed: "#10b981",
};

const FUNNEL_COLORS = ["#94a3b8", "#fbbf24", "#38bdf8", "#818cf8", "#34d399"];

function EmptyChart() {
  return (
    <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
      No analytics data yet.
    </div>
  );
}

export function DashboardCharts({
  quoteVolumeTrend,
  revenueTrend,
  quotesByStatus,
  conversionFunnel,
  timeToClose,
}: Pick<
  DashboardAnalytics,
  "quoteVolumeTrend" | "revenueTrend" | "quotesByStatus" | "conversionFunnel" | "timeToClose"
>) {
  const statusData = quotesByStatus.filter((s) => s.count > 0).map((s) => ({ name: s.status, value: s.count }));
  const funnelData = conversionFunnel.map((f, index) => ({
    name: f.stage,
    value: f.count,
    fill: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Quote volume trend */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Quote Volume Trend</h3>
        {quoteVolumeTrend.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quoteVolumeTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: "transparent" }} />
                <Bar dataKey="quotes" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Total Quotes" />
                <Bar dataKey="won" fill="#34d399" radius={[4, 4, 0, 0]} name="Won" />
                <Bar dataKey="lost" fill="#f87171" radius={[4, 4, 0, 0]} name="Lost" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Revenue trend */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Revenue Trend</h3>
        {revenueTrend.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `$${Number(value) / 1000}k`}
                />
                <Tooltip
                  formatter={(value: ValueType | undefined) => [`$${Number(value).toLocaleString()}`, "Revenue"]}
                />
                <Line type="monotone" dataKey="revenue" stroke="#4649e5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Quotes by status */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Quotes by Status</h3>
        {statusData.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="h-64 flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Conversion funnel */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Conversion Funnel</h3>
        {funnelData.every((f) => f.value === 0) ? (
          <EmptyChart />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Time to close */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm lg:col-span-2">
        <h3 className="text-sm font-semibold mb-4">Time to Close (Avg Days)</h3>
        {timeToClose.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeToClose}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: ValueType | undefined) => [`${value} days`, "Avg Time to Close"]} />
                <Line type="monotone" dataKey="avgDays" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
