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
  updateTenantCapabilities,
  resetTenantOwnerPassword,
  updateTenantOverrides,
  type TenantDetail as TenantDetailInfo,
} from '@/api/platform';
import { useAuth } from '@/contexts/auth.context';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';
import {
  Building,
  Globe,
  Users,
  Calendar,
  Puzzle,
  Sparkles,
  AlertTriangle,
  Key,
  Copy,
  Check,
  ShieldAlert,
  ArrowUpRight,
  CheckCircle2,
  RefreshCw,
  Layers,
  Zap,
  Landmark,
  GraduationCap,
  Home,
  ShoppingBag,
  ClipboardList,
  Shield,
  Power,
  Heart,
  Laptop,
  Mail,
  UserCheck,
  CreditCard
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Industry Icon Helper                                              */
/* ------------------------------------------------------------------ */
const getIndustryIcon = (industry: string) => {
  switch (industry?.toLowerCase()) {
    case 'education':
      return GraduationCap;
    case 'healthcare':
      return Heart;
    case 'real-estate':
      return Home;
    case 'retail':
      return ShoppingBag;
    case 'finance':
      return Landmark;
    case 'technology':
      return Laptop;
    default:
      return Building;
  }
};

/* ------------------------------------------------------------------ */
/*  Plugin Registry (Extensions) Manager                              */
/* ------------------------------------------------------------------ */
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

  const { handleSubmit, setValue, watch } = useForm<FormValues>({
    values: {
      pluginIds: initialPluginIds,
    },
  });

  const selectedPluginIds = watch('pluginIds') || [];

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => updateTenantEntitlements(tenantId, data.pluginIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast.success('Workspace extensions saved successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save extensions');
    },
  });

  if (loadingPlugins) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-slate-400">
        <RefreshCw size={13} className="animate-spin text-slate-400" />
        Syncing plugin registry…
      </div>
    );
  }

  const activePlugins = allPlugins.filter((p) => p.status === 'active');
  const compatiblePlugins = activePlugins.filter((plugin) => {
    const manifest = plugin.manifest;
    return (
      manifest.compatible_industries.includes('*') ||
      manifest.compatible_industries
        .map((i) => i.toLowerCase())
        .includes(tenantIndustry.toLowerCase())
    );
  });

  const onSubmit = (data: FormValues) => {
    updateMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {compatiblePlugins.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <Puzzle size={22} className="mx-auto text-slate-400 mb-2.5" />
          <p className="text-xs font-semibold text-slate-900">No extensions available</p>
          <p className="text-[10px] text-slate-400 mt-0.5">There are no plugins compatible with the {tenantIndustry} scope yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {compatiblePlugins.map((plugin) => {
            const manifest = plugin.manifest;
            const isLicensed = selectedPluginIds.includes(plugin.id);

            return (
              <div
                key={plugin.id}
                onClick={() => {
                  if (!canUpdate) return;
                  if (isLicensed) {
                    setValue('pluginIds', selectedPluginIds.filter((id) => id !== plugin.id));
                  } else {
                    setValue('pluginIds', [...selectedPluginIds, plugin.id]);
                  }
                }}
                className={`group relative flex flex-col justify-between p-4 rounded-xl border transition-all select-none min-h-[110px] ${
                  isLicensed
                    ? 'bg-indigo-50/40 border-indigo-600 ring-[0.5px] ring-indigo-600'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                } ${canUpdate ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-900 tracking-tight">{manifest.name}</span>
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-mono font-medium">
                          v{plugin.version}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">{manifest.description}</p>
                    </div>
                    
                    {/* Custom Checkbox */}
                    <div className="flex-shrink-0 mt-0.5">
                      {isLicensed ? (
                        <div className="w-4 h-4 rounded bg-indigo-600 text-white flex items-center justify-center animate-in zoom-in-50 duration-150">
                          <Check size={10} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded border border-slate-200 bg-white group-hover:border-slate-400 transition-colors" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-100 pt-2 font-mono">
                  <span>{plugin.package_name}</span>
                  {!canUpdate && (
                    <span className={isLicensed ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                      {isLicensed ? 'Licensed' : 'Disabled'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canUpdate && compatiblePlugins.length > 0 && (
        <div className="flex justify-end pt-2 border-t border-slate-200">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            {updateMutation.isPending ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving Extensions...
              </>
            ) : (
              <>
                <Sparkles size={13} />
                Save Extensions
              </>
            )}
          </button>
        </div>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Capabilities Grid                                                 */
/* ------------------------------------------------------------------ */
const ALL_CAPABILITIES = [
  {
    id: 'capability/enrollment',
    name: 'Enrollment & Admissions',
    description: 'Enables academic courses, cohort tracking, and enrollment workflow stages.',
    industry: 'education',
  },
  {
    id: 'capability/appointment',
    name: 'Appointments & Scheduling',
    description: 'Adds appointments, slots, availability schedules, and calendar view.',
    industry: 'healthcare',
  },
  {
    id: 'capability/billing',
    name: 'Invoicing & Financial Ledger',
    description: 'Adds invoice documents, line items, payments, and billing ledger.',
    industry: 'finance',
  },
  {
    id: 'capability/property-listing',
    name: 'Property Listings',
    description: 'Adds property coordinates, bedrooms, floor plans, and listing status.',
    industry: 'real-estate',
  },
  {
    id: 'capability/order-management',
    name: 'Order Management',
    description: 'Adds order creation, product line items, payment status, and order tracking.',
    industry: 'retail',
  },
  {
    id: 'capability/customer-onboarding',
    name: 'Customer Onboarding',
    description: 'Adds multi-step customer onboarding workflows, tracking setup steps and contract values.',
    industry: 'technology',
  },
];

const CAPABILITY_ICONS: Record<string, any> = {
  'capability/enrollment': GraduationCap,
  'capability/appointment': Calendar,
  'capability/billing': CreditCard,
  'capability/property-listing': Home,
  'capability/order-management': ShoppingBag,
  'capability/customer-onboarding': ClipboardList,
};

const CAPABILITY_INDUSTRY_THEME: Record<string, { bg: string; text: string; dot: string }> = {
  healthcare: { bg: 'bg-emerald-50/50 border-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  finance: { bg: 'bg-amber-50/50 border-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
  technology: { bg: 'bg-sky-50/50 border-sky-100', text: 'text-sky-800', dot: 'bg-sky-500' },
  retail: { bg: 'bg-orange-50/50 border-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
  education: { bg: 'bg-violet-50/50 border-violet-100', text: 'text-violet-800', dot: 'bg-violet-500' },
  'real-estate': { bg: 'bg-rose-50/50 border-rose-100', text: 'text-rose-800', dot: 'bg-rose-500' },
};

interface AdminCapabilityManagerProps {
  tenantId: string;
  tenantIndustry: string;
  initialCapabilities: string[];
  canUpdate: boolean;
}

interface CapabilityFormValues {
  capabilities: string[];
}

function AdminCapabilityManager({
  tenantId,
  tenantIndustry,
  initialCapabilities,
  canUpdate,
}: AdminCapabilityManagerProps) {
  const queryClient = useQueryClient();

  const { handleSubmit, setValue, watch } = useForm<CapabilityFormValues>({
    values: {
      capabilities: initialCapabilities,
    },
  });

  const selectedCapabilities = watch('capabilities') || [];

  const updateMutation = useMutation({
    mutationFn: (data: CapabilityFormValues) => updateTenantCapabilities(tenantId, data.capabilities),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast.success('Workspace capabilities saved successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save capabilities');
    },
  });

  const onSubmit = (data: CapabilityFormValues) => {
    updateMutation.mutate(data);
  };

  const recommendedCaps = ALL_CAPABILITIES.filter(
    (cap) => cap.industry.toLowerCase() === tenantIndustry?.toLowerCase()
  );
  const otherCaps = ALL_CAPABILITIES.filter(
    (cap) => cap.industry.toLowerCase() !== tenantIndustry?.toLowerCase()
  );

  const renderCard = (cap: typeof ALL_CAPABILITIES[0], isRecommended: boolean) => {
    const isEnabled = selectedCapabilities.includes(cap.id);
    const CapIcon = CAPABILITY_ICONS[cap.id] || Zap;
    const theme = CAPABILITY_INDUSTRY_THEME[cap.industry] || {
      bg: 'bg-gray-50/50 border-gray-100',
      text: 'text-gray-800',
      dot: 'bg-gray-500',
    };

    return (
      <div
        key={cap.id}
        onClick={() => {
          if (!canUpdate) return;
          if (isEnabled) {
            setValue('capabilities', selectedCapabilities.filter((id) => id !== cap.id));
          } else {
            setValue('capabilities', [...selectedCapabilities, cap.id]);
          }
        }}
        className={`group relative flex flex-col justify-between p-4 rounded-xl border transition-all select-none min-h-[135px] ${
          isEnabled
            ? isRecommended
              ? 'bg-indigo-50/30 border-indigo-600 ring-[0.5px] ring-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.08)]'
              : 'bg-indigo-50/30 border-indigo-600 ring-[0.5px] ring-indigo-600'
            : isRecommended
              ? 'bg-white border-indigo-100 hover:border-indigo-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
        } ${canUpdate ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            {/* Left: Capability Icon Block */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
              isEnabled 
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                : 'bg-slate-50 text-slate-500 border border-slate-200'
            }`}>
              <CapIcon size={16} />
            </div>

            {/* Right: Checkbox and Details */}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 tracking-tight">{cap.name}</span>
                <div className="flex-shrink-0">
                  {isEnabled ? (
                    <div className="w-4 h-4 rounded text-white flex items-center justify-center animate-in zoom-in-50 duration-150 bg-indigo-600">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  ) : (
                    <div className={`w-4 h-4 rounded border bg-white transition-colors ${
                      isRecommended ? 'border-indigo-300 group-hover:border-indigo-400' : 'border-slate-200 group-hover:border-slate-400'
                    }`} />
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">{cap.description}</p>
            </div>
          </div>
        </div>

        {/* Footer info: ID name and Dynamic colored industry badges */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[9px] text-slate-400">{cap.id.split('/')[1]}</span>
            <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.25 text-[8px] font-semibold uppercase tracking-wider ${theme.bg} ${theme.text}`}>
              <span className={`h-1 w-1 rounded-full ${theme.dot}`} />
              {cap.industry}
            </span>
          </div>
          
          {isRecommended && (
            <span className="inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded shadow-sm">
              ★ Core Scope
            </span>
          )}

          {!canUpdate && (
            <span className={`text-[9px] font-mono ${isEnabled ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
              {isEnabled ? 'Enabled' : 'Disabled'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Recommended Core Industry Scope */}
      {recommendedCaps.length > 0 && (
        <div className="space-y-3.5">
          <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={12} className="text-indigo-500 animate-pulse" />
            Recommended Core Scope
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendedCaps.map((cap) => renderCard(cap, true))}
          </div>
        </div>
      )}

      {/* Additional Cross-Domain Add-ons */}
      {otherCaps.length > 0 && (
        <div className="space-y-3.5 pt-1.5">
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Layers size={12} className="text-slate-400" />
            Additional Cross-Domain Add-ons
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherCaps.map((cap) => renderCard(cap, false))}
          </div>
        </div>
      )}

      {canUpdate && (
        <div className="flex justify-end pt-2 border-t border-slate-200">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            {updateMutation.isPending ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving Capabilities...
              </>
            ) : (
              <>
                <Sparkles size={13} />
                Save Capabilities
              </>
            )}
          </button>
        </div>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Tenant custom limits overrides panel                              */
/* ------------------------------------------------------------------ */
interface AdminOverridesManagerProps {
  tenantId: string;
  tenantData: TenantDetailInfo;
  canUpdate: boolean;
}

function AdminOverridesManager({ tenantId, tenantData, canUpdate }: AdminOverridesManagerProps) {
  const queryClient = useQueryClient();
  const plan = tenantData.plan;
  const customLimits = tenantData.custom_limits ?? {};

  // Form states
  const [maxUsers, setMaxUsers] = useState<string>(
    customLimits.max_users !== undefined ? String(customLimits.max_users) : ''
  );
  const [maxBranches, setMaxBranches] = useState<string>(
    customLimits.max_branches !== undefined ? String(customLimits.max_branches) : ''
  );

  const [overrideUsers, setOverrideUsers] = useState<boolean>(customLimits.max_users !== undefined);
  const [overrideBranches, setOverrideBranches] = useState<boolean>(customLimits.max_branches !== undefined);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, any>) => updateTenantOverrides(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast.success('Custom limits overrides updated successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update custom limits');
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Record<string, any> = {};

    if (overrideUsers && maxUsers.trim() !== '') {
      payload.max_users = parseInt(maxUsers, 10);
    } else {
      payload.max_users = null; // Clear override
    }

    if (overrideBranches && maxBranches.trim() !== '') {
      payload.max_branches = parseInt(maxBranches, 10);
    } else {
      payload.max_branches = null; // Clear override
    }

    updateMutation.mutate(payload);
  };

  const resolvedMaxUsers = overrideUsers && maxUsers !== '' ? maxUsers : (plan?.max_users ?? '5');
  const resolvedMaxBranches = overrideBranches && maxBranches !== '' ? maxBranches : (plan?.max_branches ?? '1');

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Seat Limits */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
            <Users size={12} className="text-slate-500" />
            Seat Limit Override
          </label>
          <div className="flex items-center gap-1.5 select-none">
            <input
              type="checkbox"
              id="overrideUsers"
              checked={overrideUsers}
              disabled={!canUpdate}
              onChange={(e) => setOverrideUsers(e.target.checked)}
              className="rounded border-slate-200 text-indigo-600 focus:ring-indigo-600 h-3.5 w-3.5 cursor-pointer"
            />
            <label htmlFor="overrideUsers" className="text-[10px] text-slate-400 font-medium cursor-pointer">
              Custom Seat Limit
            </label>
          </div>
        </div>

        {overrideUsers ? (
          <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
            <input
              type="number"
              min="1"
              max="10000"
              value={maxUsers}
              disabled={!canUpdate}
              onChange={(e) => setMaxUsers(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all"
              placeholder="Enter custom maximum seats..."
            />
            <p className="text-[9px] text-indigo-600 font-medium leading-none">
              Overriding default plan limit of {plan?.max_users ?? '5'} seats.
            </p>
          </div>
        ) : (
          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] text-slate-500 flex justify-between select-none">
            <span>Inheriting plan default:</span>
            <span className="font-semibold text-slate-800">{plan?.max_users ?? '5'} Seats</span>
          </div>
        )}
      </div>

      {/* Branch Limits */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
            <Building size={12} className="text-slate-500" />
            Branch Limit Override
          </label>
          <div className="flex items-center gap-1.5 select-none">
            <input
              type="checkbox"
              id="overrideBranches"
              checked={overrideBranches}
              disabled={!canUpdate}
              onChange={(e) => setOverrideBranches(e.target.checked)}
              className="rounded border-slate-200 text-indigo-600 focus:ring-indigo-600 h-3.5 w-3.5 cursor-pointer"
            />
            <label htmlFor="overrideBranches" className="text-[10px] text-slate-400 font-medium cursor-pointer">
              Custom Branch Limit
            </label>
          </div>
        </div>

        {overrideBranches ? (
          <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
            <input
              type="number"
              min="1"
              max="1000"
              value={maxBranches}
              disabled={!canUpdate}
              onChange={(e) => setMaxBranches(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all"
              placeholder="Enter custom maximum branches..."
            />
            <p className="text-[9px] text-indigo-600 font-medium leading-none">
              Overriding default plan limit of {plan?.max_branches ?? '1'} branches.
            </p>
          </div>
        ) : (
          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] text-slate-500 flex justify-between select-none">
            <span>Inheriting plan default:</span>
            <span className="font-semibold text-slate-800">{plan?.max_branches ?? '1'} Branch</span>
          </div>
        )}
      </div>

      {/* Resolved ceilings summary info */}
      <div className="p-2.5 bg-slate-50/50 border border-slate-200/50 rounded-lg space-y-1">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Resolved Active Ceilings</span>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Max User Capacity</span>
          <span className="font-bold text-slate-900 font-mono">{resolvedMaxUsers} Seats</span>
        </div>
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 mt-1">
          <span className="text-slate-500 font-medium">Max Branch Capacity</span>
          <span className="font-bold text-slate-900 font-mono">{resolvedMaxBranches} Branches</span>
        </div>
      </div>

      {canUpdate && (
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
        >
          {updateMutation.isPending ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              Saving Overrides...
            </>
          ) : (
            <>
              <Sparkles size={13} />
              Save Limits Overrides
            </>
          )}
        </button>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */
interface TenantDetailProps {
  tenantId: string;
}

export function TenantDetail({ tenantId }: TenantDetailProps) {
  const { ability } = useAuth();
  const queryClient = useQueryClient();
  
  const [confirmName, setConfirmName] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [assignError, setAssignError] = useState('');
  
  // Owner Credentials Reset states
  const [resetResult, setResetResult] = useState<{ email: string; temporary_password: string } | null>(null);
  const [resetCopied, setResetCopied] = useState(false);

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
      setConfirmName('');
      toast.success('Workspace suspended successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to suspend workspace');
    }
  });

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateTenant(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast.success('Workspace reactivated successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reactivate workspace');
    }
  });

  const assignPlanMutation = useMutation({
    mutationFn: () => assignPlan(tenantId, selectedPlanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      setAssignError('');
      toast.success('Subscription plan reassigned successfully');
    },
    onError: () => {
      setAssignError('Failed to reassign plan entitlement');
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetTenantOwnerPassword(tenantId),
    onSuccess: (data) => {
      setResetResult(data);
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast.success('Owner credentials regenerated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to regenerate owner credentials');
    },
  });

  const handleCopyResetPassword = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setResetCopied(true);
      toast.success('Regenerated password copied to clipboard!');
      setTimeout(() => setResetCopied(false), 3000);
    } catch (err) {
      toast.error('Failed to copy credentials');
    }
  };

  const canSuspend = ability?.can('update', 'PlatformTenant') ?? false;
  const canAssignPlan = ability?.can('assign', 'PlatformPlan') ?? false;
  const canUpdateBilling = ability?.can('update', 'Billing') ?? false;

  if (isLoading) {
    return (
      <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
        <RefreshCw size={24} className="animate-spin text-slate-400" />
        <span className="text-xs text-slate-400 font-medium">Retrieving workspace parameters…</span>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="py-16 text-center border border-slate-200 rounded-xl bg-white max-w-md mx-auto">
        <AlertTriangle size={28} className="text-amber-500 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-slate-900">Tenant Parameters Missing</h3>
        <p className="text-xs text-slate-400 mt-1">This workspace tenant may have been deprovisioned or does not exist.</p>
      </div>
    );
  }

  const handleSuspend = () => {
    if (confirmName !== tenant.name) return;
    suspendMutation.mutate();
  };

  const TenantIndustryIcon = getIndustryIcon(tenant.industry);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* LEFT COLUMN: Main Configurations */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Core Details Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                <TenantIndustryIcon size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">{tenant.name}</h2>
                <p className="text-[10px] text-slate-400 font-mono leading-none mt-1">ID: {tenant.id}</p>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold capitalize border ${
                tenant.status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                  : 'bg-rose-50 text-rose-700 border-rose-200/60'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${tenant.status === 'active' ? 'bg-emerald-600' : 'bg-rose-600'}`} />
              {tenant.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* Slug / Domain */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-medium block">Workspace Domain</span>
              <a
                href={`https://${tenant.slug}.meta-crm.local`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-slate-900 flex items-center gap-1 hover:underline select-all font-mono text-[11px]"
              >
                <Globe size={13} className="text-slate-500" />
                https://{tenant.slug}.meta-crm.local
                <ArrowUpRight size={10} className="text-slate-400" />
              </a>
            </div>

            {/* Industry Scope */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-medium block">Industry Scope</span>
              <span className="font-semibold text-slate-900 flex items-center gap-1.5 capitalize">
                <TenantIndustryIcon size={13} className="text-slate-500" />
                {tenant.industry}
              </span>
            </div>

            {/* Capacity Usage */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <span className="text-slate-400 font-medium block">Active Capacity</span>
              <div className="flex items-center gap-4 text-slate-900 font-semibold">
                <span className="flex items-center gap-1">
                  <Layers size={13} className="text-slate-400" />
                  {tenant.branch_count} Branches
                </span>
                <span className="flex items-center gap-1">
                  <Users size={13} className="text-slate-400" />
                  {tenant.user_count} Users
                </span>
              </div>
            </div>

            {/* Created On */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-slate-400 font-medium block">Provisioned Date</span>
              <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-500" />
                {new Date(tenant.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </span>
            </div>
          </div>
        </div>

        {/* Extensions Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Puzzle size={15} className="text-slate-500" />
              Workspace Extensions
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Enable or disable plugin registries compatible with this workspace industry template.</p>
          </div>
          <AdminLicenseManager
            tenantId={tenantId}
            tenantIndustry={tenant.industry}
            initialPluginIds={tenant.plugin_ids ?? []}
            canUpdate={canUpdateBilling}
          />
        </div>

        {/* Capabilities Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Zap size={15} className="text-slate-500" />
              Product Capabilities
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Toggle high-level functional parameters and tenant feature flags.</p>
          </div>
          <AdminCapabilityManager
            tenantId={tenantId}
            tenantIndustry={tenant.industry}
            initialCapabilities={tenant.enabled_capabilities ?? []}
            canUpdate={canSuspend}
          />
        </div>
      </div>

      {/* RIGHT COLUMN: Quick Actions & System Overrides */}
      <div className="space-y-6">
        
        {/* Support Impersonation Banner */}
        <Link 
          to="/admin/tenants/$id/impersonate" 
          params={{ id: tenantId }}
          className="block"
        >
          <div className="border border-slate-200 bg-white rounded-xl p-4 flex items-center justify-between hover:bg-slate-50 hover:border-slate-300 transition-all group cursor-pointer shadow-sm">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-900 block">Support Impersonation</span>
              <span className="text-[10px] text-slate-400 block leading-none">View read-only configuration portal.</span>
            </div>
            <ArrowUpRight size={14} className="text-slate-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
          </div>
        </Link>

        {/* Owner Credentials Widget */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
              <Shield size={14} className="text-slate-500" />
              Administrative Access
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Regenerate and secure the credentials of the workspace owner account.</p>
          </div>

          {!resetResult ? (
            <button
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              {resetMutation.isPending ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Generating key…
                </>
              ) : (
                <>
                  <Key size={13} />
                  Reset Owner Password
                </>
              )}
            </button>
          ) : (
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* Alert Widget */}
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                <p className="text-[11px] font-semibold flex items-center gap-1">
                  <ShieldAlert size={12} className="flex-shrink-0" />
                  New Password Generated
                </p>
                <p className="text-[10px] text-amber-700/90 leading-normal">
                  Write this temporary credentials record down. It has been updated in the core database and is shown once.
                </p>
              </div>

              {/* Account details copy card */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-2.5">
                <div className="text-[10px]">
                  <span className="text-slate-400 font-medium block">Owner Username</span>
                  <span className="font-semibold text-slate-900 block flex items-center gap-1 mt-0.5 select-all font-mono text-[11px]">
                    <Mail size={12} className="text-slate-400" />
                    {resetResult.email}
                  </span>
                </div>

                <div className="text-[10px] border-t border-slate-100 pt-2">
                  <span className="text-slate-400 font-medium block">Temporary Access Key</span>
                  <div className="flex items-center justify-between gap-2 mt-1 bg-white border border-slate-200 rounded-md p-1.5 pl-2">
                    <span className="font-mono text-xs font-bold text-slate-800 select-all tracking-wider">
                      {resetResult.temporary_password}
                    </span>
                    <button
                      onClick={() => handleCopyResetPassword(resetResult.temporary_password)}
                      className={`p-1 rounded-md border transition-all ${
                        resetCopied
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {resetCopied ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setResetResult(null)}
                className="w-full py-1.5 rounded-lg border border-slate-200 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
              >
                Clear Results Block
              </button>
            </div>
          )}
        </div>

        {/* Subscription Plan Card */}
        {canAssignPlan && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3.5">
            <div>
              <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                <CreditCard size={14} className="text-slate-500" />
                Subscription Plan
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Assign plan entitlement parameters to expand branch, user, and extension limit flags.</p>
            </div>

            <div className="space-y-3">
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all cursor-pointer"
              >
                <option value="">Select a subscription plan...</option>
                {plans?.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} ({plan.max_branches}b, {plan.max_users}u)
                  </option>
                ))}
              </select>

              <button
                onClick={() => assignPlanMutation.mutate()}
                disabled={!selectedPlanId || assignPlanMutation.isPending}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                {assignPlanMutation.isPending ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Reassigning plan ceiling…
                  </>
                ) : (
                  <>
                    <UserCheck size={13} />
                    Assign Entitlements
                  </>
                )}
              </button>
            </div>
            {assignError && <p className="text-[10px] text-rose-600 text-center font-medium mt-1">{assignError}</p>}
          </div>
        )}

        {/* Custom Overrides & Capacity Limits */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3.5">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
              <Zap size={14} className="text-slate-500" />
              Custom Overrides & Limits
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Override standard tier ceilings for user seats and workspace branch allocations.</p>
          </div>

          <AdminOverridesManager
            tenantId={tenantId}
            tenantData={tenant}
            canUpdate={canSuspend}
          />
        </div>

        {/* Danger Zone / Suspend */}
        {canSuspend && (
          <div className="bg-white border border-rose-200 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-rose-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Power size={14} className="text-rose-700" />
                Danger Zone
              </h3>
              <p className="text-[10px] text-rose-600/70 mt-0.5">Critical status parameters to suspension override this tenant organization.</p>
            </div>

            {tenant.status === 'active' ? (
              <div className="space-y-3">
                <p className="text-[10px] text-rose-700/80 leading-normal bg-rose-50/50 p-2.5 rounded-lg border border-rose-100">
                  Suspending this workspace halts core branch systems and prevents login attempts. Confirm by typing the workspace name below.
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={`Type "${tenant.name}" to confirm`}
                    className="w-full rounded-lg border border-rose-200 px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-rose-600 focus:border-rose-600 font-medium"
                  />
                  <button
                    onClick={handleSuspend}
                    disabled={confirmName !== tenant.name || suspendMutation.isPending}
                    className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    {suspendMutation.isPending ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        Suspending…
                      </>
                    ) : (
                      <>
                        <Power size={13} />
                        Suspend Workspace
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in duration-200">
                <p className="text-[10px] text-emerald-800/80 leading-normal bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                  Reactivating this workspace will immediately lift the access block and restore active data connections.
                </p>
                <button
                  onClick={() => reactivateMutation.mutate()}
                  disabled={reactivateMutation.isPending}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  {reactivateMutation.isPending ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      Reactivating…
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      Reactivate Workspace
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

