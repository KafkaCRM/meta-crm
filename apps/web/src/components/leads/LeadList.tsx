import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { createColumnHelper } from '@tanstack/react-table';
import { leadsApi, type LeadResponse } from '@/api/leads';
import { useBranch } from '@/contexts/branch.context';
import { VirtualTable } from '@/components/shared/VirtualTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/shared/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import {
  Search,
  Megaphone,
  Plus,
  Phone,
  MessageSquare,
  AlertTriangle,
  AlertCircle,
  Clock,
  ExternalLink,
  FileText,
  Download,
  Trash2,
  Users,
  UserCheck,
  Calendar,
  Flame,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { LeadQuickActionDrawer } from './LeadQuickActionDrawer';
import { InlineStatusSelect } from '@/components/shared/InlineStatusSelect';
import {
  ViewAndColumnManager,
  type CustomViewDefinition,
  type ColumnDefinition,
} from '@/components/shared/ViewAndColumnManager';
import { settingsApi } from '@/api/settings';
import { toast } from 'sonner';
import {
  CompactRecordRow,
  DEFAULT_RECORD_ACTIONS,
  OperationalStatusBadge,
  SourceBadge as OperationalSourceBadge,
  type OperationalStatus,
} from '@/components/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LeadDetail } from './LeadDetail';
import { CreateLeadModal } from './CreateLeadModal';
import { CampaignOptInModal } from './CampaignOptInModal';
import { LeadFilterBuilder, type LeadFilterState } from './LeadFilterBuilder';
import { BulkActionBar } from '@/components/shared/BulkActionBar';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const columnHelper = createColumnHelper<LeadResponse>();

function LeadSourceBadge({ source }: { source: string }) {
  const label =
    source === 'whatsapp'
      ? 'WhatsApp'
      : source === 'justdial'
        ? 'JustDial'
        : source === 'facebook'
          ? 'Facebook'
          : source === 'web' || source === 'web_form' || source === 'website_webhook'
            ? 'Web Form'
            : source === 'franchise_routed'
              ? 'Franchise HQ'
              : source;
  return <OperationalSourceBadge source={label} />;
}

function LeadStatusBadge({ status }: { status: string }) {
  const operationalStatus: OperationalStatus =
    status === 'converted'
      ? 'converted'
      : status === 'qualified'
        ? 'qualified'
        : status === 'unqualified'
          ? 'lost'
          : status === 'contacted'
            ? 'contacted'
            : status === 'new'
              ? 'new'
              : status === 'hot'
                ? 'pending'
                : 'pending';

  return <OperationalStatusBadge status={operationalStatus} label={status.replace('_', ' ')} />;
}

const AVAILABLE_COLUMNS: ColumnDefinition[] = [
  { id: 'name', label: 'Name', defaultVisible: true },
  { id: 'phone', label: 'Phone', defaultVisible: true },
  { id: 'source', label: 'Source', defaultVisible: true },
  { id: 'campaign', label: 'Campaign', defaultVisible: true },
  { id: 'status', label: 'Status', defaultVisible: true },
  { id: 'created_at', label: 'SLA Status', defaultVisible: true },
  { id: 'assigned_to', label: 'Assignee', defaultVisible: true },
];

const DEFAULT_VIEWS: CustomViewDefinition[] = [
  { id: 'all', name: 'All Leads', icon: 'users' },
  { id: 'my', name: 'My Assigned', icon: 'users' },
  { id: 'followups', name: "Today's Follow-ups", icon: 'bookmark' },
  { id: 'untouched', name: 'Untouched (>24h)', icon: 'flame' },
  { id: 'hot', name: 'Hot Priority', icon: 'flame' },
  { id: 'new', name: 'New', icon: 'sparkles' },
  { id: 'unassigned', name: 'Unassigned', icon: 'target' },
  { id: 'duplicate', name: 'Duplicate Risk', icon: 'star' },
  { id: 'junk', name: 'Junk', icon: 'bookmark' },
];

export function LeadList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { user } = useAuth();

  // Dynamic Views & Custom Columns State
  const [activeViewId, setActiveViewId] = useState<string>('all');
  const [activeCustomView, setActiveCustomView] = useState<CustomViewDefinition | null>(null);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('mc_columns_leads');
      return stored ? JSON.parse(stored) : AVAILABLE_COLUMNS.map((c) => c.id);
    } catch {
      return AVAILABLE_COLUMNS.map((c) => c.id);
    }
  });

  const handleVisibleColumnsChange = (cols: string[]) => {
    setVisibleColumnIds(cols);
    try {
      localStorage.setItem('mc_columns_leads', JSON.stringify(cols));
    } catch {}
  };

  // Keyboard shortcut: press 'C' anywhere on the page to trigger lead creation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          setCreateOpen(true);
        }
      }
    };
    const handleOpenModal = () => setCreateOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-create-lead', handleOpenModal);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-create-lead', handleOpenModal);
    };
  }, []);

  const [filters, setFilters] = useState<LeadFilterState>({});
  const [selectedLeads, setSelectedLeads] = useState<LeadResponse[]>([]);

  // Quick Action Drawer state (Calling, WhatsApp, Outcomes)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLead, setDrawerLead] = useState<LeadResponse | null>(null);
  const [drawerMode, setDrawerMode] = useState<'call' | 'whatsapp' | 'note'>('call');

  const handleQuickAction = useCallback((lead: LeadResponse, mode: 'call' | 'whatsapp' | 'note') => {
    setDrawerLead(lead);
    setDrawerMode(mode);
    setDrawerOpen(true);
  }, []);

  // Campaign Opt-in Modal state
  const [optInModalOpen, setOptInModalOpen] = useState(false);
  const [optInLeadIds, setOptInLeadIds] = useState<string[]>([]);
  const [optInLeadNames, setOptInLeadNames] = useState<string[]>([]);
  const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(null);

  const { selectedVerticalIds } = useBranch();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const verticalIdsStr = selectedVerticalIds.length > 0 ? selectedVerticalIds.join(',') : '';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leads', verticalIdsStr, debouncedSearch, activeViewId, filters, activeCustomView?.filters],
    queryFn: () => {
      const params: Record<string, string | number> = {};
      if (verticalIdsStr) params.vertical_ids = verticalIdsStr;
      if (debouncedSearch) params.name = debouncedSearch;

      const effectiveFilters = { ...filters, ...(activeCustomView?.filters || {}) };

      if (effectiveFilters.status) {
        params.status = effectiveFilters.status;
      } else if (activeViewId === 'new') {
        params.status = 'new';
      } else if (activeViewId === 'hot') {
        params.status = 'hot';
      } else if (activeViewId === 'junk') {
        params.status = 'junk';
      }

      if (effectiveFilters.source) params.source = effectiveFilters.source;
      if (effectiveFilters.campaign_id) params.campaign_id = effectiveFilters.campaign_id;

      if (effectiveFilters.assigned_to_id) {
        params.assigned_to_id = effectiveFilters.assigned_to_id;
      } else if (activeViewId === 'unassigned') {
        params.assigned_to_id = 'unassigned';
      } else if (activeViewId === 'my' && user?.id) {
        params.assigned_to_id = user.id;
      }

      return leadsApi.list(params as any);
    },
    staleTime: 15_000,
  });

  // Dynamic Custom Field Definitions
  const { data: fieldDefs = [] } = useQuery({
    queryKey: ['settings', 'fields', 'lead'],
    queryFn: () => settingsApi.fieldDefinitions.list('lead'),
    staleTime: 60_000,
  });

  const allAvailableColumns = useMemo<ColumnDefinition[]>(() => {
    const existingIds = new Set(AVAILABLE_COLUMNS.map((c) => c.id));
    const customCols: ColumnDefinition[] = fieldDefs
      .filter((f) => !existingIds.has(f.name))
      .map((f) => ({
        id: `custom_${f.name}`,
        label: f.label,
        defaultVisible: false,
        isCustomField: true,
      }));
    return [...AVAILABLE_COLUMNS, ...customCols];
  }, [fieldDefs]);

  const rawLeads = data?.data ?? [];

  // Client-side counts for custom view tabs
  const viewCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    counts['all'] = rawLeads.length;
    counts['my'] = rawLeads.filter((l: any) => l.assigned_to_id === user?.id).length;
    counts['followups'] = rawLeads.filter((l: any) => {
      const d = (l.attributes as any)?.follow_up_date;
      return d && dayjs(d).isBefore(dayjs().endOf('day'));
    }).length;
    counts['untouched'] = rawLeads.filter((l: any) => {
      const hours = dayjs().diff(dayjs(l.created_at), 'hour');
      return hours >= 24 && l.status !== 'converted' && l.status !== 'junk';
    }).length;
    counts['hot'] = rawLeads.filter((l: any) => l.status === 'hot').length;
    counts['new'] = rawLeads.filter((l: any) => l.status === 'new').length;
    counts['unassigned'] = rawLeads.filter((l: any) => !l.assigned_to_id).length;
    counts['duplicate'] = rawLeads.filter((l: any) => l.duplicate_risk).length;
    counts['junk'] = rawLeads.filter((l: any) => l.status === 'junk').length;
    return counts;
  }, [rawLeads, user?.id]);

  // Client-side segmented filter for untouched, followups, duplicate tabs and custom view criteria
  const leads = useMemo(() => {
    let result = rawLeads;
    if (activeViewId === 'duplicate') {
      result = result.filter((l: any) => l.duplicate_risk);
    } else if (activeViewId === 'untouched') {
      result = result.filter((l: any) => {
        const hours = dayjs().diff(dayjs(l.created_at), 'hour');
        return hours >= 24 && l.status !== 'converted' && l.status !== 'junk';
      });
    } else if (activeViewId === 'followups') {
      result = result.filter((l: any) => {
        const d = (l.attributes as any)?.follow_up_date;
        return d && dayjs(d).isBefore(dayjs().endOf('day'));
      });
    } else if (activeCustomView?.filters) {
      const cf = activeCustomView.filters;
      if (cf.status) result = result.filter((l: any) => l.status === cf.status);
      if (cf.source) result = result.filter((l: any) => l.source === cf.source);
      if (cf.campaign_id) result = result.filter((l: any) => l.campaign_id === cf.campaign_id);
    }
    return result;
  }, [rawLeads, activeViewId, activeCustomView]);

  const openPhone = useCallback((phone: string) => {
    window.location.href = `tel:${phone}`;
  }, []);

  const openWhatsApp = useCallback((phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = `91${cleaned}`;
    window.open(`https://api.whatsapp.com/send?phone=${cleaned}`, '_blank');
  }, []);

  const handleOpenOptIn = useCallback((lead: LeadResponse) => {
    setOptInLeadIds([lead.id]);
    setOptInLeadNames([lead.name]);
    setCurrentCampaignId(lead.campaign_id);
    setOptInModalOpen(true);
  }, []);

  const exportLeadsCsv = (leadsToExport: LeadResponse[]) => {
    const headers = ['Name', 'Email', 'Phone', 'Source', 'Status', 'Campaign', 'Created At'];
    const rows = leadsToExport.map((l) => [
      `"${l.name.replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      `"${l.phone.replace(/"/g, '""')}"`,
      `"${l.source}"`,
      `"${l.status}"`,
      `"${(l.campaign?.name || '').replace(/"/g, '""')}"`,
      `"${l.created_at}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_export_${dayjs().format('YYYY-MM-DD_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStatusChange = useCallback(
    async (leadId: string, newStatus: string) => {
      try {
        await leadsApi.update(leadId, { status: newStatus as any });
        toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
        refetch();
      } catch (err: any) {
        toast.error(err?.message || 'Failed to update status');
      }
    },
    [refetch]
  );

  const columns = useMemo(() => {
    const baseCols = [
      columnHelper.accessor('name', {
        id: 'name',
        header: 'Name',
        cell: (info) => {
          const row = info.row.original as any;
          return (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{info.getValue()}</span>
              {row.duplicate_risk && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertTriangle size={8} />
                  Dupe
                </span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('phone', {
        id: 'phone',
        header: 'Phone',
        cell: (info) => {
          const phone = info.getValue();
          const row = info.row.original as any;
          const isInvalid = row.phone_valid === false;
          return (
            <div className="flex items-center gap-2 group/phone">
              <span
                className={cn(
                  'text-sm font-mono font-medium',
                  isInvalid ? 'text-red-500 line-through decoration-dotted' : 'text-muted-foreground'
                )}
              >
                {phone}
              </span>
              {isInvalid && (
                <span className="text-red-500" title="Invalid format">
                  <AlertCircle size={12} />
                </span>
              )}
              <div className="flex items-center gap-1.5 opacity-0 group-hover/phone:opacity-100 transition-opacity ml-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickAction(row, 'call');
                  }}
                  className="p-1 rounded bg-muted hover:bg-emerald-50 text-muted-foreground hover:text-emerald-700 transition-colors cursor-pointer"
                  title="Call & Log Interaction"
                >
                  <Phone size={11} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickAction(row, 'whatsapp');
                  }}
                  className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
                  title="WhatsApp & Log"
                >
                  <MessageSquare size={11} />
                </button>
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('source', {
        id: 'source',
        header: 'Source',
        cell: (info) => <LeadSourceBadge source={info.getValue()} />,
      }),
      columnHelper.accessor('campaign', {
        id: 'campaign',
        header: 'Campaign',
        cell: (info) => {
          const lead = info.row.original as any;
          const camp = lead.campaign;
          if (camp) {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenOptIn(lead);
                }}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all cursor-pointer group"
                title="Enrolled in campaign — click to change"
              >
                <Megaphone size={11} className="text-primary group-hover:scale-110 transition-transform" />
                <span className="truncate max-w-[120px]">{camp.name}</span>
              </button>
            );
          }
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenOptIn(lead);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer"
              title="Click to opt-in to campaign"
            >
              <Plus size={10} />
              Opt-in
            </button>
          );
        },
      }),
      columnHelper.accessor('status', {
        id: 'status',
        header: 'Status',
        cell: (info) => {
          const lead = info.row.original as any;
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <InlineStatusSelect
                status={info.getValue()}
                onStatusChange={(newStatus) => handleStatusChange(lead.id, newStatus)}
              />
            </div>
          );
        },
      }),
      columnHelper.accessor('created_at', {
        id: 'created_at',
        header: 'SLA Status',
        cell: (info) => {
          const row = info.row.original as any;
          const date = dayjs(info.getValue());
          const now = dayjs();
          const diffHours = now.diff(date, 'hour');
          const isConverted = row.status === 'converted';

          let slaText = date.fromNow();
          let pillStyle = 'bg-muted text-muted-foreground border-transparent';

          if (!isConverted) {
            if (diffHours < 2) {
              pillStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
              slaText = `New (<2h)`;
            } else if (diffHours < 24) {
              pillStyle = 'bg-amber-50 text-amber-700 border-amber-200';
              slaText = `No contact (${diffHours}h)`;
            } else {
              pillStyle = 'bg-red-50 text-red-700 border-red-200 animate-pulse font-bold';
              slaText = `Stale (>24h)`;
            }
          } else {
            slaText = 'Converted';
            pillStyle = 'bg-slate-100 text-slate-400 border-transparent';
          }

          return (
            <div className="flex items-center gap-1.5">
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border', pillStyle)}>
                <Clock size={8} />
                {slaText}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor('assigned_to', {
        id: 'assigned_to',
        header: 'Assignee',
        cell: (info) => {
          const assignee = info.getValue() as any;
          return (
            <span className="text-sm text-muted-foreground">
              {assignee?.name ?? <span className="text-slate-400 italic">Unassigned</span>}
            </span>
          );
        },
      }),
    ];

    // Dynamic custom fields columns from tenant field definitions
    const customFieldCols = fieldDefs.map((field) => {
      const colId = `custom_${field.name}`;
      return columnHelper.accessor((row) => (row.attributes as any)?.[field.name], {
        id: colId,
        header: field.label,
        cell: (info) => {
          const val = info.getValue();
          if (val === null || val === undefined || val === '') {
            return <span className="text-muted-foreground/40 italic">—</span>;
          }
          if (typeof val === 'boolean') {
            return val ? 'Yes' : 'No';
          }
          return <span className="text-sm text-foreground">{String(val)}</span>;
        },
      });
    });

    const allCols = [...baseCols, ...customFieldCols];
    return allCols.filter((col) => visibleColumnIds.includes(col.id as string));
  }, [visibleColumnIds, fieldDefs, handleQuickAction, handleOpenOptIn, handleStatusChange]);

  const handleRowClick = useCallback((row: LeadResponse) => {
    setPreviewId(row.id);
    setPreviewOpen(true);
  }, []);

  return (
    <PageShell
      title="Leads"
      description="Operational Cockpit: Quick calling, campaign opt-in, qualification, and lead promotion to active deals."
      actions={
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-primary hover:bg-[#1e293b] text-white flex items-center gap-1.5 h-9 rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
        >
          <Plus size={14} />
          Add Lead
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Dynamic Saved Views and Column Chooser */}
        <ViewAndColumnManager
          entityType="Lead"
          defaultViews={DEFAULT_VIEWS}
          activeViewId={activeViewId}
          onViewChange={(view) => {
            setActiveViewId(view.id);
            setActiveCustomView(view.isCustom ? view : null);
            if (view.columnIds && view.columnIds.length > 0) {
              handleVisibleColumnsChange(view.columnIds);
            }
          }}
          availableColumns={allAvailableColumns}
          visibleColumnIds={visibleColumnIds}
          onVisibleColumnsChange={handleVisibleColumnsChange}
          currentFilters={filters}
          countsByViewId={viewCounts}
        />

        {/* Toolbar with Search and Advanced Filter Builder */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="relative w-80 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads by name..."
              className="pl-9 h-9 border-border bg-card text-foreground rounded-lg"
            />
          </div>

          <LeadFilterBuilder
            filters={filters}
            onFilterChange={setFilters}
            onReset={() => setFilters({})}
            rawLeadsCount={leads.length}
          />
        </div>

        {/* Data Table */}
        <Card className="bg-card border-border rounded-xl shadow-xs overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
                Loading leads...
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <AlertCircle size={36} className="text-red-400/60 mb-3" />
                <p className="font-semibold text-foreground">Failed to load leads</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  There was an error fetching leads. Please try again.
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4 h-8 text-xs">
                  Retry
                </Button>
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Megaphone size={36} className="text-muted-foreground/40 mb-3" />
                <p className="font-semibold text-foreground">No leads found</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  {activeViewId !== 'all'
                    ? `No leads match the "${activeCustomView?.name || DEFAULT_VIEWS.find((t) => t.id === activeViewId)?.name || activeViewId}" view right now.`
                    : 'Add a lead manually or connect a third-party integration to start capturing leads.'}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <VirtualTable
                    data={leads}
                    columns={columns as any}
                    rowCount={leads.length}
                    isLoading={isLoading}
                    resource="Lead"
                    onRowClick={handleRowClick}
                    onSelectionChange={setSelectedLeads}
                    getRowActions={(row) => {
                      return (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded bg-muted hover:bg-emerald-50 hover:text-emerald-700 text-muted-foreground transition-all duration-200 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAction(row, 'call');
                            }}
                            title="Call & Log"
                          >
                            <Phone size={11} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 transition-all duration-200 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAction(row, 'whatsapp');
                            }}
                            title="WhatsApp & Log"
                          >
                            <MessageSquare size={11} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded bg-muted hover:bg-amber-50 hover:text-amber-600 text-muted-foreground transition-all duration-200 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenOptIn(row);
                            }}
                            title="Opt-in to Campaign"
                          >
                            <Megaphone size={11} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded bg-muted hover:bg-blue-50 hover:text-blue-600 text-muted-foreground transition-all duration-200 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(row);
                            }}
                            title="Quick View"
                          >
                            <ExternalLink size={11} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded bg-muted hover:bg-indigo-50 hover:text-indigo-600 text-muted-foreground transition-all duration-200 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate({ to: '/leads/$id', params: { id: row.id } });
                            }}
                            title="Full Page"
                          >
                            <FileText size={11} />
                          </Button>
                        </div>
                      );
                    }}
                  />
                </div>
                <div className="lg:hidden divide-y divide-border">
                  {leads.map((lead: any) => (
                    <CompactRecordRow
                      key={lead.id}
                      title={lead.name}
                      subtitle={lead.phone}
                      status={<LeadStatusBadge status={lead.status} />}
                      source={<LeadSourceBadge source={lead.source} />}
                      meta={
                        <div className="flex flex-col gap-1 w-full text-xs">
                          <div className="flex items-center justify-between text-slate-500">
                            <span>{lead.email || 'No email'}</span>
                            <span>{dayjs(lead.created_at).format('DD MMM, h:mm A')}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {lead.campaign && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">
                                <Megaphone size={9} />
                                {lead.campaign.name}
                              </span>
                            )}
                            {lead.duplicate_risk && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertTriangle size={8} />
                                Duplicate Risk
                              </span>
                            )}
                            {lead.phone_valid === false && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-700 border border-red-200">
                                <AlertCircle size={8} />
                                Invalid Phone
                              </span>
                            )}
                            {lead.assigned_to?.name && (
                              <span className="text-[10px] text-slate-400 italic">
                                Assigned: {lead.assigned_to.name}
                              </span>
                            )}
                          </div>
                        </div>
                      }
                      actions={[
                        DEFAULT_RECORD_ACTIONS.call(() => handleQuickAction(lead, 'call')),
                        DEFAULT_RECORD_ACTIONS.whatsapp(() => handleQuickAction(lead, 'whatsapp')),
                      ]}
                      onClick={() => handleRowClick(lead)}
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedRows={selectedLeads}
        onClearSelection={() => setSelectedLeads([])}
        resource="leads"
        actions={[
          {
            id: 'optin-campaign',
            label: 'Opt-in to Campaign',
            icon: <Megaphone size={14} />,
            action: async () => {
              setOptInLeadIds(selectedLeads.map((l) => l.id));
              setOptInLeadNames(selectedLeads.map((l) => l.name));
              setCurrentCampaignId(null);
              setOptInModalOpen(true);
            },
          },
          {
            id: 'export-csv',
            label: 'Export CSV',
            icon: <Download size={14} />,
            action: async () => {
              exportLeadsCsv(selectedLeads);
            },
          },
          {
            id: 'delete',
            label: 'Delete Leads',
            icon: <Trash2 size={14} />,
            confirmMessage: `Are you sure you want to delete ${selectedLeads.length} leads?`,
            action: async () => {
              await leadsApi.bulkAction({
                action: 'delete',
                lead_ids: selectedLeads.map((l) => l.id),
              });
              queryClient.invalidateQueries({ queryKey: ['leads'] });
              setSelectedLeads([]);
            },
          },
        ]}
      />

      {/* Campaign Opt-in Modal */}
      <CampaignOptInModal
        open={optInModalOpen}
        onOpenChange={setOptInModalOpen}
        leadIds={optInLeadIds}
        leadNames={optInLeadNames}
        currentCampaignId={currentCampaignId}
        onSuccess={() => {
          setSelectedLeads([]);
        }}
      />

      {/* Lead Detail Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
          </DialogHeader>
          {previewId && (
            <LeadDetail
              leadId={previewId}
              onClose={() => setPreviewOpen(false)}
              onChanged={() => {
                refetch();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Lead Modal */}
      <CreateLeadModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          refetch();
        }}
      />

      {/* Quick Action Drawer for Call / WhatsApp / Outcome Logging */}
      <LeadQuickActionDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        lead={drawerLead}
        initialMode={drawerMode}
        onSuccess={() => {
          refetch();
        }}
      />
    </PageShell>
  );
}
