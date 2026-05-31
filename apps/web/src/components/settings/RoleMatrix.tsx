import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Shield, Info, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { settingsApi, type Role } from '@/api/settings';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const RESOURCES = [
  'Party', 'Case', 'Interaction', 'Report', 'Workflow',
  'FieldDefinition', 'LabelOverride', 'Integration', 'Webhook',
  'User', 'Role', 'Branch', 'Brand', 'Plugin', 'BillingRecord',
];

const ACTIONS = ['create', 'read', 'update', 'delete', 'export', 'assign', 'manage'];

export function RoleMatrix() {
  const { can } = usePermissions();
  const canManage = can('manage', 'Role');
  const queryClient = useQueryClient();
  const [newRole, setNewRole] = useState({ name: '', slug: '', description: '' });

  const { data: roles, isLoading } = useQuery({
    queryKey: ['settings', 'roles'],
    queryFn: () => settingsApi.roles.list(),
    staleTime: 30_000,
  });

  const sortedRoles = useMemo(() => {
    if (!roles) return [];
    const systemRolesOrder = ['owner', 'admin', 'manager', 'member', 'viewer'];
    const system = roles.filter((r) => r.is_system_role);
    const custom = roles.filter((r) => !r.is_system_role);

    const sortedSystem = system.sort((a, b) => {
      const aIndex = systemRolesOrder.indexOf(a.slug);
      const bIndex = systemRolesOrder.indexOf(b.slug);
      return aIndex - bIndex;
    });

    const sortedCustom = custom.sort((a, b) => a.name.localeCompare(b.name));

    return [...sortedSystem, ...sortedCustom];
  }, [roles]);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; slug: string; description?: string }) =>
      settingsApi.roles.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'roles'] });
      toast.success('Custom role created successfully');
      setNewRole({ name: '', slug: '', description: '' });
    },
    onError: () => toast.error('Failed to create role'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: { resource: string; action: string }[] }) =>
      settingsApi.roles.update(id, { permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'roles'] });
      toast.success('Permissions saved');
    },
    onError: () => toast.error('Failed to update permissions'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.roles.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'roles'] });
      toast.success('Role deleted successfully');
    },
    onError: () => toast.error('Failed to delete role'),
  });

  const handleTogglePermission = useCallback(
    (roleId: string, resource: string, action: string, currentPermissions: { resource: string; action: string }[]) => {
      const exists = currentPermissions.some(
        (p) => p.resource === resource && p.action === action,
      );
      const newPermissions = exists
        ? currentPermissions.filter((p) => !(p.resource === resource && p.action === action))
        : [...currentPermissions, { resource, action }];
      updateMutation.mutate({ id: roleId, permissions: newPermissions });
    },
    [updateMutation],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newRole.name.trim() || !newRole.slug.trim()) return;
      createMutation.mutate(newRole);
    },
    [newRole, createMutation],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Roles & Permissions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Design custom security policies, configure permission matrices, and enforce access control
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Permission matrices list */}
        <div className={cn("space-y-4", canManage ? "lg:col-span-2" : "lg:col-span-3")}>
          {sortedRoles.map((role) => (
            <RolePermissionGrid
              key={role.id}
              role={role}
              onToggle={handleTogglePermission}
              onDelete={() => {
                if (window.confirm(`Are you sure you want to permanently delete role "${role.name}"?`)) {
                  removeMutation.mutate(role.id);
                }
              }}
              isSaving={updateMutation.isPending && updateMutation.variables?.id === role.id}
              canManage={canManage}
            />
          ))}
        </div>

        {/* Create custom role card */}
        {canManage && (
        <Card className="bg-card border-border rounded-xl shadow-none h-fit">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-medium text-foreground flex items-center gap-1.5">
              <Shield size={16} className="text-muted-foreground" />
              Custom Role
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Create a custom permission profile for your team
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Role Title</label>
                <Input
                  type="text"
                  placeholder="e.g. Finance Analyst"
                  value={newRole.name}
                  onChange={(e) => setNewRole((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="h-9 border-border bg-card text-foreground placeholder-[#94a3b8]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Unique Identifier (Slug)</label>
                <Input
                  type="text"
                  placeholder="e.g. finance_analyst"
                  value={newRole.slug}
                  onChange={(e) => setNewRole((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  required
                  className="h-9 border-border bg-card text-foreground placeholder-[#94a3b8] font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  placeholder="Summarise access parameters..."
                  value={newRole.description}
                  onChange={(e) => setNewRole((f) => ({ ...f, description: e.target.value }))}
                  className="min-h-[70px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder-[#94a3b8] outline-none focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400/50"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-primary hover:bg-[#1e293b] text-white w-full h-9 rounded-lg flex items-center justify-center gap-1.5"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus size={15} />
                  )}
                  Deploy Custom Role
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}

interface RolePermissionGridProps {
  role: Role;
  onToggle: (roleId: string, resource: string, action: string, permissions: { resource: string; action: string }[]) => void;
  onDelete: () => void;
  isSaving: boolean;
  canManage: boolean;
}

function RolePermissionGrid({ role, onToggle, onDelete, isSaving, canManage }: RolePermissionGridProps) {
  const [expanded, setExpanded] = useState(false);

  const permissionSet = useMemo(
    () => new Set(role.permissions.map((p) => `${p.resource}:${p.action}`)),
    [role.permissions],
  );

  return (
    <Card className="bg-card border-border rounded-xl shadow-none overflow-hidden hover:border-slate-300 transition-all">
      <div
        className="flex items-center justify-between px-4 py-3.5 hover:bg-background/50 transition-colors cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="p-2 bg-[#f1f5f9] text-muted-foreground border border-border rounded-lg">
            <Shield size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{role.name}</span>
              {role.is_system_role ? (
                <Badge variant="outline" className="bg-background text-muted-foreground border-border text-[9px] rounded-md font-semibold py-0 px-1.5 flex items-center gap-1">
                  <Lock size={9} />
                  System Role
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-fin-orange/10/50 text-fin-orange border-fin-orange/20 text-[9px] rounded-md font-semibold py-0 px-1.5">
                  Custom
                </Badge>
              )}
            </div>
            {role.description ? (
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-sm lg:max-w-md">{role.description}</p>
            ) : (
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {role.is_system_role ? 'System security profile' : 'Custom security profile'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono bg-background px-2 py-0.5 border border-border rounded">
            {role.permissions.length} nodes
          </span>
          {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="px-4 py-2 font-medium text-[#475569] w-32">Resource Node</th>
                {ACTIONS.map((action) => (
                  <th key={action} className="px-2 py-2 text-center font-medium text-[#475569] capitalize">
                    {action}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {RESOURCES.map((resource) => (
                <tr key={resource} className="hover:bg-background/30">
                  <td className="px-4 py-2 font-medium text-foreground">{resource}</td>
                  {ACTIONS.map((action) => {
                    const key = `${resource}:${action}`;
                    const checked = permissionSet.has(key);
                    return (
                      <td key={action} className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={role.is_system_role || !canManage}
                          onChange={() =>
                            onToggle(
                              role.id,
                              resource,
                              action,
                              role.permissions as { resource: string; action: string }[],
                            )
                          }
                          className="h-3.5 w-3.5 rounded border-[#cbd5e1] text-foreground focus:ring-slate-400 cursor-pointer disabled:cursor-not-allowed transition-all"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {role.is_system_role ? (
            <div className="px-4 py-2.5 bg-background border-t border-border flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Info size={12} className="text-muted-foreground" />
              <span>System roles are managed by platform specifications and cannot be modified.</span>
            </div>
          ) : !canManage ? (
            <div className="px-4 py-2.5 bg-background border-t border-border flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Lock size={12} className="text-muted-foreground" />
              <span>You do not have permission to modify custom roles.</span>
            </div>
          ) : (
            <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Changes save automatically</span>
              <Button
                variant="ghost"
                size="xs"
                onClick={onDelete}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 text-[11px] font-medium h-7 rounded-md"
              >
                <Trash2 size={12} className="mr-1" />
                Delete Custom Role
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
