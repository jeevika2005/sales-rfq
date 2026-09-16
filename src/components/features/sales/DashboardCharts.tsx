"use client";

import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
  FunnelChart, Funnel, LabelList
} from 'recharts';

const mockTrendData = [
  { name: 'Jan', quotes: 12, won: 4, lost: 2 },
  { name: 'Feb', quotes: 18, won: 6, lost: 3 },
  { name: 'Mar', quotes: 25, won: 10, lost: 4 },
];

const mockRevenueData = [
  { name: 'Jan', revenue: 45000 },
  { name: 'Feb', revenue: 72000 },
  { name: 'Mar', revenue: 115000 },
];

const mockStatusData = [
  { name: 'Draft', value: 12 },
  { name: 'Pending', value: 8 },
  { name: 'Quoted', value: 15 },
  { name: 'Won', value: 20 },
];

const mockFunnelData = [
  { value: 100, name: 'Draft', fill: '#94a3b8' },
  { value: 80, name: 'Pending', fill: '#fbbf24' },
  { value: 50, name: 'Quoted', fill: '#38bdf8' },
  { value: 40, name: 'Approved', fill: '#818cf8' },
  { value: 25, name: 'Won', fill: '#34d399' }
];

const mockTimeData = [
  { name: 'Jan', days: 14 },
  { name: 'Feb', days: 11 },
  { name: 'Mar', days: 8 },
];

const COLORS = ['#94a3b8', '#fbbf24', '#38bdf8', '#34d399'];

export function DashboardCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Quote volume trend */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Quote Volume Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockTrendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Bar dataKey="quotes" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Total Quotes" />
              <Bar dataKey="won" fill="#34d399" radius={[4, 4, 0, 0]} name="Won" />
              <Bar dataKey="lost" fill="#f87171" radius={[4, 4, 0, 0]} name="Lost" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue trend */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Revenue Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockRevenueData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} 
                tickFormatter={(value) => `$${value/1000}k`} />
              <Tooltip formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="#4649e5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quotes by status */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Quotes by Status</h3>
        <div className="h-64 flex justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={mockStatusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {mockStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Conversion funnel */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Conversion Funnel</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip />
              <Funnel
                dataKey="value"
                data={mockFunnelData}
                isAnimationActive
              >
                <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time to close */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm lg:col-span-2">
        <h3 className="text-sm font-semibold mb-4">Time to Close (Avg Days)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockTimeData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: any) => [`${value} days`, 'Avg Time to Close']} />
              <Line type="monotone" dataKey="days" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
