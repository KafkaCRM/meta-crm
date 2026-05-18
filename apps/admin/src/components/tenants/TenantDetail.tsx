import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTenant,
  suspendTenant,
  reactivateTenant,
  listPlans,
  assignPlan,
} from '@/api/platform';
import { useAuth } from '@/contexts/auth.context';
import { PlatformRole } from '@meta-crm/types';

interface TenantDetailProps {
  tenantId: string;
}

export function TenantDetail({ tenantId }: TenantDetailProps) {
  const { ability } = useAuth();
  const queryClient = useQueryClient();
  const [confirmName, setConfirmName] = useState('');
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [assignError, setAssignError] = useState('');

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => getTenant(tenantId),
  });

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
  });

  const suspendMutation = useMutation({
    mutationFn: () => suspendTenant(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      setShowSuspendDialog(false);
      setConfirmName('');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateTenant(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
    },
  });

  const assignPlanMutation = useMutation({
    mutationFn: () => assignPlan(tenantId, selectedPlanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      setAssignError('');
    },
    onError: () => {
      setAssignError('Failed to assign plan');
    },
  });

  const canSuspend = ability?.can('update', 'PlatformTenant') ?? false;
  const canAssignPlan = ability?.can('assign', 'PlatformPlan') ?? false;

  if (isLoading) {
    return <div className="py-12 text-center">Loading...</div>;
  }

  if (!tenant) {
    return <div className="py-12 text-center">Tenant not found</div>;
  }

  const handleSuspend = () => {
    if (confirmName !== tenant.name) return;
    suspendMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-lg bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{tenant.name}</h2>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
              tenant.status === 'active'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {tenant.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-500">Slug:</span>
            <p>{tenant.slug}</p>
          </div>
          <div>
            <span className="font-medium text-gray-500">Industry:</span>
            <p>{tenant.industry}</p>
          </div>
          <div>
            <span className="font-medium text-gray-500">Branches:</span>
            <p>{tenant.branch_count}</p>
          </div>
          <div>
            <span className="font-medium text-gray-500">Users:</span>
            <p>{tenant.user_count}</p>
          </div>
          <div>
            <span className="font-medium text-gray-500">Plugins:</span>
            <p>{tenant.plugin_list.length > 0 ? tenant.plugin_list.join(', ') : 'None'}</p>
          </div>
          <div>
            <span className="font-medium text-gray-500">Created:</span>
            <p>{new Date(tenant.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {canAssignPlan && (
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-4 text-lg font-semibold">Assign Plan</h3>
          <div className="flex items-center gap-4">
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select a plan...</option>
              {plans?.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {plan.max_branches} branches, {plan.max_users} users, {plan.max_plugins} plugins
                </option>
              ))}
            </select>
            <button
              onClick={() => assignPlanMutation.mutate()}
              disabled={!selectedPlanId || assignPlanMutation.isPending}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {assignPlanMutation.isPending ? 'Assigning...' : 'Assign'}
            </button>
          </div>
          {assignError && <p className="mt-2 text-sm text-red-600">{assignError}</p>}
        </div>
      )}

      {canSuspend && (
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-4 text-lg font-semibold">
            {tenant.status === 'active' ? 'Suspend Tenant' : 'Reactivate Tenant'}
          </h3>
          {tenant.status === 'active' ? (
            <>
              <p className="mb-3 text-sm text-gray-600">
                Suspending this tenant will block all login attempts. Type the tenant name to confirm.
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={`Type "${tenant.name}" to confirm`}
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={handleSuspend}
                  disabled={confirmName !== tenant.name || suspendMutation.isPending}
                  className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {suspendMutation.isPending ? 'Suspending...' : 'Suspend'}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => reactivateMutation.mutate()}
              disabled={reactivateMutation.isPending}
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {reactivateMutation.isPending ? 'Reactivating...' : 'Reactivate'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
