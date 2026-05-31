import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Megaphone, TrendingUp, Target, Activity, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { campaignsApi } from '@/api/campaigns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { CampaignFormModal } from './CampaignFormModal';

export function CampaignConsole() {
  const { can } = usePermissions();
  const canManage = can('create', 'Campaign');
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: statsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['campaigns', 'stats'],
    queryFn: () => campaignsApi.getAggregateStats(),
    staleTime: 30_000,
  });

  const refreshMutation = () => {
    refetch();
    toast.success('Campaign statistics updated');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-[1100px] p-6 text-center text-red-600 bg-red-50 rounded-xl border border-red-200 mt-12">
        <p className="font-semibold">Failed to load campaigns data</p>
        <p className="text-xs mt-1">{(error as Error)?.message || 'An unexpected error occurred. Please check permissions or server connection.'}</p>
        <Button
          onClick={() => refetch()}
          size="sm"
          className="mt-4 bg-red-600 hover:bg-red-700 text-white"
        >
          Try Again
        </Button>
      </div>
    );
  }

  const campaigns = statsData?.campaigns ?? [];
  const totalLeads = statsData?.total_leads ?? 0;
  const totalConverted = statsData?.total_converted ?? 0;
  const overallRate = statsData?.overall_conversion_rate ?? 0;
  const topChannel = statsData?.top_channel ?? '—';

  return (
    <div className="space-y-6 max-w-[1100px] animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Campaign Attribution</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Measure acquisition funnels, tag inbound leads, and track multi-channel conversions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshMutation}
            className="h-9 text-xs gap-1 border-border text-muted-foreground bg-card hover:bg-muted"
          >
            <RefreshCw size={13} />
            Refresh
          </Button>
          {canManage && (
            <Button
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="h-9 text-xs gap-1 bg-primary hover:bg-[#1e293b] text-white"
            >
              <Plus size={14} />
              Create Campaign
            </Button>
          )}
        </div>
      </div>

      {/* Aggregate Telemetry Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border rounded-xl shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-fin-orange/10 flex items-center justify-center text-fin-orange flex-shrink-0">
              <Megaphone size={20} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Campaigns</p>
              <p className="text-2xl font-extrabold text-foreground mt-0.5">{campaigns.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-xl shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 flex-shrink-0">
              <Target size={20} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total leads</p>
              <p className="text-2xl font-extrabold text-foreground mt-0.5">{totalLeads.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-xl shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Conversion Rate</p>
              <p className="text-2xl font-extrabold text-foreground mt-0.5">{overallRate}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-xl shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
              <Activity size={20} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Top Channel</p>
              <p className="text-2xl font-extrabold text-foreground mt-0.5 capitalize">{topChannel.replace('_', ' ')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns Listing */}
      <Card className="bg-card border-border rounded-xl shadow-none overflow-hidden">
        <CardHeader className="border-b border-border px-6 py-4">
          <CardTitle className="text-sm font-semibold text-foreground">Active Channels & UTM Configurations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-muted border-b border-border text-muted-foreground text-xs font-semibold uppercase">
                  <th className="px-6 py-3">Campaign Name</th>
                  <th className="px-6 py-3">Channel</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Leads</th>
                  <th className="px-6 py-3 text-right">Converted</th>
                  <th className="px-6 py-3 text-right">Conv. Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {campaigns.map((camp) => {
                  const rateColor =
                    camp.conversion_rate >= 20
                      ? 'text-emerald-600 font-bold'
                      : camp.conversion_rate >= 10
                        ? 'text-amber-600 font-semibold'
                        : 'text-muted-foreground';

                  const statusBg =
                    camp.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : camp.status === 'paused'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : camp.status === 'completed'
                          ? 'bg-fin-orange/10 text-fin-orange border-fin-orange/30'
                          : 'bg-muted text-foreground/80 border-border';

                  return (
                    <tr key={camp.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{camp.name}</td>
                      <td className="px-6 py-4 capitalize text-muted-foreground">{camp.channel.replace('_', ' ')}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusBg}`}>
                          {camp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-muted-foreground">{camp.total_leads}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">{camp.converted}</td>
                      <td className={`px-6 py-4 text-right ${rateColor}`}>{camp.conversion_rate}%</td>
                    </tr>
                  );
                })}
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground text-xs">
                      No campaigns created yet. Click "Create Campaign" to begin tagging incoming traffic.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <CampaignFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
