import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Lock, RefreshCw, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';

interface ConversionRateWidgetProps {
  className?: string;
  hasPermission?: boolean;
}

export function ConversionRateWidget({ className, hasPermission = true }: ConversionRateWidgetProps) {
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
    enabled: hasPermission,
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
    enabled: hasPermission && !!date_from && !!date_to,
  });

  const delta = prevData ? (data?.rate ?? 0) - prevData.rate : 0;

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
          <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-2">Conversion Rate</p>
          <Skeleton className="h-10 w-20 bg-[#e2e8f0]" />
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={`bg-white border-[#e2e8f0] rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#0f172a]">Conversion Rate</CardTitle>
        </CardHeader>
        <Separator className="bg-[#e2e8f0]" />
        <CardContent className="pt-5">
          <Skeleton className="h-10 w-24 bg-[#e2e8f0] mb-3" />
          <Skeleton className="h-3 w-36 bg-[#e2e8f0]" />
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
              <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-1">Conversion Rate</p>
              <p className="text-sm text-[#c41c1c]">Could not load pipeline data. Retry.</p>
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

  return (
    <Card className={`bg-white border-[#e2e8f0] rounded-xl shadow-none hover:shadow-md transition-shadow ${className ?? ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#0f172a]">Conversion Rate</CardTitle>
      </CardHeader>
      <Separator className="bg-[#e2e8f0]" />
      <CardContent className="pt-5">
        <button
          className="text-left w-full group"
          onClick={() => navigate({ to: '/cases', search: { stage: 'won' } as any })}
        >
          <div className="text-4xl font-bold text-[#0f172a] tracking-tight group-hover:text-[#3b82f6] transition-colors">
            {data?.rate != null ? `${data.rate.toFixed(1)}%` : '—'}
          </div>
        </button>
        {delta !== 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            {delta > 0 ? (
              <TrendingUp size={14} className="text-[#0bdf50]" />
            ) : (
              <TrendingDown size={14} className="text-[#c41c1c]" />
            )}
            <span className={`text-sm font-medium ${delta > 0 ? 'text-[#0bdf50]' : 'text-[#c41c1c]'}`}>
              {delta > 0 ? '+' : ''}{delta.toFixed(1)}pp vs prior period
            </span>
          </div>
        )}
        <p className="text-xs text-[#94a3b8] mt-2">
          {data?.converted ?? 0} enrolled from {data?.total ?? 0} total enquiries
        </p>
        <div className="mt-3 w-full h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0bdf50] rounded-full transition-all"
            style={{ width: `${Math.min(data?.rate ?? 0, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
