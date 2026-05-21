import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, ArrowUpRight, Lock } from 'lucide-react';

interface MyCasesWidgetProps {
  className?: string;
}

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-[#3b82f6]/10 text-[#2563eb] border-[#3b82f6]/20',
  contacted: 'bg-[#3b82f6]/10 text-[#2563eb] border-[#3b82f6]/20',
  qualified: 'bg-[#f59e0b]/10 text-[#d97706] border-[#f59e0b]/20',
  negotiation: 'bg-[#f59e0b]/10 text-[#d97706] border-[#f59e0b]/20',
  won: 'bg-[#0bdf50]/10 text-[#0a7f2e] border-[#0bdf50]/20',
  enrolled: 'bg-[#0bdf50]/10 text-[#0a7f2e] border-[#0bdf50]/20',
  lost: 'bg-[#c41c1c]/10 text-[#c41c1c] border-[#c41c1c]/20',
  dropped: 'bg-[#c41c1c]/10 text-[#c41c1c] border-[#c41c1c]/20',
};

function StageBadge({ stage }: { stage: string }) {
  const cls = STAGE_COLORS[stage] ?? 'bg-[#9c9fa5]/10 text-[#626260] border-[#9c9fa5]/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${cls}`}>
      {stage}
    </span>
  );
}

export function MyCasesWidget({ className }: MyCasesWidgetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { date_from, date_to } = getDateRangeFromSearch(location.search);

  const params: ReportParams = { date_from, date_to };

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'my-cases', date_from, date_to],
    queryFn: () => reportsApi.myCases(params),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#111111]">My Cases Today</CardTitle>
        </CardHeader>
        <Separator className="bg-[#ebe7e1]" />
        <CardContent className="pt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-32 bg-[#ebe7e1]" />
              <Skeleton className="h-4 w-16 bg-[#ebe7e1] ml-auto" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#111111]">My Cases Today</CardTitle>
        </CardHeader>
        <Separator className="bg-[#ebe7e1]" />
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#c41c1c]">Could not load cases. Retry.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="h-7 text-xs border-[#d3cec6]"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const cases = data?.cases ?? [];

  return (
    <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none hover:shadow-md transition-shadow ${className ?? ''}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-[#111111]">My Cases Today</CardTitle>
        {cases.length > 0 && (
          <Badge variant="secondary" className="bg-[#3b82f6]/10 text-[#2563eb] border-0 text-xs rounded-md">
            {cases.length}
          </Badge>
        )}
      </CardHeader>
      <Separator className="bg-[#ebe7e1]" />
      <CardContent className="pt-4">
        {cases.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-[#f5f1ec] flex items-center justify-center mb-3">
              <FileText size={18} className="text-[#9c9fa5]" />
            </div>
            <p className="text-sm font-medium text-[#111111]">No cases assigned to you</p>
            <p className="text-xs text-[#9c9fa5] mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cases.map((c) => (
              <button
                key={c.id}
                className="flex w-full items-center justify-between rounded-lg border border-[#ebe7e1] p-3 text-left hover:bg-[#f5f1ec] transition-colors"
                onClick={() => navigate({ to: '/cases/$id', params: { id: c.id } })}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#111111] truncate">{c.party_name}</p>
                  <p className="text-xs text-[#9c9fa5] mt-0.5 truncate">{c.title}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <StageBadge stage={c.stage} />
                  <ArrowUpRight size={12} className="text-[#9c9fa5]" />
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-[#ebe7e1]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/cases', search: { assigned_to_me: 'true' } as any })}
            className="w-full h-7 text-xs text-[#626260] hover:text-[#111111]"
          >
            View all cases
            <ArrowUpRight size={12} className="ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
