import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTenant,
  suspendTenant,
  reactivateTenant,
  listPlans,
  assignPlan,
  resetTenantOwnerPassword,
  updateTenantOverrides,
  getTenantCapabilities,
  enableTenantCapability,
  disableTenantCapability,
  getTenantPlugins,
  installTenantPlugin,
  uninstallTenantPlugin,
  getTenantHierarchy,
  type TenantDetail as TenantDetailInfo,
  type PlatformTenantPlugin,
  type PlatformTenantCapability,
} from '@/api/platform';
import { useAuth } from '@/contexts/auth.context';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';
import { DangerousActionModal } from '@/components/shared/DangerousActionModal';
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
  CreditCard,
  FolderTree,
  GitFork,
  ChevronDown,
  ChevronUp,
  ChevronRight
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
/* ------------------------------------------------------------------ */
/*  Plugin Registry (Extensions) Manager                              */
/* ------------------------------------------------------------------ */
interface AdminLicenseManagerProps {
  tenantId: string;
  tenantIndustry: string;
  canUpdate: boolean;
  maxPlugins: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Communication: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Integrations: 'bg-amber-50 text-amber-700 border-amber-100',
  Analytics: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  Productivity: 'bg-purple-50 text-purple-700 border-purple-100',
  Healthcare: 'bg-rose-50 text-rose-700 border-rose-100',
  Retail: 'bg-sky-50 text-sky-700 border-sky-100',
  Finance: 'bg-blue-50 text-blue-700 border-blue-100',
};

const CATEGORY_ICONS: Record<string, string> = {
  Communication: '📧',
  Integrations: '⚡',
  Analytics: '📊',
  Productivity: '📚',
  Healthcare: '🏥',
  Retail: '🛍️',
  Finance: '🧾',
};

function AdminLicenseManager({
  tenantId,
  tenantIndustry,
  canUpdate,
  maxPlugins,
}: AdminLicenseManagerProps) {
  const queryClient = useQueryClient();

  const { data: tenantPlugins = [], isLoading: loadingPlugins } = useQuery({
    queryKey: ['tenant-plugins', tenantId],
    queryFn: () => getTenantPlugins(tenantId),
  });

  const installMutation = useMutation({
    mutationFn: (pluginId: string) => installTenantPlugin(tenantId, pluginId),
    onMutate: async (pluginId) => {
      await queryClient.cancelQueries({ queryKey: ['tenant-plugins', tenantId] });
      const previous = queryClient.getQueryData<PlatformTenantPlugin[]>(['tenant-plugins', tenantId]);
      queryClient.setQueryData<PlatformTenantPlugin[]>(['tenant-plugins', tenantId], (old) =>
        old?.map((p) => (p.id === pluginId ? { ...p, installed: true } : p))
      );
      return { previous };
    },
    onError: (err: any, pluginId, context) => {
      queryClient.setQueryData(['tenant-plugins', tenantId], context?.previous);
      toast.error(err.message || 'Failed to install plugin');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-plugins', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: (pluginId: string) => uninstallTenantPlugin(tenantId, pluginId),
    onMutate: async (pluginId) => {
      await queryClient.cancelQueries({ queryKey: ['tenant-plugins', tenantId] });
      const previous = queryClient.getQueryData<PlatformTenantPlugin[]>(['tenant-plugins', tenantId]);
      queryClient.setQueryData<PlatformTenantPlugin[]>(['tenant-plugins', tenantId], (old) =>
        old?.map((p) => (p.id === pluginId ? { ...p, installed: false } : p))
      );
      return { previous };
    },
    onError: (err: any, pluginId, context) => {
      queryClient.setQueryData(['tenant-plugins', tenantId], context?.previous);
      toast.error(err.message || 'Failed to uninstall plugin');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-plugins', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
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

  const compatiblePlugins = tenantPlugins.filter((plugin) => {
    const manifest = plugin.manifest;
    return (
      manifest.compatible_industries.includes('*') ||
      manifest.compatible_industries
        .map((i) => i.toLowerCase())
        .includes(tenantIndustry.toLowerCase())
    );
  });

  const installedCount = tenantPlugins.filter((p) => p.installed).length;
  const limitReached = installedCount >= maxPlugins;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold border-b border-slate-100 pb-2 mb-2">
        <span>Installed Count</span>
        <span className={limitReached ? 'text-rose-600 font-bold' : 'text-indigo-600 font-bold'}>
          {installedCount} / {maxPlugins} Plugins Used
        </span>
      </div>

      {compatiblePlugins.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <Puzzle size={22} className="mx-auto text-slate-400 mb-2.5" />
          <p className="text-xs font-semibold text-slate-900">No extensions available</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            There are no plugins compatible with the {tenantIndustry} scope yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {compatiblePlugins.map((plugin) => {
            const manifest = plugin.manifest;
            const isInstalled = plugin.installed;
            const cat = manifest.category ?? 'Utility';
            const catColor = CATEGORY_COLORS[cat] ?? 'bg-slate-50 text-slate-700 border-slate-200';
            const catIcon = CATEGORY_ICONS[cat] ?? '⚙️';

            return (
              <div
                key={plugin.id}
                className={`group relative flex flex-col justify-between p-4 rounded-xl border transition-all select-none min-h-[120px] ${
                  isInstalled
                    ? 'bg-indigo-50/40 border-indigo-600 ring-[0.5px] ring-indigo-600'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-900 tracking-tight">
                          {catIcon} {manifest.name}
                        </span>
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-mono font-medium">
                          v{plugin.version}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${catColor}`}>
                          {cat}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">
                        {manifest.description}
                      </p>
                    </div>

                    <div className="flex-shrink-0 mt-0.5">
                      {isInstalled ? (
                        <div className="w-4 h-4 rounded bg-indigo-600 text-white flex items-center justify-center animate-in zoom-in-50 duration-150">
                          <Check size={10} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded border border-slate-200 bg-white" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-100 pt-2 font-mono">
                  <span>{plugin.package_name}</span>
                  {canUpdate ? (
                    isInstalled ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          uninstallMutation.mutate(plugin.id);
                        }}
                        disabled={uninstallMutation.isPending}
                        className="px-2.5 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-md cursor-pointer transition-colors"
                      >
                        {uninstallMutation.isPending ? 'Uninstalling…' : 'Uninstall'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          installMutation.mutate(plugin.id);
                        }}
                        disabled={limitReached || installMutation.isPending}
                        title={
                          limitReached
                            ? `Plugin limit reached: ${installedCount} of ${maxPlugins} installed`
                            : undefined
                        }
                        className={`px-2.5 py-1 text-[10px] font-bold border rounded-md cursor-pointer transition-colors ${
                          limitReached
                            ? 'text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed'
                            : 'text-indigo-600 hover:bg-indigo-50 border-indigo-200'
                        }`}
                      >
                        {installMutation.isPending ? 'Installing…' : 'Install'}
                      </button>
                    )
                  ) : (
                    <span className={isInstalled ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                      {isInstalled ? 'Installed' : 'Not Installed'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Capabilities Grid                                                 */
/* ------------------------------------------------------------------ */
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
  canUpdate: boolean;
}

function AdminCapabilityManager({
  tenantId,
  tenantIndustry,
  canUpdate,
}: AdminCapabilityManagerProps) {
  const queryClient = useQueryClient();

  const { data: capabilities = [], isLoading } = useQuery({
    queryKey: ['tenant-capabilities', tenantId],
    queryFn: () => getTenantCapabilities(tenantId),
  });

  const enableMutation = useMutation({
    mutationFn: (capId: string) => enableTenantCapability(tenantId, capId),
    onMutate: async (capId) => {
      await queryClient.cancelQueries({ queryKey: ['tenant-capabilities', tenantId] });
      const previous = queryClient.getQueryData<PlatformTenantCapability[]>(['tenant-capabilities', tenantId]);
      queryClient.setQueryData<PlatformTenantCapability[]>(['tenant-capabilities', tenantId], (old) =>
        old?.map((c) => (c.id === capId ? { ...c, enabled: true } : c))
      );
      return { previous };
    },
    onError: (err: any, capId, context) => {
      queryClient.setQueryData(['tenant-capabilities', tenantId], context?.previous);
      toast.error(err.message || 'Failed to enable capability');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-capabilities', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
    },
  });

  const disableMutation = useMutation({
    mutationFn: (capId: string) => disableTenantCapability(tenantId, capId),
    onMutate: async (capId) => {
      await queryClient.cancelQueries({ queryKey: ['tenant-capabilities', tenantId] });
      const previous = queryClient.getQueryData<PlatformTenantCapability[]>(['tenant-capabilities', tenantId]);
      queryClient.setQueryData<PlatformTenantCapability[]>(['tenant-capabilities', tenantId], (old) =>
        old?.map((c) => (c.id === capId ? { ...c, enabled: false } : c))
      );
      return { previous };
    },
    onError: (err: any, capId, context) => {
      queryClient.setQueryData(['tenant-capabilities', tenantId], context?.previous);
      toast.error(err.message || 'Failed to disable capability');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-capabilities', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-slate-400">
        <RefreshCw size={13} className="animate-spin text-slate-400" />
        Syncing capabilities…
      </div>
    );
  }

  const recommendedCaps = capabilities.filter(
    (cap) => cap.industry.toLowerCase() === tenantIndustry?.toLowerCase()
  );
  const otherCaps = capabilities.filter(
    (cap) => cap.industry.toLowerCase() !== tenantIndustry?.toLowerCase()
  );

  const renderCard = (cap: PlatformTenantCapability, isRecommended: boolean) => {
    const isEnabled = cap.enabled;
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
            disableMutation.mutate(cap.id);
          } else {
            enableMutation.mutate(cap.id);
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

            {/* Right: Toggle switch and Details */}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 tracking-tight">{cap.name}</span>
                <div className="flex-shrink-0">
                  {canUpdate ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isEnabled) {
                          disableMutation.mutate(cap.id);
                        } else {
                          enableMutation.mutate(cap.id);
                        }
                      }}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  ) : (
                    <div className="w-4 h-4 rounded text-white flex items-center justify-center bg-indigo-600">
                      <Check size={10} strokeWidth={3} />
                    </div>
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
    <div className="space-y-6">
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
    </div>
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
/*  Hierarchy Tree Component                                          */
/* ------------------------------------------------------------------ */
interface AdminHierarchyManagerProps {
  tenantId: string;
}

function AdminHierarchyManager({ tenantId }: AdminHierarchyManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({});

  const { data: hierarchy, isLoading } = useQuery({
    queryKey: ['tenant-hierarchy', tenantId],
    queryFn: () => getTenantHierarchy(tenantId),
    enabled: isExpanded,
  });

  const toggleBranch = (branchId: string) => {
    setExpandedBranches((prev) => ({
      ...prev,
      [branchId]: !prev[branchId],
    }));
  };

  const getConversionBadgeColor = (rate: number) => {
    if (rate >= 25) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (rate >= 15) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div 
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <FolderTree size={16} className="text-slate-500" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Tenant Organisation Hierarchy</h3>
            <p className="text-xs text-slate-400 mt-0.5">Explore the branches, active brands, and course business verticals configured under this tenant.</p>
          </div>
        </div>
        <div className="text-slate-400">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-6 border-t border-slate-100 pt-5 animate-in fade-in duration-200">
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
              <RefreshCw size={13} className="animate-spin text-slate-400" />
              Loading organization hierarchy…
            </div>
          ) : !hierarchy || hierarchy.branches.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <Building size={20} className="mx-auto text-slate-400 mb-2" />
              <p className="text-xs font-semibold text-slate-900">No branches configured yet</p>
              <p className="text-[10px] text-slate-400 mt-0.5">This tenant has not provisioned any branches in their portal.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {hierarchy.branches.map((branch) => {
                const isBranchExpanded = expandedBranches[branch.id] ?? false;

                return (
                  <div key={branch.id} className="border border-slate-100 rounded-xl bg-slate-50/20 overflow-hidden">
                    {/* Branch Row */}
                    <div 
                      className="flex items-center justify-between p-3.5 bg-slate-50/50 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-all select-none"
                      onClick={() => toggleBranch(branch.id)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {isBranchExpanded ? (
                          <ChevronDown size={14} className="text-slate-400" />
                        ) : (
                          <ChevronRight size={14} className="text-slate-400" />
                        )}
                        <Building size={14} className="text-slate-600" />
                        <span className="text-xs font-bold text-slate-800">{branch.name}</span>
                        {branch.city && (
                          <span className="text-[10px] text-slate-400 font-medium">({branch.city})</span>
                        )}
                        
                        {/* Brands assigned under this branch */}
                        <div className="flex items-center gap-1.5 ml-2">
                          {branch.brands.map((brand) => (
                            <span 
                              key={brand.id} 
                              className={`text-[9px] px-1.5 py-0.25 rounded font-medium border uppercase tracking-wider ${
                                brand.is_primary 
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold' 
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {brand.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {branch.verticals.length} verticals
                      </span>
                    </div>

                    {/* Verticals under this Branch */}
                    {isBranchExpanded && (
                      <div className="p-3 pl-8 bg-white space-y-2.5 animate-in slide-in-from-top-1 duration-150 border-t border-slate-100">
                        {branch.verticals.length === 0 ? (
                          <div className="text-[10px] italic text-slate-400 py-1 pl-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                            No verticals configured yet for this branch.
                          </div>
                        ) : (
                          branch.verticals.map((vertical) => (
                            <div key={vertical.id} className="flex items-center justify-between gap-4 py-0.5">
                              <div className="flex items-center gap-2">
                                <GitFork size={12} className="text-slate-400 -rotate-90" />
                                <span className={`text-xs font-semibold ${vertical.status === 'inactive' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                  {vertical.name}
                                </span>
                                {vertical.status === 'inactive' && (
                                  <span className="text-[8px] bg-slate-100 text-slate-500 border border-slate-200 px-1 rounded uppercase tracking-wider font-mono">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] text-slate-400 font-medium">
                                  {vertical.stats.total_leads} leads
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getConversionBadgeColor(vertical.stats.conversion_rate)}`}>
                                  {vertical.stats.conversion_rate}% conversion
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
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
  
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [assignError, setAssignError] = useState('');
  
  // Modal states
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);
  
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
    mutationFn: (reason: string) => suspendTenant(tenantId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast.success('Workspace suspended successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to suspend workspace');
    }
  });

  const reactivateMutation = useMutation({
    mutationFn: (reason: string) => reactivateTenant(tenantId, reason),
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

        {/* Tenant Hierarchy Section */}
        <AdminHierarchyManager tenantId={tenantId} />

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
            canUpdate={canUpdateBilling}
            maxPlugins={tenant.plan?.max_plugins ?? 5}
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
                  Suspending this workspace halts core branch systems, blocks user logins, and invalidates API keys.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSuspendModalOpen(true)}
                  className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Power size={13} />
                  Suspend Workspace...
                </button>
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in duration-200">
                <p className="text-[10px] text-emerald-800/80 leading-normal bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                  Reactivating this workspace will lift the access block and restore active data connections.
                </p>
                <button
                  type="button"
                  onClick={() => setIsReactivateModalOpen(true)}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Sparkles size={13} />
                  Reactivate Workspace...
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dangerous Action Modals */}
      {tenant && (
        <>
          <DangerousActionModal
            isOpen={isSuspendModalOpen}
            onClose={() => setIsSuspendModalOpen(false)}
            onConfirm={async (reason) => {
              await suspendMutation.mutateAsync(reason);
            }}
            title="Suspend Tenant Workspace"
            description={`You are about to suspend the workspace "${tenant.name}". This will restrict login access, disable extensions, and block active CRM operations.`}
            targetName={tenant.name}
            confirmButtonText="Suspend Workspace"
            isPending={suspendMutation.isPending}
          />
          <DangerousActionModal
            isOpen={isReactivateModalOpen}
            onClose={() => setIsReactivateModalOpen(false)}
            onConfirm={async (reason) => {
              await reactivateMutation.mutateAsync(reason);
            }}
            title="Reactivate Tenant Workspace"
            description={`You are about to reactivate the workspace "${tenant.name}". This will immediately lift the login restrictions and restore database queries/connections.`}
            targetName={tenant.name}
            confirmButtonText="Reactivate Workspace"
            isPending={reactivateMutation.isPending}
          />
        </>
      )}

    </div>
  );
}

