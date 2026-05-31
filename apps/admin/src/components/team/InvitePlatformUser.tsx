import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invitePlatformUser } from '@/api/platform';
import { useAuth } from '@/contexts/auth.context';
import { PlatformRole } from '@meta-crm/types';
import { Mail, UserPlus, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ROLE_HIERARCHY: Record<PlatformRole, number> = {
  [PlatformRole.PlatformOwner]: 100,
  [PlatformRole.PlatformAdmin]: 80,
  [PlatformRole.PlatformSupport]: 50,
  [PlatformRole.PlatformSales]: 50,
  [PlatformRole.PlatformBilling]: 50,
  [PlatformRole.PlatformDeveloper]: 50,
  [PlatformRole.PlatformOps]: 50,
};

const ALL_ROLES: PlatformRole[] = [
  PlatformRole.PlatformAdmin,
  PlatformRole.PlatformSupport,
  PlatformRole.PlatformSales,
  PlatformRole.PlatformBilling,
  PlatformRole.PlatformDeveloper,
  PlatformRole.PlatformOps,
];

const ROLE_LABELS: Record<PlatformRole, string> = {
  [PlatformRole.PlatformOwner]: 'Platform Owner',
  [PlatformRole.PlatformAdmin]: 'Platform Admin',
  [PlatformRole.PlatformSupport]: 'Platform Support',
  [PlatformRole.PlatformSales]: 'Platform Sales',
  [PlatformRole.PlatformBilling]: 'Platform Billing',
  [PlatformRole.PlatformDeveloper]: 'Platform Developer',
  [PlatformRole.PlatformOps]: 'Platform Ops',
};

const ROLE_DESCRIPTIONS: Record<PlatformRole, string> = {
  [PlatformRole.PlatformOwner]: 'All-Access root privilege',
  [PlatformRole.PlatformAdmin]: 'Full tenant and plan controls',
  [PlatformRole.PlatformSupport]: 'Tenant viewing and impersonation',
  [PlatformRole.PlatformSales]: 'Subscription plan builder and viewer',
  [PlatformRole.PlatformBilling]: 'Invoice adjustments and payouts ledger',
  [PlatformRole.PlatformDeveloper]: 'Platform catalog plugins registration',
  [PlatformRole.PlatformOps]: 'Bull-queues diagnostics controls',
};

export function InvitePlatformUser() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentUserLevel = user?.platform_role ? ROLE_HIERARCHY[user.platform_role] : 0;

  const availableRoles = useMemo(() => {
    return ALL_ROLES.filter((r) => ROLE_HIERARCHY[r] <= currentUserLevel);
  }, [currentUserLevel]);

  const inviteMutation = useMutation({
    mutationFn: () => invitePlatformUser({ name, email, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      setSuccess(`Invitation successfully sent to ${email}`);
      setName('');
      setEmail('');
      setRole('');
      setError('');
    },
    onError: (err: any) => {
      setError(err.message ?? 'Failed to invite platform operator');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    inviteMutation.mutate();
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name input */}
        <div className="space-y-1">
          <label htmlFor="inviteName" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Operator Full Name
          </label>
          <input
            id="inviteName"
            type="text"
            placeholder="e.g. John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-muted-foreground text-foreground"
            required
          />
        </div>

        {/* Email input */}
        <div className="space-y-1">
          <label htmlFor="inviteEmail" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Operator Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              id="inviteEmail"
              type="email"
              placeholder="e.g. operator@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-muted-foreground text-foreground"
              required
            />
          </div>
        </div>

        {/* Role select */}
        <div className="space-y-1">
          <label htmlFor="inviteRole" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Operator Platform Role
          </label>
          <select
            id="inviteRole"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-foreground"
            required
          >
            <option value="">Select platform permission tier...</option>
            {availableRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}
              </option>
            ))}
          </select>
          {availableRoles.length === 0 && (
            <p className="mt-1.5 text-[10px] text-rose-500 font-medium">No roles available. Your operator hierarchy is too low.</p>
          )}
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-lg p-3 text-xs text-rose-700 font-medium">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-700 font-medium">
            <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={inviteMutation.isPending || availableRoles.length === 0}
          className="w-full bg-fin-orange hover:bg-fin-orange/90 text-white rounded-lg h-9 font-medium text-sm shadow-sm transition-all gap-1.5 mt-2"
        >
          <UserPlus size={15} />
          {inviteMutation.isPending ? 'Sending Invitation...' : 'Send Platform Invitation'}
        </Button>
      </form>

      {/* Info helper */}
      <div className="bg-muted border border-border rounded-lg p-3 flex items-start gap-2 mt-4 text-[11px] text-muted-foreground leading-normal">
        <Info size={14} className="mt-0.5 text-fin-orange flex-shrink-0" />
        <span>Platform operators receive password-less magic invite links to claim their administrator access tokens instantly.</span>
      </div>
    </div>
  );
}
