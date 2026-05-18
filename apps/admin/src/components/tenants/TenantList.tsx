import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { VirtualTable } from '@meta-crm/ui';
import { listTenants, TenantListItem } from '@/api/platform';
import { useNavigate } from '@tanstack/react-router';

const ALL_INDUSTRIES = ['All', 'education', 'healthcare', 'real-estate', 'retail', 'finance', 'technology'];
const ALL_STATUSES = ['All', 'active', 'suspended'];

export function TenantList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [cursor, setCursor] = useState<string | undefined>();
  const [allData, setAllData] = useState<TenantListItem[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['tenants', cursor],
    queryFn: () => listTenants(cursor, 100),
  });

  useMemo(() => {
    if (data?.data) {
      setAllData((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newItems = data.data.filter((t) => !existingIds.has(t.id));
        return [...prev, ...newItems];
      });
    }
  }, [data]);

  const filteredData = useMemo(() => {
    return allData.filter((tenant) => {
      const matchesSearch =
        !search ||
        tenant.name.toLowerCase().includes(search.toLowerCase()) ||
        tenant.slug.toLowerCase().includes(search.toLowerCase());
      const matchesIndustry = industryFilter === 'All' || tenant.industry === industryFilter;
      const matchesStatus = statusFilter === 'All' || tenant.status === statusFilter;
      return matchesSearch && matchesIndustry && matchesStatus;
    });
  }, [allData, search, industryFilter, statusFilter]);

  const columns: ColumnDef<TenantListItem>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
      },
      {
        accessorKey: 'slug',
        header: 'Slug',
      },
      {
        accessorKey: 'industry',
        header: 'Industry',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.getValue('status') as string;
          return (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {status}
            </span>
          );
        },
      },
      {
        accessorKey: 'branch_count',
        header: 'Branches',
      },
      {
        accessorKey: 'user_count',
        header: 'Users',
      },
      {
        accessorKey: 'case_count',
        header: 'Cases',
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => {
          const date = row.getValue('created_at') as string;
          return new Date(date).toLocaleDateString();
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {ALL_INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>
              {ind === 'All' ? 'All Industries' : ind}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {ALL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status === 'All' ? 'All Statuses' : status}
            </option>
          ))}
        </select>
      </div>

      <VirtualTable<TenantListItem>
        data={filteredData}
        columns={columns}
        rowCount={filteredData.length}
        isLoading={isLoading}
        onRowClick={(row) => navigate({ to: `/admin/tenants/${row.id}` })}
        searchPlaceholder="Search tenants..."
        searchValue={search}
        onSearchChange={setSearch}
        emptyState={
          <div className="text-center">
            <p className="text-lg font-medium">No tenants found</p>
            <p className="text-sm text-gray-500">Try adjusting your filters</p>
          </div>
        }
      />
    </div>
  );
}
