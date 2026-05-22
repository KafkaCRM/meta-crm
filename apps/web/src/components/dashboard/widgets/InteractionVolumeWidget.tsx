import { useQuery } from '@tanstack/react-query';
import { useLocation } from '@tanstack/react-router';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Lock, RefreshCw } from 'lucide-react';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface InteractionVolumeWidgetProps {
  className?: string;
  hasPermission?: boolean;
}

export function InteractionVolumeWidget({ className, hasPermission = true }: InteractionVolumeWidgetProps) {
  const location = useLocation();
  const { date_from, date_to } = getDateRangeFromSearch(location.search);

  const params = { date_from, date_to };

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'interaction-volume', date_from, date_to],
    queryFn: () => reportsApi.interactionVolume(params),
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
          <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-4">Interaction Volume</p>
          <Skeleton className="h-40 bg-[#e2e8f0] rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={`bg-white border-[#e2e8f0] rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#0f172a]">Interaction Volume</CardTitle>
        </CardHeader>
        <Separator className="bg-[#e2e8f0]" />
        <CardContent className="pt-5">
          <Skeleton className="h-40 bg-[#e2e8f0] rounded-xl" />
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
              <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-1">Interaction Volume</p>
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

  const chartData = data?.daily?.map((d) => ({
    date: d.date,
    inbound: d.inbound,
    outbound: d.outbound,
  })) ?? [];

  return (
    <Card className={`bg-white border-[#e2e8f0] rounded-xl shadow-none hover:shadow-md transition-shadow ${className ?? ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#0f172a]">Interaction Volume</CardTitle>
      </CardHeader>
      <Separator className="bg-[#e2e8f0]" />
      <CardContent className="pt-5">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={8} barGap={1}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={24}
            />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#0f172a',
                boxShadow: 'none',
              }}
              formatter={(value: any, name: any) => [value, name === 'inbound' ? 'Inbound' : 'Outbound']}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              iconType="circle"
            />
            <Bar dataKey="inbound" fill="#3b82f6" name="Inbound" radius={[2, 2, 0, 0]} />
            <Bar dataKey="outbound" fill="#0bdf50" name="Outbound" radius={[2, 2, 0, 0]} opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
