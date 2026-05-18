import { useQuery } from '@tanstack/react-query';
import { listPlugins } from '@/api/platform';
import { useNavigate } from '@tanstack/react-router';

export function PluginRegistry() {
  const navigate = useNavigate();
  const { data: plugins, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: listPlugins,
  });

  if (isLoading) {
    return <div className="py-12 text-center">Loading...</div>;
  }

  if (!plugins || plugins.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg font-medium">No plugins registered</p>
        <p className="mt-2 text-sm text-gray-500">Register a plugin to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-medium">Package</th>
            <th className="px-4 py-2 text-left text-sm font-medium">Version</th>
            <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-2 text-left text-sm font-medium">Industries</th>
            <th className="px-4 py-2 text-left text-sm font-medium">Hooks</th>
            <th className="px-4 py-2 text-left text-sm font-medium">Tenants</th>
          </tr>
        </thead>
        <tbody>
          {plugins.map((plugin) => (
            <tr
              key={plugin.id}
              className="cursor-pointer border-t hover:bg-muted/30"
              onClick={() => navigate({ to: `/admin/plugins/${plugin.id}` })}
            >
              <td className="px-4 py-2 text-sm">
                <div>
                  <p className="font-medium">{plugin.package_name}</p>
                  <p className="text-xs text-gray-500">{plugin.manifest?.name}</p>
                </div>
              </td>
              <td className="px-4 py-2 text-sm font-mono">{plugin.version}</td>
              <td className="px-4 py-2 text-sm">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    plugin.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : plugin.status === 'deprecated'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  {plugin.status}
                </span>
              </td>
              <td className="px-4 py-2 text-sm">
                {plugin.manifest?.compatible_industries?.join(', ') ?? '—'}
              </td>
              <td className="px-4 py-2 text-sm">
                {plugin.manifest?.hooks?.join(', ') ?? '—'}
              </td>
              <td className="px-4 py-2 text-sm">{plugin.tenant_count ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
