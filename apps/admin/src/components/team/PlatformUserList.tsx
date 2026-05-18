import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPlatformUsers, deactivatePlatformUser, PlatformUser } from '@/api/platform';
import { useAuth } from '@/contexts/auth.context';

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
    },
  });

  const canDelete = ability?.can('delete', 'PlatformUser') ?? false;

  if (isLoading) {
    return <div className="py-12 text-center">Loading...</div>;
  }

  if (!users || users.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg font-medium">No platform users found</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-medium">Name</th>
            <th className="px-4 py-2 text-left text-sm font-medium">Email</th>
            <th className="px-4 py-2 text-left text-sm font-medium">Role</th>
            <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-2 text-left text-sm font-medium">Created</th>
            {canDelete && <th className="px-4 py-2 text-left text-sm font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {users.map((user: PlatformUser) => (
            <tr key={user.id} className="border-t">
              <td className="px-4 py-2 text-sm font-medium">{user.name}</td>
              <td className="px-4 py-2 text-sm">{user.email}</td>
              <td className="px-4 py-2 text-sm">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">
                  {user.role ?? '—'}
                </span>
              </td>
              <td className="px-4 py-2 text-sm">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    user.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {user.status}
                </span>
              </td>
              <td className="px-4 py-2 text-sm">
                {new Date(user.created_at).toLocaleDateString()}
              </td>
              {canDelete && (
                <td className="px-4 py-2 text-sm">
                  {user.status === 'active' && (
                    <button
                      onClick={() => deactivateMutation.mutate(user.id)}
                      disabled={deactivateMutation.isPending}
                      className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
