import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Trash2, ArrowUpRight, Lock, Puzzle, Loader2, Sparkles } from 'lucide-react';
import { settingsApi, type Plugin } from '@/api/settings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';

export function PluginStore() {
  const { can } = usePermissions();
  const canManage = can('manage', 'Plugin');
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
      toast.success('Plugin installed successfully');
    },
    onError: () => toast.error('Failed to install plugin'),
  });

  const uninstallMutation = useMutation({
    mutationFn: (id: string) => settingsApi.plugins.uninstall(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'plugins'] });
      toast.success('Plugin uninstalled successfully');
    },
    onError: () => toast.error('Failed to uninstall plugin'),
  });

  const handleInstall = useCallback(
    (id: string) => installMutation.mutate(id),
    [installMutation],
  );

  const handleUninstall = useCallback(
    (id: string) => {
      if (window.confirm('Are you sure you want to uninstall this plugin? Any associated data integrations might stop working.')) {
        uninstallMutation.mutate(id);
      }
    },
    [uninstallMutation],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#94a3b8]" />
      </div>
    );
  }

  // Categories of plugins
  const categories = ['All Extensions', 'Productivity', 'Integrations', 'Developer'];

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0f172a]">Plugin Store</h1>
          <p className="text-sm text-[#64748b] mt-0.5">
            Discover utility add-ons, connect developer hooks, and scale your workspace capability
          </p>
        </div>
      </div>

      {/* Grid listing */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plugins?.map((plugin) => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            onInstall={() => handleInstall(plugin.id)}
            onUninstall={() => handleUninstall(plugin.id)}
            isInstalling={installMutation.isPending && installMutation.variables === plugin.id}
            isUninstalling={uninstallMutation.isPending && uninstallMutation.variables === plugin.id}
            canManage={canManage}
          />
        ))}
        {plugins?.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-[#64748b]">
            No plugins currently available in the marketplace registry.
          </div>
        )}
      </div>
    </div>
  );
}

interface PluginCardProps {
  plugin: Plugin;
  onInstall: () => void;
  onUninstall: () => void;
  isInstalling: boolean;
  isUninstalling: boolean;
  canManage: boolean;
}

function PluginCard({ plugin, onInstall, onUninstall, isInstalling, isUninstalling, canManage }: PluginCardProps) {
  const isPlanLocked = plugin.requires_plan && !plugin.installed;

  return (
    <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none overflow-hidden hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group">
      <CardContent className="p-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 text-indigo-600 border border-indigo-100 rounded-lg group-hover:scale-105 transition-transform">
            <Puzzle size={18} />
          </div>
          <Badge variant="outline" className="font-mono text-[9px] text-[#94a3b8] py-0 px-1 border-[#e2e8f0]">
            v{plugin.version}
          </Badge>
        </div>

        <div className="mt-3.5 space-y-1">
          <h3 className="text-sm font-semibold text-[#0f172a]">{plugin.name}</h3>
          <p className="text-xs text-[#64748b] leading-relaxed line-clamp-3 min-h-[48px]">
            {plugin.description}
          </p>
        </div>

        {plugin.requires_plan && (
          <div className="mt-3 flex items-center gap-1 text-[10px] text-amber-600 font-medium">
            <Lock size={10} className="stroke-[2.5px]" />
            <span>Requires {plugin.requires_plan} subscription</span>
          </div>
        )}
      </CardContent>

      <div className="bg-[#f8fafc] border-t border-[#e2e8f0] px-4 py-3 flex items-center justify-between">
        {plugin.installed ? (
          <>
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              <Sparkles size={11} className="fill-emerald-100" />
              Installed
            </span>
            {canManage && (
              <Button
                variant="ghost"
                size="xs"
                disabled={isUninstalling}
                onClick={onUninstall}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 text-[11px] font-semibold h-7 rounded-md"
              >
                {isUninstalling ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Trash2 size={11} className="mr-1" />
                )}
                Uninstall
              </Button>
            )}
          </>
        ) : isPlanLocked ? (
          <>
            <span className="text-[11px] text-amber-600 font-medium">Locked</span>
            {canManage && (
              <Button
                variant="outline"
                size="xs"
                className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 text-[11px] font-semibold h-7 rounded-md"
              >
                Upgrade
                <ArrowUpRight size={11} className="ml-1" />
              </Button>
            )}
          </>
        ) : (
          <>
            <span className="text-[11px] text-[#94a3b8]">Ready to deploy</span>
            {canManage && (
              <Button
                onClick={onInstall}
                disabled={isInstalling}
                size="xs"
                className="bg-[#0f172a] hover:bg-[#1e293b] text-white text-[11px] font-semibold h-7 rounded-md"
              >
                {isInstalling ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Download size={11} className="mr-1" />
                )}
                Install Extension
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
