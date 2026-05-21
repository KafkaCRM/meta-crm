import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PartySource } from '@meta-crm/types';
import { Lock, RefreshCw } from 'lucide-react';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface PartySourceWidgetProps {
  className?: string;
  hasPermission?: boolean;
}

const SOURCE_COLORS: Record<string, string> = {
  [PartySource.WhatsApp]: '#0bdf50',
  [PartySource.JustDial]: '#ff8c00',
  [PartySource.Facebook]: '#1877f2',
  [PartySource.Manual]: '#9c9fa5',
  [PartySource.WebForm]: '#8b5cf6',
  [PartySource.Api]: '#ff5600',
};

const SOURCE_LABELS: Record<string, string> = {
  [PartySource.WhatsApp]: 'WhatsApp',
  [PartySource.JustDial]: 'JustDial',
  [PartySource.Facebook]: 'Facebook',
  [PartySource.Manual]: 'Manual',
  [PartySource.WebForm]: 'Web Form',
  [PartySource.Api]: 'API',
};

export function PartySourceWidget({ className, hasPermission = true }: PartySourceWidgetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { date_from, date_to } = getDateRangeFromSearch(location.search);

  const params = { date_from, date_to };

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'party-sources', date_from, date_to],
    queryFn: () => reportsApi.partySources(params),
    staleTime: 60_000,
    enabled: hasPermission,
  });

  if (!hasPermission) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none relative overflow-hidden ${className ?? ''}`}>
        <CardContent className="pt-5 pb-5">
          <div className="absolute inset-0 backdrop-blur-sm bg-white/60 flex items-center justify-center z-10">
            <div className="text-center">
              <Lock size={20} className="mx-auto text-[#9c9fa5] mb-2" />
              <p className="text-xs font-medium text-[#626260]">Upgrade your role to view this report</p>
            </div>
          </div>
          <p className="text-xs font-medium text-[#9c9fa5] uppercase tracking-wider mb-3">Contact Sources</p>
          <Skeleton className="h-36 bg-[#ebe7e1] rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#111111]">Contact Sources</CardTitle>
        </CardHeader>
        <Separator className="bg-[#ebe7e1]" />
        <CardContent className="pt-5">
          <Skeleton className="h-36 bg-[#ebe7e1] rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#9c9fa5] uppercase tracking-wider mb-1">Contact Sources</p>
              <p className="text-sm text-[#c41c1c]">Could not load data. Retry.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="h-7 text-xs border-[#d3cec6]"
            >
              <RefreshCw size={12} className="mr-1" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = data?.total ?? data?.sources.reduce((sum, s) => sum + s.count, 0) ?? 0;

  const chartData = data?.sources.map((s) => ({
    name: s.source,
    value: s.count,
    fill: SOURCE_COLORS[s.source] ?? '#9c9fa5',
  })) ?? [];

  return (
    <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none hover:shadow-md transition-shadow ${className ?? ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#111111]">Contact Sources</CardTitle>
      </CardHeader>
      <Separator className="bg-[#ebe7e1]" />
      <CardContent className="pt-5">
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
              formatter={(value: any, name: any) => [value, SOURCE_LABELS[name as string] ?? name]}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="text-center -mt-8 mb-3">
          <p className="text-xs text-[#9c9fa5]">Total</p>
          <p className="text-lg font-bold text-[#111111]">{total}</p>
        </div>

        <div className="mt-3 space-y-1.5">
          {data?.sources.map((source) => (
            <button
              key={source.source}
              className="w-full flex items-center justify-between text-left hover:bg-[#f5f1ec] rounded-lg px-2 py-1.5 transition-colors"
              onClick={() => navigate({ to: '/parties', search: { source: source.source } as any })}
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: SOURCE_COLORS[source.source] ?? '#9c9fa5' }}
                />
                <span className="text-sm text-[#111111]">
                  {SOURCE_LABELS[source.source] ?? source.source}
                </span>
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
