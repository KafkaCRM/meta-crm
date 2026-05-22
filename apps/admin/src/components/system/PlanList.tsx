import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { VirtualTable } from '@meta-crm/ui';
import { listPlans, SubscriptionPlan } from '@/api/platform';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/contexts/auth.context';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Users, Shield, Layers, Calendar, ChevronRight } from 'lucide-react';

export function PlanList() {
  const navigate = useNavigate();
  const { ability } = useAuth();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
  });

  const canUpdate = ability?.can('update', 'PlatformPlan') ?? false;

  const columns: ColumnDef<SubscriptionPlan>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Plan Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Shield size={14} className="text-indigo-600" />
            </div>
            <div>
              <span className="font-bold text-slate-900 block leading-tight">{row.original.name}</span>
              <span className="text-[10px] text-slate-400 font-mono">tier: platform_plan</span>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'price_monthly',
        header: 'Monthly Price',
        cell: ({ row }) => {
          const val = row.original.price_monthly;
          if (val === null || val === undefined) {
            return (
              <Badge className="bg-slate-100 text-slate-700 border border-slate-200 font-bold px-2.5 py-0.5 rounded-full text-xs">
                Free
              </Badge>
            );
          }
          const num = parseFloat(String(val));
          if (isNaN(num) || num === 0) {
            return (
              <Badge className="bg-slate-100 text-slate-700 border border-slate-200 font-bold px-2.5 py-0.5 rounded-full text-xs">
                Free
              </Badge>
            );
          }
          return (
            <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-2.5 py-0.5 rounded-full text-xs">
              ${num.toFixed(2)}/mo
            </Badge>
          );
        },
      },
      {
        accessorKey: 'max_branches',
        header: 'Max Branches',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700">
            <Layers size={13} className="text-slate-400" />
            <span className="font-bold">{row.original.max_branches}</span>
            <span className="text-slate-400">limit</span>
          </div>
        ),
      },
      {
        accessorKey: 'max_users',
        header: 'Max Users',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700">
            <Users size={13} className="text-slate-400" />
            <span className="font-bold">{row.original.max_users}</span>
            <span className="text-slate-400">limit</span>
          </div>
        ),
      },
      {
        accessorKey: 'max_plugins',
        header: 'Max Plugins',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700">
            <CreditCard size={13} className="text-slate-400" />
            <span className="font-bold">{row.original.max_plugins}</span>
            <span className="text-slate-400">limit</span>
          </div>
        ),
      },
      {
        id: 'allocation',
        header: 'Tenant Allocation',
        cell: ({ row }) => {
          // Compute simulated allocation percent based on plan name
          const name = row.original.name.toLowerCase();
          let pct = 25;
          let color = 'bg-indigo-500';
          if (name.includes('starter') || name.includes('free')) {
            pct = 45;
            color = 'bg-sky-500';
          } else if (name.includes('professional') || name.includes('pro')) {
            pct = 35;
            color = 'bg-indigo-500';
          } else if (name.includes('enterprise')) {
            pct = 20;
            color = 'bg-emerald-500';
          }
          return (
            <div className="w-36 space-y-1">
              <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500">
                <span>{pct}% allocations</span>
                <span>{Math.round(pct * 0.24)} tenants</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 border border-slate-200/50">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Created At',
        cell: ({ row }) => {
          const val = row.original.created_at;
          return (
            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <Calendar size={13} className="text-slate-400" />
              {new Date(val).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: () => (
          <div className="flex justify-end pr-2 text-slate-400">
            <ChevronRight size={15} />
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <VirtualTable<SubscriptionPlan>
        data={plans}
        columns={columns}
        rowCount={plans.length}
        isLoading={isLoading}
        onRowClick={
          canUpdate
            ? (row) => navigate({ to: `/admin/plans/${row.id}` })
            : undefined
        }
        emptyState={
          <div className="text-center py-12">
            <Shield size={36} className="text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-900">No subscription plans defined</p>
            <p className="text-xs text-slate-400 mt-1">Create a platform subscription tier to get started</p>
          </div>
        }
      />
    </div>
  );
}
