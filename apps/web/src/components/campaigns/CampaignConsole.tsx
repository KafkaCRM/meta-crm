import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Search,
  Download,
  SlidersHorizontal,
  MoreHorizontal,
  Check,
  Building2,
  GitFork,
  Compass,
  Users,
  Eye,
  Trash2,
  Pause,
  Play
} from 'lucide-react';
import { campaignsApi, type Campaign } from '@/api/campaigns';
import { settingsApi } from '@/api/settings';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranch } from '@/contexts/branch.context';
import { CampaignFormModal } from './CampaignFormModal';
import { CampaignReportsTab } from './CampaignReportsTab';
import { VirtualTable } from '@/components/shared/VirtualTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LeadDetail } from '../leads/LeadDetail';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

export function CampaignConsole() {
  const { can } = usePermissions();
  const canManage = can('create', 'Campaign');
  const queryClient = useQueryClient();
  const { selectedBranchIds } = useBranch();

  const [activeTab, setActiveTab] = useState<'campaigns' | 'reports'>('campaigns');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Cascaded Filters matching friend's CRM
  const [filterBranch, setFilterBranch] = useState<string>('');
  const [filterVertical, setFilterVertical] = useState<string>('');
  const [filterPipeline, setFilterPipeline] = useState<string>('');
  const [filterCounsellor, setFilterCounsellor] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);

  // Column Visibility Chooser
  const [visibleColumns, setVisibleColumns] = useState({
    index: true,
    campaign: true,
    branch: true,
    vertical: true,
    pipeline: true,
    source: true,
    utm: true,
    spend: true,
    leads: true,
    cpl: true,
    assignRule: true,
    status: true,
    actions: true,
  });

  // Scopes and search states for the detailed Leads view
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [metricFilter, setMetricFilter] = useState<'all' | 'untouched' | 'converted'>('all');

  // Preview Drawer states
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const effectiveBranchIds = useMemo(() => {
    if (filterBranch) return filterBranch;
    if (selectedBranchIds.length > 0) return selectedBranchIds.join(',');
    return undefined;
  }, [filterBranch, selectedBranchIds]);

  // 1. Fetch Branches for filter
  const { data: branches = [] } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list({ accessible: true }),
  });

  // 2. Fetch Verticals for filter
  const { data: verticals = [] } = useQuery({
    queryKey: ['settings', 'verticals', effectiveBranchIds],
    queryFn: () => settingsApi.verticals.list(effectiveBranchIds ? { branch_ids: effectiveBranchIds } : undefined),
  });

  // Verticals filtered by selected branch
  const filteredVerticalOptions = useMemo(() => {
    if (!filterBranch && !effectiveBranchIds) return verticals;
    return verticals;
  }, [verticals, filterBranch, effectiveBranchIds]);

  // 3. Fetch Pipelines for filter
  const { data: pipelines = [] } = useQuery({
    queryKey: ['settings', 'pipelines', effectiveBranchIds, filterVertical],
    queryFn: () => settingsApi.pipelines.list({
      branch_ids: effectiveBranchIds || undefined,
      vertical_id: filterVertical || undefined,
    }),
  });

  // 4. Fetch Users (Lead Counsellors)
  const { data: users = [] } = useQuery({
    queryKey: ['settings', 'users-all'],
    queryFn: () => settingsApi.users.list(),
  });

  // 5. Fetch Aggregate Stats Summary (Top 8 KPIs)
  const { 
    data: statsData, 
    isLoading: isLoadingStats, 
    refetch: refetchStats 
  } = useQuery({
    queryKey: [
      'campaigns', 
      'stats', 
      effectiveBranchIds, 
      filterVertical, 
      filterPipeline
    ],
    queryFn: () => campaignsApi.getAggregateStats({
      branch_ids: effectiveBranchIds || undefined,
      vertical_id: filterVertical || undefined,
      pipeline_id: filterPipeline || undefined,
    }),
    staleTime: 30_000,
  });

  // 6. Fetch Filtered Campaigns List (12-Column Grid)
  const { 
    data: campaignsList = [], 
    isLoading: isLoadingCampaigns, 
    refetch: refetchCampaigns 
  } = useQuery({
    queryKey: [
      'campaigns', 
      'list', 
      effectiveBranchIds, 
      filterVertical, 
      filterPipeline, 
      filterCounsellor, 
      searchQuery, 
      includeInactive
    ],
    queryFn: () => campaignsApi.list({
      branch_ids: effectiveBranchIds || undefined,
      vertical_id: filterVertical || undefined,
      pipeline_id: filterPipeline || undefined,
      assigned_to: filterCounsellor || undefined,
      name: searchQuery.trim() || undefined,
      include_inactive: includeInactive,
    }),
    staleTime: 30_000,
  });

  // 7. Fetch selected campaign detail
  const { data: campaign } = useQuery({
    queryKey: ['campaigns', selectedCampaignId],
    queryFn: () => campaignsApi.get(selectedCampaignId!),
    enabled: !!selectedCampaignId,
  });

  // 8. Fetch leads for selected campaign
  const { data: campaignLeads, isLoading: isLoadingLeads, refetch: refetchLeads } = useQuery({
    queryKey: ['campaigns', selectedCampaignId, 'leads'],
    queryFn: () => campaignsApi.getLeads(selectedCampaignId!),
    enabled: !!selectedCampaignId,
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => 
      campaignsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign status updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => campaignsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign deleted');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete campaign');
    }
  });

  const handleRefresh = async () => {
    await Promise.all([refetchStats(), refetchCampaigns()]);
    if (selectedCampaignId) {
      await refetchLeads();
    }
    toast.success('Campaign data refreshed');
  };

  const handleBranchFilterChange = (val: string) => {
    setFilterBranch(val);
    setFilterVertical('');
    setFilterPipeline('');
  };

  const handleVerticalFilterChange = (val: string) => {
    setFilterVertical(val);
    setFilterPipeline('');
  };

  // CSV Export Function
  const handleExportCSV = () => {
    if (!campaignsList || campaignsList.length === 0) {
      toast.error('No campaigns to export');
      return;
    }

    const headers = [
      '#',
      'Campaign',
      'Branch',
      'Vertical',
      'Pipeline',
      'Source',
      'UTM',
      'Spend (INR)',
      'Leads',
      'CPL (INR)',
      'Assign rule',
      'Status'
    ];

    const rows = campaignsList.map((c, idx) => {
      const attr = (c.attributes as any) || {};
      const spendVal = attr.spend ? Number(attr.spend) : 0;
      const rule = attr.assign_rule === 'on_demand' 
        ? 'On Demand' 
        : attr.assign_rule === 'equal' 
          ? 'Equal' 
          : attr.assign_rule === 'conditional' 
            ? 'Conditional' 
            : (attr.distribution || '—');

      return [
        idx + 1,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.branch?.name || '').replace(/"/g, '""')}"`,
        `"${(c.vertical?.name || '').replace(/"/g, '""')}"`,
        `"${(c.pipeline?.name || '').replace(/"/g, '""')}"`,
        `"${(c.channel || '').replace(/"/g, '""')}"`,
        `"${(c.utm_campaign || '').replace(/"/g, '""')}"`,
        spendVal > 0 ? spendVal : 0,
        c.leads_count ?? 0,
        c.cpl ?? 0,
        `"${rule}"`,
        `"${c.status || 'active'}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `campaigns_export_${dayjs().format('YYYY-MM-DD_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported campaigns CSV');
  };

  // Currency Formatter
  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatCplOrSpend = (val: number | null | undefined) => {
    if (!val || val <= 0) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val);
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

  // Client side filtering for campaign leads table
  const filteredLeads = useMemo(() => {
    const list = campaignLeads?.data ?? [];
    let filtered = [...list];

    if (leadSearchQuery.trim()) {
      const q = leadSearchQuery.toLowerCase();
      filtered = filtered.filter(lead => 
        lead.party?.name?.toLowerCase().includes(q) ||
        lead.party?.phone_raw?.toLowerCase().includes(q)
      );
    }

    if (metricFilter === 'untouched') {
      filtered = filtered.filter(lead => lead.stage?.toLowerCase() === 'new');
    } else if (metricFilter === 'converted') {
      filtered = filtered.filter(lead => lead.stage?.toLowerCase() === 'converted' || lead.stage?.toLowerCase() === 'won');
    }

    return filtered;
  }, [campaignLeads, leadSearchQuery, metricFilter]);

  const leadColumns = useMemo(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorFn: (row: any) => row.party?.name || row.name || 'Unknown',
        cell: (info: any) => (
          <span className="font-semibold text-foreground">{info.getValue()}</span>
        ),
      },
      {
        id: 'phone',
        header: 'Phone',
        accessorFn: (row: any) => row.party?.phone_raw || row.phone,
        cell: (info: any) => (
          <span className="text-sm font-mono text-muted-foreground">{info.getValue() || '—'}</span>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        accessorFn: (row: any) => row.source || 'Direct',
        cell: (info: any) => (
          <span className="text-xs text-muted-foreground capitalize">{info.getValue()}</span>
        ),
      },
      {
        id: 'stage',
        header: 'Status',
        accessorFn: (row: any) => row.stage || row.status,
        cell: (info: any) => {
          const stage = (info.getValue() as string) || 'new';
          let variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' = 'secondary';
          if (stage === 'won' || stage === 'converted' || stage === 'qualified') variant = 'success';
          else if (stage === 'lost' || stage === 'dropped') variant = 'destructive';
          else if (stage === 'new') variant = 'default';
          
          return (
            <Badge variant={variant} className="text-[10px] tracking-normal uppercase h-5 font-semibold">
              {stage}
            </Badge>
          );
        },
      },
      {
        id: 'assigned_to',
        header: 'Assigned Rep',
        accessorFn: (row: any) => row.assignedTo?.name || row.assigned_to?.name,
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

  // --- DETAIL VIEW: Selected Campaign Drilldown ---
  if (selectedCampaignId && campaign) {
    return (
      <div className="space-y-6 max-w-[1300px] animate-in fade-in duration-200">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={() => { setSelectedCampaignId(null); setMetricFilter('all'); }}
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-sm font-semibold"
            >
              <ArrowLeft size={15} />
              Campaigns
            </button>
            <span className="text-muted-foreground">/</span>
            {activeBranch && (
              <>
                <span className="text-sm font-medium text-muted-foreground">
                  {activeBranch.name}
                </span>
                <span className="text-muted-foreground">/</span>
              </>
            )}
            <span className="text-sm font-bold text-foreground bg-muted px-2.5 py-0.5 rounded-md">
              {campaign.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="h-8 text-xs gap-1.5 border-border"
            >
              <RefreshCw size={13} />
              Refresh
            </Button>
          </div>
        </div>

        {/* 4 Detail Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card 
            className={cn(
              "border-border rounded-xl cursor-pointer transition-all hover:bg-muted/30",
              metricFilter === 'all' && "ring-1 ring-primary"
            )}
            onClick={() => setMetricFilter('all')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Megaphone size={18} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Leads</p>
                <p className="text-xl font-extrabold text-foreground">{campaign.stats?.total_leads ?? 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={cn(
              "border-border rounded-xl cursor-pointer transition-all hover:bg-muted/30",
              metricFilter === 'untouched' && "ring-1 ring-primary"
            )}
            onClick={() => setMetricFilter('untouched')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Target size={18} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Untouched Leads</p>
                <p className="text-xl font-extrabold text-foreground">{campaign.stats?.untouched_leads ?? 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border rounded-xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <Activity size={18} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Call Connect Rate</p>
                <p className="text-xl font-extrabold text-foreground">{campaign.stats?.call_connect_rate ?? 0}%</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={cn(
              "border-border rounded-xl cursor-pointer transition-all hover:bg-muted/30",
              metricFilter === 'converted' && "ring-1 ring-primary"
            )}
            onClick={() => setMetricFilter('converted')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <TrendingUp size={18} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Converted Leads</p>
                <p className="text-xl font-extrabold text-foreground">{campaign.stats?.converted ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative w-80 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
            <Input
              value={leadSearchQuery}
              onChange={(e) => setLeadSearchQuery(e.target.value)}
              placeholder="Search leads by name or phone..."
              className="pl-9 h-9 border-border text-xs"
            />
          </div>
          {metricFilter !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMetricFilter('all')}
              className="text-xs text-muted-foreground"
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Leads Grid */}
        <Card className="border-border rounded-xl overflow-hidden shadow-xs">
          <VirtualTable
            data={filteredLeads}
            columns={leadColumns as any}
            rowCount={filteredLeads.length}
            isLoading={isLoadingLeads}
            resource="Party"
            onRowClick={handleRowClick}
            getRowActions={(row: any) => {
              const phone = row.party?.phone_raw || row.phone;
              return (
                <div className="flex items-center gap-1">
                  {phone && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground"
                        onClick={(e) => { e.stopPropagation(); openPhone(phone); }}
                        title="Call"
                      >
                        <Phone size={11} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground"
                        onClick={(e) => { e.stopPropagation(); openWhatsApp(phone); }}
                        title="WhatsApp"
                      >
                        <MessageSquare size={11} />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded hover:bg-blue-50 hover:text-blue-600 text-muted-foreground"
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

        {/* Lead Details Modal */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Lead Details</DialogTitle>
            </DialogHeader>
            <div className="px-1">
              {previewId && (
                <LeadDetail
                  leadId={previewId}
                  onClose={() => setPreviewOpen(false)}
                  onChanged={() => refetchLeads()}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // --- STANDARD OVERVIEW VIEW (Friend's CRM UI) ---
  const activeCampaignsCount = statsData?.active_campaigns ?? campaignsList.filter(c => c.status === 'active').length;
  const totalLeadsCount = statsData?.total_leads ?? campaignsList.reduce((acc, c) => acc + (c.leads_count ?? 0), 0);
  const leadsMtdCount = statsData?.leads_mtd ?? 0;
  const wonCount = statsData?.won ?? campaignsList.reduce((acc, c) => acc + (c.won_count ?? 0), 0);
  const lostCount = statsData?.lost ?? 0;
  const revenueTotal = statsData?.revenue ?? campaignsList.reduce((acc, c) => acc + (c.revenue ?? 0), 0);
  const activeLeadsCount = statsData?.active_leads ?? (totalLeadsCount - wonCount - lostCount);
  const closedCount = statsData?.closed ?? (wonCount + lostCount);

  return (
    <div className="space-y-5 max-w-[1400px] animate-in fade-in duration-200">
      
      {/* 1. Header & Context */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Marketing &amp; Lead Management &gt; Campaign
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">Campaign</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Campaigns sit under each Pipeline and pull leads from sources. UTM &amp; ROI tracked per campaign.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              onClick={() => setIsModalOpen(true)}
              className="h-9 px-3.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              New campaign
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs (Campaigns vs Reports) */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => { setActiveTab('campaigns'); setSelectedCampaignId(null); }}
          className={cn(
            'px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px cursor-pointer',
            activeTab === 'campaigns'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Campaigns
        </button>
        <button
          onClick={() => { setActiveTab('reports'); setSelectedCampaignId(null); }}
          className={cn(
            'px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px cursor-pointer',
            activeTab === 'reports'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Reports &amp; Attribution
        </button>
      </div>

      {activeTab === 'reports' && <CampaignReportsTab />}

      {activeTab === 'campaigns' && (
        <>
          {/* 2. Top 8-KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {/* KPI 1: Active campaigns */}
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
                Active campaigns
              </span>
              <p className="text-lg font-bold text-foreground mt-1">
                {activeCampaignsCount}
              </p>
            </div>

            {/* KPI 2: Total Lead */}
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
                Total Lead
              </span>
              <p className="text-lg font-bold text-foreground mt-1">
                {totalLeadsCount.toLocaleString()}
              </p>
            </div>

            {/* KPI 3: Leads (MTD) */}
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
                Leads (MTD)
              </span>
              <p className="text-lg font-bold text-foreground mt-1">
                {leadsMtdCount.toLocaleString()}
              </p>
            </div>

            {/* KPI 4: Won */}
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider block truncate">
                Won
              </span>
              <p className="text-lg font-bold text-emerald-600 mt-1">
                {wonCount.toLocaleString()}
              </p>
            </div>

            {/* KPI 5: Lost */}
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider block truncate">
                Lost
              </span>
              <p className="text-lg font-bold text-rose-600 mt-1">
                {lostCount.toLocaleString()}
              </p>
            </div>

            {/* KPI 6: Revenue */}
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider block truncate">
                Revenue
              </span>
              <p className="text-lg font-bold text-foreground mt-1 truncate" title={formatCurrency(revenueTotal)}>
                {formatCurrency(revenueTotal)}
              </p>
            </div>

            {/* KPI 7: Active leads */}
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
                Active leads
              </span>
              <p className="text-lg font-bold text-foreground mt-1">
                {activeLeadsCount.toLocaleString()}
              </p>
            </div>

            {/* KPI 8: Closed */}
            <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block truncate">
                Closed
              </span>
              <p className="text-lg font-bold text-foreground mt-1">
                {closedCount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* 3. Cascaded Filter Bar */}
          <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs flex flex-wrap items-center gap-3">
            
            {/* Filter: Branch */}
            <div className="w-40 sm:w-44">
              <select
                value={filterBranch}
                onChange={(e) => handleBranchFilterChange(e.target.value)}
                className="w-full h-8.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs cursor-pointer"
              >
                <option value="">All branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Filter: Vertical (Filtered by Branch) */}
            <div className="w-40 sm:w-44">
              <select
                value={filterVertical}
                onChange={(e) => handleVerticalFilterChange(e.target.value)}
                className="w-full h-8.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs cursor-pointer"
              >
                <option value="">All vertical</option>
                {filteredVerticalOptions.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            {/* Filter: Pipeline (Filtered by Vertical) */}
            <div className="w-40 sm:w-44">
              <select
                value={filterPipeline}
                onChange={(e) => setFilterPipeline(e.target.value)}
                className="w-full h-8.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs cursor-pointer"
              >
                <option value="">All pipeline</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Filter: Lead Counsellor */}
            <div className="w-44 sm:w-48">
              <select
                value={filterCounsellor}
                onChange={(e) => setFilterCounsellor(e.target.value)}
                className="w-full h-8.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs cursor-pointer"
              >
                <option value="">All lead counsellor</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
              <Input
                type="text"
                placeholder="Search campaign name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8.5 text-xs rounded-lg border-border"
              />
            </div>

            {/* Include Inactive Checkbox */}
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none">
              <Checkbox
                checked={includeInactive}
                onCheckedChange={(checked) => setIncludeInactive(!!checked)}
              />
              Include inactive
            </label>
          </div>

          {/* 4. Toolbar: Columns, Export, Refresh */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">Campaigns</h3>
              <Badge variant="secondary" className="text-[10px] font-semibold h-5 px-1.5 rounded-full">
                {campaignsList.length}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {/* Columns Chooser */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg border-border">
                    <SlidersHorizontal size={12} />
                    Columns
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-2 rounded-xl border border-border bg-popover shadow-lg">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block px-2 py-1">
                    Toggle Table Columns
                  </span>
                  <div className="space-y-1 mt-1">
                    {Object.entries(visibleColumns).map(([key, isVis]) => (
                      <label key={key} className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded-md text-xs cursor-pointer capitalize">
                        <Checkbox
                          checked={isVis}
                          onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, [key]: !!checked }))}
                        />
                        {key === 'assignRule' ? 'Assign rule' : key}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Export Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="h-8 text-xs gap-1.5 rounded-lg border-border"
              >
                <Download size={12} />
                Export
              </Button>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="h-8 text-xs gap-1.5 rounded-lg border-border"
              >
                <RefreshCw size={12} className={cn(isLoadingCampaigns && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          {/* 5. 12-Column Campaign Data Grid */}
          <Card className="border-border rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/60 border-b border-border text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                    {visibleColumns.index && <th className="px-3.5 py-3 w-10 text-center">#</th>}
                    {visibleColumns.campaign && <th className="px-4 py-3 min-w-[160px]">Campaign</th>}
                    {visibleColumns.branch && <th className="px-3.5 py-3 min-w-[110px]">Branch</th>}
                    {visibleColumns.vertical && <th className="px-3.5 py-3 min-w-[110px]">Vertical</th>}
                    {visibleColumns.pipeline && <th className="px-3.5 py-3 min-w-[110px]">Pipeline</th>}
                    {visibleColumns.source && <th className="px-3.5 py-3 min-w-[90px]">Source</th>}
                    {visibleColumns.utm && <th className="px-3.5 py-3 min-w-[90px]">UTM</th>}
                    {visibleColumns.spend && <th className="px-3.5 py-3 min-w-[90px] text-right">Spend</th>}
                    {visibleColumns.leads && <th className="px-3.5 py-3 min-w-[70px] text-right">Leads</th>}
                    {visibleColumns.cpl && <th className="px-3.5 py-3 min-w-[80px] text-right">CPL</th>}
                    {visibleColumns.assignRule && <th className="px-3.5 py-3 min-w-[110px]">Assign rule</th>}
                    {visibleColumns.status && <th className="px-3.5 py-3 min-w-[90px]">Status</th>}
                    {visibleColumns.actions && <th className="px-3.5 py-3 w-16 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoadingCampaigns ? (
                    <tr>
                      <td colSpan={13} className="py-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span>Loading campaigns...</span>
                        </div>
                      </td>
                    </tr>
                  ) : campaignsList.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-14 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                          <Megaphone size={28} className="text-muted-foreground/50" />
                          <p className="font-semibold text-foreground text-sm">No campaigns found</p>
                          <p className="text-[11px] text-muted-foreground">
                            No campaigns match your selected branch, vertical, or filter criteria. Click "New campaign" to create one.
                          </p>
                          {canManage && (
                            <Button
                              size="sm"
                              onClick={() => setIsModalOpen(true)}
                              className="mt-2 text-xs rounded-xl"
                            >
                              <Plus size={13} className="mr-1" />
                              New campaign
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    campaignsList.map((c, index) => {
                      const attr = (c.attributes as any) || {};
                      const spendVal = attr.spend ? Number(attr.spend) : 0;
                      const assignRule = attr.assign_rule === 'on_demand' 
                        ? 'On Demand' 
                        : attr.assign_rule === 'equal' 
                          ? 'Equal' 
                          : attr.assign_rule === 'conditional' 
                            ? 'Conditional' 
                            : (attr.distribution ? String(attr.distribution) : '—');

                      const statusBadge = 
                        c.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : c.status === 'paused'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : c.status === 'completed'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-muted text-muted-foreground border-border';

                      const assignBadge = 
                        assignRule === 'On Demand'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : assignRule === 'Equal'
                            ? 'bg-teal-50 text-teal-700 border-teal-200'
                            : assignRule === 'Conditional'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-muted text-muted-foreground border-border';

                      return (
                        <tr 
                          key={c.id} 
                          className="hover:bg-muted/40 transition-colors group cursor-pointer"
                          onClick={() => setSelectedCampaignId(c.id)}
                        >
                          {/* # */}
                          {visibleColumns.index && (
                            <td className="px-3.5 py-3 text-center text-muted-foreground font-mono">
                              {index + 1}
                            </td>
                          )}

                          {/* Campaign */}
                          {visibleColumns.campaign && (
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                  {c.name}
                                </span>
                                {attr.campaign_type && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {attr.campaign_type}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}

                          {/* Branch */}
                          {visibleColumns.branch && (
                            <td className="px-3.5 py-3 text-foreground">
                              {c.branch?.name || '—'}
                            </td>
                          )}

                          {/* Vertical */}
                          {visibleColumns.vertical && (
                            <td className="px-3.5 py-3 text-foreground">
                              {c.vertical?.name || '—'}
                            </td>
                          )}

                          {/* Pipeline */}
                          {visibleColumns.pipeline && (
                            <td className="px-3.5 py-3 text-foreground">
                              {c.pipeline?.name || '—'}
                            </td>
                          )}

                          {/* Source */}
                          {visibleColumns.source && (
                            <td className="px-3.5 py-3 text-muted-foreground capitalize">
                              {c.channel ? c.channel.replace(/_/g, ' ') : '—'}
                            </td>
                          )}

                          {/* UTM */}
                          {visibleColumns.utm && (
                            <td className="px-3.5 py-3 text-muted-foreground font-mono">
                              {c.utm_campaign || '—'}
                            </td>
                          )}

                          {/* Spend */}
                          {visibleColumns.spend && (
                            <td className="px-3.5 py-3 text-right font-mono text-muted-foreground">
                              {formatCplOrSpend(spendVal)}
                            </td>
                          )}

                          {/* Leads */}
                          {visibleColumns.leads && (
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-foreground">
                              {c.leads_count ?? 0}
                            </td>
                          )}

                          {/* CPL */}
                          {visibleColumns.cpl && (
                            <td className="px-3.5 py-3 text-right font-mono text-muted-foreground">
                              {formatCplOrSpend(c.cpl)}
                            </td>
                          )}

                          {/* Assign Rule */}
                          {visibleColumns.assignRule && (
                            <td className="px-3.5 py-3">
                              <span className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                                assignBadge
                              )}>
                                {assignRule}
                              </span>
                            </td>
                          )}

                          {/* Status */}
                          {visibleColumns.status && (
                            <td className="px-3.5 py-3">
                              <span className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize",
                                statusBadge
                              )}>
                                {c.status}
                              </span>
                            </td>
                          )}

                          {/* Actions */}
                          {visibleColumns.actions && (
                            <td className="px-3.5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                                    <MoreHorizontal size={14} />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                  <DropdownMenuItem onClick={() => setSelectedCampaignId(c.id)} className="text-xs gap-2">
                                    <Eye size={12} />
                                    View Leads
                                  </DropdownMenuItem>
                                  
                                  {c.status === 'active' ? (
                                    <DropdownMenuItem 
                                      onClick={() => toggleStatusMutation.mutate({ id: c.id, status: 'inactive' })} 
                                      className="text-xs gap-2"
                                    >
                                      <Pause size={12} />
                                      Make Inactive
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem 
                                      onClick={() => toggleStatusMutation.mutate({ id: c.id, status: 'active' })} 
                                      className="text-xs gap-2"
                                    >
                                      <Play size={12} />
                                      Make Active
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuSeparator />
                                  
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      if (confirm(`Delete campaign "${c.name}"?`)) {
                                        deleteMutation.mutate(c.id);
                                      }
                                    }} 
                                    className="text-xs gap-2 text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 size={12} />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          )}

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Campaign Form Modal */}
      <CampaignFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          handleRefresh();
        }}
      />

    </div>
  );
}
