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
import { BulkActionBar, type BulkAction } from '@/components/shared/BulkActionBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

const SOURCE_COLORS: Record<string, string> = {
  [PartySource.WhatsApp]: 'bg-[#0bdf50]/10 text-[#0a7f2e] border-[#0bdf50]/20',
  [PartySource.JustDial]: 'bg-[#ff8c00]/10 text-[#cc7000] border-[#ff8c00]/20',
  [PartySource.Facebook]: 'bg-[#1877f2]/10 text-[#1565c0] border-[#1877f2]/20',
  [PartySource.Manual]: 'bg-[#94a3b8]/10 text-[#64748b] border-[#94a3b8]/20',
  [PartySource.WebForm]: 'bg-[#8b5cf6]/10 text-[#7c3aed] border-[#8b5cf6]/20',
  [PartySource.Api]: 'bg-[#ff5600]/10 text-[#cc4400] border-[#ff5600]/20',
};

function SourceBadge({ source }: { source: string }) {
  const cls = SOURCE_COLORS[source] ?? 'bg-[#94a3b8]/10 text-[#64748b] border-[#94a3b8]/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>
      {source === PartySource.WhatsApp ? 'WhatsApp' : source === PartySource.JustDial ? 'JustDial' : source === PartySource.Facebook ? 'Facebook' : source === PartySource.WebForm ? 'Web Form' : source === PartySource.Manual ? 'Manual' : source}
    </span>
  );
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
  const cls = STAGE_COLORS[stage] ?? 'bg-[#94a3b8]/10 text-[#64748b] border-[#94a3b8]/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${cls}`}>
      {stage}
    </span>
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
          <span className="font-medium text-[#0f172a]">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('phone_raw', {
        header: t('party.phone') ?? 'Phone',
        cell: (info) => (
          <span className="text-[#64748b] text-sm font-mono">{info.getValue()}</span>
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
          <span className="text-sm text-[#94a3b8]">
            {dayjs(info.getValue()).format('DD MMM YYYY')}
          </span>
        ),
      }),
    ],
    [t],
  );

  const handleRowClick = useCallback(
    (row: PartyResponse) => {
      navigate({ to: '/parties/$id', params: { id: row.id } });
    },
    [navigate],
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

  return (
    <div className="space-y-5 max-w-[1280px]">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#0f172a] tracking-tight">
            {t('party.plural') ?? 'Contacts'}
          </h1>
          <p className="text-sm text-[#94a3b8] mt-0.5">
            {parties.length > 0 ? `${parties.length} ${t('party.plural')?.toLowerCase() ?? 'contacts'}` : `Manage your ${t('party.plural')?.toLowerCase() ?? 'contacts'}`}
          </p>
        </div>
        {can('create', 'Party') && (
          <Button
            onClick={() => navigate({ to: '/parties/new' })}
            className="bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-lg h-9 px-4 text-sm font-medium"
          >
            <Plus size={15} className="mr-1.5" />
            New {t('party.singular') ?? 'Contact'}
          </Button>
        )}
      </div>

      {/* Filters bar */}
      <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <Input
                type="text"
                placeholder="Search by name or phone…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 bg-[#f8fafc] border-[#e2e8f0] text-sm placeholder:text-[#94a3b8] focus-visible:ring-[#0f172a]/30"
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
                <SelectTrigger className="h-8 w-full bg-[#f8fafc] border-[#e2e8f0] text-sm">
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
              className="h-8 w-[140px] bg-[#f8fafc] border-[#e2e8f0] text-sm"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
              className="h-8 w-[140px] bg-[#f8fafc] border-[#e2e8f0] text-sm"
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
                className="h-8 text-xs text-[#94a3b8] hover:text-[#0f172a]"
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table card */}
      <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none overflow-hidden">
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
            <div className="w-12 h-12 rounded-full bg-[#f8fafc] flex items-center justify-center mb-4">
              <Users size={20} className="text-[#94a3b8]" />
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
    </div>
  );
}
