import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Megaphone, 
  TrendingUp, 
  Target, 
  Activity, 
  Plus, 
  RefreshCw, 
  Loader2, 
  Phone, 
  MessageSquare, 
  ExternalLink,
  ArrowLeft,
  Search
} from 'lucide-react';
import { campaignsApi } from '@/api/campaigns';
import { settingsApi } from '@/api/settings';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/usePermissions';
import { CampaignFormModal } from './CampaignFormModal';
import { VirtualTable } from '@/components/shared/VirtualTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LeadDetail } from '../leads/LeadDetail';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

export function CampaignConsole() {
  const { can } = usePermissions();
  const canManage = can('create', 'Campaign');
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  
  // Scopes and search states for the detailed Leads view
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [metricFilter, setMetricFilter] = useState<'all' | 'untouched' | 'converted'>('all');
  
  // Preview Drawer states
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Fetch aggregate data
  const { data: statsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['campaigns', 'stats'],
    queryFn: () => campaignsApi.getAggregateStats(),
    staleTime: 30_000,
  });

  // Fetch branches & brands for dynamic scoping
  const { data: branches = [] } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list(),
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['settings', 'brands'],
    queryFn: () => settingsApi.brands.list(),
  });

  // Fetch selected campaign detail
  const { data: campaign, isLoading: isLoadingCampaign } = useQuery({
    queryKey: ['campaigns', selectedCampaignId],
    queryFn: () => campaignsApi.get(selectedCampaignId!),
    enabled: !!selectedCampaignId,
  });

  // Fetch leads for selected campaign
  const { data: campaignLeads, isLoading: isLoadingLeads, refetch: refetchLeads } = useQuery({
    queryKey: ['campaigns', selectedCampaignId, 'leads'],
    queryFn: () => campaignsApi.getLeads(selectedCampaignId!),
    enabled: !!selectedCampaignId,
  });

  const refreshMutation = () => {
    refetch();
    if (selectedCampaignId) {
      refetchLeads();
    }
    toast.success('Campaign statistics updated');
  };

  const openPhone = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const openWhatsApp = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = `91${cleaned}`;
    window.open(`https://api.whatsapp.com/send?phone=${cleaned}`, '_blank');
  };

  const activeBranch = useMemo(() => {
    if (!campaign) return null;
    return branches.find(b => b.id === campaign.branch_id);
  }, [campaign, branches]);

  const activeBrand = useMemo(() => {
    if (!campaign) return null;
    return brands.find(b => b.id === campaign.brand_id);
  }, [campaign, brands]);

  // Client side filtering for campaign leads table
  const filteredLeads = useMemo(() => {
    const list = campaignLeads?.data ?? [];
    let filtered = [...list];

    // Search Query (Name/Phone)
    if (leadSearchQuery.trim()) {
      const q = leadSearchQuery.toLowerCase();
      filtered = filtered.filter(lead => 
        lead.party?.name?.toLowerCase().includes(q) ||
        lead.party?.phone_raw?.toLowerCase().includes(q)
      );
    }

    // Metric Click Filters
    if (metricFilter === 'untouched') {
      filtered = filtered.filter(lead => lead.stage?.toLowerCase() === 'new');
    } else if (metricFilter === 'converted') {
      filtered = filtered.filter(lead => lead.stage?.toLowerCase() === 'converted' || lead.stage?.toLowerCase() === 'won');
    }

    return filtered;
  }, [campaignLeads, leadSearchQuery, metricFilter]);

  // Setup table columns
  const columns = useMemo(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorFn: (row: any) => row.name,
        cell: (info: any) => (
          <span className="font-semibold text-foreground">{info.getValue()}</span>
        ),
      },
      {
        id: 'phone',
        header: 'Phone',
        accessorFn: (row: any) => row.phone,
        cell: (info: any) => (
          <span className="text-sm font-mono text-muted-foreground">{info.getValue()}</span>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        accessorFn: (row: any) => row.source,
        cell: (info: any) => (
          <span className="text-xs text-muted-foreground capitalize">{info.getValue()}</span>
        ),
      },
      {
        id: 'stage',
        header: 'Status',
        accessorFn: (row: any) => row.stage,
        cell: (info: any) => {
          const stage = info.getValue() as string;
          let variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' = 'secondary';
          if (stage === 'won' || stage === 'converted' || stage === 'qualified') variant = 'success';
          else if (stage === 'lost' || stage === 'dropped') variant = 'destructive';
          else if (stage === 'new') variant = 'default';
          
          return (
            <span className="capitalize shrink-0">
              <Badge variant={variant} className="text-[10px] tracking-normal uppercase h-5 font-semibold">
                {stage}
              </Badge>
            </span>
          );
        },
      },
      {
        id: 'assigned_to',
        header: 'Assigned To',
        accessorFn: (row: any) => row.assigned_to?.name,
        cell: (info: any) => (
          <span className="text-xs text-muted-foreground">{info.getValue() || '—'}</span>
        ),
      },
      {
        id: 'created_at',
        header: 'Created',
        accessorFn: (row: any) => row.created_at,
        cell: (info: any) => (
          <span className="text-xs text-muted-foreground">
            {dayjs(info.getValue()).format('DD MMM YYYY')}
          </span>
        ),
      },
    ],
    [],
  );

  const handleRowClick = (row: any) => {
    setPreviewId(row.id);
    setPreviewOpen(true);
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
        <Button onClick={() => refetch()} size="sm" className="mt-4 bg-red-600 hover:bg-red-700 text-white">
          Try Again
        </Button>
      </div>
    );
  }

  // --- RENDERING DETAIL VIEW (Selected Campaign) ---
  if (selectedCampaignId && campaign) {
    return (
      <div className="space-y-6 max-w-[1100px] animate-in fade-in duration-200">
        
        {/* Breadcrumb Scoping & Dynamic Auto-Collapse */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setSelectedCampaignId(null); setMetricFilter('all'); }}
              className="text-muted-foreground hover:text-foreground hover:underline transition-colors flex items-center gap-1 text-sm font-semibold"
            >
              <ArrowLeft size={14} />
              Campaigns
            </button>
            <span className="text-muted-foreground">/</span>
            {branches.length > 1 && (
              <>
                <span className="text-sm font-semibold text-foreground">
                  {activeBranch?.name ?? 'Branch'}
                </span>
                <span className="text-muted-foreground">/</span>
              </>
            )}
            {brands.length > 1 && (
              <>
                <span className="text-sm font-semibold text-foreground">
                  {activeBrand?.name ?? 'Brand'}
                </span>
                <span className="text-muted-foreground">/</span>
              </>
            )}
            <span className="text-sm font-bold bg-muted px-2 py-0.5 rounded-md text-foreground">
              {campaign.name}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshMutation}
            className="h-8 text-xs gap-1 border-border text-muted-foreground bg-card hover:bg-muted"
          >
            <RefreshCw size={13} />
            Refresh
          </Button>
        </div>

        {/* Interactive Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Card 1: Total Leads */}
          <Card 
            className={cn(
              "bg-card border-border rounded-xl shadow-none relative overflow-hidden cursor-pointer transition-all hover:bg-muted/20",
              metricFilter === 'all' && "ring-1 ring-primary"
            )}
            onClick={() => setMetricFilter('all')}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                <Megaphone size={20} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Leads</p>
                <p className="text-2xl font-extrabold text-foreground mt-0.5">{campaign.stats?.total_leads ?? 0}</p>
              </div>
            </CardContent>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-100">
              <div className="bg-indigo-600 h-full w-full" />
            </div>
          </Card>

          {/* Card 2: Untouched Leads */}
          <Card 
            className={cn(
              "bg-card border-border rounded-xl shadow-none relative overflow-hidden cursor-pointer transition-all hover:bg-muted/20",
              metricFilter === 'untouched' && "ring-1 ring-primary"
            )}
            onClick={() => setMetricFilter('untouched')}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 flex-shrink-0">
                <Target size={20} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Untouched Leads</p>
                <p className="text-2xl font-extrabold text-foreground mt-0.5">{campaign.stats?.untouched_leads ?? 0}</p>
              </div>
            </CardContent>
            {/* Target is 0. Colored based on velocity limit. */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100">
              <div className={cn(
                "h-full transition-all duration-300",
                (campaign.stats?.untouched_leads ?? 0) === 0 ? "bg-emerald-500 w-full" : 
                (campaign.stats?.untouched_leads ?? 0) <= 5 ? "bg-amber-500 w-1/2" : "bg-rose-500 w-1/4"
              )} />
            </div>
          </Card>

          {/* Card 3: Call Connect Rate */}
          <Card className="bg-card border-border rounded-xl shadow-none relative overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 flex-shrink-0">
                <Activity size={20} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Call Connect Rate</p>
                <p className="text-2xl font-extrabold text-foreground mt-0.5">{campaign.stats?.call_connect_rate ?? 0}%</p>
              </div>
            </CardContent>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100">
              <div 
                className={cn(
                  "h-full transition-all",
                  (campaign.stats?.call_connect_rate ?? 0) >= 60 ? "bg-emerald-500" :
                  (campaign.stats?.call_connect_rate ?? 0) >= 45 ? "bg-amber-500" : "bg-rose-500"
                )} 
                style={{ width: `${Math.min(campaign.stats?.call_connect_rate ?? 0, 100)}%` }}
              />
            </div>
          </Card>

          {/* Card 4: Converted Leads */}
          <Card 
            className={cn(
              "bg-card border-border rounded-xl shadow-none relative overflow-hidden cursor-pointer transition-all hover:bg-muted/20",
              metricFilter === 'converted' && "ring-1 ring-primary"
            )}
            onClick={() => setMetricFilter('converted')}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Converted Leads</p>
                <p className="text-2xl font-extrabold text-foreground mt-0.5">{campaign.stats?.converted ?? 0}</p>
              </div>
            </CardContent>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100">
              <div 
                className={cn(
                  "h-full transition-all",
                  (campaign.stats?.conversion_rate ?? 0) >= 15 ? "bg-emerald-500" : "bg-amber-500"
                )} 
                style={{ width: `${Math.min(campaign.stats?.conversion_rate ?? 0, 100)}%` }}
              />
            </div>
          </Card>

        </div>

        {/* Unified Search & Filter bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative w-80 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
            <Input
              value={leadSearchQuery}
              onChange={(e) => setLeadSearchQuery(e.target.value)}
              placeholder="Search leads by name or phone..."
              className="pl-9 h-9 border-border bg-card text-foreground"
            />
          </div>
          {metricFilter !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMetricFilter('all')}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Campaign Leads Grid */}
        <Card className="bg-card border-border rounded-xl shadow-none overflow-hidden">
          <VirtualTable
            data={filteredLeads}
            columns={columns as any}
            rowCount={filteredLeads.length}
            isLoading={isLoadingLeads}
            resource="Party"
            onRowClick={handleRowClick}
            getRowActions={(row: any) => {
              const phone = row.party?.phone_raw;
              return (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded bg-muted hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground transition-all duration-200"
                    onClick={(e) => { e.stopPropagation(); openPhone(phone); }}
                    title="Call"
                  >
                    <Phone size={11} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded bg-muted hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground transition-all duration-200"
                    onClick={(e) => { e.stopPropagation(); openWhatsApp(phone); }}
                    title="WhatsApp"
                  >
                    <MessageSquare size={11} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded bg-muted hover:bg-blue-50 hover:text-blue-600 text-muted-foreground transition-all duration-200"
                    onClick={(e) => { e.stopPropagation(); handleRowClick(row); }}
                    title="View details"
                  >
                    <ExternalLink size={11} />
                  </Button>
                </div>
              );
            }}
          />
        </Card>

        {/* Slide-out Preview Panel */}
<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
  <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Lead Details</DialogTitle>
    </DialogHeader>
    <div className="px-1">
      {previewId && (
        <LeadDetail
          leadId={previewId}
          onClose={() => setPreviewOpen(false)}
          onChanged={() => {
            refetchLeads();
          }}
        />
      )}
    </div>
  </DialogContent>
</Dialog>
      </div>
    );
  }

  // --- RENDERING CAMPAIGNS LIST (Standard View) ---
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
                  <th className="px-6 py-3 text-right">Conv. Rate</th>
                  <th className="px-6 py-3 text-right">Call Connect</th>
                  <th className="px-6 py-3 text-right">Untouched</th>
                  <th className="px-6 py-3 text-right">Idle Agents</th>
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
                    <tr 
                      key={camp.id} 
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedCampaignId(camp.id)}
                    >
                      <td className="px-6 py-4 font-semibold text-foreground">{camp.name}</td>
                      <td className="px-6 py-4 capitalize text-muted-foreground">{camp.channel.replace('_', ' ')}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusBg}`}>
                          {camp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-muted-foreground font-mono">{camp.total_leads}</td>
                      <td className={`px-6 py-4 text-right font-mono ${rateColor}`}>{camp.conversion_rate}%</td>
                      <td className="px-6 py-4 text-right text-muted-foreground font-mono">{camp.call_connect_rate ?? 0}%</td>
                      <td className="px-6 py-4 text-right text-amber-600 font-semibold font-mono">{camp.untouched_leads ?? 0}</td>
                      <td className="px-6 py-4 text-right text-rose-600 font-semibold font-mono">{camp.idle_agents ?? 0}</td>
                    </tr>
                  );
                })}
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground text-xs">
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
