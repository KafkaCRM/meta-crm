import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { Clock } from 'lucide-react';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface StageTimeWidgetProps {
  className?: string;
}

const STAGE_COLORS = ['#65b5ff', '#0bdf50', '#b3e01c', '#03b2cb', '#ff2067', '#ff5600'];

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
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardContent className="pt-5 pb-5">
          <Skeleton className="h-4 w-32 bg-[#ebe7e1] mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 bg-[#ebe7e1] mb-2 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-medium text-[#9c9fa5] uppercase tracking-wider mb-2">Avg Time per Stage</p>
          <p className="text-sm text-[#c41c1c]">Failed to load</p>
        </CardContent>
      </Card>
    );
  }

  const maxHours = Math.max(...(data?.stages.map((s) => s.avg_hours) ?? [1]));

  return (
    <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
      <CardContent className="pt-5 pb-5">
        <p className="text-xs font-medium text-[#9c9fa5] uppercase tracking-wider mb-4">Avg Time per Stage</p>
        <div className="space-y-3">
          {data?.stages.map((stage, i) => (
            <button
              key={stage.name}
              className="w-full text-left group"
              onClick={() => navigate({ to: '/cases', search: `?stage=${encodeURIComponent(stage.name)}` } as any)}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-[#9c9fa5]" />
                  <span className="text-sm text-[#111111]">{stage.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-[#111111]">{Math.round(stage.avg_hours)}h</span>
                  <span className="text-xs text-[#9c9fa5] ml-1.5">
                    ({Math.round(stage.min_hours)}–{Math.round(stage.max_hours)}h)
                  </span>
                </div>
              </div>
              <div className="w-full h-1 bg-[#ebe7e1] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${maxHours > 0 ? (stage.avg_hours / maxHours) * 100 : 0}%`,
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
