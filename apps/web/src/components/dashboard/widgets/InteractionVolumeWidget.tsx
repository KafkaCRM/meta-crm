import { useQuery } from '@tanstack/react-query';
import { useLocation } from '@tanstack/react-router';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MessageSquare, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';

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
      <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
        <h3 className="text-sm font-medium mb-3">Interaction Volume</h3>
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
        <h3 className="text-sm font-medium mb-3">Interaction Volume</h3>
        <p className="text-sm text-destructive">Failed to load</p>
      </div>
    );
  }

  const chartData = data?.channels.map((ch) => ({
    name: ch.channel,
    inbound: ch.inbound,
    outbound: ch.outbound,
    total: ch.count,
  })) ?? [];

  return (
    <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
      <h3 className="text-sm font-medium mb-3">Interaction Volume</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="inbound" fill="#3b82f6" name="Inbound" />
          <Bar dataKey="outbound" fill="#22c55e" name="Outbound" />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-1">
        {data?.channels.map((ch) => (
          <div key={ch.channel} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="capitalize">{ch.channel}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ArrowDownLeft className="h-3 w-3" /> {ch.inbound}
              </span>
              <span className="flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> {ch.outbound}
              </span>
              <span className="font-medium text-foreground">{ch.count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
