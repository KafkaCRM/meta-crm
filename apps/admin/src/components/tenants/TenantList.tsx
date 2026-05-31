import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { VirtualTable } from '@meta-crm/ui';
import { listTenants, TenantListItem } from '@/api/platform';
import { useNavigate } from '@tanstack/react-router';
import { 
  Building2, 
  Activity, 
  ShieldAlert, 
  Globe, 
  Users, 
  GitBranch, 
  Briefcase, 
  Calendar, 
  ChevronDown, 
  Search, 
  X,
  Sparkles
} from 'lucide-react';

const ALL_INDUSTRIES = ['All', 'education', 'healthcare', 'real-estate', 'retail', 'finance', 'technology'];
const ALL_STATUSES = ['All', 'active', 'suspended'];

export function TenantList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [cursor, setCursor] = useState<string | undefined>();
  const [allData, setAllData] = useState<TenantListItem[]>([]);
  const [isIndustryOpen, setIsIndustryOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close industry filter dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsIndustryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Compute KPI Stats dynamically from allData
  const stats = useMemo(() => {
    const total = allData.length;
    const active = allData.filter((t) => t.status === 'active').length;
    const suspended = allData.filter((t) => t.status === 'suspended').length;
    
    const indCounts: Record<string, number> = {};
    allData.forEach((t) => {
      indCounts[t.industry] = (indCounts[t.industry] || 0) + 1;
    });
    
    let topInd = 'None';
    let maxCount = 0;
    Object.entries(indCounts).forEach(([ind, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topInd = ind;
      }
    });

    return {
      total,
      active,
      suspended,
      topIndustry: topInd === 'None' ? 'None' : topInd.charAt(0).toUpperCase() + topInd.slice(1),
      topIndustryCount: maxCount,
    };
  }, [allData]);

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
        header: 'Tenant Name',
        cell: ({ row }) => {
          const name = row.original.name;
          const slug = row.original.slug;
          return (
            <div className="flex flex-col py-1">
              <span className="font-semibold text-foreground text-sm">{name}</span>
              <span className="text-xs text-muted-foreground font-mono mt-0.5">{slug}.meta-crm.local</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'industry',
        header: 'Industry',
        cell: ({ row }) => {
          const ind = row.getValue('industry') as string;
          const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
            healthcare: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
            finance: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
            technology: { bg: 'bg-sky-50 border-sky-100', text: 'text-sky-800', dot: 'bg-sky-500' },
            retail: { bg: 'bg-orange-50 border-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
            education: { bg: 'bg-violet-50 border-violet-100', text: 'text-violet-800', dot: 'bg-violet-500' },
            'real-estate': { bg: 'bg-rose-50 border-rose-100', text: 'text-rose-800', dot: 'bg-rose-500' },
          };
          const theme = colorMap[ind.toLowerCase()] || { bg: 'bg-muted border-border/50 border', text: 'text-foreground', dot: 'bg-muted0' };
          return (
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${theme.bg} ${theme.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
              {ind.charAt(0).toUpperCase() + ind.slice(1)}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.getValue('status') as string;
          const isActive = status === 'active';
          return (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
              isActive 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                : 'bg-rose-50 text-rose-800 border-rose-100'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          );
        },
      },
      {
        accessorKey: 'branch_count',
        header: 'Branches',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <GitBranch size={13} className="text-muted-foreground" />
            <span className="font-medium">{row.original.branch_count}</span>
          </div>
        )
      },
      {
        accessorKey: 'user_count',
        header: 'Users',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users size={13} className="text-muted-foreground" />
            <span className="font-medium">{row.original.user_count}</span>
          </div>
        )
      },
      {
        accessorKey: 'case_count',
        header: 'Cases',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Briefcase size={13} className="text-muted-foreground" />
            <span className="font-medium">{row.original.case_count}</span>
          </div>
        )
      },
      {
        accessorKey: 'created_at',
        header: 'Provisioned',
        cell: ({ row }) => {
          const date = row.getValue('created_at') as string;
          return (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar size={13} />
              <span>{new Date(date).toLocaleDateString()}</span>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Dynamic KPI Header Panel */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 p-6 bg-slate-100/40 border-b border-border">
        {/* Total Tenants */}
        <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-3 transition-all duration-200 hover:shadow-xs hover:border-slate-300">
          <div className="w-10 h-10 rounded-lg bg-fin-orange/10 flex items-center justify-center text-fin-orange flex-shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total Tenants</p>
            <p className="text-xl font-bold text-foreground mt-0.5">{isLoading ? '—' : stats.total}</p>
          </div>
        </div>

        {/* Active Workspaces */}
        <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-3 transition-all duration-200 hover:shadow-xs hover:border-slate-300">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <Activity size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Active</p>
            <p className="text-xl font-bold text-foreground mt-0.5">{isLoading ? '—' : stats.active}</p>
          </div>
        </div>

        {/* Suspended Workspaces */}
        <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-3 transition-all duration-200 hover:shadow-xs hover:border-slate-300">
          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 flex-shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Suspended</p>
            <p className="text-xl font-bold text-foreground mt-0.5">{isLoading ? '—' : stats.suspended}</p>
          </div>
        </div>

        {/* Industry Diversity */}
        <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-3 transition-all duration-200 hover:shadow-xs hover:border-slate-300">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
            <Globe size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Top Industry</p>
            <p className="text-sm font-bold text-foreground mt-0.5 truncate">
              {isLoading ? '—' : stats.topIndustry !== 'None' ? `${stats.topIndustry} (${stats.topIndustryCount})` : 'None'}
            </p>
          </div>
        </div>
      </div>

      {/* Premium Integrated Filter Bar */}
      <div className="px-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Search with clear state */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search tenants by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-muted-foreground transition-all text-foreground"
          />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-muted-foreground hover:text-foreground"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Right: Custom Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented Status Pill Control */}
          <div className="bg-slate-100 p-1 rounded-lg border border-border flex gap-1 items-center">
            {ALL_STATUSES.map((status) => {
              const active = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                    active 
                      ? 'bg-fin-orange text-white shadow-xs' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {status === 'All' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              );
            })}
          </div>

          {/* Styled Custom Industry Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsIndustryOpen(!isIndustryOpen)}
              className="px-3 py-1.5 text-xs font-medium bg-card border border-border hover:bg-muted rounded-lg flex items-center gap-2 text-foreground transition-all"
            >
              <span>
                {industryFilter === 'All' ? 'All Industries' : industryFilter.charAt(0).toUpperCase() + industryFilter.slice(1)}
              </span>
              <ChevronDown size={12} className={`text-muted-foreground transition-transform duration-200 ${isIndustryOpen ? 'rotate-180' : ''}`} />
            </button>

            {isIndustryOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-card border border-border rounded-lg shadow-lg z-30 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                {ALL_INDUSTRIES.map((ind) => {
                  const active = industryFilter === ind;
                  return (
                    <button
                      key={ind}
                      onClick={() => {
                        setIndustryFilter(ind);
                        setIsIndustryOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-xs flex items-center justify-between transition-colors duration-150 ${
                        active 
                          ? 'bg-slate-100 text-foreground font-semibold' 
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <span>{ind === 'All' ? 'All Industries' : ind.charAt(0).toUpperCase() + ind.slice(1)}</span>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-fin-orange" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="px-6 pb-6">
        <VirtualTable<TenantListItem>
          data={filteredData}
          columns={columns}
          rowCount={filteredData.length}
          isLoading={isLoading}
          onRowClick={(row) => navigate({ to: `/admin/tenants/${row.id}` })}
          searchPlaceholder="Search tenants..."
          searchValue={search}
          onSearchChange={setSearch}
          enableColumnVisibility={false} // Clean layout, integrated filters instead
          showSearch={false}
          emptyState={
            <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/50">
              <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                <Sparkles size={20} className="text-muted-foreground" />
              </div>
              <p className="text-base font-semibold text-foreground">No matches found</p>
              <p className="text-xs text-muted-foreground mt-1">Try resetting your filters or adjusting your search term.</p>
              {(search || industryFilter !== 'All' || statusFilter !== 'All') && (
                <button
                  onClick={() => {
                    setSearch('');
                    setIndustryFilter('All');
                    setStatusFilter('All');
                  }}
                  className="mt-4 px-3 py-1.5 text-xs font-semibold bg-fin-orange hover:bg-fin-orange/90 text-white rounded-lg transition-all duration-200 shadow-sm shadow-indigo-100"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}
