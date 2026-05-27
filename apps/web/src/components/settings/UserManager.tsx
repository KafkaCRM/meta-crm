import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Mail, Shield, UserPlus, X } from 'lucide-react';
import { settingsApi, type User, type Role } from '@/api/settings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

export function UserManager() {
  const { can } = usePermissions();
  const canManage = can('manage', 'User');
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

  const inviteMutation = useMutation({
    mutationFn: (data: { name: string; email: string; role_ids: string[] }) =>
      settingsApi.users.invite(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'users'] });
      toast.success('Invitation sent successfully');
      setInviteForm({ name: '', email: '', roleIds: [] });
    },
    onError: () => toast.error('Failed to send invitation'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.users.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'users'] });
      toast.success('User removed successfully');
    },
    onError: () => toast.error('Failed to remove user'),
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!inviteForm.name.trim() || !inviteForm.email.trim() || inviteForm.roleIds.length === 0) {
        toast.error('Please fill out all fields and select at least one role');
        return;
      }
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
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#94a3b8]" />
      </div>
    );
  }

  // Predefined cool avatar background gradients
  const avatarGradients = [
    'from-slate-800 to-slate-900 text-slate-100',
    'from-indigo-900 to-slate-800 text-indigo-100',
    'from-blue-900 to-slate-800 text-blue-100',
    'from-emerald-950 to-slate-900 text-emerald-100',
  ];

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0f172a]">Users</h1>
        <p className="text-sm text-[#64748b] mt-0.5">
          Manage your team members, invite new workspace operators, and control system permissions
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Users list card */}
        <Card className={cn("bg-white border-[#e2e8f0] rounded-xl shadow-none", canManage ? "md:col-span-2" : "md:col-span-3")}>
          <CardHeader className="pb-3 border-b border-[#e2e8f0]">
            <CardTitle className="text-base font-medium text-[#0f172a]">
              Active Operators
            </CardTitle>
            <CardDescription className="text-xs text-[#94a3b8]">
              {users?.length ?? 0} operators active in this tenant
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[#e2e8f0]">
              {users?.map((user, index) => {
                const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                const avatarGrad = avatarGradients[index % avatarGradients.length];

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 hover:bg-[#f8fafc]/60 transition-colors group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Avatar Circle */}
                      <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${avatarGrad} flex items-center justify-center font-semibold text-xs border border-slate-200/50 shadow-sm flex-shrink-0`}>
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[#0f172a] truncate">{user.name}</p>
                          {/* Pulsing indicator - simulates active status */}
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                        </div>
                        <p className="text-xs text-[#64748b] mt-0.5 flex items-center gap-1">
                          <Mail size={12} className="text-[#94a3b8]" />
                          <span className="truncate">{user.email}</span>
                        </p>
                        {user.roles && user.roles.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {user.roles.map((r) => (
                              <Badge
                                key={r.role_id}
                                variant="secondary"
                                className="bg-[#f1f5f9] text-[#475569] border-[#e2e8f0] text-[10px] font-medium rounded px-1.5 py-0"
                              >
                                {r.role_name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 transition-all"
                        onClick={() => {
                          if (window.confirm(`Remove ${user.name} from the workspace?`)) {
                            removeMutation.mutate(user.id);
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                );
              })}
              {users?.length === 0 && (
                <div className="p-8 text-center text-sm text-[#64748b]">
                  No active operators found. {canManage && 'Use the invite form to add your first member.'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invite Form card */}
        {canManage && (
          <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none h-fit">
            <CardHeader className="pb-3 border-b border-[#e2e8f0]">
              <CardTitle className="text-base font-medium text-[#0f172a] flex items-center gap-1.5">
                <UserPlus size={16} className="text-[#94a3b8]" />
                Invite Member
              </CardTitle>
              <CardDescription className="text-xs text-[#94a3b8]">
                Grant workspace access by sending an invitation
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#64748b]">Full Name</label>
                  <Input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    className="h-9 border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#64748b]">Email Address</label>
                  <Input
                    type="email"
                    placeholder="e.g. john@company.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                    required
                    className="h-9 border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#64748b] flex items-center gap-1">
                    <Shield size={12} className="text-[#94a3b8]" />
                    Assigned Roles
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 border border-[#e2e8f0] rounded-lg bg-[#f8fafc]/50">
                    {sortedRoles.map((role) => {
                      const isSelected = inviteForm.roleIds.includes(role.id);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => toggleRole(role.id)}
                          className={`text-xs px-2.5 py-1 rounded-md border transition-all text-left font-medium ${
                            isSelected
                              ? 'bg-[#0f172a] text-white border-[#0f172a] shadow-sm'
                              : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-slate-400 hover:text-[#0f172a]'
                          }`}
                        >
                          {role.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={inviteMutation.isPending}
                    className="bg-[#0f172a] hover:bg-[#1e293b] text-white w-full h-9 rounded-lg flex items-center justify-center gap-1.5"
                  >
                    {inviteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus size={15} />
                    )}
                    Send Invitation
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
