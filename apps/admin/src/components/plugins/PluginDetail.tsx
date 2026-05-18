import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deprecatePlugin, disablePlugin } from '@/api/platform';
import { useAuth } from '@/contexts/auth.context';

interface PluginDetailProps {
  pluginId: string;
}

export function PluginDetail({ pluginId }: PluginDetailProps) {
  const { ability } = useAuth();
  const queryClient = useQueryClient();
  const [showDeprecateDialog, setShowDeprecateDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  const { data: plugin, isLoading } = useQuery({
    queryKey: ['plugin', pluginId],
    queryFn: () =>
      fetch(`/api/platform/plugins/${pluginId}`).then((res) => {
        if (!res.ok) throw new Error('Failed to fetch plugin');
        return res.json();
      }),
  });

  const deprecateMutation = useMutation({
    mutationFn: () => deprecatePlugin(pluginId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin', pluginId] });
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
      setShowDeprecateDialog(false);
      setConfirmName('');
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => disablePlugin(pluginId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin', pluginId] });
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
      setShowDisableDialog(false);
      setConfirmName('');
    },
  });

  const canManage = ability?.can('manage', 'PlatformPlugin') ?? false;

  if (isLoading) {
    return <div className="py-12 text-center">Loading...</div>;
  }

  if (!plugin) {
    return <div className="py-12 text-center">Plugin not found</div>;
  }

  const tenantCount = plugin.tenant_count ?? 0;

  const handleDeprecate = () => {
    if (confirmName !== plugin.package_name) return;
    deprecateMutation.mutate();
  };

  const handleDisable = () => {
    if (confirmName !== plugin.package_name) return;
    disableMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-lg bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{plugin.package_name}</h2>
            <p className="text-sm text-gray-500">{plugin.manifest?.name}</p>
          </div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
              plugin.status === 'active'
                ? 'bg-green-100 text-green-800'
                : plugin.status === 'deprecated'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {plugin.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-500">Version:</span>
            <p className="font-mono">{plugin.version}</p>
          </div>
          <div>
            <span className="font-medium text-gray-500">Tenants using:</span>
            <p>{tenantCount}</p>
          </div>
          <div>
            <span className="font-medium text-gray-500">Description:</span>
            <p>{plugin.manifest?.description}</p>
          </div>
          <div>
            <span className="font-medium text-gray-500">Industries:</span>
            <p>{plugin.manifest?.compatible_industries?.join(', ')}</p>
          </div>
          <div>
            <span className="font-medium text-gray-500">Hooks:</span>
            <p>{plugin.manifest?.hooks?.join(', ') ?? 'None'}</p>
          </div>
          <div>
            <span className="font-medium text-gray-500">Extends:</span>
            <p>{plugin.manifest?.extends?.join(', ') ?? 'None'}</p>
          </div>
        </div>
      </div>

      {canManage && plugin.status === 'active' && (
        <div className="space-y-4">
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h3 className="mb-4 text-lg font-semibold">Deprecate Plugin</h3>
            <p className="mb-3 text-sm text-gray-600">
              {tenantCount > 0
                ? `⚠️ ${tenantCount} tenant(s) are currently using this plugin. Deprecating will mark it as deprecated but not remove it.`
                : 'No tenants are using this plugin.'}
            </p>
            {!showDeprecateDialog ? (
              <button
                onClick={() => setShowDeprecateDialog(true)}
                className="rounded bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700"
              >
                Deprecate Plugin
              </button>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={`Type "${plugin.package_name}" to confirm`}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDeprecate}
                    disabled={confirmName !== plugin.package_name || deprecateMutation.isPending}
                    className="rounded bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700 disabled:opacity-50"
                  >
                    {deprecateMutation.isPending ? 'Deprecating...' : 'Confirm Deprecate'}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeprecateDialog(false);
                      setConfirmName('');
                    }}
                    className="rounded border px-4 py-2 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg bg-white p-6 shadow-md">
            <h3 className="mb-4 text-lg font-semibold text-red-600">Disable Plugin (Emergency)</h3>
            <p className="mb-3 text-sm text-gray-600">
              This will immediately disable the plugin for all tenants. Use only in emergencies.
            </p>
            {!showDisableDialog ? (
              <button
                onClick={() => setShowDisableDialog(true)}
                className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Disable Plugin
              </button>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={`Type "${plugin.package_name}" to confirm`}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDisable}
                    disabled={confirmName !== plugin.package_name || disableMutation.isPending}
                    className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {disableMutation.isPending ? 'Disabling...' : 'Confirm Disable'}
                  </button>
                  <button
                    onClick={() => {
                      setShowDisableDialog(false);
                      setConfirmName('');
                    }}
                    className="rounded border px-4 py-2 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
