import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPlugin, deprecatePlugin, disablePlugin } from '@/api/platform';
import { useAuth } from '@/contexts/auth.context';
import { ShieldAlert, AlertTriangle, Play, Database, Layers, Radio, HelpCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';

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
    queryFn: () => getPlugin(pluginId),
  });

  const deprecateMutation = useMutation({
    mutationFn: () => deprecatePlugin(pluginId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin', pluginId] });
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
      setShowDeprecateDialog(false);
      setConfirmName('');
      toast.warning('Platform plugin marked as deprecated');
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to deprecate plugin');
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => disablePlugin(pluginId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin', pluginId] });
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
      setShowDisableDialog(false);
      setConfirmName('');
      toast.error('Platform plugin disabled immediately (Emergency trigger)');
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Emergency disable failed');
    },
  });

  const handleDeprecate = () => {
    deprecateMutation.mutate();
  };

  const handleDisable = () => {
    disableMutation.mutate();
  };

  const canManage = ability?.can('manage', 'PlatformPlugin') ?? false;

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
        <div className="w-5 h-5 border-2 border-border border-t-indigo-600 rounded-full animate-spin" />
        Resolving plugin manifest payload...
      </div>
    );
  }

  if (!plugin) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm">
        <ShieldAlert size={28} className="mx-auto mb-2 text-rose-500 animate-bounce" />
        Platform plugin record was not found or is inactive.
      </div>
    );
  }

  const tenantCount = plugin.tenant_count ?? 0;
  const isUniversal = plugin.manifest?.compatible_industries?.includes('*') ?? false;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Premium Details Shell */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        
        {/* Banner header */}
        <div className="p-6 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/50">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-widest text-fin-orange font-bold">Extension Details</span>
            <h2 className="text-lg font-extrabold text-foreground leading-tight">{plugin.manifest?.name ?? 'Plugin Manifest'}</h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{plugin.package_name}</p>
          </div>

          <div className="flex gap-2">
            {isUniversal && (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100/50 hover:bg-emerald-50 text-xs px-2.5 py-0.5 rounded font-bold shadow-none">
                Universal Extension
              </Badge>
            )}
            <Badge className={`text-xs px-2.5 py-0.5 rounded font-bold border shadow-none ${
              plugin.status === 'active' 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : plugin.status === 'deprecated'
                  ? 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'
                  : 'bg-rose-50 text-rose-700 border-rose-100'
            }`}>
              {plugin.status.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Content body */}
        <div className="p-6 space-y-6">
          
          {/* Main info panel */}
          <div className="grid gap-6 md:grid-cols-3">
            
            <div className="bg-muted/60 p-4 rounded-xl border border-border/60 space-y-1 font-mono text-xs">
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Package Version</span>
              <p className="text-sm font-extrabold text-foreground mt-1 flex items-center gap-1.5">
                <Database size={13} className="text-muted-foreground" />
                v{plugin.version}
              </p>
            </div>

            <div className="bg-muted/60 p-4 rounded-xl border border-border/60 space-y-1 font-mono text-xs">
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Subscriber Density</span>
              <p className="text-sm font-extrabold text-foreground mt-1 flex items-center gap-1.5">
                <Layers size={13} className="text-muted-foreground" />
                {tenantCount} active workspaces
              </p>
            </div>

            <div className="bg-muted/60 p-4 rounded-xl border border-border/60 space-y-1 font-mono text-xs">
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Requires Service Plan</span>
              <p className="text-sm font-extrabold text-fin-orange mt-1 flex items-center gap-1.5">
                <Play size={13} className="text-fin-orange" />
                {plugin.manifest?.requires_plan ?? 'Standard (Any)'}
              </p>
            </div>

          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Developer Description</span>
            <p className="text-sm text-foreground/80 leading-relaxed bg-muted p-4 rounded-xl border border-border/50">
              {plugin.manifest?.description ?? 'No detailed description declared in manifest.'}
            </p>
          </div>

          {/* Detailed Specifications */}
          <div className="grid gap-6 md:grid-cols-3 pt-2">
            
            {/* Industries */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Compatible Industries</span>
              <div className="flex flex-wrap gap-1">
                {plugin.manifest?.compatible_industries?.map((ind: string) => (
                  <Badge key={ind} className="bg-fin-orange/10/60 border-fin-orange/20/50 hover:bg-fin-orange/10 text-fin-orange text-[10px] font-semibold px-2 py-0.5 rounded shadow-none">
                    {ind}
                  </Badge>
                )) ?? <span className="text-xs text-muted-foreground font-medium">None</span>}
              </div>
            </div>

            {/* System Hooks */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Registered Event Hooks</span>
              <div className="flex flex-wrap gap-1">
                {plugin.manifest?.hooks?.map((hk: string) => (
                  <Badge key={hk} className="bg-purple-50/60 border-purple-100/50 hover:bg-purple-50 text-purple-700 text-[10px] font-semibold px-2 py-0.5 rounded font-mono shadow-none">
                    {hk}
                  </Badge>
                )) ?? <span className="text-xs text-muted-foreground font-medium">None</span>}
              </div>
            </div>

            {/* Extends UI */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Extends CRM Layout</span>
              <div className="flex flex-wrap gap-1">
                {plugin.manifest?.extends?.map((ext: string) => (
                  <Badge key={ext} className="bg-sky-50/60 border-sky-100/50 hover:bg-sky-50 text-sky-700 text-[10px] font-semibold px-2 py-0.5 rounded shadow-none">
                    {ext}
                  </Badge>
                )) ?? <span className="text-xs text-muted-foreground font-medium">None</span>}
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Emergency Management Controls Drawer */}
      {canManage && plugin.status === 'active' && (
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Deprecate block */}
          <Card className="bg-card border-border rounded-xl shadow-sm overflow-hidden">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-foreground text-sm">Deprecate Plugin package</h3>
                  <p className="text-xs text-muted-foreground leading-normal">
                    {tenantCount > 0
                      ? `⚠️ ${tenantCount} tenant workspace(s) actively license this plugin. Deprecation hides it from new plan creations without breaking active systems.`
                      : 'No active tenants license this module. Safe to deprecate.'}
                  </p>
                </div>
              </div>

              {!showDeprecateDialog ? (
                <Button
                  onClick={() => setShowDeprecateDialog(true)}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-lg h-9 font-medium text-xs shadow-sm transition-colors"
                >
                  Initiate Deprecate Cascade
                </Button>
              ) : (
                <div className="space-y-3 pt-2">
                  <input
                    type="text"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={`Type "${plugin.package_name}" to verify`}
                    className="w-full px-3 py-1.5 text-xs bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-mono"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDeprecate}
                      disabled={confirmName !== plugin.package_name || deprecateMutation.isPending}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg h-9 font-semibold text-xs disabled:opacity-50"
                    >
                      {deprecateMutation.isPending ? 'Processing...' : 'Confirm Deprecate'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeprecateDialog(false);
                        setConfirmName('');
                      }}
                      className="h-9 px-4 text-xs border-border text-muted-foreground rounded-lg hover:bg-muted bg-card"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Emergency disable */}
          <Card className="bg-card border-border rounded-xl shadow-sm overflow-hidden">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 flex-shrink-0 animate-pulse">
                  <ShieldAlert size={18} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-950 text-sm">Emergency System Disablement</h3>
                  <p className="text-xs text-muted-foreground leading-normal">
                    Immediately strip this plugin from all client instances in the database. Use in cases of security compromise or database failures.
                  </p>
                </div>
              </div>

              {!showDisableDialog ? (
                <Button
                  onClick={() => setShowDisableDialog(true)}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-lg h-9 font-medium text-xs shadow-sm transition-colors"
                >
                  Trigger Emergency Disable
                </Button>
              ) : (
                <div className="space-y-3 pt-2">
                  <input
                    type="text"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={`Type "${plugin.package_name}" to verify`}
                    className="w-full px-3 py-1.5 text-xs bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 font-mono"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDisable}
                      disabled={confirmName !== plugin.package_name || disableMutation.isPending}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg h-9 font-semibold text-xs disabled:opacity-50"
                    >
                      {disableMutation.isPending ? 'Stripping...' : 'Confirm Emergency Strip'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDisableDialog(false);
                        setConfirmName('');
                      }}
                      className="h-9 px-4 text-xs border-border text-muted-foreground rounded-lg hover:bg-muted bg-card"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}
