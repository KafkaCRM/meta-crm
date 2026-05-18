import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';

interface PipelineFunnelWidgetProps {
  className?: string;
}

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
      <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
        <h3 className="text-sm font-medium mb-3">Pipeline Funnel</h3>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
        <h3 className="text-sm font-medium mb-3">Pipeline Funnel</h3>
        <p className="text-sm text-destructive">Failed to load</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
      <h3 className="text-sm font-medium mb-3">Pipeline Funnel</h3>
      <div className="space-y-2">
        {data?.stages.map((stage, i) => (
          <button
            key={stage.name}
            className="w-full flex items-center justify-between text-left hover:bg-muted/50 rounded px-2 py-1 transition-colors"
            onClick={() => {
              navigate({
                to: '/cases',
                search: `?stage=${encodeURIComponent(stage.name)}`,
              });
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="h-3 rounded-full bg-primary"
                style={{ width: `${Math.max(8, stage.percentage)}px` }}
              />
              <span className="text-sm">{stage.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{stage.count}</span>
              <span className="text-xs text-muted-foreground">{Math.round(stage.percentage)}%</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
