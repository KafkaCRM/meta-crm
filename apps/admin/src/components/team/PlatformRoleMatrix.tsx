import { PLATFORM_ROLE_MAP } from '@meta-crm/permissions';
import type { PlatformPermissionDefinition } from '@meta-crm/permissions';
import { PlatformRole } from '@meta-crm/types';
import type { PlatformSubject } from '@meta-crm/permissions';

const ALL_RESOURCES: PlatformSubject[] = [
  'PlatformTenant',
  'PlatformPlan',
  'PlatformPlugin',
  'PlatformReport',
  'PlatformUser',
  'SystemHealth',
  'Billing',
];

const ALL_ACTIONS = ['create', 'read', 'update', 'delete', 'manage', 'assign'];

const ROLE_LABELS: Record<PlatformRole, string> = {
  [PlatformRole.PlatformOwner]: 'Owner',
  [PlatformRole.PlatformAdmin]: 'Admin',
  [PlatformRole.PlatformSupport]: 'Support',
  [PlatformRole.PlatformSales]: 'Sales',
  [PlatformRole.PlatformBilling]: 'Billing',
  [PlatformRole.PlatformDeveloper]: 'Developer',
  [PlatformRole.PlatformOps]: 'Ops',
};

const RESOURCE_LABELS: Record<string, string> = {
  PlatformTenant: 'Tenants',
  PlatformPlan: 'Plans',
  PlatformPlugin: 'Plugins',
  PlatformReport: 'Reports',
  PlatformUser: 'Users',
  SystemHealth: 'System Health',
  Billing: 'Billing',
};

const ACTION_SYMBOLS: Record<string, string> = {
  manage: '★',
  create: 'C',
  read: 'R',
  update: 'U',
  delete: 'D',
  assign: 'A',
};

export function PlatformRoleMatrix() {
  const roles = Object.values(PlatformRole);

  const getPermissionForRole = (
    role: PlatformRole,
    resource: PlatformSubject,
  ): string => {
    const perms = PLATFORM_ROLE_MAP[role];
    if (!perms) return '—';
    const matching = perms.filter((p) => p.resource === resource);
    if (matching.length === 0) return '—';
    if (matching.some((p) => p.action === 'manage')) return '★';
    return matching
      .map((p) => ACTION_SYMBOLS[p.action] ?? p.action.charAt(0).toUpperCase())
      .join('');
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="sticky left-0 z-10 bg-muted px-4 py-2 text-left font-medium">
              Resource
            </th>
            {roles.map((role) => (
              <th key={role} className="px-4 py-2 text-center font-medium">
                {ROLE_LABELS[role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_RESOURCES.map((resource) => (
            <tr key={resource} className="border-t">
              <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium">
                {RESOURCE_LABELS[resource]}
              </td>
              {roles.map((role) => {
                const perm = getPermissionForRole(role, resource);
                const hasPermission = perm !== '—';
                return (
                  <td
                    key={`${role}-${resource}`}
                    className={`px-4 py-2 text-center font-mono text-xs ${
                      hasPermission ? 'text-green-700' : 'text-gray-300'
                    }`}
                  >
                    {perm}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t px-4 py-2 text-xs text-gray-500">
        <span className="font-mono">★</span> = Manage &nbsp;
        <span className="font-mono">C</span> = Create &nbsp;
        <span className="font-mono">R</span> = Read &nbsp;
        <span className="font-mono">U</span> = Update &nbsp;
        <span className="font-mono">D</span> = Delete &nbsp;
        <span className="font-mono">A</span> = Assign &nbsp;
        <span className="text-gray-300">—</span> = No access
      </div>
    </div>
  );
}
