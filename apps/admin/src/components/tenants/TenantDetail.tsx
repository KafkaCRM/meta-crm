import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTenant,
  suspendTenant,
  reactivateTenant,
  listPlans,
  assignPlan,
  listPlugins,
  updateTenantEntitlements,
} from '@/api/platform';
import { useAuth } from '@/contexts/auth.context';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';

interface AdminLicenseManagerProps {
  tenantId: string;
  tenantIndustry: string;
  initialPluginIds: string[];
  canUpdate: boolean;
}

interface FormValues {
  pluginIds: string[];
}

function AdminLicenseManager({
  tenantId,
  tenantIndustry,
  initialPluginIds,
  canUpdate,
}: AdminLicenseManagerProps) {
  const queryClient = useQueryClient();

  const { data: allPlugins = [], isLoading: loadingPlugins } = useQuery({
    queryKey: ['platform-plugins'],
    queryFn: listPlugins,
  });

  const { control, handleSubmit } = useForm<FormValues>({
    values: {
      pluginIds: initialPluginIds,
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => updateTenantEntitlements(tenantId, data.pluginIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast.success('Tenant entitlements updated successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update entitlements');
    },
  });

  if (loadingPlugins) {
    return <div className="text-sm text-gray-500">Loading plugins...</div>;
  }

  const activePlugins = allPlugins.filter((p) => p.status === 'active');

  const onSubmit = (data: FormValues) => {
    updateMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        {activePlugins.map((plugin) => {
          const manifest = plugin.manifest;
          const isCompatible =
            manifest.compatible_industries.includes('*') ||
            manifest.compatible_industries
              .map((i) => i.toLowerCase())
              .includes(tenantIndustry.toLowerCase());

          if (!isCompatible) {
            return null;
          }

          const isLicensed = initialPluginIds.includes(plugin.id);

          return (
            <div
              key={plugin.id}
              className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0 gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{manifest.name}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                    v{plugin.version}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{manifest.description}</p>
              </div>

              <div className="flex-shrink-0 flex items-center justify-end min-w-[80px]">
                {canUpdate ? (
                  <Controller
                    name="pluginIds"
                    control={control}
                    render={({ field }) => {
                      const checked = field.value.includes(plugin.id);
                      return (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              field.onChange([...field.value, plugin.id]);
                            } else {
                              field.onChange(field.value.filter((id) => id !== plugin.id));
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      );
                    }}
                  />
                ) : (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      isLicensed
                        ? 'text-green-700 bg-green-50 border border-green-200'
                        : 'text-gray-500 bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {isLicensed ? 'Licensed' : 'Unlicensed'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canUpdate && (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Entitlements'}
          </button>
        </div>
      )}
    </form>
  );
}

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
  const canUpdateBilling = ability?.can('update', 'Billing') ?? false;

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

      <div className="rounded-lg bg-white p-6 shadow-md">
        <h3 className="mb-4 text-lg font-semibold">Tenant Plugins & Licensing</h3>
        <AdminLicenseManager
          tenantId={tenantId}
          tenantIndustry={tenant.industry}
          initialPluginIds={tenant.plugin_list}
          canUpdate={canUpdateBilling}
        />
      </div>

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
