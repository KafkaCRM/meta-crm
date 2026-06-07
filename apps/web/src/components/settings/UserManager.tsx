import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Mail, Shield, UserPlus, X, Phone, Key } from 'lucide-react';
import { settingsApi, type User, type Role } from '@/api/settings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

export function UserManager() {
  const { can } = usePermissions();
  const canManage = can('manage', 'User');
  const queryClient = useQueryClient();

  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    phone_number: '',
    password: '',
    autoGeneratePassword: true,
    assignment_ids: [] as string[],
    roleIds: [] as string[],
    vertical_ids: [] as string[],
  });

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [createdUserCredentials, setCreatedUserCredentials] = useState<{
    name: string;
    email?: string | null;
    phone_number?: string;
    password?: string;
  } | null>(null);

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

  const { data: assignments } = useQuery({
    queryKey: ['settings', 'assignments'],
    queryFn: () => settingsApi.assignments.list(),
    staleTime: 30_000,
  });

  const { data: branches } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list(),
    staleTime: 30_000,
  });

  const { data: brands } = useQuery({
    queryKey: ['settings', 'brands'],
    queryFn: () => settingsApi.brands.list(),
    staleTime: 30_000,
  });

  const { data: verticals } = useQuery({
    queryKey: ['settings', 'verticals'],
    queryFn: () => settingsApi.verticals.list({ status: 'active' }),
    staleTime: 30_000,
  });

  const assignmentOptions = useMemo(() => {
    if (!assignments || !branches || !brands) return [];
    return assignments.map((a) => {
      const branch = branches.find((b) => b.id === a.branch_id);
      const brand = brands.find((b) => b.id === a.brand_id);
      return {
        id: a.id,
        name: `${branch?.name ?? 'Unknown Branch'} - ${brand?.name ?? 'Unknown Brand'}`,
      };
    });
  }, [assignments, branches, brands]);

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
    mutationFn: (data: {
      name: string;
      email?: string;
      phone_number: string;
      password?: string;
      role_ids: string[];
      assignment_ids?: string[];
      vertical_ids?: string[];
    }) => settingsApi.users.invite(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'users'] });
      toast.success('User invited successfully');
      setCreatedUserCredentials({
        name: data.name,
        email: data.email,
        phone_number: data.phone_number,
        password: data.temporary_password,
      });
      setInviteForm({
        name: '',
        email: '',
        phone_number: '',
        password: '',
        autoGeneratePassword: true,
        assignment_ids: [],
        roleIds: [],
        vertical_ids: [],
      });
      setIsInviteModalOpen(false);
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to send invitation'),
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
      if (!inviteForm.name.trim() || !inviteForm.phone_number.trim() || inviteForm.roleIds.length === 0) {
        toast.error('Please fill out all required fields and select at least one role');
        return;
      }
      if (!inviteForm.autoGeneratePassword && !inviteForm.password.trim()) {
        toast.error('Please enter a custom password or select auto-generate');
        return;
      }
      if (assignmentOptions.length > 1 && inviteForm.assignment_ids.length === 0) {
        toast.error('Please select at least one Store Location');
        return;
      }

      inviteMutation.mutate({
        name: inviteForm.name,
        email: inviteForm.email.trim() || undefined,
        phone_number: inviteForm.phone_number.trim(),
        password: inviteForm.autoGeneratePassword ? undefined : inviteForm.password,
        role_ids: inviteForm.roleIds,
        assignment_ids: inviteForm.assignment_ids.length > 0 ? inviteForm.assignment_ids : undefined,
        vertical_ids: inviteForm.vertical_ids.length > 0 ? inviteForm.vertical_ids : undefined,
      });
    },
    [inviteForm, inviteMutation, assignmentOptions],
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your team members, invite new workspace operators, and control system permissions
          </p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => setIsInviteModalOpen(true)}
            className="h-9 text-xs gap-1.5 bg-primary hover:bg-[#1e293b] text-white"
          >
            <UserPlus size={15} />
            Invite Operator
          </Button>
        )}
      </div>

      {/* Users list card (Full Width) */}
      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-medium text-foreground">
            Active Operators
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
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
                  className="flex items-center justify-between p-4 hover:bg-background/60 transition-colors group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Avatar Circle */}
                    <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${avatarGrad} flex items-center justify-center font-semibold text-xs border border-border/50 shadow-sm flex-shrink-0`}>
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                        {/* Pulsing indicator - simulates active status */}
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                      </div>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail size={12} className="text-muted-foreground/85" />
                          <span className="truncate">{user.email || 'No email'}</span>
                        </p>
                        {user.phone_number && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone size={12} className="text-muted-foreground/85" />
                            <span className="truncate">{user.phone_number}</span>
                          </p>
                        )}
                      </div>
                      {user.roles && user.roles.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {user.roles.map((r) => (
                            <Badge
                              key={r.role_id}
                              variant="secondary"
                              className="bg-[#f1f5f9] text-[#475569] border-border text-[10px] font-medium rounded px-1.5 py-0"
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
              <div className="p-8 text-center text-sm text-muted-foreground">
                No active operators found. {canManage && 'Use the Invite Operator button to add your first member.'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invite Member Dialog Modal */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card border border-border rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-1.5">
              <UserPlus size={18} className="text-muted-foreground" />
              Invite Member
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Grant workspace access by sending an invitation
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Full Name</label>
              <Input
                type="text"
                placeholder="e.g. John Doe"
                value={inviteForm.name}
                onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="h-9 border-border bg-card text-foreground placeholder-[#94a3b8]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email Address (Optional)</label>
              <Input
                type="email"
                placeholder="e.g. john@company.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                className="h-9 border-border bg-card text-foreground placeholder-[#94a3b8]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Phone Number <span className="text-red-500">*</span></label>
              <Input
                type="tel"
                placeholder="e.g. +1 555-0199"
                value={inviteForm.phone_number}
                onChange={(e) => setInviteForm((f) => ({ ...f, phone_number: e.target.value }))}
                required
                className="h-9 border-border bg-card text-foreground placeholder-[#94a3b8]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Key size={12} className="text-muted-foreground" />
                Security Credentials
              </label>
              <div className="space-y-2 p-3 border border-border rounded-lg bg-background/50">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoGeneratePassword"
                    checked={inviteForm.autoGeneratePassword}
                    onChange={(e) => setInviteForm((f) => ({ ...f, autoGeneratePassword: e.target.checked }))}
                    className="rounded border-border bg-card text-primary focus:ring-ring h-4 w-4"
                  />
                  <label htmlFor="autoGeneratePassword" className="text-xs font-medium text-foreground cursor-pointer select-none">
                    Auto-generate random 8-character password
                  </label>
                </div>
                {!inviteForm.autoGeneratePassword && (
                  <div className="space-y-1.5 pt-1 animate-in fade-in-50 duration-200">
                    <Input
                      type="password"
                      placeholder="Enter custom password"
                      value={inviteForm.password}
                      onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))}
                      required
                      className="h-9 border-border bg-card text-foreground placeholder-[#94a3b8]"
                    />
                  </div>
                )}
              </div>
            </div>

            {assignmentOptions.length > 1 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  Store Locations / Assignments <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-border rounded-lg bg-background/50">
                  {assignmentOptions.map((opt) => {
                    const isSelected = inviteForm.assignment_ids.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setInviteForm((f) => ({
                            ...f,
                            assignment_ids: f.assignment_ids.includes(opt.id)
                              ? f.assignment_ids.filter((id) => id !== opt.id)
                              : [...f.assignment_ids, opt.id],
                          }));
                        }}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-md border transition-all text-left font-medium",
                          isSelected
                            ? "bg-primary text-white border-[#0f172a] shadow-sm"
                            : "bg-card text-muted-foreground border-border hover:border-slate-400 hover:text-foreground"
                        )}
                      >
                        {opt.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {assignmentOptions.length === 1 && (
              <div className="space-y-1 mt-1 bg-background/30 p-2 rounded border border-border/40">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Branch / Brand Assignment (Auto-selected)
                </label>
                <span className="text-xs text-foreground font-medium block">
                  {assignmentOptions[0]?.name ?? ''}
                </span>
              </div>
            )}

            {verticals && verticals.length > 1 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  Assigned Verticals / Departments
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-border rounded-lg bg-background/50">
                  {verticals.map((vert: any) => {
                    const isSelected = inviteForm.vertical_ids.includes(vert.id);
                    return (
                      <button
                        key={vert.id}
                        type="button"
                        onClick={() => {
                          setInviteForm((f) => ({
                            ...f,
                            vertical_ids: f.vertical_ids.includes(vert.id)
                              ? f.vertical_ids.filter((id) => id !== vert.id)
                              : [...f.vertical_ids, vert.id],
                          }));
                        }}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-md border transition-all text-left font-medium",
                          isSelected
                            ? "bg-primary text-white border-[#0f172a] shadow-sm"
                            : "bg-card text-muted-foreground border-border hover:border-slate-400 hover:text-foreground"
                        )}
                      >
                        {vert.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {verticals && verticals.length === 1 && (
              <div className="space-y-1 mt-1 bg-background/30 p-2 rounded border border-border/40">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Vertical / Product Scoping (Auto-selected)
                </label>
                <span className="text-xs text-foreground font-medium block">
                  {verticals[0]?.name ?? ''}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Shield size={12} className="text-muted-foreground" />
                Assigned Roles
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-border rounded-lg bg-background/50">
                {sortedRoles.map((role) => {
                  const isSelected = inviteForm.roleIds.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleRole(role.id)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-all text-left font-medium ${
                        isSelected
                          ? 'bg-primary text-white border-[#0f172a] shadow-sm'
                          : 'bg-card text-muted-foreground border-border hover:border-slate-400 hover:text-foreground'
                      }`}
                    >
                      {role.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="pt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInviteModalOpen(false)}
                className="w-full sm:w-auto h-9 text-xs border-border text-muted-foreground bg-card hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={inviteMutation.isPending}
                className="bg-primary hover:bg-[#1e293b] text-white w-full sm:w-auto h-9 text-xs flex items-center justify-center gap-1.5"
              >
                {inviteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Success Dialog showing created user credentials */}
      <Dialog
        open={!!createdUserCredentials}
        onOpenChange={(open) => {
          if (!open) setCreatedUserCredentials(null);
        }}
      >
        <DialogContent className="sm:max-w-md bg-card border border-border rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Shield className="text-emerald-500 h-5 w-5" />
              Operator Created Successfully
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              The user has been successfully provisioned. Please copy their credentials below. For security reasons, the password will not be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 p-4 rounded-lg bg-background/50 border border-border/60">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <span className="font-medium text-muted-foreground">Full Name:</span>
              <span className="col-span-2 font-semibold text-foreground">{createdUserCredentials?.name}</span>

              <span className="font-medium text-muted-foreground">Email:</span>
              <span className="col-span-2 font-mono text-foreground select-all break-all">{createdUserCredentials?.email || 'None'}</span>

              {createdUserCredentials?.phone_number && (
                <>
                  <span className="font-medium text-muted-foreground">Phone:</span>
                  <span className="col-span-2 font-mono text-foreground select-all">{createdUserCredentials?.phone_number}</span>
                </>
              )}

              <span className="font-medium text-muted-foreground">Password:</span>
              <span className="col-span-2 font-mono text-foreground font-semibold select-all break-all bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 w-fit">
                {createdUserCredentials?.password}
              </span>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const text = `Operator Credentials:\nName: ${createdUserCredentials?.name}\nEmail: ${createdUserCredentials?.email || 'None'}${createdUserCredentials?.phone_number ? `\nPhone: ${createdUserCredentials?.phone_number}` : ''}\nPassword: ${createdUserCredentials?.password}`;
                navigator.clipboard.writeText(text);
                toast.success('Credentials copied to clipboard');
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5"
            >
              Copy Credentials
            </Button>
            <Button
              type="button"
              onClick={() => setCreatedUserCredentials(null)}
              className="w-full sm:w-auto bg-primary text-white hover:bg-[#1e293b]"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
