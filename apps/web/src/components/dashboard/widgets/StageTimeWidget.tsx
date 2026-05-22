import { useQuery } from '@tanstack/react-query';
import { useLocation } from '@tanstack/react-router';
import { Clock, Lock, RefreshCw } from 'lucide-react';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface StageTimeWidgetProps {
  className?: string;
  hasPermission?: boolean;
}

const STAGE_COLORS = ['#3b82f6', '#60a5fa', '#f59e0b', '#fbbf24', '#0bdf50', '#c41c1c'];

export function StageTimeWidget({ className, hasPermission = true }: StageTimeWidgetProps) {
  const location = useLocation();
  const { date_from, date_to } = getDateRangeFromSearch(location.search);

  const params: ReportParams = { date_from, date_to };

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'stage-time', date_from, date_to],
    queryFn: () => reportsApi.stageTime(params),
    staleTime: 60_000,
    enabled: hasPermission,
  });

  if (!hasPermission) {
    return (
      <Card className={`bg-white border-[#e2e8f0] rounded-xl shadow-none relative overflow-hidden ${className ?? ''}`}>
        <CardContent className="pt-5 pb-5">
          <div className="absolute inset-0 backdrop-blur-sm bg-white/60 flex items-center justify-center z-10">
            <div className="text-center">
              <Lock size={20} className="mx-auto text-[#94a3b8] mb-2" />
              <p className="text-xs font-medium text-[#64748b]">Upgrade your role to view this report</p>
            </div>
          </div>
          <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-4">Avg Time per Stage</p>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 bg-[#e2e8f0] mb-2 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={`bg-white border-[#e2e8f0] rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#0f172a]">Avg Time per Stage</CardTitle>
        </CardHeader>
        <Separator className="bg-[#e2e8f0]" />
        <CardContent className="pt-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 bg-[#e2e8f0] mb-2 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`bg-white border-[#e2e8f0] rounded-xl shadow-none ${className ?? ''}`}>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-1">Avg Time per Stage</p>
              <p className="text-sm text-[#c41c1c]">Could not load data. Retry.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="h-7 text-xs border-[#e2e8f0]"
            >
              <RefreshCw size={12} className="mr-1" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxHours = Math.max(...(data?.stages.map((s) => s.avg_hours) ?? [1]));

  return (
    <Card className={`bg-white border-[#e2e8f0] rounded-xl shadow-none hover:shadow-md transition-shadow ${className ?? ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#0f172a]">Avg Time per Stage</CardTitle>
      </CardHeader>
      <Separator className="bg-[#e2e8f0]" />
      <CardContent className="pt-5">
        <div className="space-y-3">
          {data?.stages.map((stage, i) => {
            const pastSLA = stage.sla_hours > 0 && stage.avg_hours > stage.sla_hours;
            const barColor = pastSLA
              ? stage.avg_hours > stage.sla_hours * 1.5
                ? '#c41c1c'
                : '#f59e0b'
              : STAGE_COLORS[i % STAGE_COLORS.length];

            return (
              <div key={stage.name} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-[#94a3b8]" />
                    <span className="text-sm text-[#0f172a]">{stage.name}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-semibold ${pastSLA ? 'text-[#c41c1c]' : 'text-[#0f172a]'}`}>
                      {Math.round(stage.avg_hours)}h
                    </span>
                    <span className="text-xs text-[#94a3b8] ml-1.5">
                      SLA: {stage.sla_hours}h
                    </span>
                  </div>
                </div>
                <div className="relative w-full h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${maxHours > 0 ? (stage.avg_hours / maxHours) * 100 : 0}%`,
                      backgroundColor: barColor,
                    }}
                  />
                  {stage.sla_hours > 0 && maxHours > 0 && (
                    <div
                      className="absolute top-0 h-full w-0.5 bg-[#94a3b8]/40"
                      style={{ left: `${(stage.sla_hours / maxHours) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
