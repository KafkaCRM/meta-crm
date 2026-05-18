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

const columnHelper = createColumnHelper<PartyResponse>();

const SOURCE_COLORS: Record<string, string> = {
  [PartySource.WhatsApp]: 'bg-green-100 text-green-800',
  [PartySource.JustDial]: 'bg-blue-100 text-blue-800',
  [PartySource.Facebook]: 'bg-indigo-100 text-indigo-800',
  [PartySource.Manual]: 'bg-gray-100 text-gray-800',
  [PartySource.WebForm]: 'bg-purple-100 text-purple-800',
  [PartySource.Api]: 'bg-orange-100 text-orange-800',
};

export function PartyList() {
  const { can } = usePermissions();
  const { t } = useLabels();
  const navigate = useNavigate();

  const [searchName, setSearchName] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');

  const { data, isLoading, isFetching } = useQuery({
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
          <span className="font-medium">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('phone_raw', {
        header: t('party.phone') ?? 'Phone',
        cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('email', {
        header: t('party.email') ?? 'Email',
        cell: (info) => (
          <span className="text-muted-foreground">{info.getValue() ?? '—'}</span>
        ),
      }),
      columnHelper.accessor('source', {
        header: t('party.source') ?? 'Source',
        cell: (info) => {
          const source = info.getValue();
          const colorClass = SOURCE_COLORS[source] ?? 'bg-gray-100 text-gray-800';
          return (
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
              {source}
            </span>
          );
        },
      }),
      columnHelper.accessor('type', {
        header: t('party.type') ?? 'Type',
        cell: (info) => (
          <span className="text-sm">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('merge_status', {
        header: 'Status',
        cell: (info) => {
          const status = info.getValue();
          if (status === MergeStatus.Merged) {
            return (
              <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                Merged
              </span>
            );
          }
          if (status === MergeStatus.PendingReview) {
            return (
              <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Pending
              </span>
            );
          }
          return (
            <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              Active
            </span>
          );
        },
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('party.plural') ?? 'Parties'}</h1>
        {can('create', 'Party') && (
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => navigate({ to: '/parties/new' })}
          >
            {t('party.new') ?? 'New Party'}
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          placeholder="Search by name..."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className="rounded-md border border-input px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Search by phone..."
          value={searchPhone}
          onChange={(e) => setSearchPhone(e.target.value)}
          className="rounded-md border border-input px-3 py-2 text-sm"
        />
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="rounded-md border border-input px-3 py-2 text-sm"
        >
          <option value="">All sources</option>
          {Object.values(PartySource).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border border-input px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          {Object.values(PartyType).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

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
        emptyState={
          <div className="text-center">
            <p className="text-lg font-medium">No parties found</p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters or create a new party
            </p>
          </div>
        }
      />
    </div>
  );
}
