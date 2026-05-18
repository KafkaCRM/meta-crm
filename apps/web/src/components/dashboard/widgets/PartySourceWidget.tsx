import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface PartySourceWidgetProps {
  className?: string;
}

/* DESIGN.md report palette — inside analytics surfaces only */
const COLORS = ['#65b5ff', '#0bdf50', '#b3e01c', '#03b2cb', '#ff2067', '#ff5600'];

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
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardContent className="pt-5 pb-5">
          <Skeleton className="h-4 w-28 bg-[#ebe7e1] mb-4" />
          <Skeleton className="h-36 bg-[#ebe7e1] rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-medium text-[#9c9fa5] uppercase tracking-wider mb-2">Contact Sources</p>
          <p className="text-sm text-[#c41c1c]">Failed to load</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data?.sources.map((s, i) => ({
    name: s.source,
    value: s.count,
    fill: COLORS[i % COLORS.length]!,
  })) ?? [];

  const total = data?.sources.reduce((sum, s) => sum + s.count, 0) ?? 0;

  return (
    <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
      <CardContent className="pt-5 pb-5">
        <p className="text-xs font-medium text-[#9c9fa5] uppercase tracking-wider mb-3">Contact Sources</p>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #d3cec6',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#111111',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-3 space-y-1.5">
          {data?.sources.map((source, i) => (
            <button
              key={source.source}
              className="w-full flex items-center justify-between text-left hover:bg-[#f5f1ec] rounded-lg px-2 py-1.5 transition-colors"
              onClick={() => navigate({ to: '/parties', search: `?source=${encodeURIComponent(source.source)}` } as any)}
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-sm text-[#111111] capitalize">{source.source}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#111111]">{source.count}</span>
                <span className="text-xs text-[#9c9fa5]">
                  {total > 0 ? Math.round((source.count / total) * 100) : 0}%
                </span>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
