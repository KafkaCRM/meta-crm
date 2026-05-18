import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { settingsApi, type User, type Role } from '@/api/settings';

export function UserManager() {
  const queryClient = useQueryClient();
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', roleIds: [] as string[] });

  const { data: users, isLoading } = useQuery({
    queryKey: ['settings', 'users'],
    queryFn: () => settingsApi.users.list(),
    staleTime: 30_000,
  });

  const { data: roles } = useQuery({
    queryKey: ['settings', 'roles'],
    queryFn: () => settingsApi.roles.list(),
    staleTime: 30_000,
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { name: string; email: string; role_ids: string[] }) =>
      settingsApi.users.invite(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'users'] });
      toast.success('Invitation sent');
      setInviteForm({ name: '', email: '', roleIds: [] });
    },
    onError: () => toast.error('Failed to send invitation'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.users.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'users'] });
      toast.success('User removed');
    },
    onError: () => toast.error('Failed to remove user'),
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!inviteForm.name.trim() || !inviteForm.email.trim() || inviteForm.roleIds.length === 0) return;
      inviteMutation.mutate({
        name: inviteForm.name,
        email: inviteForm.email,
        role_ids: inviteForm.roleIds,
      });
    },
    [inviteForm, inviteMutation],
  );

  const toggleRole = useCallback((roleId: string) => {
    setInviteForm((f) => ({
      ...f,
      roleIds: f.roleIds.includes(roleId)
        ? f.roleIds.filter((id) => id !== roleId)
        : [...f.roleIds, roleId],
    }));
  }, []);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invite and manage users
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium">Invite User</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Name"
            value={inviteForm.name}
            onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
            className="rounded-md border border-input px-3 py-2 text-sm"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={inviteForm.email}
            onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
            className="rounded-md border border-input px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Roles</label>
          <div className="flex flex-wrap gap-2">
            {roles?.map((role) => (
              <button
                key={role.id}
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  inviteForm.roleIds.includes(role.id)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-input text-muted-foreground hover:bg-muted'
                }`}
                onClick={() => toggleRole(role.id)}
              >
                {role.name}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={inviteMutation.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {inviteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          <Plus className="h-4 w-4" />
          Invite
        </button>
      </form>

      <div className="rounded-lg border divide-y">
        {users?.map((user) => (
          <div key={user.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              {user.roles && user.roles.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {user.roles.map((r) => (
                    <span key={r.role_id} className="text-xs bg-muted px-2 py-0.5 rounded">
                      {r.role_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                if (window.confirm(`Remove ${user.name}?`)) {
                  removeMutation.mutate(user.id);
                }
              }}
              className="p-1 rounded hover:bg-muted"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          </div>
        ))}
        {users?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No users yet. Invite your first user above.
          </div>
        )}
      </div>
    </div>
  );
}
