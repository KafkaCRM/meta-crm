import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { listPlans, createPlan, updatePlan } from '@/api/platform';
import { useAuth } from '@/contexts/auth.context';

interface PlanFormProps {
  planId?: string;
}

export function PlanForm({ planId }: PlanFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { ability } = useAuth();

  const canUpdate = ability?.can('update', 'PlatformPlan') ?? false;
  const canCreate = ability?.can('create', 'PlatformPlan') ?? false;
  const isReadOnly = planId ? !canUpdate : !canCreate;

  const [name, setName] = useState('');
  const [maxBranches, setMaxBranches] = useState(1);
  const [maxUsers, setMaxUsers] = useState(1);
  const [maxPlugins, setMaxPlugins] = useState(0);
  const [priceMonthly, setPriceMonthly] = useState<number | ''>('');
  const [error, setError] = useState('');

  // Find the plan from the list of plans
  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
    enabled: !!planId,
  });

  const plan = useMemo(() => {
    return plans.find((p) => p.id === planId);
  }, [plans, planId]);

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setMaxBranches(plan.max_branches);
      setMaxUsers(plan.max_users);
      setMaxPlugins(plan.max_plugins);
      setPriceMonthly(
        plan.price_monthly !== null && plan.price_monthly !== undefined
          ? parseFloat(String(plan.price_monthly))
          : ''
      );
    }
  }, [plan]);

  const mutation = useMutation({
    mutationFn: async () => {
      const price = priceMonthly === '' ? undefined : Number(priceMonthly);
      if (planId) {
        return updatePlan(planId, {
          max_branches: maxBranches,
          max_users: maxUsers,
          max_plugins: maxPlugins,
          price_monthly: price,
        });
      } else {
        return createPlan({
          name: name.trim(),
          max_branches: maxBranches,
          max_users: maxUsers,
          max_plugins: maxPlugins,
          price_monthly: price,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast.success(planId ? 'Plan updated successfully' : 'Plan created successfully');
      navigate({ to: '/admin/plans' });
    },
    onError: (err: any) => {
      setError(err.message ?? 'An error occurred while saving the plan');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!planId && !name.trim()) {
      setError('Plan name is required');
      return;
    }
    if (maxBranches < 1) {
      setError('Max branches must be at least 1');
      return;
    }
    if (maxUsers < 1) {
      setError('Max users must be at least 1');
      return;
    }
    if (maxPlugins < 0) {
      setError('Max plugins must be at least 0');
      return;
    }
    if (priceMonthly !== '' && Number(priceMonthly) < 0) {
      setError('Price cannot be negative');
      return;
    }

    mutation.mutate();
  };

  if (planId && loadingPlans) {
    return <div className="text-center py-6">Loading plan details...</div>;
  }

  if (planId && !plan && !loadingPlans) {
    return (
      <div className="text-center py-6 text-red-600">
        Plan not found or could not be loaded.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isReadOnly && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          You do not have permission to modify platform plans. Viewing in read-only mode.
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
            Plan Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!!planId || isReadOnly}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="e.g. Starter, Enterprise"
            required
          />
          {planId && (
            <p className="mt-1 text-xs text-gray-500">Plan name cannot be modified after creation.</p>
          )}
        </div>

        {/* Pricing */}
        <div>
          <label htmlFor="price" className="mb-1 block text-sm font-medium text-gray-700">
            Monthly Price ($ USD, optional)
          </label>
          <input
            id="price"
            type="number"
            value={priceMonthly}
            onChange={(e) => setPriceMonthly(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={isReadOnly}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="0.00 (Free)"
            min={0}
            step="any"
          />
        </div>

        {/* Max Branches */}
        <div>
          <label htmlFor="maxBranches" className="mb-1 block text-sm font-medium text-gray-700">
            Max Branches
          </label>
          <input
            id="maxBranches"
            type="number"
            value={maxBranches}
            onChange={(e) => setMaxBranches(Number(e.target.value))}
            disabled={isReadOnly}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
            min={1}
            required
          />
        </div>

        {/* Max Users */}
        <div>
          <label htmlFor="maxUsers" className="mb-1 block text-sm font-medium text-gray-700">
            Max Users
          </label>
          <input
            id="maxUsers"
            type="number"
            value={maxUsers}
            onChange={(e) => setMaxUsers(Number(e.target.value))}
            disabled={isReadOnly}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
            min={1}
            required
          />
        </div>

        {/* Max Plugins */}
        <div>
          <label htmlFor="maxPlugins" className="mb-1 block text-sm font-medium text-gray-700">
            Max Plugins
          </label>
          <input
            id="maxPlugins"
            type="number"
            value={maxPlugins}
            onChange={(e) => setMaxPlugins(Number(e.target.value))}
            disabled={isReadOnly}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
            min={0}
            required
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t pt-4">
          <button
            type="button"
            onClick={() => navigate({ to: '/admin/plans' })}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            {isReadOnly ? 'Back' : 'Cancel'}
          </button>
          {!isReadOnly && (
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : 'Save Plan'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
