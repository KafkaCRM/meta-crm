import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { leadsApi, type LeadResponse, type LeadListParams } from '@/api/leads';
import { settingsApi, type Branch, type Vertical, type User as TeamUser } from '@/api/settings';
import { campaignsApi, type Campaign } from '@/api/campaigns';
import { useBranch } from '@/contexts/branch.context';
import { useAuth } from '@/contexts/auth.context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { PageShell } from '@/components/shared/PageShell';
import { BulkActionBar, type BulkAction } from '@/components/shared/BulkActionBar';
import { InlineStatusSelect } from '@/components/shared/InlineStatusSelect';
import { SourceBadge } from '@/components/shared';
import { LeadQuickActionDrawer } from './LeadQuickActionDrawer';
import { CreateLeadModal } from './CreateLeadModal';
import { CampaignOptInModal } from './CampaignOptInModal';
import {
  Search,
  Plus,
  Phone,
  MessageSquare,
  AlertTriangle,
  AlertCircle,
  Clock,
  Download,
  Trash2,
  Users,
  RefreshCw,
  Filter,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Megaphone,
  X,
  Sparkles,
  Flame,
  LayoutGrid,
  Table as TableIcon,
  GraduationCap,
  UserCheck,
  CheckCircle2,
  ChevronUp,
  Zap,
  Snowflake,
  CheckSquare,
  Square,
  MinusSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

type SegmentType = 'all' | 'hot' | 'warm' | 'cold';
type ViewType = 'classic' | 'modern';
type DatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month';

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'index', label: '#', visible: true },
  { id: 'lead', label: 'Lead', visible: true },
  { id: 'branch', label: 'Branch', visible: true },
  { id: 'course', label: 'Course', visible: true },
  { id: 'vertical_pipeline', label: 'Vertical · Pipeline', visible: true },
  { id: 'campaign', label: 'Campaign', visible: true },
  { id: 'source', label: 'Source', visible: true },
  { id: 'score', label: 'Score', visible: true },
  { id: 'counsellor', label: 'Lead Counsellor', visible: true },
  { id: 'stage', label: 'Stage', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'disposition', label: 'Last Call Disposition', visible: true },
  { id: 'next_followup', label: 'Next follow-up', visible: true },
  { id: 'created_at', label: 'Created on / SLA', visible: true },
  { id: 'actions', label: 'Actions', visible: true },
];

const STATUS_OPTIONS = [
  'New',
  'Contacted',
  'Qualified',
  'Proposal Sent',
  'Hot',
  'Won',
  'Enrolled',
  'Lost',
  'Junk',
];

const DISPOSITION_OPTIONS = [
  'Connected',
  'Busy',
  'Not Picked',
  'Wrong Number',
  'Call Back',
  'Interested',
  'Not Interested',
  'Meeting Fixed',
];

function getAvatarBg(name: string) {
  const colors = [
    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
}

export function LeadList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedBranchId, selectedBranchIds } = useBranch();

  // Primary Views & Segments
  const [segment, setSegment] = useState<SegmentType>('all');
  const [view, setView] = useState<ViewType>('classic');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Filter States
  const [branchFilter, setBranchFilter] = useState<string>('');

  const effectiveBranchIds = useMemo(() => {
    if (branchFilter) return branchFilter;
    if (selectedBranchIds.length > 0) return selectedBranchIds.join(',');
    return undefined;
  }, [branchFilter, selectedBranchIds]);
  const [verticalFilter, setVerticalFilter] = useState<string>('');
  const [pipelineFilter, setPipelineFilter] = useState<string>('');
  const [campaignFilter, setCampaignFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [counsellorFilter, setCounsellorFilter] = useState<string>('');
  const [dispositionFilter, setDispositionFilter] = useState<string>('');
  const [followUpFilter, setFollowUpFilter] = useState<string>('all');

  // Date Filter States
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Search & Sort States
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc'>('newest');

  // Quick Checkbox Toggles
  const [slaBreached, setSlaBreached] = useState(false);
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [redFlagged, setRedFlagged] = useState(false);

  // Selection for bulk actions
  const [selectedLeads, setSelectedLeads] = useState<LeadResponse[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals & Drawers
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLead, setDrawerLead] = useState<LeadResponse | null>(null);
  const [drawerMode, setDrawerMode] = useState<'call' | 'whatsapp' | 'note'>('call');
  const [optInModalOpen, setOptInModalOpen] = useState(false);
  const [optInLeadIds, setOptInLeadIds] = useState<string[]>([]);
  const [optInCampaignId, setOptInCampaignId] = useState<string | null>(null);

  // Column Customization
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const stored = localStorage.getItem('mc_lead_table_columns_v5');
      if (stored) {
        const parsed = JSON.parse(stored);
        return DEFAULT_COLUMNS.map((col) => {
          const found = parsed.find((p: any) => p.id === col.id);
          return found ? { ...col, visible: found.visible } : col;
        });
      }
      return DEFAULT_COLUMNS;
    } catch {
      return DEFAULT_COLUMNS;
    }
  });

  const toggleColumn = (colId: string) => {
    setColumns((prev) => {
      const next = prev.map((c) => (c.id === colId ? { ...c, visible: !c.visible } : c));
      try {
        localStorage.setItem('mc_lead_table_columns_v5', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Keyboard shortcut 'C' for Create Lead
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }
      if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setCreateModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounce Search
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery]);

  // Handle Preset Date Change
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = dayjs();
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'today') {
      setDateFrom(now.format('YYYY-MM-DD'));
      setDateTo(now.format('YYYY-MM-DD'));
    } else if (preset === 'yesterday') {
      const yest = now.subtract(1, 'day').format('YYYY-MM-DD');
      setDateFrom(yest);
      setDateTo(yest);
    } else if (preset === 'week') {
      setDateFrom(now.startOf('week').format('YYYY-MM-DD'));
      setDateTo(now.endOf('week').format('YYYY-MM-DD'));
    } else if (preset === 'month') {
      setDateFrom(now.startOf('month').format('YYYY-MM-DD'));
      setDateTo(now.endOf('month').format('YYYY-MM-DD'));
    }
    setPage(1);
  };

  // Queries for Cascading Filters
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list({ accessible: true }),
    staleTime: 60_000,
  });

  const { data: verticals = [] } = useQuery<Vertical[]>({
    queryKey: ['settings', 'verticals', effectiveBranchIds],
    queryFn: () => settingsApi.verticals.list(effectiveBranchIds ? { branch_ids: effectiveBranchIds } : undefined),
    staleTime: 60_000,
  });

  // Query ALL pipelines to ensure stageMap can resolve stage names across all verticals
  const { data: allPipelines = [] } = useQuery<any[]>({
    queryKey: ['settings', 'all-pipelines'],
    queryFn: () => settingsApi.pipelines.list(),
    staleTime: 60_000,
  });

  const filteredPipelines = useMemo(() => {
    if (!verticalFilter) return allPipelines;
    return allPipelines.filter((p) => p.vertical_id === verticalFilter || p.verticalId === verticalFilter);
  }, [allPipelines, verticalFilter]);

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['campaigns', 'list', effectiveBranchIds, verticalFilter],
    queryFn: () => campaignsApi.list(effectiveBranchIds ? { branch_ids: effectiveBranchIds } : undefined),
    staleTime: 60_000,
  });

  const { data: teamUsers = [] } = useQuery<TeamUser[]>({
    queryKey: ['settings', 'users'],
    queryFn: () => settingsApi.users.list(),
    staleTime: 60_000,
  });

  const availableStages = useMemo(() => {
    if (pipelineFilter) {
      const p = allPipelines.find((pipe) => pipe.id === pipelineFilter);
      return p?.stages || [];
    }
    const allStgs: any[] = [];
    filteredPipelines.forEach((p) => {
      if (p.stages) allStgs.push(...p.stages);
    });
    return Array.from(new Map(allStgs.map((s) => [s.id, s])).values());
  }, [pipelineFilter, filteredPipelines, allPipelines]);

  const stageMap = useMemo(() => {
    const map = new Map<string, string>();
    allPipelines.forEach((p) => {
      (p.stages || []).forEach((s: any) => {
        if (s.id && s.name) map.set(s.id, s.name);
      });
    });
    return map;
  }, [allPipelines]);

  const resolveStageName = useCallback(
    (lead: LeadResponse) => {
      if (!lead.stage) return 'New Lead';
      // 1. Check lead's direct pipelineDefinition stages returned by backend
      const fromLead = lead.pipelineDefinition?.stages?.find((s: any) => s.id === lead.stage);
      if (fromLead?.name) return fromLead.name;

      // 2. Check stageMap populated from tenant pipelines
      if (stageMap.has(lead.stage)) return stageMap.get(lead.stage)!;

      // 3. Check within allPipelines
      for (const p of allPipelines) {
        const found = (p.stages || []).find((s: any) => s.id === lead.stage);
        if (found?.name) return found.name;
      }

      // 4. Fallback: if already a human-readable name, display it
      if (lead.stage.length < 20 && !/^[a-z0-9]{20,}$/i.test(lead.stage)) {
        return lead.stage;
      }

      // Never show a raw CUID string
      return 'In Progress';
    },
    [stageMap, allPipelines]
  );

  // Active Filters Count & Chips
  const activeFilterChips = useMemo(() => {
    const chips: { id: string; label: string; onClear: () => void }[] = [];
    if (branchFilter) {
      const b = branches.find((item) => item.id === branchFilter);
      chips.push({ id: 'branch', label: `Branch: ${b?.name || branchFilter}`, onClear: () => setBranchFilter('') });
    } else if (selectedBranchIds.length > 0) {
      const names = branches
        .filter((b) => selectedBranchIds.includes(b.id))
        .map((b) => b.name)
        .join(', ');
      chips.push({
        id: 'workspace-branches',
        label: `Scope: ${names || `${selectedBranchIds.length} Branches`}`,
        onClear: () => {},
      });
    }
    if (verticalFilter) {
      const v = verticals.find((item) => item.id === verticalFilter);
      chips.push({ id: 'vertical', label: `Vertical: ${v?.name || verticalFilter}`, onClear: () => setVerticalFilter('') });
    }
    if (pipelineFilter) {
      const p = allPipelines.find((item) => item.id === pipelineFilter);
      chips.push({ id: 'pipeline', label: `Pipeline: ${p?.name || pipelineFilter}`, onClear: () => setPipelineFilter('') });
    }
    if (campaignFilter) {
      const c = campaigns.find((item) => item.id === campaignFilter);
      chips.push({ id: 'campaign', label: `Campaign: ${c?.name || campaignFilter}`, onClear: () => setCampaignFilter('') });
    }
    if (sourceFilter) {
      chips.push({ id: 'source', label: `Source: ${sourceFilter}`, onClear: () => setSourceFilter('') });
    }
    if (statusFilter) {
      chips.push({ id: 'status', label: `Status: ${statusFilter}`, onClear: () => setStatusFilter('') });
    }
    if (stageFilter) {
      const stg = availableStages.find((item: any) => item.id === stageFilter);
      chips.push({ id: 'stage', label: `Stage: ${stg?.name || stageFilter}`, onClear: () => setStageFilter('') });
    }
    if (counsellorFilter) {
      const u = teamUsers.find((item) => item.id === counsellorFilter);
      chips.push({ id: 'counsellor', label: `Counsellor: ${u?.name || counsellorFilter}`, onClear: () => setCounsellorFilter('') });
    }
    if (dispositionFilter) {
      chips.push({ id: 'disposition', label: `Disposition: ${dispositionFilter}`, onClear: () => setDispositionFilter('') });
    }
    if (followUpFilter !== 'all') {
      chips.push({ id: 'followup', label: `Follow-up: ${followUpFilter}`, onClear: () => setFollowUpFilter('all') });
    }
    if (datePreset !== 'all') {
      chips.push({ id: 'datePreset', label: `Date: ${datePreset}`, onClear: () => handleDatePresetChange('all') });
    }
    if (debouncedSearch) {
      chips.push({ id: 'search', label: `Search: "${debouncedSearch}"`, onClear: () => { setSearchQuery(''); setDebouncedSearch(''); } });
    }
    if (slaBreached) {
      chips.push({ id: 'sla', label: 'SLA Breached', onClear: () => setSlaBreached(false) });
    }
    if (duplicatesOnly) {
      chips.push({ id: 'dupe', label: 'Duplicates Only', onClear: () => setDuplicatesOnly(false) });
    }
    if (redFlagged) {
      chips.push({ id: 'flag', label: 'Red Flagged', onClear: () => setRedFlagged(false) });
    }
    return chips;
  }, [
    branchFilter,
    verticalFilter,
    pipelineFilter,
    campaignFilter,
    sourceFilter,
    statusFilter,
    stageFilter,
    counsellorFilter,
    dispositionFilter,
    followUpFilter,
    datePreset,
    debouncedSearch,
    slaBreached,
    duplicatesOnly,
    redFlagged,
    branches,
    verticals,
    allPipelines,
    campaigns,
    availableStages,
    teamUsers,
  ]);

  // Query Leads with all filter params
  const offset = (page - 1) * pageSize;
  const leadQueryParams: LeadListParams = useMemo(() => {
    return {
      offset,
      limit: pageSize,
      branch_ids: effectiveBranchIds,
      vertical_id: verticalFilter || undefined,
      pipeline_definition_id: pipelineFilter || undefined,
      campaign_id: campaignFilter || undefined,
      source: sourceFilter || undefined,
      status: statusFilter ? statusFilter.toLowerCase() : undefined,
      stage: stageFilter || undefined,
      assigned_to_id: counsellorFilter || undefined,
      disposition: dispositionFilter || undefined,
      segment: segment !== 'all' ? segment : undefined,
      sla_breached: slaBreached ? true : undefined,
      is_duplicate: duplicatesOnly ? true : undefined,
      red_flagged: redFlagged ? true : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      follow_up: followUpFilter !== 'all' ? followUpFilter : undefined,
      search: debouncedSearch || undefined,
      sort: sortOption,
    };
  }, [
    offset,
    pageSize,
    effectiveBranchIds,
    verticalFilter,
    pipelineFilter,
    campaignFilter,
    sourceFilter,
    statusFilter,
    stageFilter,
    counsellorFilter,
    dispositionFilter,
    segment,
    slaBreached,
    duplicatesOnly,
    redFlagged,
    dateFrom,
    dateTo,
    followUpFilter,
    debouncedSearch,
    sortOption,
  ]);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['leads', leadQueryParams],
    queryFn: () => leadsApi.list(leadQueryParams),
    staleTime: 10_000,
  });

  const leads = data?.data || [];
  const totalCount = data?.total_count ?? leads.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // KPI summary metrics calculated from visible query scope
  const hotCount = useMemo(
    () => leads.filter((l) => l.status === 'hot' || (l.attributes as any)?.priority === 'hot' || ((l.attributes as any)?.score || 0) >= 75).length,
    [leads]
  );
  const overdueCount = useMemo(
    () => leads.filter((l) => (l.attributes as any)?.next_follow_up_date && dayjs((l.attributes as any).next_follow_up_date).isBefore(dayjs())).length,
    [leads]
  );
  const convertedCount = useMemo(
    () => leads.filter((l) => l.status === 'won' || l.status === 'converted' || l.status === 'enrolled').length,
    [leads]
  );

  // Quick Action Call / WhatsApp Handlers
  const handleCall = useCallback((lead: LeadResponse) => {
    setDrawerLead(lead);
    setDrawerMode('call');
    setDrawerOpen(true);
  }, []);

  const handleWhatsApp = useCallback((lead: LeadResponse) => {
    let clean = (lead.phone || '').replace(/\D/g, '');
    if (clean.length === 10) clean = `91${clean}`;
    const greeting = encodeURIComponent(
      `Hello ${lead.name}, thank you for reaching out to us! How can we assist you with your inquiry?`
    );
    window.open(`https://api.whatsapp.com/send?phone=${clean}&text=${greeting}`, '_blank');
    setDrawerLead(lead);
    setDrawerMode('whatsapp');
    setDrawerOpen(true);
  }, []);

  const handleOpenOptIn = useCallback((lead: LeadResponse) => {
    setOptInLeadIds([lead.id]);
    setOptInCampaignId(lead.campaign_id || lead.campaignId || null);
    setOptInModalOpen(true);
  }, []);

  // CSV Export
  const handleExportCsv = (leadsToExport: LeadResponse[] = leads) => {
    if (leadsToExport.length === 0) {
      toast.info('No leads to export');
      return;
    }

    const headers = [
      '#',
      'Lead Name',
      'Phone',
      'Email',
      'Branch',
      'Course',
      'Vertical',
      'Pipeline',
      'Campaign',
      'Source',
      'Score',
      'Counsellor',
      'Stage',
      'Status',
      'Last Disposition',
      'Next Follow-up',
      'Created On',
    ];

    const rows = leadsToExport.map((l, idx) => {
      const attrs = (l.attributes as any) || {};
      const branchName = l.vertical?.branch?.name || l.campaign?.branch?.name || attrs.branch_name || '—';
      const courseName = attrs.course || '—';
      const vertName = l.vertical?.name || '—';
      const pipeName = l.pipelineDefinition?.name || '—';
      const campName = l.campaign?.name || '—';
      const counsellor = l.assignedTo?.name || l.assigned_to?.name || '—';
      const nextFollow = attrs.next_follow_up_date ? dayjs(attrs.next_follow_up_date).format('DD-MM-YYYY HH:mm') : '—';
      const createdStr = dayjs(l.createdAt || l.created_at).format('DD-MM-YYYY HH:mm');

      return [
        idx + 1,
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${l.phone || ''}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${branchName.replace(/"/g, '""')}"`,
        `"${courseName.replace(/"/g, '""')}"`,
        `"${vertName.replace(/"/g, '""')}"`,
        `"${pipeName.replace(/"/g, '""')}"`,
        `"${campName.replace(/"/g, '""')}"`,
        `"${l.source || ''}"`,
        `"${attrs.score_label || attrs.score || ''}"`,
        `"${counsellor.replace(/"/g, '""')}"`,
        `"${resolveStageName(l)}"`,
        `"${l.status || '—'}"`,
        `"${attrs.last_call_disposition || '—'}"`,
        `"${nextFollow}"`,
        `"${createdStr}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_export_${dayjs().format('YYYY-MM-DD_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${leadsToExport.length} leads to CSV`);
  };

  // Bulk Actions
  const bulkActions: BulkAction<LeadResponse>[] = useMemo(
    () => [
      {
        id: 'optin-campaign',
        label: 'Opt-in to Campaign',
        icon: <Megaphone size={14} />,
        action: async (rows: LeadResponse[]) => {
          setOptInLeadIds(rows.map((r) => r.id));
          setOptInCampaignId(null);
          setOptInModalOpen(true);
        },
      },
      {
        id: 'export-csv',
        label: 'Export CSV',
        icon: <Download size={14} />,
        action: async (rows: LeadResponse[]) => {
          handleExportCsv(rows);
        },
      },
      {
        id: 'delete',
        label: 'Delete Leads',
        icon: <Trash2 size={14} />,
        confirmMessage: `Are you sure you want to delete ${selectedLeads.length} leads?`,
        action: async (rows: LeadResponse[]) => {
          await leadsApi.bulkAction({
            action: 'delete',
            lead_ids: rows.map((r) => r.id),
          });
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          setSelectedLeads([]);
        },
      },
    ],
    [selectedLeads.length, queryClient]
  );

  // Reset all filters
  const handleResetFilters = () => {
    setBranchFilter('');
    setVerticalFilter('');
    setPipelineFilter('');
    setCampaignFilter('');
    setSourceFilter('');
    setStatusFilter('');
    setStageFilter('');
    setCounsellorFilter('');
    setDispositionFilter('');
    setFollowUpFilter('all');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setSearchQuery('');
    setDebouncedSearch('');
    setSlaBreached(false);
    setDuplicatesOnly(false);
    setRedFlagged(false);
    setPage(1);
    toast.info('All filters cleared');
  };

  const isColVisible = (id: string) => columns.find((c) => c.id === id)?.visible ?? true;

  const allSelected = leads.length > 0 && selectedLeads.length === leads.length;
  const isPartiallySelected = selectedLeads.length > 0 && selectedLeads.length < leads.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads);
    }
  };

  const toggleSelectLead = (lead: LeadResponse) => {
    setSelectedLeads((prev) => {
      const exists = prev.some((l) => l.id === lead.id);
      if (exists) {
        return prev.filter((l) => l.id !== lead.id);
      }
      return [...prev, lead];
    });
  };

  return (
    <PageShell
      title="Leads"
      description="Full lead table tagged Branch › Vertical › Pipeline › Campaign › Source with live communications."
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-9 px-3 text-xs font-semibold gap-1.5 border-border bg-card hover:bg-muted cursor-pointer rounded-lg"
            title="Refresh table"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="h-9 px-4 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-lg shadow-xs cursor-pointer"
          >
            <Plus size={15} />
            <span>Add Lead</span>
            <kbd className="hidden sm:inline-flex ml-1 px-1.5 py-0.5 text-[9px] font-mono bg-primary-foreground/20 rounded">C</kbd>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 1. KPI SUMMARY STRIP */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div
            onClick={() => {
              setSegment('all');
              setPage(1);
            }}
            className={cn(
              'p-3.5 rounded-xl border bg-card transition-all cursor-pointer shadow-none group',
              segment === 'all' ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border hover:border-primary/40'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Total Leads</span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Users size={14} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-foreground">{totalCount}</span>
              <span className="text-[11px] text-muted-foreground">in scope</span>
            </div>
          </div>

          <div
            onClick={() => {
              setSegment('hot');
              setPage(1);
            }}
            className={cn(
              'p-3.5 rounded-xl border bg-card transition-all cursor-pointer shadow-none group',
              segment === 'hot' ? 'border-red-500/60 ring-1 ring-red-500/20' : 'border-border hover:border-red-400'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Hot Priority</span>
              <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center">
                <Flame size={14} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-red-600">{hotCount}</span>
              <span className="text-[11px] text-red-600/80">urgent follow-up</span>
            </div>
          </div>

          <div
            onClick={() => {
              setFollowUpFilter('today');
              setPage(1);
            }}
            className={cn(
              'p-3.5 rounded-xl border bg-card transition-all cursor-pointer shadow-none group',
              followUpFilter === 'today' ? 'border-amber-500/60 ring-1 ring-amber-500/20' : 'border-border hover:border-amber-400'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Follow-ups Today / Overdue</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Clock size={14} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className={cn('text-2xl font-bold', overdueCount > 0 ? 'text-amber-600' : 'text-foreground')}>
                {overdueCount}
              </span>
              <span className="text-[11px] text-muted-foreground">pending calls</span>
            </div>
          </div>

          <div
            onClick={() => {
              setStatusFilter('won');
              setPage(1);
            }}
            className={cn(
              'p-3.5 rounded-xl border bg-card transition-all cursor-pointer shadow-none group',
              statusFilter === 'won' ? 'border-emerald-500/60 ring-1 ring-emerald-500/20' : 'border-border hover:border-emerald-400'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Enrolled / Converted</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={14} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-emerald-600">{convertedCount}</span>
              <span className="text-[11px] text-emerald-600/80">deals won</span>
            </div>
          </div>
        </div>

        {/* 2. MODERN CONTROL BAR */}
        <Card className="bg-card border-border rounded-xl shadow-none">
          <CardContent className="p-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Left: Segment Pills */}
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/70 overflow-x-auto">
                {[
                  { id: 'all', label: 'All', icon: Users, color: 'text-foreground' },
                  { id: 'hot', label: 'Hot', icon: Flame, color: 'text-red-600' },
                  { id: 'warm', label: 'Warm', icon: Sparkles, color: 'text-amber-600' },
                  { id: 'cold', label: 'Cold', icon: Clock, color: 'text-blue-600' },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = segment === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setSegment(tab.id as SegmentType);
                        setPage(1);
                      }}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer shrink-0',
                        isActive
                          ? 'bg-background text-foreground shadow-xs border border-border'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                      )}
                    >
                      <Icon size={12} className={isActive ? 'text-primary' : tab.color} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Center: Search input */}
              <div className="relative flex-1 max-w-md">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search name, phone, course, branch…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-7 text-xs bg-muted/30 border-border rounded-lg placeholder:text-muted-foreground focus-visible:ring-primary/30"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Right: Actions (Filters, Columns, Export, View Toggle) */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFilterPanelOpen((prev) => !prev)}
                  className={cn(
                    'h-8 px-2.5 text-xs font-medium gap-1.5 rounded-lg border-border cursor-pointer transition-colors',
                    isFilterPanelOpen || activeFilterChips.length > 0
                      ? 'bg-primary/10 text-primary border-primary/30 font-semibold'
                      : 'bg-background hover:bg-muted'
                  )}
                >
                  <Filter size={13} />
                  <span>Filters</span>
                  {activeFilterChips.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                      {activeFilterChips.length}
                    </span>
                  )}
                  {isFilterPanelOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </Button>

                {/* Columns Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-medium gap-1.5 border-border bg-background hover:bg-muted cursor-pointer rounded-lg"
                    >
                      <SlidersHorizontal size={13} />
                      <span className="hidden sm:inline">Columns</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3 bg-popover border border-border rounded-xl shadow-xl z-50">
                    <div className="text-xs font-semibold text-foreground mb-2 pb-1 border-b border-border">
                      Visible Table Columns
                    </div>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {columns.map((col) => (
                        <label
                          key={col.id}
                          className="flex items-center gap-2 text-xs text-foreground hover:bg-muted/50 p-1 rounded cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={col.visible}
                            onChange={() => toggleColumn(col.id)}
                            className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                          />
                          <span>{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportCsv(leads)}
                  className="h-8 text-xs font-medium gap-1.5 border-border bg-background hover:bg-muted cursor-pointer rounded-lg"
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">Export</span>
                </Button>

                {/* View Switcher */}
                <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-lg border border-border/70">
                  <button
                    type="button"
                    onClick={() => setView('classic')}
                    className={cn(
                      'p-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                      view === 'classic'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Table view"
                  >
                    <TableIcon size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('modern')}
                    className={cn(
                      'p-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                      view === 'modern'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Cards view"
                  >
                    <LayoutGrid size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* COLLAPSIBLE FILTER PANEL */}
            {isFilterPanelOpen && (
              <div className="mt-3 pt-3 border-t border-border space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* GROUP 1: Routing & Cascade */}
                  <div className="bg-muted/20 border border-border/60 rounded-lg p-3 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span>1. Routing & Cascade</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground">Branch</label>
                        <select
                          value={branchFilter}
                          onChange={(e) => {
                            setBranchFilter(e.target.value);
                            setVerticalFilter('');
                            setPipelineFilter('');
                            setCampaignFilter('');
                            setPage(1);
                          }}
                          className="w-full h-7 text-xs bg-background border border-border rounded px-2 cursor-pointer font-normal"
                        >
                          <option value="">All branches</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground">Vertical</label>
                        <select
                          value={verticalFilter}
                          onChange={(e) => {
                            setVerticalFilter(e.target.value);
                            setPipelineFilter('');
                            setCampaignFilter('');
                            setPage(1);
                          }}
                          className="w-full h-7 text-xs bg-background border border-border rounded px-2 cursor-pointer font-normal"
                        >
                          <option value="">All verticals</option>
                          {verticals.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground">Pipeline</label>
                        <select
                          value={pipelineFilter}
                          onChange={(e) => {
                            setPipelineFilter(e.target.value);
                            setStageFilter('');
                            setPage(1);
                          }}
                          className="w-full h-7 text-xs bg-background border border-border rounded px-2 cursor-pointer font-normal"
                        >
                          <option value="">All pipelines</option>
                          {filteredPipelines.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground">Campaign</label>
                        <select
                          value={campaignFilter}
                          onChange={(e) => {
                            setCampaignFilter(e.target.value);
                            setPage(1);
                          }}
                          className="w-full h-7 text-xs bg-background border border-border rounded px-2 cursor-pointer font-normal"
                        >
                          <option value="">All campaigns</option>
                          {campaigns.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* GROUP 2: Lead Status & Team */}
                  <div className="bg-muted/20 border border-border/60 rounded-lg p-3 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>2. Status & Team</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground">Status</label>
                        <select
                          value={statusFilter}
                          onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                          }}
                          className="w-full h-7 text-xs bg-background border border-border rounded px-2 cursor-pointer font-normal"
                        >
                          <option value="">All statuses</option>
                          {STATUS_OPTIONS.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground">Stage</label>
                        <select
                          value={stageFilter}
                          onChange={(e) => {
                            setStageFilter(e.target.value);
                            setPage(1);
                          }}
                          className="w-full h-7 text-xs bg-background border border-border rounded px-2 cursor-pointer font-normal"
                        >
                          <option value="">All stages</option>
                          {availableStages.map((s: any) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground">Counsellor</label>
                        <select
                          value={counsellorFilter}
                          onChange={(e) => {
                            setCounsellorFilter(e.target.value);
                            setPage(1);
                          }}
                          className="w-full h-7 text-xs bg-background border border-border rounded px-2 cursor-pointer font-normal"
                        >
                          <option value="">All counsellors</option>
                          <option value="unassigned">Unassigned</option>
                          {teamUsers.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground">Disposition</label>
                        <select
                          value={dispositionFilter}
                          onChange={(e) => {
                            setDispositionFilter(e.target.value);
                            setPage(1);
                          }}
                          className="w-full h-7 text-xs bg-background border border-border rounded px-2 cursor-pointer font-normal"
                        >
                          <option value="">All dispositions</option>
                          {DISPOSITION_OPTIONS.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* GROUP 3: Timeframe & Verification */}
                  <div className="bg-muted/20 border border-border/60 rounded-lg p-3 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      <span>3. Timeframe & Filters</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 bg-background p-0.5 rounded border border-border">
                        {(['all', 'today', 'yesterday', 'week', 'month'] as DatePreset[]).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handleDatePresetChange(p)}
                            className={cn(
                              'flex-1 py-0.5 text-[10px] font-semibold rounded capitalize transition-all cursor-pointer',
                              datePreset === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {p === 'all' ? 'All' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : p}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => {
                            setDateFrom(e.target.value);
                            setDatePreset('all');
                            setPage(1);
                          }}
                          className="h-7 text-[11px] bg-background border-border rounded font-mono"
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => {
                            setDateTo(e.target.value);
                            setDatePreset('all');
                            setPage(1);
                          }}
                          className="h-7 text-[11px] bg-background border-border rounded font-mono"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-red-600 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={slaBreached}
                            onChange={(e) => {
                              setSlaBreached(e.target.checked);
                              setPage(1);
                            }}
                            className="rounded border-border text-red-600 focus:ring-red-500 w-3.5 h-3.5"
                          />
                          <span>SLA Breached</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={duplicatesOnly}
                            onChange={(e) => {
                              setDuplicatesOnly(e.target.checked);
                              setPage(1);
                            }}
                            className="rounded border-border text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                          />
                          <span>Duplicates</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={redFlagged}
                            onChange={(e) => {
                              setRedFlagged(e.target.checked);
                              setPage(1);
                            }}
                            className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                          />
                          <span>Flagged</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ACTIVE FILTER CHIPS ROW */}
                {activeFilterChips.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground mr-1">Active:</span>
                    {activeFilterChips.map((chip) => (
                      <span
                        key={chip.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20"
                      >
                        <span>{chip.label}</span>
                        <button
                          type="button"
                          onClick={chip.onClear}
                          className="hover:bg-primary/20 rounded-full p-0.5 cursor-pointer ml-0.5"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-red-600 underline ml-2 cursor-pointer"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. MAIN TABLE / CARDS CONTENT */}
        <Card className="bg-card border-border rounded-xl shadow-none overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <RefreshCw size={24} className="animate-spin mb-2 text-primary" />
              <span className="text-xs font-medium">Loading leads matching scope…</span>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle size={32} className="text-red-400 mb-2" />
              <p className="font-semibold text-foreground text-sm">Failed to load leads</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                An error occurred while fetching leads. Please check filters or retry.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4 h-8 text-xs font-medium">
                Retry
              </Button>
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Users size={22} className="text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground text-sm">No leads found in this scope</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                No records matched your search and filter criteria. Adjust or clear filters to see all leads.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="mt-4 h-8 text-xs font-medium"
              >
                Reset Filters
              </Button>
            </div>
          ) : view === 'classic' ? (
            /* TABLE VIEW */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center mx-auto"
                      >
                        {allSelected ? (
                          <CheckSquare size={14} className="text-primary" />
                        ) : isPartiallySelected ? (
                          <MinusSquare size={14} className="text-primary" />
                        ) : (
                          <Square size={14} />
                        )}
                      </button>
                    </th>
                    {isColVisible('index') && <th className="py-2.5 px-2 w-10 text-center">#</th>}
                    {isColVisible('lead') && <th className="py-2.5 px-3 min-w-[200px]">Lead</th>}
                    {isColVisible('branch') && <th className="py-2.5 px-3 min-w-[110px]">Branch</th>}
                    {isColVisible('course') && <th className="py-2.5 px-3 min-w-[120px]">Course</th>}
                    {isColVisible('vertical_pipeline') && (
                      <th className="py-2.5 px-3 min-w-[180px]">Vertical · Pipeline</th>
                    )}
                    {isColVisible('campaign') && <th className="py-2.5 px-3 min-w-[130px]">Campaign</th>}
                    {isColVisible('source') && <th className="py-2.5 px-3 min-w-[100px]">Source</th>}
                    {isColVisible('score') && <th className="py-2.5 px-3 min-w-[90px]">Score</th>}
                    {isColVisible('counsellor') && (
                      <th className="py-2.5 px-3 min-w-[120px]">Lead Counsellor</th>
                    )}
                    {isColVisible('stage') && <th className="py-2.5 px-3 min-w-[110px]">Stage</th>}
                    {isColVisible('status') && <th className="py-2.5 px-3 min-w-[120px]">Status</th>}
                    {isColVisible('disposition') && (
                      <th className="py-2.5 px-3 min-w-[130px]">Last Call Disposition</th>
                    )}
                    {isColVisible('next_followup') && (
                      <th className="py-2.5 px-3 min-w-[130px]">Next follow-up</th>
                    )}
                    {isColVisible('created_at') && (
                      <th className="py-2.5 px-3 min-w-[120px]">Created / SLA</th>
                    )}
                    {isColVisible('actions') && (
                      <th className="py-2.5 px-3 w-16 text-center">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {leads.map((lead, idx) => {
                    const attrs = (lead.attributes as any) || {};
                    const rowNumber = offset + idx + 1;
                    const initial = (lead.name || 'L').trim().charAt(0).toUpperCase();
                    const avatarBg = getAvatarBg(lead.name || 'L');
                    const branchName =
                      lead.vertical?.branch?.name ||
                      lead.campaign?.branch?.name ||
                      attrs.branch_name ||
                      '—';
                    const courseName = attrs.course || null;
                    const verticalName = lead.vertical?.name || '—';
                    const pipelineName = lead.pipelineDefinition?.name || '—';
                    const campaignObj = lead.campaign;
                    const counsellorName =
                      lead.assignedTo?.name || lead.assigned_to?.name || '—';

                    // Real score only
                    const scoreNum = attrs.score !== undefined ? Number(attrs.score) : undefined;
                    const scoreLabel = attrs.score_label || (scoreNum !== undefined ? `${scoreNum >= 75 ? 'Hot' : scoreNum >= 50 ? 'Warm' : 'Cold'} ${scoreNum}` : null);

                    const disposition = attrs.last_call_disposition || null;
                    const nextFollowUpStr = attrs.next_follow_up_date
                      ? dayjs(attrs.next_follow_up_date).format('DD MMM, hh:mm A')
                      : null;
                    const isFollowUpOverdue =
                      attrs.next_follow_up_date &&
                      dayjs(attrs.next_follow_up_date).isBefore(dayjs());
                    const createdStr = dayjs(lead.createdAt || lead.created_at).format('DD MMM YYYY, hh:mm A');
                    const createdRelative = dayjs(lead.createdAt || lead.created_at).fromNow();
                    const isDup = attrs.is_duplicate || lead.duplicate_risk;
                    const isSelected = selectedLeads.some((l) => l.id === lead.id);

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => navigate({ to: `/leads/${lead.id}` })}
                        className={cn(
                          'hover:bg-muted/40 transition-colors cursor-pointer group',
                          isSelected && 'bg-primary/5'
                        )}
                      >
                        {/* Checkbox */}
                        <td
                          className="py-2.5 px-3 text-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectLead(lead);
                          }}
                        >
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center mx-auto"
                          >
                            {isSelected ? (
                              <CheckSquare size={14} className="text-primary" />
                            ) : (
                              <Square size={14} />
                            )}
                          </button>
                        </td>

                        {/* # */}
                        {isColVisible('index') && (
                          <td className="py-2.5 px-2 text-center text-muted-foreground font-mono text-[11px]">
                            {rowNumber}
                          </td>
                        )}

                        {/* Lead */}
                        {isColVisible('lead') && (
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={cn(
                                  'w-7 h-7 rounded-full border flex items-center justify-center font-bold text-xs shrink-0',
                                  avatarBg
                                )}
                              >
                                {initial}
                              </div>
                              <div className="flex flex-col truncate">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-foreground text-xs group-hover:text-primary transition-colors">
                                    {lead.name}
                                  </span>
                                  {isDup && (
                                    <span className="inline-flex items-center px-1 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                      Dupe
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[11px] font-mono text-muted-foreground">
                                    {lead.phone}
                                  </span>
                                  <div
                                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleCall(lead)}
                                      className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-emerald-600 cursor-pointer transition-colors"
                                      title="Call & Log Interaction"
                                    >
                                      <Phone size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleWhatsApp(lead)}
                                      className="p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-950 text-emerald-600 hover:text-emerald-700 cursor-pointer transition-colors"
                                      title="Open WhatsApp Chat"
                                    >
                                      <MessageSquare size={11} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        )}

                        {/* Branch */}
                        {isColVisible('branch') && (
                          <td className="py-2.5 px-3 text-muted-foreground font-medium">
                            {branchName}
                          </td>
                        )}

                        {/* Course */}
                        {isColVisible('course') && (
                          <td className="py-2.5 px-3">
                            {courseName ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                <GraduationCap size={11} className="shrink-0" />
                                <span className="truncate max-w-[120px]">{courseName}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        )}

                        {/* Vertical · Pipeline */}
                        {isColVisible('vertical_pipeline') && (
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border/80">
                              {verticalName} <span className="mx-1 text-border">›</span> {pipelineName}
                            </span>
                          </td>
                        )}

                        {/* Campaign */}
                        {isColVisible('campaign') && (
                          <td className="py-2.5 px-3">
                            {campaignObj ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                                <Megaphone size={10} className="shrink-0" />
                                <span className="truncate max-w-[100px]">{campaignObj.name}</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenOptIn(lead);
                                }}
                                className="text-[10px] text-muted-foreground hover:text-primary border border-dashed border-border rounded px-1.5 py-0.5 hover:border-primary/60 cursor-pointer transition-colors"
                              >
                                + Opt-in
                              </button>
                            )}
                          </td>
                        )}

                        {/* Source */}
                        {isColVisible('source') && (
                          <td className="py-2.5 px-3">
                            <SourceBadge source={lead.source || 'Manual'} />
                          </td>
                        )}

                        {/* Score */}
                        {isColVisible('score') && (
                          <td className="py-2.5 px-3">
                            {scoreLabel ? (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border',
                                  (scoreNum ?? 0) >= 75
                                    ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                    : (scoreNum ?? 0) >= 50
                                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                    : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                )}
                              >
                                {(scoreNum ?? 0) >= 75 ? (
                                  <Flame size={10} className="text-rose-500" />
                                ) : (scoreNum ?? 0) >= 50 ? (
                                  <Zap size={10} className="text-amber-500" />
                                ) : (
                                  <Snowflake size={10} className="text-blue-500" />
                                )}
                                <span>{scoreLabel}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        )}

                        {/* Counsellor */}
                        {isColVisible('counsellor') && (
                          <td className="py-2.5 px-3 text-muted-foreground font-medium">
                            {counsellorName}
                          </td>
                        )}

                        {/* Stage */}
                        {isColVisible('stage') && (
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              {resolveStageName(lead)}
                            </span>
                          </td>
                        )}

                        {/* Status */}
                        {isColVisible('status') && (
                          <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                            <InlineStatusSelect
                              status={lead.status}
                              onStatusChange={async (newStatus) => {
                                try {
                                  await leadsApi.update(lead.id, { status: newStatus as any });
                                  toast.success(`Status updated to ${newStatus}`);
                                  refetch();
                                } catch (err: any) {
                                  toast.error(err?.message || 'Failed to update status');
                                }
                              }}
                            />
                          </td>
                        )}

                        {/* Disposition */}
                        {isColVisible('disposition') && (
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {disposition ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-foreground border border-border/70">
                                {disposition}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        )}

                        {/* Next follow-up */}
                        {isColVisible('next_followup') && (
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            {nextFollowUpStr ? (
                              <span className={cn('inline-flex items-center gap-1 font-medium', isFollowUpOverdue ? 'text-red-600 font-semibold' : 'text-foreground')}>
                                {isFollowUpOverdue && <AlertTriangle size={10} className="text-red-600 shrink-0" />}
                                <span>{nextFollowUpStr}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        )}

                        {/* Created on */}
                        {isColVisible('created_at') && (
                          <td className="py-2.5 px-3 text-muted-foreground" title={createdStr}>
                            <span className="text-[11px]">{createdRelative}</span>
                          </td>
                        )}

                        {/* Actions */}
                        {isColVisible('actions') && (
                          <td
                            className="py-2.5 px-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => navigate({ to: `/leads/${lead.id}` })}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                title="View details"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCall(lead)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-emerald-600 cursor-pointer transition-colors"
                                title="Quick Call & Log"
                              >
                                <Phone size={13} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* CARDS VIEW */
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {leads.map((lead) => {
                const attrs = (lead.attributes as any) || {};
                const branchName =
                  lead.vertical?.branch?.name ||
                  lead.campaign?.branch?.name ||
                  attrs.branch_name ||
                  '—';
                const courseName = attrs.course || null;
                const avatarBg = getAvatarBg(lead.name || 'L');
                const initial = (lead.name || 'L').trim().charAt(0).toUpperCase();

                return (
                  <div
                    key={lead.id}
                    onClick={() => navigate({ to: `/leads/${lead.id}` })}
                    className="bg-card border border-border hover:border-primary/40 transition-all cursor-pointer rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0',
                            avatarBg
                          )}
                        >
                          {initial}
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-foreground hover:text-primary transition-colors">
                            {lead.name}
                          </h3>
                          <p className="text-[11px] font-mono text-muted-foreground">
                            {lead.phone}
                          </p>
                        </div>
                      </div>

                      <InlineStatusSelect
                        status={lead.status}
                        onStatusChange={async (newStatus) => {
                          try {
                            await leadsApi.update(lead.id, { status: newStatus as any });
                            toast.success(`Status updated to ${newStatus}`);
                            refetch();
                          } catch (err: any) {
                            toast.error(err?.message || 'Failed to update status');
                          }
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                        {branchName}
                      </span>
                      {courseName && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-medium">
                          <GraduationCap size={10} />
                          <span>{courseName}</span>
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-medium">
                        {resolveStageName(lead)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                      <span>{dayjs(lead.createdAt || lead.created_at).fromNow()}</span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCall(lead)}
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-emerald-600"
                        >
                          <Phone size={11} className="mr-1" />
                          Call
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleWhatsApp(lead)}
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-emerald-600"
                        >
                          <MessageSquare size={11} className="mr-1" />
                          Chat
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 4. PAGINATION FOOTER */}
          <div className="border-t border-border bg-muted/10 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-muted-foreground flex items-center gap-2">
              <span>
                Showing <strong className="text-foreground">{totalCount > 0 ? offset + 1 : 0}–{Math.min(offset + pageSize, totalCount)}</strong> of{' '}
                <strong className="text-foreground">{totalCount}</strong> leads
              </span>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-6 text-xs bg-background border border-border rounded px-1 cursor-pointer font-medium"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2 text-xs border-border bg-background hover:bg-muted disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft size={13} className="mr-0.5" />
                Prev
              </Button>

              {/* Page numbers */}
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pNum = i + 1;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setPage(pNum)}
                      className={cn(
                        'w-6 h-6 rounded text-xs font-semibold transition-colors cursor-pointer',
                        page === pNum
                          ? 'bg-primary text-primary-foreground font-bold'
                          : 'hover:bg-muted text-muted-foreground'
                      )}
                    >
                      {pNum}
                    </button>
                  );
                })}
                {totalPages > 5 && (
                  <>
                    <span className="text-muted-foreground text-xs px-0.5">…</span>
                    <button
                      type="button"
                      onClick={() => setPage(totalPages)}
                      className={cn(
                        'w-6 h-6 rounded text-xs font-semibold transition-colors cursor-pointer',
                        page === totalPages
                          ? 'bg-primary text-primary-foreground font-bold'
                          : 'hover:bg-muted text-muted-foreground'
                      )}
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 px-2 text-xs border-border bg-background hover:bg-muted disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight size={13} className="ml-0.5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* FLOATING BULK ACTION BAR */}
      <BulkActionBar
        selectedRows={selectedLeads}
        onClearSelection={() => setSelectedLeads([])}
        resource="leads"
        actions={bulkActions}
      />

      {/* MODALS */}
      <CreateLeadModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          refetch();
        }}
      />

      <LeadQuickActionDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        lead={drawerLead}
        initialMode={drawerMode}
        onSuccess={() => {
          refetch();
        }}
      />

      <CampaignOptInModal
        open={optInModalOpen}
        onOpenChange={setOptInModalOpen}
        leadIds={optInLeadIds}
        currentCampaignId={optInCampaignId}
        onSuccess={() => {
          refetch();
        }}
      />
    </PageShell>
  );
}
