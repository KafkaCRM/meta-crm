import { useQuery } from '@tanstack/react-query';
import { useLocation } from '@tanstack/react-router';
import { reportsApi, type ReportParams } from '@/api/reports';
import { getDateRangeFromSearch } from '../DateRangePicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Phone, Calendar, ArrowUpRight, Clock } from 'lucide-react';

interface MyFollowUpsWidgetProps {
  className?: string;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  call: <Phone size={12} />,
  email: <Calendar size={12} />,
  whatsapp: <Phone size={12} />,
  note: <Clock size={12} />,
};

const CHANNEL_COLORS: Record<string, string> = {
  call: 'text-[#8b5cf6]',
  email: 'text-[#3b82f6]',
  whatsapp: 'text-[#0bdf50]',
  note: 'text-muted-foreground',
};

export function MyFollowUpsWidget({ className }: MyFollowUpsWidgetProps) {
  const location = useLocation();
  const { date_from, date_to } = getDateRangeFromSearch(location.search);

  const params: ReportParams = { date_from, date_to };

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'my-followups', date_from, date_to],
    queryFn: () => reportsApi.myFollowUps(params),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <Card className={`bg-card border-border rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Follow-ups Today</CardTitle>
        </CardHeader>
        <Separator className="bg-[#e2e8f0]" />
        <CardContent className="pt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-28 bg-[#e2e8f0]" />
              <Skeleton className="h-4 w-16 bg-[#e2e8f0] ml-auto" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`bg-card border-border rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Follow-ups Today</CardTitle>
        </CardHeader>
        <Separator className="bg-[#e2e8f0]" />
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#c41c1c]">Could not load follow-ups. Retry.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="h-7 text-xs border-border"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const followUps = data?.followUps ?? [];

  return (
    <Card className={`bg-card border-border rounded-xl shadow-none hover:shadow-md transition-shadow ${className ?? ''}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-foreground">Follow-ups Today</CardTitle>
        {followUps.length > 0 && (
          <Badge variant="secondary" className="bg-[#f59e0b]/10 text-[#d97706] border-0 text-xs rounded-md">
            {followUps.length}
          </Badge>
        )}
      </CardHeader>
      <Separator className="bg-[#e2e8f0]" />
      <CardContent className="pt-4">
        {followUps.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center mb-3">
              <Calendar size={18} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No follow-ups scheduled for today</p>
            <p className="text-xs text-muted-foreground mt-1">Enjoy the quiet!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {followUps.map((fu) => (
              <div
                key={fu.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className={CHANNEL_COLORS[fu.channel] ?? 'text-muted-foreground'}>
                    {CHANNEL_ICONS[fu.channel] ?? <Clock size={12} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{fu.party_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{fu.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span className="text-xs text-muted-foreground">{fu.time}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    title="Call"
                  >
                    <Phone size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
