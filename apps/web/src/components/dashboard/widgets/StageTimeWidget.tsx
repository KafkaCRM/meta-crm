import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { Clock } from 'lucide-react';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';

interface StageTimeWidgetProps {
  className?: string;
}

export function StageTimeWidget({ className }: StageTimeWidgetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { date_from, date_to } = getDateRangeFromSearch(location.search);

  const params: ReportParams = { date_from, date_to };

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'stage-time', date_from, date_to],
    queryFn: () => reportsApi.stageTime(params),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
        <h3 className="text-sm font-medium mb-3">Avg Time per Stage</h3>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-6 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
        <h3 className="text-sm font-medium mb-3">Avg Time per Stage</h3>
        <p className="text-sm text-destructive">Failed to load</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
      <h3 className="text-sm font-medium mb-3">Avg Time per Stage</h3>
      <div className="space-y-2">
        {data?.stages.map((stage) => (
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
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{stage.name}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold">{Math.round(stage.avg_hours)}h</span>
              <span className="text-xs text-muted-foreground ml-1">
                ({Math.round(stage.min_hours)}–{Math.round(stage.max_hours)}h)
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
