import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';

interface PartySourceWidgetProps {
  className?: string;
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function PartySourceWidget({ className }: PartySourceWidgetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { date_from, date_to } = getDateRangeFromSearch(location.search);

  const params = { date_from, date_to };

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'party-sources', date_from, date_to],
    queryFn: () => reportsApi.partySources(params),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
        <h3 className="text-sm font-medium mb-3">Party Sources</h3>
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
        <h3 className="text-sm font-medium mb-3">Party Sources</h3>
        <p className="text-sm text-destructive">Failed to load</p>
      </div>
    );
  }

  const chartData = data?.sources.map((s, i) => ({
    name: s.source,
    value: s.count,
    fill: COLORS[i % COLORS.length]!,
  })) ?? [];

  const total = data?.sources.reduce((sum, s) => sum + s.count, 0) ?? 0;

  return (
    <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
      <h3 className="text-sm font-medium mb-3">Party Sources</h3>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 space-y-1">
        {data?.sources.map((source, i) => (
          <button
            key={source.source}
            className="w-full flex items-center justify-between text-left hover:bg-muted/50 rounded px-2 py-1 transition-colors"
            onClick={() => {
              navigate({
                to: '/parties',
                search: `?source=${encodeURIComponent(source.source)}`,
              });
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-sm capitalize">{source.source}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{source.count}</span>
              <span className="text-xs text-muted-foreground">
                {total > 0 ? Math.round((source.count / total) * 100) : 0}%
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
