import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPlatformUsers, deactivatePlatformUser, PlatformUser } from '@/api/platform';
import { useAuth } from '@/contexts/auth.context';
import { ShieldAlert, Ban, UserCheck, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const AVATAR_COLORS = [
  'bg-indigo-100 text-fin-orange',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
];

export function PlatformUserList() {
  const { ability } = useAuth();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['platform-users'],
    queryFn: listPlatformUsers,
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => deactivatePlatformUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      toast.success('Platform admin user deactivated successfully');
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to deactivate platform user');
    },
  });

  const canDelete = ability?.can('delete', 'PlatformUser') ?? false;

  if (isLoading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
        <div className="w-5 h-5 border-2 border-border border-t-indigo-600 rounded-full animate-spin" />
        Loading system operators directory...
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        <ShieldAlert size={28} className="mx-auto mb-2 text-muted-foreground/70" />
        No platform operator users registered in this environment.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-muted-foreground font-semibold border-b border-border">
          <tr>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider">Operator Info</th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider">Platform Role</th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider">Account Status</th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider">Provisioned At</th>
            {canDelete && <th className="px-4 py-3 text-right text-xs uppercase tracking-wider">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50 bg-card">
          {users.map((user: PlatformUser, index) => {
            const isActive = user.status === 'active';
            const initials = user.name
              ? user.name.slice(0, 2).toUpperCase()
              : user.email.slice(0, 2).toUpperCase();
            
            const colorClass = AVATAR_COLORS[index % AVATAR_COLORS.length];

            return (
              <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                {/* Operator info */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${colorClass}`}>
                      {initials}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground leading-tight">{user.name}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">{user.email}</span>
                    </div>
                  </div>
                </td>

                {/* Role */}
                <td className="px-4 py-3">
                  <Badge className="bg-fin-orange/10 hover:bg-indigo-100 border-transparent text-fin-orange text-[10px] font-semibold px-2 py-0.5 rounded">
                    {user.role?.replace('Platform', '') ?? 'Support'}
                  </Badge>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-slate-100 text-muted-foreground border border-border'
                  }`}>
                    {isActive ? (
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    )}
                    {user.status}
                  </span>
                </td>

                {/* Date */}
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-muted-foreground" />
                    {new Date(user.created_at).toLocaleDateString()}
                  </div>
                </td>

                {/* Actions */}
                {canDelete && (
                  <td className="px-4 py-3 text-right">
                    {isActive ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deactivateMutation.isPending}
                        onClick={() => deactivateMutation.mutate(user.id)}
                        className="h-7 px-2.5 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-md font-semibold gap-1"
                      >
                        <Ban size={12} />
                        Deactivate
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground font-medium">Deactivated</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
