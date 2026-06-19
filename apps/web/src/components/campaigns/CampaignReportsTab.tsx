import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, type CampaignReportEntry } from '@/api/reports';
import { useBranch } from '@/contexts/branch.context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { RefreshCw, TrendingUp, BarChart3, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'comparison' | 'channel';

export function CampaignReportsTab() {
  const { selectedVerticalIds } = useBranch();
  const verticalIdsStr = selectedVerticalIds.length > 0 ? selectedVerticalIds.join(',') : '';
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewMode>('comparison');

  const { data: campaignsData, isLoading, refetch } = useQuery({
    queryKey: ['reports', 'campaigns', verticalIdsStr],
    queryFn: () => reportsApi.campaigns({ vertical_id: verticalIdsStr || undefined }),
    staleTime: 30_000,
  });

  const { data: channelData, isLoading: channelLoading } = useQuery({
    queryKey: ['reports', 'channel-performance', verticalIdsStr],
    queryFn: () => reportsApi.channelPerformance({ vertical_id: verticalIdsStr || undefined }),
    staleTime: 30_000,
  });

  const { data: comparisonData, isLoading: comparisonLoading } = useQuery({
    queryKey: ['reports', 'campaign-comparison', ...Array.from(selectedIds)],
    queryFn: () => reportsApi.campaignComparison(Array.from(selectedIds)),
    enabled: selectedIds.size >= 2,
    staleTime: 30_000,
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!campaignsData?.campaigns) return;
    if (selectedIds.size === campaignsData.campaigns.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(campaignsData.campaigns.map((c) => c.id)));
    }
  };

  const campaigns = campaignsData?.campaigns ?? [];

  const channelChartData = useMemo(() => {
    return (channelData?.channels ?? []).map((ch) => ({
      name: ch.channel.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      leads: ch.total_leads,
      converted: ch.converted,
      'Conv. Rate': Math.round(ch.conversion_rate),
    }));
  }, [channelData]);

  if (isLoading || channelLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-[#e2e8f0]" />
        <Skeleton className="h-64 bg-[#e2e8f0] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={view === 'comparison' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('comparison')}
            className={cn(
              'h-8 text-xs gap-1.5',
              view === 'comparison'
                ? 'bg-primary text-white'
                : 'border-border text-muted-foreground'
            )}
          >
            <Table2 size={13} />
            Campaign Comparison
          </Button>
          <Button
            variant={view === 'channel' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('channel')}
            className={cn(
              'h-8 text-xs gap-1.5',
              view === 'channel'
                ? 'bg-primary text-white'
                : 'border-border text-muted-foreground'
            )}
          >
            <BarChart3 size={13} />
            Channel Performance
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="h-8 text-xs gap-1 border-border text-muted-foreground"
        >
          <RefreshCw size={13} />
          Refresh
        </Button>
      </div>

      {view === 'comparison' && (
        <>
          <Card className="bg-card border-border rounded-xl shadow-none overflow-hidden">
            <CardHeader className="border-b border-border px-6 py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Select Campaigns to Compare
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="text-xs text-muted-foreground h-7"
                >
                  {selectedIds.size === campaigns.length ? 'Clear All' : 'Select All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {campaigns.length === 0 ? (
                <p className="px-6 py-8 text-sm text-muted-foreground text-center">
                  No campaigns found for the current period.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {campaigns.map((camp) => (
                    <label
                      key={camp.id}
                      className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(camp.id)}
                        onChange={() => toggleSelect(camp.id)}
                        className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{camp.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {camp.channel.replace('_', ' ')} · {camp.total_leads} leads · {camp.conversion_rate}% conv.
                        </p>
                      </div>
                      <Badge
                        variant={camp.status === 'active' ? 'success' : camp.status === 'paused' ? 'warning' : 'secondary'}
                        className="text-[9px] uppercase h-5 px-2"
                      >
                        {camp.status}
                      </Badge>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedIds.size >= 2 && (
            <Card className="bg-card border-border rounded-xl shadow-none overflow-hidden">
              <CardHeader className="border-b border-border px-6 py-4">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp size={15} className="text-primary" />
                  Comparison
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {comparisonLoading ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-8 bg-[#e2e8f0]" />
                    <Skeleton className="h-8 bg-[#e2e8f0]" />
                    <Skeleton className="h-8 bg-[#e2e8f0]" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted border-b border-border text-muted-foreground text-xs font-semibold uppercase">
                          <th className="px-6 py-3">Campaign</th>
                          <th className="px-6 py-3">Channel</th>
                          <th className="px-6 py-3 text-right">Leads</th>
                          <th className="px-6 py-3 text-right">Converted</th>
                          <th className="px-6 py-3 text-right">Conv. Rate</th>
                          <th className="px-6 py-3 text-right">Call Connect</th>
                          <th className="px-6 py-3 text-right">Untouched</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {comparisonData?.campaigns.map((camp) => (
                          <tr key={camp.id} className="hover:bg-muted/50 transition-colors">
                            <td className="px-6 py-3 font-semibold text-foreground">{camp.name}</td>
                            <td className="px-6 py-3 capitalize text-muted-foreground">{camp.channel.replace('_', ' ')}</td>
                            <td className="px-6 py-3 text-right font-mono">{camp.total_leads}</td>
                            <td className="px-6 py-3 text-right font-mono">{camp.converted}</td>
                            <td className={cn(
                              'px-6 py-3 text-right font-mono',
                              camp.conversion_rate >= 20 ? 'text-emerald-600 font-bold' : 'text-muted-foreground'
                            )}>
                              {camp.conversion_rate}%
                            </td>
                            <td className="px-6 py-3 text-right font-mono text-muted-foreground">{camp.call_connect_rate}%</td>
                            <td className="px-6 py-3 text-right font-mono text-amber-600 font-semibold">{camp.untouched_leads}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {selectedIds.size === 0 && (
            <Card className="bg-card border-border rounded-xl shadow-none">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Select 2 or more campaigns above to see a side-by-side comparison.
                </p>
              </CardContent>
            </Card>
          )}

          {selectedIds.size === 1 && (
            <Card className="bg-card border-border rounded-xl shadow-none">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Select at least one more campaign to enable comparison view.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {view === 'channel' && (
        <Card className="bg-card border-border rounded-xl shadow-none">
          <CardHeader className="border-b border-border px-6 py-4">
            <CardTitle className="text-sm font-semibold text-foreground">
              Channel Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {channelChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No channel performance data available.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={channelChartData} barSize={24} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#0f172a',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    iconType="circle"
                  />
                  <Bar dataKey="leads" fill="#3b82f6" name="Total Leads" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="converted" fill="#0bdf50" name="Converted" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Conv. Rate" fill="#f59e0b" name="Conv. Rate %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
