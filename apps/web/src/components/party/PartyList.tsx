import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { createColumnHelper } from '@tanstack/react-table';
import { PartySource, PartyType, MergeStatus } from '@meta-crm/types';
import type { PartyResponse } from '@meta-crm/types';
import { usePermissions } from '@/hooks/usePermissions';
import { useLabels } from '@/hooks/useLabels';
import { partiesApi } from '@/api/parties';
import { VirtualTable } from '@/components/shared/VirtualTable';
import { SidePanelPreview } from '@/components/shared/SidePanelPreview';
import { BulkActionBar, type BulkAction } from '@/components/shared/BulkActionBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageShell } from '@/components/shared/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, Search, Users, Download, UserPlus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import dayjs from 'dayjs';

const columnHelper = createColumnHelper<PartyResponse>();

function SourceBadge({ source }: { source: string }) {
  let variant: 'success' | 'warning' | 'info' | 'secondary' | 'outline' = 'outline';
  if (source === PartySource.WhatsApp) variant = 'success';
  else if (source === PartySource.JustDial) variant = 'warning';
  else if (source === PartySource.Facebook) variant = 'info';
  else if (source === PartySource.WebForm) variant = 'secondary';
  
  const label = source === PartySource.WhatsApp ? 'WhatsApp' : source === PartySource.JustDial ? 'JustDial' : source === PartySource.Facebook ? 'Facebook' : source === PartySource.WebForm ? 'Web Form' : source === PartySource.Manual ? 'Manual' : source;
  
  return (
    <Badge variant={variant} className="capitalize shrink-0">
      {label}
    </Badge>
  );
}

function StageBadge({ stage }: { stage: string }) {
  let variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' = 'secondary';
  if (stage === 'won' || stage === 'enrolled') variant = 'success';
  else if (stage === 'lost' || stage === 'dropped') variant = 'destructive';
  else if (stage === 'qualified' || stage === 'negotiation') variant = 'warning';
  else if (stage === 'new' || stage === 'contacted') variant = 'default';
  
  return (
    <Badge variant={variant} className="capitalize shrink-0">
      {stage}
    </Badge>
  );
}

export function PartyList() {
  const { can } = usePermissions();
  const { t } = useLabels();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterSources, setFilterSources] = useState<string[]>([]);
  const [filterCounsellor, setFilterCounsellor] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedRows, setSelectedRows] = useState<PartyResponse[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const { data, isLoading } = useQuery({
    queryKey: ['parties', debouncedSearch, filterSources, filterCounsellor, dateFrom, dateTo],
    queryFn: () => {
      const params: Record<string, string | number> = { limit: 500 };
      if (debouncedSearch) {
        if (/^\+?\d/.test(debouncedSearch)) {
          params.phone = debouncedSearch;
        } else {
          params.name = debouncedSearch;
        }
      }
      if (filterSources.length > 0) params.source = filterSources.join(',');
      if (filterCounsellor) params.assigned_to = filterCounsellor;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      return partiesApi.list(params as any);
    },
    staleTime: 30_000,
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('party.name') ?? 'Name',
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('phone_raw', {
        header: t('party.phone') ?? 'Phone',
        cell: (info) => (
          <span className="text-muted-foreground text-sm font-mono">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('source', {
        header: t('party.source') ?? 'Source',
        cell: (info) => <SourceBadge source={info.getValue()} />,
      }),
      columnHelper.accessor('merge_status', {
        header: 'Status',
        cell: (info) => {
          const status = info.getValue();
          if (status === MergeStatus.Merged) {
            return <span className="text-xs text-[#c41c1c]">Merged</span>;
          }
          return <span className="text-xs text-[#0bdf50]">Active</span>;
        },
      }),
      columnHelper.accessor('created_at', {
        header: 'Created',
        cell: (info) => (
          <span className="text-sm text-muted-foreground">
            {dayjs(info.getValue()).format('DD MMM YYYY')}
          </span>
        ),
      }),
    ],
    [t],
  );

  const handleRowClick = useCallback(
    (row: PartyResponse) => {
      setPreviewId(row.id);
      setPreviewOpen(true);
    },
    [],
  );

  const parties = data?.data ?? [];

  const bulkActions: BulkAction<PartyResponse>[] = useMemo(() => {
    const actions: BulkAction<PartyResponse>[] = [];
    if (can('update', 'Party')) {
      actions.push({
        id: 'assign',
        label: 'Assign',
        icon: <UserPlus size={14} />,
        action: async (rows) => {
          // TODO: implement bulk assign
        },
      });
    }
    actions.push({
      id: 'export',
      label: 'Export CSV',
      icon: <Download size={14} />,
      action: async (rows) => {
        const headers = ['Name', 'Phone', 'Email', 'Source', 'Created'];
        const csvRows = rows.map((r) =>
          [r.name, r.phone_raw, r.email ?? '', r.source, r.created_at].map((v) => `"${v}"`).join(','),
        );
        const csv = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'parties.csv';
        a.click();
        URL.revokeObjectURL(url);
      },
    });
    return actions;
  }, [can]);

  const hasActiveFilters = debouncedSearch || filterSources.length > 0 || filterCounsellor || dateFrom || dateTo;

  const headerActions = useMemo(() => {
    if (!can('create', 'Party')) return null;
    return (
      <Button
        onClick={() => navigate({ to: '/parties/new' })}
        className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-9 px-4 text-sm font-medium"
      >
        <Plus size={15} className="mr-1.5" />
        New {t('party.singular') ?? 'Contact'}
      </Button>
    );
  }, [can, navigate, t]);

  return (
    <PageShell
      title={t('party.plural') ?? 'Contacts'}
      description={parties.length > 0 ? `${parties.length} ${t('party.plural')?.toLowerCase() ?? 'contacts'}` : `Manage your ${t('party.plural')?.toLowerCase() ?? 'contacts'}`}
      actions={headerActions}
    >

      {/* Filters bar */}
      <Card className="bg-white border-border rounded-xl shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name or phone…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 bg-muted/40 border-border text-sm placeholder:text-muted-foreground focus-visible:ring-primary/30"
              />
            </div>

            <div className="min-w-[160px]">
              <Select
                value={(filterSources.length > 0 ? filterSources[0] : 'all') as string}
                onValueChange={(v) => {
                  if (v === 'all') setFilterSources([]);
                  else setFilterSources([v]);
                }}
              >
                <SelectTrigger className="h-8 w-full bg-muted/40 border-border text-sm">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {Object.values(PartySource).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === PartySource.WhatsApp ? 'WhatsApp' : s === PartySource.JustDial ? 'JustDial' : s === PartySource.WebForm ? 'Web Form' : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
              className="h-8 w-[140px] bg-muted/40 border-border text-sm"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
              className="h-8 w-[140px] bg-muted/40 border-border text-sm"
            />

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setDebouncedSearch('');
                  setFilterSources([]);
                  setFilterCounsellor('');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table card */}
      <Card className="bg-white border-border rounded-xl shadow-none overflow-hidden">
        <VirtualTable<PartyResponse>
          data={parties}
          columns={columns}
          rowCount={parties.length}
          isLoading={isLoading}
          resource="Party"
          onRowClick={handleRowClick}
          onSelectionChange={setSelectedRows}
          enableColumnVisibility
          enableMultiSort
          pageSize={50}
          tableId="party-list"
          emptyTitle={`No ${t('party.plural')?.toLowerCase() ?? 'contacts'} yet`}
          emptyDescription={`Add your first ${t('party.singular')?.toLowerCase() ?? 'contact'} to get started`}
          {...(can('create', 'Party') ? {
            emptyCta: {
              label: `+ Add your first ${t('party.singular') ?? 'contact'}`,
              onClick: () => navigate({ to: '/parties/new' }),
            },
          } : {})}
          emptyIcon={
            <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mb-4">
              <Users size={20} className="text-muted-foreground" />
            </div>
          }
        />
      </Card>

      <BulkActionBar
        selectedRows={selectedRows}
        actions={bulkActions}
        onClearSelection={() => setSelectedRows([])}
        resource="Party"
      />

      <SidePanelPreview 
        isOpen={previewOpen} 
        recordId={previewId} 
        objectType="Party" 
        onClose={() => setPreviewOpen(false)} 
      />
    </PageShell>
  );
}
