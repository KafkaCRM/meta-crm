import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plug, ChevronRight } from 'lucide-react';
import { integrationsApi } from '@/api/integrations';
import type { ConnectionDto, IntegrationManifest } from '@/api/integrations';
import { IntegrationDetail } from './IntegrationDetail';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function resolveIcon(icon: string) {
  switch (icon) {
    case 'MessageSquare': return Plug;
    case 'Share2': return Plug;
    case 'PhoneCall': return Plug;
    case 'Mail': return Plug;
    case 'Zap': return Plug;
    case 'Calendar': return Plug;
    case 'Inbox': return Plug;
    case 'Link': return Plug;
    default: return Plug;
  }
}

export function IntegrationsLayout() {
  const [selected, setSelected] = useState<{ connectionId: string; manifest: IntegrationManifest } | null>(null);

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
  const connectionsByProvider = new Map(connections.map((c) => [c.provider, c]));

  if (selected) {
    return <IntegrationDetail connectionId={selected.connectionId} manifest={selected.manifest} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Connect lead sources, communication channels, and automation tools to your workspace.
          Click an integration to configure its connection, intake routing, field mapping, and automation.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {manifests.map((manifest) => {
          const connection = connectionsByProvider.get(manifest.provider);
          const isConnected = connection?.status === 'connected';
          const ProviderIcon = resolveIcon(manifest.icon);

          return (
            <Card
              key={manifest.provider}
              role="button"
              onClick={() => setSelected({ connectionId: connection?.id ?? '', manifest })}
              className={cn(
                'bg-card border-border rounded-xl shadow-none p-4 cursor-pointer hover:border-primary/30 transition-colors',
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                  isConnected
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                    : 'border-border bg-background text-muted-foreground',
                )}>
                  <ProviderIcon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{manifest.name}</span>
                    <Badge variant="outline" className={cn(
                      'rounded-md text-[10px]',
                      isConnected
                        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                        : 'border-border text-muted-foreground',
                    )}>
                      {connection?.status ?? 'disconnected'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{manifest.description}</p>
                  {connection?.last_tested_at && (
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Last tested: {new Date(connection.last_tested_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1" />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
