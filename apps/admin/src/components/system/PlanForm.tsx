import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { listPlans, createPlan, updatePlan } from '@/api/platform';
import { useAuth } from '@/contexts/auth.context';
import { Shield, Sparkles, Building, Briefcase, GraduationCap, CheckSquare, Layers, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlanFormProps {
  planId?: string;
}

interface CapabilityItem {
  key: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
}

interface CapabilityCategory {
  categoryName: string;
  description: string;
  items: CapabilityItem[];
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
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Define categorized capabilities
  const capabilityCategories: CapabilityCategory[] = useMemo(
    () => [
      {
        categoryName: 'Real Estate & Housing',
        description: 'Property management, unit inventories, and leasing utilities',
        items: [
          {
            key: 'property',
            name: 'Property Management',
            description: 'Define real estate properties, track inspect logs, and handle leasing.',
            icon: Building,
          },
        ],
      },
      {
        categoryName: 'Education & Academics',
        description: 'Student catalogs, registration, and classroom operations',
        items: [
          {
            key: 'enrollment',
            name: 'Student Enrollment',
            description: 'Coordinate applicant pipelines, course catalogs, and grade records.',
            icon: GraduationCap,
          },
        ],
      },
      {
        categoryName: 'Professional Services',
        description: 'Time booking, scheduling, and consultant slots',
        items: [
          {
            key: 'appointment',
            name: 'Appointment Booking',
            description: 'Setup calendar services, handle customer slot reservations, and staff sync.',
            icon: CheckSquare,
          },
        ],
      },
      {
        categoryName: 'Finance & Invoicing',
        description: 'Payment collection and core platform accounting',
        items: [
          {
            key: 'billing',
            name: 'Tenant Invoicing & Billing',
            description: 'Dispatch invoices, handle stripe hooks, and view platform payments.',
            icon: Landmark,
          },
        ],
      },
      {
        categoryName: 'E-Commerce & Logistics',
        description: 'Retail stores, purchase processing, and orders tracking',
        items: [
          {
            key: 'order-management',
            name: 'Order Management',
            description: 'Track items stock levels, customer orders, and shipments.',
            icon: Briefcase,
          },
        ],
      },
      {
        categoryName: 'Core SaaS Operations',
        description: 'Platform baseline setup and operations',
        items: [
          {
            key: 'customer-onboarding',
            name: 'Customer Onboarding Checklists',
            description: 'Streamline signup documents, verification grids, and setup steps.',
            icon: Layers,
          },
        ],
      },
    ],
    []
  );

  // Default capabilities assigned depending on plan level
  const defaultCapabilitiesMap = useMemo(() => {
    return {
      starter: ['customer-onboarding', 'appointment'],
      professional: ['customer-onboarding', 'appointment', 'property', 'enrollment'],
      enterprise: ['customer-onboarding', 'appointment', 'property', 'enrollment', 'billing', 'order-management'],
    };
  }, []);

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

      // Match capability keys based on name or assign defaults
      const lowName = plan.name.toLowerCase();
      if (lowName.includes('starter') || lowName.includes('free')) {
        setSelectedCapabilities(defaultCapabilitiesMap.starter);
      } else if (lowName.includes('professional') || lowName.includes('pro')) {
        setSelectedCapabilities(defaultCapabilitiesMap.professional);
      } else {
        setSelectedCapabilities(defaultCapabilitiesMap.enterprise);
      }
    } else if (!planId) {
      // Create mode default
      setSelectedCapabilities(defaultCapabilitiesMap.starter);
    }
  }, [plan, planId, defaultCapabilitiesMap]);

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
      toast.success(
        planId 
          ? `Plan '${name}' entitlements and capabilities updated successfully` 
          : `Plan '${name}' provisioned successfully`
      );
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

  const handleToggleCapability = (key: string) => {
    if (isReadOnly) return;
    setSelectedCapabilities((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  if (planId && loadingPlans) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-border border-t-indigo-600 rounded-full animate-spin" />
        <span className="text-xs text-muted-foreground">Loading plan metadata…</span>
      </div>
    );
  }

  if (planId && !plan && !loadingPlans) {
    return (
      <div className="text-center py-12 text-red-600 font-semibold">
        Platform subscription plan not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-800 font-medium">
          You do not have administrative write permissions for platform plans. Viewing in read-only mode.
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Plan Name */}
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase">
              Plan Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!planId || isReadOnly}
              className="w-full rounded-lg border border-border bg-card px-3.5 py-2 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-muted disabled:text-muted-foreground font-semibold"
              placeholder="e.g. Pro, Enterprise Tier"
              required
            />
            {planId && (
              <p className="text-[10px] text-muted-foreground">System core tags cannot be adjusted post creation.</p>
            )}
          </div>

          {/* Pricing */}
          <div className="space-y-1.5">
            <label htmlFor="price" className="text-xs font-semibold text-muted-foreground uppercase">
              Monthly Pricing ($ USD)
            </label>
            <input
              id="price"
              type="number"
              value={priceMonthly}
              onChange={(e) => setPriceMonthly(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={isReadOnly}
              className="w-full rounded-lg border border-border bg-card px-3.5 py-2 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-muted disabled:text-muted-foreground font-semibold"
              placeholder="0.00 (Free)"
              min={0}
              step="any"
            />
          </div>
        </div>

        {/* Core quotas */}
        <div className="bg-muted p-4 border border-border rounded-xl space-y-4">
          <div className="flex items-center gap-1.5 pb-2 border-b border-border">
            <Shield size={14} className="text-fin-orange" />
            <h4 className="text-xs font-bold text-foreground/80 uppercase tracking-wider">Plan Quota Restrictions</h4>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="maxBranches" className="text-[10px] font-bold text-muted-foreground uppercase">
                Max Branches
              </label>
              <input
                id="maxBranches"
                type="number"
                value={maxBranches}
                onChange={(e) => setMaxBranches(Number(e.target.value))}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground font-mono font-bold focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                min={1}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="maxUsers" className="text-[10px] font-bold text-muted-foreground uppercase">
                Max Active Users
              </label>
              <input
                id="maxUsers"
                type="number"
                value={maxUsers}
                onChange={(e) => setMaxUsers(Number(e.target.value))}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground font-mono font-bold focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                min={1}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="maxPlugins" className="text-[10px] font-bold text-muted-foreground uppercase">
                Max Plugin Installs
              </label>
              <input
                id="maxPlugins"
                type="number"
                value={maxPlugins}
                onChange={(e) => setMaxPlugins(Number(e.target.value))}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground font-mono font-bold focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                min={0}
                required
              />
            </div>
          </div>
        </div>

        {/* Entitlements Checklist grouped by industry */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-fin-orange animate-pulse" />
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Plan Entitlements / Allowed CRM Capabilities</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Specify which modules are bundled inside this plan. Tenants will only be able to activate capabilities selected below.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {capabilityCategories.map((category) => (
              <div
                key={category.categoryName}
                className="p-4 rounded-xl border border-border bg-card hover:border-slate-300 transition-all space-y-3"
              >
                <div>
                  <h5 className="text-xs font-bold text-foreground">{category.categoryName}</h5>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{category.description}</p>
                </div>

                <div className="space-y-2">
                  {category.items.map((item) => {
                    const isChecked = selectedCapabilities.includes(item.key);
                    const IconComp = item.icon;
                    return (
                      <div
                        key={item.key}
                        onClick={() => handleToggleCapability(item.key)}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'border-indigo-500 bg-fin-orange/10/20'
                            : 'border-border/50 bg-muted/30 hover:border-border'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center border transition-colors ${
                          isChecked
                            ? 'bg-fin-orange/100 border-indigo-600 text-white'
                            : 'bg-card border-border text-muted-foreground'
                        }`}>
                          <IconComp size={13} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">{item.name}</span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              disabled={isReadOnly}
                              className="rounded border-slate-300 text-fin-orange focus:ring-indigo-500 h-3.5 w-3.5"
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">{item.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-border/50 pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: '/admin/plans' })}
            className="h-9 px-4 text-xs font-semibold hover:bg-muted border-border text-foreground/80 rounded-lg"
          >
            {isReadOnly ? 'Back' : 'Cancel'}
          </Button>
          {!isReadOnly && (
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="h-9 px-5 text-xs font-bold bg-fin-orange hover:bg-fin-orange/90 text-white rounded-lg"
            >
              {mutation.isPending ? 'Saving Plan…' : 'Save Plan & Capabilities'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
