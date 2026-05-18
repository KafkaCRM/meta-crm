import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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

  const delta = prevData ? (data?.rate ?? 0) - prevData.rate : 0;

  if (isLoading) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardContent className="pt-5 pb-5">
          <Skeleton className="h-4 w-28 bg-[#ebe7e1] mb-3" />
          <Skeleton className="h-10 w-20 bg-[#ebe7e1]" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-medium text-[#9c9fa5] uppercase tracking-wider mb-2">Conversion Rate</p>
          <p className="text-sm text-[#c41c1c]">Failed to load</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
      <CardContent className="pt-5 pb-5">
        <p className="text-xs font-medium text-[#9c9fa5] uppercase tracking-wider mb-2">Conversion Rate</p>
        <button
          className="text-left w-full"
          onClick={() => navigate({ to: '/cases', search: '?stage=won' } as any)}
        >
          <div className="text-3xl font-medium text-[#111111] tracking-tight">
            {data?.rate != null ? `${Math.round(data.rate)}%` : '—'}
          </div>
        </button>
        {delta !== 0 && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {delta > 0 ? (
              <TrendingUp size={13} className="text-[#0bdf50]" />
            ) : (
              <TrendingDown size={13} className="text-[#c41c1c]" />
            )}
            <span className={`text-xs font-medium ${delta > 0 ? 'text-[#0bdf50]' : 'text-[#c41c1c]'}`}>
              {delta > 0 ? '+' : ''}{Math.round(delta)}pp vs prior period
            </span>
          </div>
        )}
        <p className="text-xs text-[#9c9fa5] mt-2">
          {data?.converted ?? 0} of {data?.total ?? 0} cases converted
        </p>
        <div className="mt-3 w-full h-1 bg-[#ebe7e1] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0bdf50] rounded-full transition-all"
            style={{ width: `${Math.min(data?.rate ?? 0, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
