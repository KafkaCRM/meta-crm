import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';

interface ConversionRateWidgetProps {
  className?: string;
}

export function ConversionRateWidget({ className }: ConversionRateWidgetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { date_from, date_to } = getDateRangeFromSearch(location.search);

  const params: ReportParams = { date_from, date_to };

  const prevFromDate = date_from
    ? new Date(new Date(date_from).getTime() - (new Date(date_to).getTime() - new Date(date_from).getTime())).toISOString().split('T')[0]
    : undefined;
  const prevToDate = date_from ?? undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'conversion-rate', date_from, date_to],
    queryFn: () => reportsApi.conversionRate(params),
    staleTime: 60_000,
  });

  const { data: prevData } = useQuery({
    queryKey: ['reports', 'conversion-rate', prevFromDate, prevToDate],
    queryFn: () => {
      const p: ReportParams = {};
      if (prevFromDate) p.date_from = prevFromDate;
      if (prevToDate) p.date_to = prevToDate;
      return reportsApi.conversionRate(p);
    },
    staleTime: 60_000,
    enabled: !!date_from && !!date_to,
  });

  const delta = prevData ? data?.rate ?? 0 - prevData.rate : 0;

  if (isLoading) {
    return (
      <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
        <h3 className="text-sm font-medium mb-2">Conversion Rate</h3>
        <div className="h-10 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
        <h3 className="text-sm font-medium mb-2">Conversion Rate</h3>
        <p className="text-sm text-destructive">Failed to load</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
      <h3 className="text-sm font-medium mb-2">Conversion Rate</h3>
      <button
        className="w-full text-left"
        onClick={() => {
          navigate({
            to: '/cases',
            search: '?stage=won',
          });
        }}
      >
        <div className="text-3xl font-bold">{data?.rate != null ? `${Math.round(data.rate)}%` : '—'}</div>
      </button>
      <div className="flex items-center gap-2 mt-1">
        {delta !== 0 && (
          <>
            {delta > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span
              className={cn(
                'text-sm font-medium',
                delta > 0 ? 'text-green-600' : 'text-red-600',
              )}
            >
              {delta > 0 ? '+' : ''}{Math.round(delta)}pp vs prior period
            </span>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {data?.converted ?? 0} of {data?.total ?? 0} cases converted
      </p>
    </div>
  );
}
