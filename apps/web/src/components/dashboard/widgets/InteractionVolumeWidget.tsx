import { useQuery } from '@tanstack/react-query';
import { useLocation } from '@tanstack/react-router';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MessageSquare, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface InteractionVolumeWidgetProps {
  className?: string;
}

export function InteractionVolumeWidget({ className }: InteractionVolumeWidgetProps) {
  const location = useLocation();
  const { date_from, date_to } = getDateRangeFromSearch(location.search);

  const params = { date_from, date_to };

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'interaction-volume', date_from, date_to],
    queryFn: () => reportsApi.interactionVolume(params),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardContent className="pt-5 pb-5">
          <Skeleton className="h-4 w-36 bg-[#ebe7e1] mb-4" />
          <Skeleton className="h-40 bg-[#ebe7e1] rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-medium text-[#9c9fa5] uppercase tracking-wider mb-2">Interaction Volume</p>
          <p className="text-sm text-[#c41c1c]">Failed to load</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data?.channels.map((ch) => ({
    name: ch.channel,
    inbound: ch.inbound,
    outbound: ch.outbound,
    total: ch.count,
  })) ?? [];

  return (
    <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
      <CardContent className="pt-5 pb-5">
        <p className="text-xs font-medium text-[#9c9fa5] uppercase tracking-wider mb-4">Interaction Volume</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} barSize={12} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ebe7e1" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9c9fa5', fontFamily: 'Inter, sans-serif' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9c9fa5', fontFamily: 'Inter, sans-serif' }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #d3cec6',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'Inter, sans-serif',
                color: '#111111',
                boxShadow: 'none',
              }}
            />
            {/* DESIGN.md report palette — analytics surface only */}
            <Bar dataKey="inbound" fill="#65b5ff" name="Inbound" radius={[2, 2, 0, 0]} />
            <Bar dataKey="outbound" fill="#0bdf50" name="Outbound" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 space-y-2">
          {data?.channels.map((ch) => (
            <div key={ch.channel} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={12} className="text-[#9c9fa5]" />
                <span className="text-sm text-[#111111] capitalize">{ch.channel}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-xs text-[#9c9fa5]">
                  <ArrowDownLeft size={10} className="text-[#65b5ff]" />
                  {ch.inbound}
                </span>
                <span className="flex items-center gap-1 text-xs text-[#9c9fa5]">
                  <ArrowUpRight size={10} className="text-[#0bdf50]" />
                  {ch.outbound}
                </span>
                <span className="text-sm font-medium text-[#111111]">{ch.count}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
