import { PLATFORM_ROLE_MAP } from '@meta-crm/permissions';
import { PlatformRole } from '@meta-crm/types';
import type { PlatformSubject } from '@meta-crm/permissions';
import { Shield, Sparkles, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const ALL_RESOURCES: PlatformSubject[] = [
  'PlatformTenant',
  'PlatformPlan',
  'PlatformPlugin',
  'PlatformReport',
  'PlatformUser',
  'SystemHealth',
  'Billing',
];

const ROLE_LABELS: Record<PlatformRole, string> = {
  [PlatformRole.PlatformOwner]: 'Root Owner',
  [PlatformRole.PlatformAdmin]: 'Platform Admin',
  [PlatformRole.PlatformSupport]: 'Platform Support',
  [PlatformRole.PlatformSales]: 'Platform Sales',
  [PlatformRole.PlatformBilling]: 'Platform Billing',
  [PlatformRole.PlatformDeveloper]: 'Developer',
  [PlatformRole.PlatformOps]: 'Platform Ops',
};

const RESOURCE_LABELS: Record<string, string> = {
  PlatformTenant: 'Tenants & Onboarding',
  PlatformPlan: 'Subscription Pricing',
  PlatformPlugin: 'Catalog Plugins',
  PlatformReport: 'Executive Reports',
  PlatformUser: 'Platform Team List',
  SystemHealth: 'Bull Job Queues',
  Billing: 'Financial Ledger',
};

const RESOURCE_DESCRIPTIONS: Record<string, string> = {
  PlatformTenant: 'Register and manage SaaS client workspaces',
  PlatformPlan: 'Define subscription caps and capabilities bundles',
  PlatformPlugin: 'Publish and manage platform catalog modules',
  PlatformReport: 'Access non-PII aggregated telemetry and charts',
  PlatformUser: 'Invite and deactivate platform operators',
  SystemHealth: 'Diagnose server Bull queues and webhook failures',
  Billing: 'Adjust invoice balances and execute payouts',
};

export function PlatformRoleMatrix() {
  const roles = Object.values(PlatformRole);

  const getPermissionForRole = (
    role: PlatformRole,
    resource: PlatformSubject,
  ) => {
    const perms = PLATFORM_ROLE_MAP[role];
    if (!perms) return [];
    const matching = perms.filter((p) => p.resource === resource);
    return matching.map((p) => p.action);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* Grid Console */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3.5 text-left text-xs uppercase tracking-wider min-w-[220px]">
                Platform Subject Scope
              </th>
              {roles.map((role) => (
                <th key={role} className="px-3 py-3.5 text-center text-xs uppercase tracking-wider min-w-[110px] border-l border-slate-200/50">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {ALL_RESOURCES.map((resource) => (
              <tr key={resource} className="hover:bg-slate-50/50 transition-colors">
                {/* Resource Info */}
                <td className="sticky left-0 z-10 bg-white px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900 leading-tight">{RESOURCE_LABELS[resource]}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 leading-tight">{RESOURCE_DESCRIPTIONS[resource]}</span>
                  </div>
                </td>

                {/* Role Tiers */}
                {roles.map((role) => {
                  const actions = getPermissionForRole(role, resource);
                  const isOwner = role === PlatformRole.PlatformOwner || actions.includes('manage');
                  const hasAccess = actions.length > 0;

                  return (
                    <td
                      key={`${role}-${resource}`}
                      className="px-3 py-3 text-center border-l border-slate-100 font-mono text-[10px]"
                    >
                      <div className="flex items-center justify-center gap-1 flex-wrap max-w-[100px] mx-auto">
                        {isOwner ? (
                          <Badge className="bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-50 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold shadow-none">
                            <Sparkles size={8} />
                            Master
                          </Badge>
                        ) : hasAccess ? (
                          actions.map((act) => {
                            let label = act.charAt(0).toUpperCase();
                            let bgClass = 'bg-slate-50 border-slate-200 text-slate-600';
                            
                            if (act === 'create') bgClass = 'bg-emerald-50 border-emerald-100 text-emerald-700 font-bold';
                            if (act === 'read') bgClass = 'bg-sky-50 border-sky-100 text-sky-700';
                            if (act === 'update') bgClass = 'bg-amber-50 border-amber-100 text-amber-700';
                            if (act === 'delete') bgClass = 'bg-rose-50 border-rose-100 text-rose-700 font-bold';
                            if (act === 'assign') bgClass = 'bg-purple-50 border-purple-100 text-purple-700';

                            return (
                              <span
                                key={act}
                                title={act.toUpperCase()}
                                className={`inline-flex items-center justify-center w-4 h-4 rounded border text-[9px] ${bgClass}`}
                              >
                                {label}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-slate-200 text-xs font-bold font-sans">·</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Guide Deck */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-wrap gap-x-6 gap-y-2 text-[10px] text-slate-400 font-semibold uppercase tracking-wider font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded border bg-indigo-50 border-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold">★</span>
          Master = All Privileges
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded border bg-emerald-50 border-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-bold">C</span>
          Create
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded border bg-sky-50 border-sky-100 text-sky-700 flex items-center justify-center text-[9px]">R</span>
          Read Only
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded border bg-amber-50 border-amber-100 text-amber-700 flex items-center justify-center text-[9px]">U</span>
          Update
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded border bg-rose-50 border-rose-100 text-rose-700 flex items-center justify-center text-[9px] font-bold">D</span>
          Delete
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded border bg-purple-50 border-purple-100 text-purple-700 flex items-center justify-center text-[9px]">A</span>
          Assign
        </span>
      </div>
    </div>
  );
}
