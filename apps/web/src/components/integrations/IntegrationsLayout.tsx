import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageSquare, Share2, PhoneCall, Mail, Zap, Calendar, Inbox, Link, ChevronRight, Trash2, ExternalLink } from 'lucide-react';
import { integrationsApi } from '@/api/integrations';
import type { IntegrationManifest } from '@/api/integrations';
import { IntegrationDetail } from './IntegrationDetail';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const iconMap: Record<string, any> = {
  MessageSquare,
  Share2,
  PhoneCall,
  Mail,
  Zap,
  Calendar,
  Inbox,
  Link,
};

function resolveIcon(icon: string) {
  return iconMap[icon] ?? Link;
}

export function IntegrationsLayout() {
  const [selected, setSelected] = useState<{ connectionId: string; manifest: IntegrationManifest } | null>(null);
  const [tab, setTab] = useState<'integrations' | 'connected'>('integrations');
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete this ${name} integration? This will remove its routing and settings.`)) return;
    try {
      const res = await integrationsApi.connections.disconnect(id);
      queryClient.setQueryData(['integrations', 'connections'], (old: any) => {
        if (!old) return old;
        return { ...old, data: old.data?.filter((c: any) => c.id !== id) ?? [] };
      });
      toast.success(res.message);
    } catch (err: any) {
      console.error('Delete failed:', err);
      toast.error(err?.message ?? 'Failed to delete');
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['integrations', 'connections'],
    queryFn: () => integrationsApi.connections.list(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const connections = data?.data ?? [];
  const manifests = data?.manifests ?? [];
  const connectedConns = connections.filter((c) => c.status === 'connected');

  const connCountByProvider = new Map<string, number>();
  for (const c of connections) {
    connCountByProvider.set(c.provider, (connCountByProvider.get(c.provider) ?? 0) + 1);
  }

  const handleSelect = async (manifest: IntegrationManifest) => {
    if (manifest.url_generator) {
      setConnectingProvider(manifest.name);
      try {
        const conn = await integrationsApi.connections.connect(manifest.provider, {});
        setSelected({ connectionId: conn.id, manifest });
      } catch {
        toast.error(`Failed to enable ${manifest.name}`);
      } finally {
        setConnectingProvider(null);
      }
    } else {
      setSelected({ connectionId: '', manifest });
    }
  };

  if (selected) {
    return <IntegrationDetail connectionId={selected.connectionId} manifest={selected.manifest} onBack={() => setSelected(null)} />;
  }

  if (connectingProvider) {
    return (
      <div className="space-y-5 max-w-[1100px]">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Setting up {connectingProvider}...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Connect lead sources, communication channels, and automation tools to your workspace.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        <button onClick={() => setTab('integrations')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px]',
            tab === 'integrations'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}>
          Integrations
        </button>
        <button onClick={() => setTab('connected')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px]',
            tab === 'connected'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}>
          Connected {connectedConns.length > 0 && `(${connectedConns.length})`}
        </button>
      </div>

      {tab === 'integrations' ? (
        <div className="grid gap-3 md:grid-cols-2">
          {manifests.map((manifest) => {
            const ProviderIcon = resolveIcon(manifest.icon);
            const count = connCountByProvider.get(manifest.provider) ?? 0;

            return (
              <Card
                key={manifest.provider}
                role="button"
                onClick={() => handleSelect(manifest)}
                className={cn(
                  'bg-card border-border rounded-xl shadow-none p-4 cursor-pointer hover:border-primary/30 transition-colors',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                    count > 0
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                      : 'border-border bg-background text-muted-foreground',
                  )}>
                    <ProviderIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{manifest.name}</span>
                      {count > 0 && (
                        <Badge variant="outline" className="rounded-md text-[10px] border-emerald-100 bg-emerald-50 text-emerald-700">
                          {count} connected
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{manifest.description}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1" />
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {connectedConns.length === 0 ? (
            <div className="text-center py-16">
              <Link size={32} className="mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No connected integrations yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Go to the Integrations tab to connect one</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Provider</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Last tested</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Created</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {connectedConns.map((conn) => {
                  const manifest = manifests.find((m) => m.provider === conn.provider);
                  const ProviderIcon = manifest ? resolveIcon(manifest.icon) : Link;
                  const name = manifest?.name ?? conn.provider;
                  return (
                    <tr key={conn.id} role="button" onClick={() => setSelected({ connectionId: conn.id, manifest: manifest ?? { id: conn.provider, provider: conn.provider, name: conn.provider, description: '', icon: 'Link', credential_fields: [] } })}
                      className="border-b border-border last:border-b-0 hover:bg-muted/20 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700">
                            <ProviderIcon size={16} />
                          </div>
                          <span className="font-medium text-foreground">{name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="rounded-md text-[10px] border-emerald-100 bg-emerald-50 text-emerald-700">
                          {conn.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {conn.last_tested_at ? new Date(conn.last_tested_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(conn.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setSelected({ connectionId: conn.id, manifest: manifest ?? { id: conn.provider, provider: conn.provider, name: conn.provider, description: '', icon: 'Link', credential_fields: [] } })}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                            <ExternalLink size={12} />
                            Open
                          </button>
                          <button onClick={(e) => handleDelete(conn.id, name, e)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors">
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
