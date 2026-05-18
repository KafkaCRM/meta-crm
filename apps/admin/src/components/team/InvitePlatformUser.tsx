import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invitePlatformUser } from '@/api/platform';
import { useAuth } from '@/contexts/auth.context';
import { PlatformRole } from '@meta-crm/types';

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
      setSuccess(`Invitation sent to ${email}`);
      setName('');
      setEmail('');
      setRole('');
      setError('');
    },
    onError: (err: any) => {
      setError(err.message ?? 'Failed to invite user');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    inviteMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-6 text-xl font-bold">Invite Platform User</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="inviteName" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <input
            id="inviteName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label htmlFor="inviteEmail" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="inviteEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label htmlFor="inviteRole" className="mb-1 block text-sm font-medium">
            Role
          </label>
          <select
            id="inviteRole"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">Select role...</option>
            {availableRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          {availableRoles.length === 0 && (
            <p className="mt-1 text-xs text-gray-500">No roles available to assign</p>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
        <button
          type="submit"
          disabled={inviteMutation.isPending || availableRoles.length === 0}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
        </button>
      </form>
    </div>
  );
}
