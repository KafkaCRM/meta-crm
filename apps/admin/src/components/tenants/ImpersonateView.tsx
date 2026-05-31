import { useQuery } from '@tanstack/react-query';
import { getTenant } from '@/api/platform';

interface ImpersonateViewProps {
  tenantId: string;
}

export function ImpersonateView({ tenantId }: ImpersonateViewProps) {
  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => getTenant(tenantId),
  });

  if (isLoading) {
    return <div className="py-12 text-center">Loading...</div>;
  }

  if (!tenant) {
    return <div className="py-12 text-center">Tenant not found</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-lg border-2 border-yellow-300 bg-yellow-50 p-4">
        <p className="text-sm font-medium text-yellow-800">
          Read-Only View — You are viewing this tenant as a platform support user. No changes can be made.
        </p>
      </div>

      <div className="rounded-lg bg-card p-6 shadow-md">
        <h2 className="mb-4 text-xl font-bold">{tenant.name}</h2>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-500">Slug:</span>
            <p className="mt-1 rounded bg-gray-100 px-3 py-2">{tenant.slug}</p>
          </div>
          <div>
            <span className="font-medium text-gray-500">Industry:</span>
            <p className="mt-1 rounded bg-gray-100 px-3 py-2">{tenant.industry}</p>
          </div>
          <div>
            <span className="font-medium text-gray-500">Status:</span>
            <p className="mt-1 rounded bg-gray-100 px-3 py-2">{tenant.status}</p>
          </div>
          <div>
            <span className="font-medium text-gray-500">Created:</span>
            <p className="mt-1 rounded bg-gray-100 px-3 py-2">
              {new Date(tenant.created_at).toLocaleDateString()}
            </p>
          </div>
          <div>
            <span className="font-medium text-gray-500">Branches:</span>
            <p className="mt-1 rounded bg-gray-100 px-3 py-2">{tenant.branch_count}</p>
          </div>
          <div>
            <span className="font-medium text-gray-500">Users:</span>
            <p className="mt-1 rounded bg-gray-100 px-3 py-2">{tenant.user_count}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-card p-6 shadow-md">
        <h3 className="mb-4 text-lg font-semibold">Installed Plugins</h3>
        {tenant.plugin_list.length > 0 ? (
          <ul className="space-y-2">
            {tenant.plugin_list.map((plugin) => (
              <li key={plugin} className="rounded bg-gray-100 px-3 py-2 text-sm">
                {plugin}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No plugins installed</p>
        )}
      </div>
    </div>
  );
}
