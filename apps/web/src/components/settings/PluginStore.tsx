import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Trash2, ArrowUpRight, Lock } from 'lucide-react';
import { settingsApi, type Plugin } from '@/api/settings';

export function PluginStore() {
  const queryClient = useQueryClient();

  const { data: plugins, isLoading } = useQuery({
    queryKey: ['settings', 'plugins'],
    queryFn: () => settingsApi.plugins.list(),
    staleTime: 30_000,
  });

  const installMutation = useMutation({
    mutationFn: (id: string) => settingsApi.plugins.install(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'plugins'] });
      toast.success('Plugin installed');
    },
    onError: () => toast.error('Failed to install plugin'),
  });

  const uninstallMutation = useMutation({
    mutationFn: (id: string) => settingsApi.plugins.uninstall(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'plugins'] });
      toast.success('Plugin uninstalled');
    },
    onError: () => toast.error('Failed to uninstall plugin'),
  });

  const handleInstall = useCallback(
    (id: string) => installMutation.mutate(id),
    [installMutation],
  );

  const handleUninstall = useCallback(
    (id: string) => {
      if (window.confirm('Uninstall this plugin?')) {
        uninstallMutation.mutate(id);
      }
    },
    [uninstallMutation],
  );

  if (isLoading) {
    return <div className="text-muted-foreground">Loading plugins...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plugin Store</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Install and manage plugins
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plugins?.map((plugin) => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            onInstall={() => handleInstall(plugin.id)}
            onUninstall={() => handleUninstall(plugin.id)}
          />
        ))}
      </div>

      {plugins?.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No plugins available.
        </div>
      )}
    </div>
  );
}

interface PluginCardProps {
  plugin: Plugin;
  onInstall: () => void;
  onUninstall: () => void;
}

function PluginCard({ plugin, onInstall, onUninstall }: PluginCardProps) {
  const isPlanLocked = plugin.requires_plan && !plugin.installed;

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col">
      <div className="flex-1">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-medium">{plugin.name}</h3>
          <span className="text-xs text-muted-foreground">v{plugin.version}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{plugin.description}</p>
        {plugin.requires_plan && (
          <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
            <Lock className="h-3 w-3" />
            Requires {plugin.requires_plan} plan
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {plugin.installed ? (
          <>
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Download className="h-3 w-3" />
              Installed
            </span>
            <button
              onClick={onUninstall}
              className="ml-auto text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Uninstall
            </button>
          </>
        ) : isPlanLocked ? (
          <button
            className="ml-auto text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            <ArrowUpRight className="h-3 w-3" />
            Upgrade
          </button>
        ) : (
          <button
            onClick={onInstall}
            className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 flex items-center gap-1"
          >
            <Download className="h-3 w-3" />
            Install
          </button>
        )}
      </div>
    </div>
  );
}
