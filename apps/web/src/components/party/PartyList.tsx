import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { createColumnHelper } from '@tanstack/react-table';
import { PartySource, PartyType, MergeStatus } from '@meta-crm/types';
import type { PartyResponse } from '@meta-crm/types';
import { usePermissions } from '@/hooks/usePermissions';
import { useLabels } from '@/hooks/useLabels';
import { partiesApi } from '@/api/parties';
import { VirtualTable } from '@/components/shared/VirtualTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, Search, SlidersHorizontal, Users } from 'lucide-react';

const columnHelper = createColumnHelper<PartyResponse>();

/* Source badge colors — DESIGN.md: use report palette sparingly */
function SourceBadge({ source }: { source: string }) {
  const styles: Record<string, string> = {
    [PartySource.WhatsApp]: 'bg-[#0bdf50]/10 text-[#0a7f2e] border-[#0bdf50]/20',
    [PartySource.JustDial]: 'bg-[#65b5ff]/10 text-[#0050aa] border-[#65b5ff]/20',
    [PartySource.Facebook]: 'bg-[#0007cb]/10 text-[#0007cb] border-[#0007cb]/20',
    [PartySource.Manual]: 'bg-[#ebe7e1] text-[#626260] border-[#d3cec6]',
    [PartySource.WebForm]: 'bg-[#b3e01c]/10 text-[#5a6e00] border-[#b3e01c]/20',
    [PartySource.Api]: 'bg-[#ff5600]/10 text-[#cc4400] border-[#ff5600]/20',
  };
  const cls = styles[source] ?? 'bg-[#ebe7e1] text-[#626260] border-[#d3cec6]';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>
      {source}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === MergeStatus.Merged) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#c41c1c]/10 text-[#c41c1c] border border-[#c41c1c]/20">
        Merged
      </span>
    );
  }
  if (status === MergeStatus.PendingReview) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#0bdf50]/10 text-[#0a7f2e] border border-[#0bdf50]/20">
      Active
    </span>
  );
}

export function PartyList() {
  const { can } = usePermissions();
  const { t } = useLabels();
  const navigate = useNavigate();

  const [searchName, setSearchName] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['parties', searchName, searchPhone, filterSource, filterType],
    queryFn: () => {
      const params: Record<string, string | number> = { limit: 50 };
      if (searchName) params.name = searchName;
      if (searchPhone) params.phone = searchPhone;
      if (filterSource) params.source = filterSource;
      if (filterType) params.type = filterType;
      return partiesApi.list(params as any);
    },
    staleTime: 30_000,
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('party.name') ?? 'Name',
        cell: (info) => (
          <span className="font-medium text-[#111111]">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('phone_raw', {
        header: t('party.phone') ?? 'Phone',
        cell: (info) => (
          <span className="text-[#626260] text-sm">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('email', {
        header: t('party.email') ?? 'Email',
        cell: (info) => (
          <span className="text-[#626260] text-sm">{info.getValue() ?? '—'}</span>
        ),
      }),
      columnHelper.accessor('source', {
        header: t('party.source') ?? 'Source',
        cell: (info) => <SourceBadge source={info.getValue()} />,
      }),
      columnHelper.accessor('type', {
        header: t('party.type') ?? 'Type',
        cell: (info) => (
          <span className="text-sm text-[#626260] capitalize">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('merge_status', {
        header: 'Status',
        cell: (info) => <StatusBadge status={info.getValue()} />,
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
  const hasNext = !!data?.next_cursor;
  const rowCount = parties.length + (hasNext ? 1 : 0);

  return (
    <div className="space-y-5 max-w-[1280px]">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight">
            {t('party.plural') ?? 'Contacts'}
          </h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">
            {parties.length > 0 ? `${parties.length} contacts` : 'Manage your contacts and companies'}
          </p>
        </div>
        {can('create', 'Party') && (
          <Button
            onClick={() => navigate({ to: '/parties/new' })}
            className="bg-[#111111] hover:bg-black text-white rounded-lg h-9 px-4 text-sm font-medium"
          >
            <Plus size={15} className="mr-1.5" />
            {t('party.new') ?? 'New Contact'}
          </Button>
        )}
      </div>

      {/* Filters bar */}
      <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9c9fa5]" />
              <Input
                type="text"
                placeholder="Search by name…"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="pl-8 h-8 bg-[#f5f1ec] border-[#d3cec6] text-sm placeholder:text-[#9c9fa5] focus-visible:ring-[#111111]/30"
              />
            </div>
            <div className="relative min-w-[160px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9c9fa5]" />
              <Input
                type="text"
                placeholder="Search by phone…"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                className="pl-8 h-8 bg-[#f5f1ec] border-[#d3cec6] text-sm placeholder:text-[#9c9fa5] focus-visible:ring-[#111111]/30"
              />
            </div>
            <Select value={filterSource} onValueChange={(v) => setFilterSource(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-[140px] bg-[#f5f1ec] border-[#d3cec6] text-sm">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {Object.values(PartySource).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={(v) => setFilterType(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-[130px] bg-[#f5f1ec] border-[#d3cec6] text-sm">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.values(PartyType).map((tp) => (
                  <SelectItem key={tp} value={tp}>{tp}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table card */}
      <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none overflow-hidden">
        <VirtualTable<PartyResponse>
          data={parties}
          columns={columns}
          rowCount={rowCount}
          isLoading={isLoading}
          resource="Party"
          onRowClick={handleRowClick}
          enableColumnVisibility
          enableMultiSort={false}
          pageSize={50}
          emptyTitle="No contacts found"
          emptyDescription="Try adjusting your filters or add a new contact"
        />
      </Card>
    </div>
  );
}
