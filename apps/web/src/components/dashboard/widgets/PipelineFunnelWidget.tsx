import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface PipelineFunnelWidgetProps {
  className?: string;
}

/* DESIGN.md report palette — used inside analytics surfaces */
const STAGE_COLORS = ['#65b5ff', '#0bdf50', '#b3e01c', '#03b2cb', '#ff2067', '#ff5600'];

export function PipelineFunnelWidget({ className }: PipelineFunnelWidgetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { date_from, date_to } = getDateRangeFromSearch(location.search);

  const params: ReportParams = { date_from, date_to };

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'pipeline-funnel', date_from, date_to],
    queryFn: () => reportsApi.pipelineFunnel(params),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardContent className="pt-5 pb-5">
          <Skeleton className="h-4 w-28 bg-[#ebe7e1] mb-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 bg-[#ebe7e1] mb-2 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-medium text-[#9c9fa5] uppercase tracking-wider mb-2">Pipeline Funnel</p>
          <p className="text-sm text-[#c41c1c]">Failed to load</p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...(data?.stages.map((s) => s.count) ?? [1]));

  return (
    <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
      <CardContent className="pt-5 pb-5">
        <p className="text-xs font-medium text-[#9c9fa5] uppercase tracking-wider mb-4">Pipeline Funnel</p>
        <div className="space-y-2.5">
          {data?.stages.map((stage, i) => (
            <button
              key={stage.name}
              className="w-full text-left group"
              onClick={() => navigate({ to: '/cases', search: `?stage=${encodeURIComponent(stage.name)}` } as any)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-[#111111]">{stage.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#111111]">{stage.count}</span>
                  <span className="text-xs text-[#9c9fa5]">{Math.round(stage.percentage)}%</span>
                </div>
              </div>
              <div className="w-full h-1.5 bg-[#ebe7e1] rounded-full overflow-hidden">
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
