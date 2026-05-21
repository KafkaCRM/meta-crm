import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { VirtualTable } from '@meta-crm/ui';
import { listPlans, SubscriptionPlan } from '@/api/platform';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/contexts/auth.context';

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
          <span className="font-semibold text-gray-900">{row.original.name}</span>
        ),
      },
      {
        accessorKey: 'price_monthly',
        header: 'Monthly Price',
        cell: ({ row }) => {
          const val = row.original.price_monthly;
          if (val === null || val === undefined) return 'Free';
          if (val === 0) return 'Free';
          return `$${val.toFixed(2)}/mo`;
        },
      },
      {
        accessorKey: 'max_branches',
        header: 'Max Branches',
      },
      {
        accessorKey: 'max_users',
        header: 'Max Users',
      },
      {
        accessorKey: 'max_plugins',
        header: 'Max Plugins',
      },
      {
        accessorKey: 'created_at',
        header: 'Created At',
        cell: ({ row }) => {
          const val = row.original.created_at;
          return new Date(val).toLocaleDateString();
        },
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
          <div className="text-center py-8">
            <p className="text-lg font-medium text-[#111111]">No subscription plans defined</p>
            <p className="text-sm text-gray-500">Create a plan to get started</p>
          </div>
        }
      />
    </div>
  );
}
