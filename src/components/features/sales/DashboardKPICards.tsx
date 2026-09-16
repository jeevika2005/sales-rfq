import React from 'react';
import { FileText, CheckCircle2, TrendingUp, Trophy } from 'lucide-react';

export function DashboardKPICards() {
  // Mock data for Phase 0 UI layout
  const kpiData = [
    {
      title: 'Total quotes',
      value: '142',
      icon: FileText,
      description: 'All visible quotes',
    },
    {
      title: 'Active quotes',
      value: '45',
      icon: TrendingUp,
      description: 'Draft, pending, quoted',
    },
    {
      title: 'Win rate',
      value: '32%',
      icon: Trophy,
      description: 'Based on closed quotes',
    },
    {
      title: 'Won quotes',
      value: '31',
      icon: CheckCircle2,
      description: 'Won or completed',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {kpiData.map((item) => (
        <div
          key={item.title}
          className="relative overflow-hidden rounded-[8px] border border-border/40 bg-card/60 p-6 shadow-sm flex items-center gap-4 transition-all hover:shadow-md backdrop-blur-md bg-gradient-to-br from-card/80 to-muted/30"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <item.icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground truncate uppercase tracking-wider">
              {item.title}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {item.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
