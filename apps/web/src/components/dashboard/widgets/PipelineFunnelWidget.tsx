import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Lock, RefreshCw, ArrowUpRight } from 'lucide-react';

interface PipelineFunnelWidgetProps {
  className?: string;
  hasPermission?: boolean;
}

const STAGE_COLORS = ['#3b82f6', '#60a5fa', '#f59e0b', '#fbbf24', '#0bdf50', '#c41c1c'];

export function PipelineFunnelWidget({ className, hasPermission = true }: PipelineFunnelWidgetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { date_from, date_to } = getDateRangeFromSearch(location.search);

  const params: ReportParams = { date_from, date_to };

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'pipeline-funnel', date_from, date_to],
    queryFn: () => reportsApi.pipelineFunnel(params),
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
          <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-4">Pipeline Funnel</p>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 bg-[#e2e8f0] mb-2 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={`bg-white border-[#e2e8f0] rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#0f172a]">Pipeline Funnel</CardTitle>
        </CardHeader>
        <Separator className="bg-[#e2e8f0]" />
        <CardContent className="pt-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 bg-[#e2e8f0] mb-2 rounded-lg" />
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
              <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-1">Pipeline Funnel</p>
              <p className="text-sm text-[#c41c1c]">Could not load pipeline data. Retry.</p>
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

  const maxCount = Math.max(...(data?.stages.map((s) => s.count) ?? [1]));

  return (
    <Card className={`bg-white border-[#e2e8f0] rounded-xl shadow-none hover:shadow-md transition-shadow ${className ?? ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#0f172a]">Pipeline Funnel</CardTitle>
      </CardHeader>
      <Separator className="bg-[#e2e8f0]" />
      <CardContent className="pt-5">
        <div className="space-y-3">
          {data?.stages.map((stage, i) => (
            <button
              key={stage.name}
              className="w-full text-left group"
              onClick={() => navigate({ to: '/cases', search: { stage: stage.name } as any })}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-[#0f172a] group-hover:text-[#3b82f6] transition-colors">{stage.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#0f172a]">{stage.count}</span>
                  <span className="text-xs text-[#94a3b8]">{Math.round(stage.percentage)}%</span>
                </div>
              </div>
              <div className="w-full h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${maxCount > 0 ? (stage.count / maxCount) * 100 : 0}%`,
                    backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length],
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
