import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Shield } from 'lucide-react';
import { settingsApi, type Role } from '@/api/settings';
import { usePermissions } from '@/hooks/usePermissions';

const RESOURCES = [
  'Party', 'Case', 'Interaction', 'Report', 'Workflow',
  'FieldDefinition', 'LabelOverride', 'Integration', 'Webhook',
  'User', 'Role', 'Branch', 'Brand', 'Plugin', 'BillingRecord',
];

const ACTIONS = ['create', 'read', 'update', 'delete', 'export', 'assign', 'manage'];

export function RoleMatrix() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [newRole, setNewRole] = useState({ name: '', slug: '', description: '' });

  const { data: roles, isLoading } = useQuery({
    queryKey: ['settings', 'roles'],
    queryFn: () => settingsApi.roles.list(),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; slug: string; description?: string }) =>
      settingsApi.roles.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'roles'] });
      toast.success('Role created');
      setNewRole({ name: '', slug: '', description: '' });
    },
    onError: () => toast.error('Failed to create role'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: { resource: string; action: string }[] }) =>
      settingsApi.roles.update(id, { permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'roles'] });
      toast.success('Role permissions updated');
    },
    onError: () => toast.error('Failed to update permissions'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.roles.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'roles'] });
      toast.success('Role deleted');
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
    return <div className="text-muted-foreground">Loading roles...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Roles</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage roles and permissions
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium">Create Custom Role</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            placeholder="Role name"
            value={newRole.name}
            onChange={(e) => setNewRole((f) => ({ ...f, name: e.target.value }))}
            className="rounded-md border border-input px-3 py-2 text-sm"
            required
          />
          <input
            type="text"
            placeholder="Slug (e.g. senior_counsellor)"
            value={newRole.slug}
            onChange={(e) => setNewRole((f) => ({ ...f, slug: e.target.value }))}
            className="rounded-md border border-input px-3 py-2 text-sm"
            required
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newRole.description}
            onChange={(e) => setNewRole((f) => ({ ...f, description: e.target.value }))}
            className="rounded-md border border-input px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          <Plus className="h-4 w-4" />
          Create Role
        </button>
      </form>

      <div className="space-y-4">
        {roles?.map((role) => (
          <RolePermissionGrid
            key={role.id}
            role={role}
            onToggle={handleTogglePermission}
            onDelete={() => {
              if (window.confirm(`Delete role "${role.name}"?`)) {
                removeMutation.mutate(role.id);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface RolePermissionGridProps {
  role: Role;
  onToggle: (roleId: string, resource: string, action: string, permissions: { resource: string; action: string }[]) => void;
  onDelete: () => void;
}

function RolePermissionGrid({ role, onToggle, onDelete }: RolePermissionGridProps) {
  const [expanded, setExpanded] = useState(false);

  const permissionSet = useMemo(
    () => new Set(role.permissions.map((p) => `${p.resource}:${p.action}`)),
    [role.permissions],
  );

  return (
    <div className="rounded-lg border bg-card">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <div className="text-left">
            <p className="text-sm font-medium">{role.name}</p>
            <p className="text-xs text-muted-foreground">
              {role.permissions.length} permissions{role.is_system_role ? ' · System role' : ''}
            </p>
          </div>
        </div>
        <svg
          className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-2 font-medium">Resource</th>
                {ACTIONS.map((action) => (
                  <th key={action} className="px-2 py-2 text-center font-medium capitalize">
                    {action}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map((resource) => (
                <tr key={resource} className="border-t">
                  <td className="px-4 py-1.5 font-medium">{resource}</td>
                  {ACTIONS.map((action) => {
                    const key = `${resource}:${action}`;
                    const checked = permissionSet.has(key);
                    return (
                      <td key={action} className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            onToggle(
                              role.id,
                              resource,
                              action,
                              role.permissions as { resource: string; action: string }[],
                            )
                          }
                          className="h-4 w-4 rounded border-input cursor-pointer"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {!role.is_system_role && (
            <div className="px-4 py-2 border-t">
              <button
                onClick={onDelete}
                className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Delete role
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
