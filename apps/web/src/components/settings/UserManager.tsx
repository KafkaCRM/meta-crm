import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Mail, Shield, UserPlus, X, Phone, Key } from 'lucide-react';
import { settingsApi, type User } from '@/api/settings';
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
    phone_number: '',
    password: '',
    autoGeneratePassword: true,
  });

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [createdUserCredentials, setCreatedUserCredentials] = useState<{
    name: string;
    phone_number?: string;
    password?: string;
  } | null>(null);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { data: users, isLoading } = useQuery({
    queryKey: ['settings', 'users'],
    queryFn: () => settingsApi.users.list(),
    staleTime: 30_000,
  });

  const inviteMutation = useMutation({
    mutationFn: (data: {
      name: string;
      phone_number: string;
      password?: string;
    }) => settingsApi.users.invite(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'users'] });
      toast.success('User created successfully');
      setCreatedUserCredentials({
        name: data.name,
        phone_number: data.phone_number,
        password: data.temporary_password,
      });
      setInviteForm({
        name: '',
        phone_number: '',
        password: '',
        autoGeneratePassword: true,
      });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to create user'),
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
      const errors: Record<string, string> = {};

      if (!inviteForm.name.trim()) errors.name = 'Name is required';
      if (!inviteForm.phone_number.trim()) errors.phone_number = 'Phone number is required';
      if (!inviteForm.autoGeneratePassword && !inviteForm.password.trim()) errors.password = 'Enter a password or enable auto-generate';

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }

      setValidationErrors({});

      inviteMutation.mutate({
        name: inviteForm.name,
        phone_number: inviteForm.phone_number.trim(),
        password: inviteForm.autoGeneratePassword ? undefined : inviteForm.password,
      });
    },
    [inviteForm, inviteMutation],
  );

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
            Manage your team members, create new workspace users, and control system permissions
          </p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => setIsInviteModalOpen(true)}
            className="h-9 text-xs gap-1.5 bg-primary hover:bg-[#1e293b] text-white"
          >
            <UserPlus size={15} />
            Create User
          </Button>
        )}
      </div>

      {/* Users list card (Full Width) */}
      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-medium text-foreground">
            Active Users
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {users?.length ?? 0} users active in this tenant
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
                No active users found. {canManage && 'Use the Create User button to add your first member.'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create User Dialog Modal */}
      <Dialog
        open={isInviteModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setValidationErrors({});
          }
          setIsInviteModalOpen(open);
          if (!open) {
            setCreatedUserCredentials(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px] bg-card border border-border rounded-xl max-h-[90vh] overflow-y-auto">
          {!createdUserCredentials ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-1.5">
                  <UserPlus size={18} className="text-muted-foreground" />
                  Create User
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Add a new workspace member
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Full Name <span className="text-red-500">*</span></label>
                    <Input
                      type="text"
                      placeholder="John Doe"
                      value={inviteForm.name}
                      onChange={(e) => { setInviteForm((f) => ({ ...f, name: e.target.value })); setValidationErrors((p) => ({ ...p, name: '' })); }}
                      required
                      className={cn("h-9 border-border bg-card text-foreground placeholder:text-muted-foreground", validationErrors.name && "border-red-300")}
                    />
                    {validationErrors.name && <p className="text-[10px] text-red-500">{validationErrors.name}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Phone Number <span className="text-red-500">*</span></label>
                    <Input
                      type="tel"
                      placeholder="+1 555-0199"
                      value={inviteForm.phone_number}
                      onChange={(e) => { setInviteForm((f) => ({ ...f, phone_number: e.target.value })); setValidationErrors((p) => ({ ...p, phone_number: '' })); }}
                      required
                      className={cn("h-9 border-border bg-card text-foreground placeholder:text-muted-foreground", validationErrors.phone_number && "border-red-300")}
                    />
                    {validationErrors.phone_number && <p className="text-[10px] text-red-500">{validationErrors.phone_number}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Key size={12} className="text-muted-foreground" />
                    Password
                  </label>
                  <div className="space-y-2 p-3 border border-border rounded-lg bg-background/50">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={inviteForm.autoGeneratePassword}
                        onChange={(e) => setInviteForm((f) => ({ ...f, autoGeneratePassword: e.target.checked }))}
                        className="rounded border-border bg-card accent-primary h-4 w-4"
                      />
                      <span className="text-xs font-medium text-foreground">Auto-generate secure password</span>
                    </label>
                    {!inviteForm.autoGeneratePassword && (
                      <div className="animate-in fade-in-50 duration-200">
                        <Input
                          type="password"
                          placeholder="Enter custom password"
                          value={inviteForm.password}
                          onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))}
                          required
                          className="h-9 border-border bg-card text-foreground placeholder:text-muted-foreground"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="pt-2 flex gap-2">
                  <Button type="button" variant="outline" onClick={() => { setIsInviteModalOpen(false); setValidationErrors({}); }}
                    className="flex-1 h-9 text-xs border-border text-muted-foreground bg-card hover:bg-muted">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={inviteMutation.isPending}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white h-9 text-xs flex items-center justify-center gap-1.5">
                    {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus size={14} />}
                    Create User
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Shield className="text-emerald-500 h-5 w-5" />
                  User Created
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Copy these credentials now — the password won't be shown again.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 my-2 p-4 rounded-lg bg-emerald-50/30 border border-emerald-100">
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  <span className="font-medium text-muted-foreground">Name:</span>
                  <span className="font-semibold text-foreground">{createdUserCredentials.name}</span>

                  {createdUserCredentials.phone_number && (
                    <>
                      <span className="font-medium text-muted-foreground">Phone:</span>
                      <span className="font-mono text-foreground select-all">{createdUserCredentials.phone_number}</span>
                    </>
                  )}

                  <span className="font-medium text-muted-foreground">Password:</span>
                  <span className="font-mono text-foreground font-bold select-all bg-white px-2 py-0.5 rounded border border-emerald-200 w-fit">
                    {createdUserCredentials.password}
                  </span>
                </div>
              </div>

              <DialogFooter className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => {
                  const text = `Name: ${createdUserCredentials.name}${createdUserCredentials.phone_number ? `\nPhone: ${createdUserCredentials.phone_number}` : ''}\nPassword: ${createdUserCredentials.password}`;
                  navigator.clipboard.writeText(text);
                  toast.success('Copied to clipboard');
                }} className="flex-1 text-xs h-9">
                  Copy All
                </Button>
                <Button type="button" onClick={() => {
                  setCreatedUserCredentials(null);
                   setInviteForm({ name: '', phone_number: '', password: '', autoGeneratePassword: true });
                }} className="flex-1 bg-primary text-white hover:bg-primary/90 text-xs h-9">
                  Create Another
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
