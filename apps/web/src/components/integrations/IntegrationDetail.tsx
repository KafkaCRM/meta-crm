import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  Save,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  Copy,
  Check,
  Calendar,
  Mail,
} from 'lucide-react';
import { integrationsApi } from '@/api/integrations';
import { campaignsApi, type CreateCampaignDto } from '@/api/campaigns';
import { settingsApi } from '@/api/settings';
import type { ConnectionDto, IntegrationManifest, FieldMapping } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

const NEEDS_FIELD_MAPPING = new Set(['facebook', 'web-to-lead', 'zapier']);

const DEFAULT_FIELD_MAPPINGS: Partial<FieldMapping>[] = [
  { source_field: 'name', target_entity: 'lead', target_field: 'name', is_required: true },
  { source_field: 'email', target_entity: 'lead', target_field: 'email', is_required: false },
  { source_field: 'phone', target_entity: 'lead', target_field: 'phone', is_required: false },
];

interface Props {
  connectionId: string;
  manifest: IntegrationManifest;
  onBack: () => void;
}

export function IntegrationDetail({ connectionId, manifest, onBack }: Props) {
  const { can } = usePermissions();
  const canManage = can('manage', 'Integration');
  const queryClient = useQueryClient();

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['integrations', 'connections'],
    queryFn: () => integrationsApi.connections.list(),
    staleTime: 10_000,
    enabled: !connectionId,
  });

  const { data: singleConnection, isLoading: singleLoading } = useQuery({
    queryKey: ['integrations', 'connection', connectionId],
    queryFn: () => integrationsApi.connections.get(connectionId),
    enabled: !!connectionId,
  });

  const connection = connectionId
    ? (singleConnection ?? null)
    : null;

  const isLoading = connectionId ? singleLoading : listLoading;

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['integrations', 'connections'] });
    if (connectionId) queryClient.invalidateQueries({ queryKey: ['integrations', 'connection', connectionId] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[900px]">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={onBack} className="h-8 w-8">
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{manifest.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{manifest.description}</p>
        </div>
        {connection && (
          <Badge variant="outline" className={cn(
            'ml-auto rounded-md text-xs font-semibold',
            connection.status === 'connected'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : 'border-border text-muted-foreground',
          )}>
            {connection.status === 'connected' ? 'Connected' : 'Disconnected'}
          </Badge>
        )}
      </div>

      {manifest.url_generator ? (
        <UrlGeneratorSetup connection={connection} connectionId={connectionId} manifest={manifest} canManage={canManage} onChanged={refetch} />
      ) : manifest.oauth_supported ? (
        <OAuthSetup connection={connection} manifest={manifest} canManage={canManage} onChanged={refetch} />
      ) : manifest.provider === 'email-to-case' ? (
        <ServiceSetup connection={connection} manifest={manifest} canManage={canManage} onChanged={refetch} />
      ) : (
        <CredentialsSetup connection={connection} manifest={manifest} canManage={canManage} onChanged={refetch} />
      )}
    </div>
  );
}

/* ───────── URL Generator (Web-to-Lead, Zapier) ───────── */

function UrlGeneratorSetup({ connection, connectionId, manifest, canManage, onChanged }: {
  connection: ConnectionDto | null;
  connectionId: string;
  manifest: IntegrationManifest;
  canManage: boolean;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const urlToken = (connection?.config_json?.url_token as string) ?? '';
  const endpointUrl = urlToken
    ? `${window.location.origin}/api/v1/intake/${manifest.provider}/${urlToken}`
    : '';

  const disconnectMutation = useMutation({
    mutationFn: () => integrationsApi.connections.disconnect(connection!.id),
    onSuccess: () => {
      onChanged();
      toast.success(`${manifest.name} disconnected`);
    },
    onError: () => toast.error('Failed to disconnect'),
  });

  const [embedCopied, setEmbedCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(endpointUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('URL copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const embedHtml = `<form action="${endpointUrl}" method="POST">
  <input name="name" placeholder="Full Name" required />
  <input name="email" placeholder="Email" required />
  <input name="phone" placeholder="Phone" />
  <button type="submit">Submit</button>
</form>`;

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedHtml);
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
      toast.success('Embed code copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  /* ── Routing state ── */
  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.list(),
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => settingsApi.pipelines.list(),
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['integrations', 'routes', connection?.id],
    queryFn: () => integrationsApi.routes.list(connection!.id),
    enabled: !!connection?.id,
  });

  const existingRoute = routes[0];

  const [destination, setDestination] = useState<'campaign' | 'pipeline'>('campaign');
  const [campaignAction, setCampaignAction] = useState<'existing' | 'new'>('existing');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [showFieldMapping, setShowFieldMapping] = useState(NEEDS_FIELD_MAPPING.has(manifest.provider));

  useEffect(() => {
    if (existingRoute) {
      const assignRule = existingRoute.assignment_rule as Record<string, unknown> ?? {};
      if (assignRule['pipeline_definition_id'] && !existingRoute.campaign_id) {
        setDestination('pipeline');
        setSelectedPipelineId(assignRule['pipeline_definition_id'] as string);
      } else {
        setDestination('campaign');
        setSelectedCampaignId(existingRoute.campaign_id ?? '');
      }
      if (existingRoute.fieldMappings && existingRoute.fieldMappings.length > 0) {
        setFieldMappingRows(existingRoute.fieldMappings);
        setShowFieldMapping(true);
      }
    }
  }, [existingRoute]);

  const [fieldMappingRows, setFieldMappingRows] = useState<Partial<FieldMapping>[]>(DEFAULT_FIELD_MAPPINGS);

  const { data: customFields = [] } = useQuery({
    queryKey: ['settings', 'field-definitions', 'lead'],
    queryFn: () => settingsApi.fieldDefinitions.list('lead'),
    staleTime: 60_000,
    enabled: showFieldMapping,
  });

  const STANDARD_FIELDS: Record<string, string[]> = {
    lead: ['name', 'email', 'phone', 'source', 'status', 'notes'],
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      let campaignId: string | null = null;
      let assignmentRule: Record<string, unknown> = { type: 'fixed' };

      return (async () => {
        if (destination === 'campaign') {
          if (campaignAction === 'new' && newCampaignName.trim()) {
            const branchId = (connection?.config_json?.branch_id as string) ?? '';
            const brandId = (connection?.config_json?.brand_id as string) ?? '';
            const verticalId = (connection?.config_json?.vertical_id as string) ?? '';
            const pipelineId = selectedPipelineId || '';

            const campaign = await campaignsApi.create({
              name: newCampaignName.trim(),
              channel: manifest.provider,
              status: 'active',
              pipeline_id: pipelineId || undefined,
              branch_id: branchId || undefined,
              brand_id: brandId || undefined,
              vertical_id: verticalId || undefined,
              start_date: new Date().toISOString(),
            } as unknown as CreateCampaignDto);
            campaignId = campaign.id;
          } else {
            campaignId = selectedCampaignId || null;
          }
        } else {
          assignmentRule = { type: 'pipeline', pipeline_definition_id: selectedPipelineId };
        }

        return integrationsApi.routes.replace(connection!.id, [{
          priority: 0,
          mode: 'create_lead',
          campaign_id: campaignId,
          owner_id: null,
          assignment_rule: assignmentRule,
          duplicate_strategy: 'skip',
          duplicate_match_fields: ['email', 'phone'],
          fieldMappings: fieldMappingRows.length > 0
            ? fieldMappingRows.map((r) => ({
                source_field: r.source_field ?? '',
                target_entity: r.target_entity ?? 'lead',
                target_field: r.target_field ?? '',
                transform: r.transform ?? null,
                is_required: r.is_required ?? false,
              }))
            : undefined,
        }]);
      })();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'routes', connection?.id] });
      toast.success('Integration setup saved');
    },
    onError: () => toast.error('Failed to save integration setup'),
  });

  const handleSave = () => {
    if (destination === 'campaign') {
      if (campaignAction === 'existing' && !selectedCampaignId) {
        toast.error('Select a campaign to route leads into');
        return;
      }
      if (campaignAction === 'new' && !newCampaignName.trim()) {
        toast.error('Enter a name for the new campaign');
        return;
      }
    } else {
      if (!selectedPipelineId) {
        toast.error('Select a pipeline to route leads into');
        return;
      }
    }
    saveMutation.mutate();
  };

  /* ── Not connected state (setup mode) ── */
  if (!connection || connection.status !== 'connected') {
    if (connectionId) {
      return (
        <Card className="bg-card border-border rounded-xl shadow-none">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-3">Loading connection...</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">{manifest.name}</CardTitle>
          <CardDescription className="text-xs">{manifest.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {canManage && manifest.url_generator && (
            <div className="flex items-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Creating connection...</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const health = (connection.config_json?.health as { status?: string; last_tested_at?: string; message?: string } | undefined) ?? null;
  const isSetupComplete = !!(routes.length > 0);

  return (
    <div className="space-y-4">
      {/* Connection controls */}
      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant="outline" className={cn(
                'rounded-md text-xs',
                'border-emerald-100 bg-emerald-50 text-emerald-700',
              )}>
                active
              </Badge>
            </div>
            <div className="flex gap-2 ml-auto">
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => { if (window.confirm('Disconnect this integration?')) disconnectMutation.mutate(); }}
                  className="h-7 rounded-lg text-[11px] text-red-600 border-red-100 hover:bg-red-50">
                  <Trash2 className="mr-1 h-3 w-3" /> Disconnect
                </Button>
              )}
            </div>
          </div>
          {health?.message && (
            <p className="text-xs p-2 rounded-md bg-muted/50 mt-3">{health.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Endpoint URL card */}
      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Your Endpoint URL</CardTitle>
          <CardDescription className="text-xs">
            {manifest.provider === 'web-to-lead'
              ? 'Send form submissions to this URL. Set your HTML form\'s action attribute to this URL, or POST JSON directly.'
              : 'Use this webhook URL as the destination in your Zapier Zap.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <code className="flex-1 p-2.5 rounded-lg bg-muted border border-border text-xs font-mono break-all select-all">
              {endpointUrl}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 rounded-lg text-xs shrink-0">
              {copied ? <Check className="mr-1 h-3 w-3 text-emerald-600" /> : <Copy className="mr-1 h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          {manifest.provider === 'web-to-lead' && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
                <span className="text-xs font-medium text-muted-foreground">Embed code</span>
                <Button variant="outline" size="sm" onClick={handleCopyEmbed} className="h-7 rounded-md text-[11px]">
                  {embedCopied ? <Check className="mr-1 h-3 w-3 text-emerald-600" /> : <Copy className="mr-1 h-3 w-3" />}
                  {embedCopied ? 'Copied' : 'Copy code'}
                </Button>
              </div>
              <pre className="p-3 text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap select-all">
{embedHtml}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Routing */}
      {isSetupComplete && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm">
          <ShieldCheck size={16} />
          <span className="text-xs font-medium">Setup complete — leads will be routed to the campaign below</span>
        </div>
      )}

      <RoutingForm
        destination={destination}
        setDestination={setDestination}
        campaignAction={campaignAction}
        setCampaignAction={setCampaignAction}
        selectedCampaignId={selectedCampaignId}
        setSelectedCampaignId={setSelectedCampaignId}
        newCampaignName={newCampaignName}
        setNewCampaignName={setNewCampaignName}
        selectedPipelineId={selectedPipelineId}
        setSelectedPipelineId={setSelectedPipelineId}
        campaigns={campaigns}
        pipelines={pipelines}
        showFieldMapping={showFieldMapping}
        setShowFieldMapping={setShowFieldMapping}
        fieldMappingRows={fieldMappingRows}
        setFieldMappingRows={setFieldMappingRows}
        customFields={customFields}
        STANDARD_FIELDS={STANDARD_FIELDS}
        canManage={canManage}
        manifestName={manifest.name}
        needsFieldMapping={NEEDS_FIELD_MAPPING.has(manifest.provider)}
        handleSave={handleSave}
        savePending={saveMutation.isPending}
      />
    </div>
  );
}

/* ───────── OAuth Setup (Facebook, Google Calendar) ───────── */

function OAuthSetup({ connection, manifest, canManage, onChanged }: {
  connection: ConnectionDto | null;
  manifest: IntegrationManifest;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [oauthConnecting, setOauthConnecting] = useState(false);

  const handleOAuth = useCallback(async () => {
    setOauthConnecting(true);
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    const popup = window.open('', `oauth-${manifest.provider}`, `width=${width},height=${height},left=${left},top=${top}`);

    if (!popup) {
      toast.error('Popup blocked. Allow popups for this site and try again.');
      setOauthConnecting(false);
      return;
    }

    popup.document.write('<html><body style="display:flex;align-items:center;justify-content:center;font-family:sans-serif;font-size:14px;color:#666"><p>Connecting…</p></body></html>');

    try {
      const { url } = await integrationsApi.connections.getOAuthUrl(manifest.provider, window.location.href);
      popup.location.href = url;
    } catch {
      popup.close();
      toast.error('Failed to initiate OAuth. Check provider configuration.');
      setOauthConnecting(false);
      return;
    }

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'oauth' && event.data?.provider === manifest.provider) {
        window.removeEventListener('message', handler);
        setOauthConnecting(false);
        if (event.data.success) {
          onChanged();
          toast.success(`${manifest.name} connected`);
        } else {
          toast.error(event.data.message || 'OAuth failed');
        }
      }
    };

    window.addEventListener('message', handler);
    const interval = setInterval(() => {
      if (popup.closed) {
        clearInterval(interval);
        window.removeEventListener('message', handler);
        setOauthConnecting(false);
      }
    }, 500);
  }, [manifest, onChanged]);

  if (!connection || connection.status !== 'connected') {
    return (
      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Connect {manifest.name}</CardTitle>
          <CardDescription className="text-xs">Authenticate using OAuth</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Click below to authorize Meta CRM to access your {manifest.name} data.
          </p>
          {canManage && (
            <Button size="sm" onClick={handleOAuth} disabled={oauthConnecting}
              className="h-8 rounded-lg text-xs font-semibold">
              {oauthConnecting ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1.5 h-3 w-3" />
              )}
              Connect with {manifest.name}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (manifest.provider === 'google-calendar') {
    return <ServiceSetup connection={connection} manifest={manifest} canManage={canManage} onChanged={onChanged} />;
  }

  return <OAuthPostConnect connection={connection} manifest={manifest} canManage={canManage} onChanged={onChanged} />;
}

function OAuthPostConnect({ connection, manifest, canManage, onChanged }: {
  connection: ConnectionDto;
  manifest: IntegrationManifest;
  canManage: boolean;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();

  const disconnectMutation = useMutation({
    mutationFn: () => integrationsApi.connections.disconnect(connection.id),
    onSuccess: () => {
      onChanged();
      toast.success(`${manifest.name} disconnected`);
    },
    onError: () => toast.error('Failed to disconnect'),
  });

  const testMutation = useMutation({
    mutationFn: () => integrationsApi.connections.test(connection.id),
    onSuccess: (result) => {
      onChanged();
      if (result.status === 'healthy') toast.success(result.message);
      else toast.error(result.message);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const health = (connection.config_json?.health as any) ?? null;

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.list(),
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['integrations', 'routes', connection.id],
    queryFn: () => integrationsApi.routes.list(connection.id),
  });

  const existingRoute = routes[0];
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [showFieldMapping, setShowFieldMapping] = useState(true);
  const [fieldMappingRows, setFieldMappingRows] = useState<Partial<FieldMapping>[]>(DEFAULT_FIELD_MAPPINGS);

  useEffect(() => {
    if (existingRoute) {
      setSelectedCampaignId(existingRoute.campaign_id ?? '');
      if (existingRoute.fieldMappings && existingRoute.fieldMappings.length > 0) {
        setFieldMappingRows(existingRoute.fieldMappings);
      }
    }
  }, [existingRoute]);

  const { data: customFields = [] } = useQuery({
    queryKey: ['settings', 'field-definitions', 'lead'],
    queryFn: () => settingsApi.fieldDefinitions.list('lead'),
    staleTime: 60_000,
    enabled: showFieldMapping,
  });

  const STANDARD_FIELDS: Record<string, string[]> = {
    lead: ['name', 'email', 'phone', 'source', 'status', 'notes'],
  };

  const saveMutation = useMutation({
    mutationFn: () => integrationsApi.routes.replace(connection.id, [{
      priority: 0,
      mode: 'create_lead',
      campaign_id: selectedCampaignId || null,
      owner_id: null,
      assignment_rule: { type: 'fixed' },
      duplicate_strategy: 'skip',
      duplicate_match_fields: ['email', 'phone'],
      fieldMappings: fieldMappingRows.length > 0
        ? fieldMappingRows.map((r) => ({
            source_field: r.source_field ?? '',
            target_entity: 'lead',
            target_field: r.target_field ?? '',
            transform: r.transform ?? null,
            is_required: r.is_required ?? false,
          }))
        : undefined,
    }]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'routes', connection.id] });
      toast.success('Integration setup saved');
    },
    onError: () => toast.error('Failed to save'),
  });

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant="outline" className="border-emerald-100 bg-emerald-50 text-emerald-700 rounded-md text-xs">connected</Badge>
            </div>
            <div className="flex gap-2 ml-auto">
              {canManage && (
                <>
                  <Button variant="outline" size="sm" disabled={testMutation.isPending} onClick={() => testMutation.mutate()}
                    className="h-7 rounded-lg text-[11px]">
                    {testMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                    Test
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { if (window.confirm('Disconnect?')) disconnectMutation.mutate(); }}
                    className="h-7 rounded-lg text-[11px] text-red-600 border-red-100 hover:bg-red-50">
                    <Trash2 className="mr-1 h-3 w-3" /> Disconnect
                  </Button>
                </>
              )}
            </div>
          </div>
          {health?.message && <p className="text-xs p-2 rounded-md bg-muted/50 mt-3">{health.message}</p>}
        </CardContent>
      </Card>

      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Routing</CardTitle>
          <CardDescription className="text-xs">Where incoming leads from {manifest.name} should go</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Campaign</label>
            <select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              <option value="">Select a campaign…</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <FieldMappingSection
            show={showFieldMapping}
            onToggle={() => setShowFieldMapping(!showFieldMapping)}
            rows={fieldMappingRows}
            setRows={setFieldMappingRows}
            customFields={customFields}
            STANDARD_FIELDS={STANDARD_FIELDS}
            canManage={canManage}
            manifestName={manifest.name}
          />

          {canManage && (
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                className="h-8 rounded-lg text-xs font-semibold">
                {saveMutation.isPending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}
                Save Setup
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────── Credentials Setup (WhatsApp, JustDial, Email) ───────── */

function CredentialsSetup({ connection, manifest, canManage, onChanged }: {
  connection: ConnectionDto | null;
  manifest: IntegrationManifest;
  canManage: boolean;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  const connectMutation = useMutation({
    mutationFn: (creds: Record<string, string>) =>
      integrationsApi.connections.connect(manifest.provider, { credentials: creds }),
    onSuccess: () => {
      onChanged();
      toast.success(`${manifest.name} connected`);
    },
    onError: () => toast.error(`Failed to connect ${manifest.name}`),
  });

  const handleSave = () => {
    const missing = manifest.credential_fields.filter((f) => !fieldValues[f]?.trim());
    if (missing.length > 0) {
      toast.error(`Fill in: ${missing.join(', ')}`);
      return;
    }
    connectMutation.mutate(fieldValues);
  };

  /* ── Post-connect state ── */
  const disconnectMutation = useMutation({
    mutationFn: () => integrationsApi.connections.disconnect(connection!.id),
    onSuccess: () => {
      onChanged();
      toast.success(`${manifest.name} disconnected`);
    },
    onError: () => toast.error('Failed to disconnect'),
  });

  const testMutation = useMutation({
    mutationFn: () => integrationsApi.connections.test(connection!.id),
    onSuccess: (result) => {
      onChanged();
      if (result.status === 'healthy') toast.success(result.message);
      else toast.error(result.message);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const health = (connection?.config_json?.health as any) ?? null;

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.list(),
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['integrations', 'routes', connection?.id],
    queryFn: () => integrationsApi.routes.list(connection!.id),
    enabled: !!connection?.id,
  });

  const existingRoute = routes[0];
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [showFieldMapping, setShowFieldMapping] = useState(false);
  const [fieldMappingRows, setFieldMappingRows] = useState<Partial<FieldMapping>[]>(DEFAULT_FIELD_MAPPINGS);

  useEffect(() => {
    if (existingRoute) {
      setSelectedCampaignId(existingRoute.campaign_id ?? '');
      if (existingRoute.fieldMappings && existingRoute.fieldMappings.length > 0) {
        setFieldMappingRows(existingRoute.fieldMappings);
        setShowFieldMapping(true);
      }
    }
  }, [existingRoute]);

  const { data: customFields = [] } = useQuery({
    queryKey: ['settings', 'field-definitions', 'lead'],
    queryFn: () => settingsApi.fieldDefinitions.list('lead'),
    staleTime: 60_000,
    enabled: showFieldMapping,
  });

  const STANDARD_FIELDS: Record<string, string[]> = {
    lead: ['name', 'email', 'phone', 'source', 'status', 'notes'],
  };

  const saveMutation = useMutation({
    mutationFn: () => integrationsApi.routes.replace(connection!.id, [{
      priority: 0,
      mode: 'create_lead',
      campaign_id: selectedCampaignId || null,
      owner_id: null,
      assignment_rule: { type: 'fixed' },
      duplicate_strategy: 'skip',
      duplicate_match_fields: ['email', 'phone'],
      fieldMappings: fieldMappingRows.length > 0
        ? fieldMappingRows.map((r) => ({
            source_field: r.source_field ?? '',
            target_entity: 'lead',
            target_field: r.target_field ?? '',
            transform: r.transform ?? null,
            is_required: r.is_required ?? false,
          }))
        : undefined,
    }]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'routes', connection?.id] });
      toast.success('Integration setup saved');
    },
    onError: () => toast.error('Failed to save'),
  });

  /* ── Not connected state ── */
  if (!connection || connection.status !== 'connected') {
    return (
      <div className="space-y-4">
        <Card className="bg-card border-border rounded-xl shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Credentials</CardTitle>
            <CardDescription className="text-xs">Encrypted at rest with AES-256-GCM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {manifest.credential_fields.map((field) => (
              <div key={field} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground capitalize">
                  {field.replace(/_/g, ' ')}
                </label>
                <div className="relative">
                  <Input
                    type={showValues[field] ? 'text' : 'password'}
                    value={fieldValues[field] ?? ''}
                    onChange={(e) => setFieldValues((v) => ({ ...v, [field]: e.target.value }))}
                    placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                    className="h-9 border-border bg-card pr-10 text-sm"
                    disabled={!canManage}
                  />
                  <button
                    type="button"
                    onClick={() => setShowValues((v) => ({ ...v, [field]: !v[field] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showValues[field] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            ))}
            {canManage && (
              <Button size="sm" onClick={handleSave} disabled={connectMutation.isPending} className="h-8 rounded-lg text-xs font-semibold">
                {connectMutation.isPending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}
                Save Credentials
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant="outline" className={cn(
                'rounded-md text-xs',
                health?.status === 'healthy'
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  : 'border-amber-100 bg-amber-50 text-amber-700',
              )}>
                {health?.status ?? 'connected'}
              </Badge>
            </div>
            {health?.last_tested_at && (
              <span className="text-[10px] text-muted-foreground">
                Last tested: {new Date(health.last_tested_at).toLocaleString()}
              </span>
            )}
            <div className="flex gap-2 ml-auto">
              {canManage && (
                <>
                  <Button variant="outline" size="sm" disabled={testMutation.isPending} onClick={() => testMutation.mutate()}
                    className="h-7 rounded-lg text-[11px]">
                    {testMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                    Test
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { if (window.confirm('Disconnect?')) disconnectMutation.mutate(); }}
                    className="h-7 rounded-lg text-[11px] text-red-600 border-red-100 hover:bg-red-50">
                    <Trash2 className="mr-1 h-3 w-3" /> Disconnect
                  </Button>
                </>
              )}
            </div>
          </div>
          {health?.message && <p className="text-xs p-2 rounded-md bg-muted/50 mt-3">{health.message}</p>}
        </CardContent>
      </Card>

      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Routing</CardTitle>
          <CardDescription className="text-xs">Where incoming data from {manifest.name} should go</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Campaign</label>
            <select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              <option value="">Select a campaign…</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <FieldMappingSection
            show={showFieldMapping}
            onToggle={() => setShowFieldMapping(!showFieldMapping)}
            rows={fieldMappingRows}
            setRows={setFieldMappingRows}
            customFields={customFields}
            STANDARD_FIELDS={STANDARD_FIELDS}
            canManage={canManage}
            manifestName={manifest.name}
          />

          {canManage && (
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                className="h-8 rounded-lg text-xs font-semibold">
                {saveMutation.isPending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}
                Save Setup
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────── Service Setup (Email-to-Case, Google Calendar) ───────── */

function ServiceSetup({ connection, manifest, canManage, onChanged }: {
  connection: ConnectionDto | null;
  manifest: IntegrationManifest;
  canManage: boolean;
  onChanged: () => void;
}) {
  const Icon = manifest.provider === 'google-calendar' ? Calendar : Mail;

  const disconnectMutation = useMutation({
    mutationFn: () => integrationsApi.connections.disconnect(connection!.id),
    onSuccess: () => {
      onChanged();
      toast.success(`${manifest.name} disconnected`);
    },
    onError: () => toast.error('Failed to disconnect'),
  });

  const testMutation = useMutation({
    mutationFn: () => integrationsApi.connections.test(connection!.id),
    onSuccess: (result) => {
      onChanged();
      if (result.status === 'healthy') toast.success(result.message);
      else toast.error(result.message);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const health = (connection?.config_json?.health as any) ?? null;

  return (
    <div className="space-y-4">
      {connection && (
        <Card className="bg-card border-border rounded-xl shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline" className={cn(
                  'rounded-md text-xs',
                  health?.status === 'healthy'
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                    : 'border-amber-100 bg-amber-50 text-amber-700',
                )}>
                  {health?.status ?? 'connected'}
                </Badge>
              </div>
              <div className="flex gap-2 ml-auto">
                {canManage && (
                  <>
                    <Button variant="outline" size="sm" disabled={testMutation.isPending} onClick={() => testMutation.mutate()}
                      className="h-7 rounded-lg text-[11px]">
                      {testMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                      Test
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { if (window.confirm('Disconnect?')) disconnectMutation.mutate(); }}
                      className="h-7 rounded-lg text-[11px] text-red-600 border-red-100 hover:bg-red-50">
                      <Trash2 className="mr-1 h-3 w-3" /> Disconnect
                    </Button>
                  </>
                )}
              </div>
            </div>
            {health?.message && <p className="text-xs p-2 rounded-md bg-muted/50 mt-3">{health.message}</p>}
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Icon size={16} className="text-muted-foreground" />
            {manifest.name} Setup
          </CardTitle>
          <CardDescription className="text-xs">
            {manifest.provider === 'google-calendar'
              ? 'Sync appointments, meetings, and availability with Google Calendar.'
              : manifest.provider === 'email-to-case'
              ? 'Monitor an IMAP mailbox and automatically convert incoming emails to leads/cases.'
              : 'Configure this service integration.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This integration is a service connector. Dedicated setup coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────── Shared: Field Mapping Section ───────── */

function FieldMappingSection({ show, onToggle, rows, setRows, customFields, STANDARD_FIELDS, canManage, manifestName }: {
  show: boolean;
  onToggle: () => void;
  rows: Partial<FieldMapping>[];
  setRows: (rows: Partial<FieldMapping>[]) => void;
  customFields: any[];
  STANDARD_FIELDS: Record<string, string[]>;
  canManage: boolean;
  manifestName: string;
}) {
  const addRow = () => setRows([...rows, {
    source_field: '', target_entity: 'lead', target_field: '', is_required: false,
  }]);
  const updateRow = (i: number, update: Partial<FieldMapping>) => {
    const next = [...rows];
    next[i] = { ...next[i], ...update };
    setRows(next);
  };
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));

  const fieldOptions = [
    ...(STANDARD_FIELDS['lead'] ?? []).map((f: string) => ({ value: f, label: `${f} (standard)` })),
    ...customFields.map((f: any) => ({ value: f.name, label: `${f.label} (custom)` })),
  ];

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button type="button" onClick={onToggle}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        <span>Field Mapping {!show && rows.length > 0 && (
          <span className="ml-1.5 text-[10px] text-emerald-600">({rows.length} mapped)</span>
        )}</span>
        {show ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {show && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-[10px] text-muted-foreground">
            Map {manifestName} field names to CRM Lead field names. Fields without a mapping pass through with their original names.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1.5 px-1 font-medium">Incoming Field</th>
                  <th className="py-1.5 px-1 font-medium">CRM Field</th>
                  <th className="py-1.5 px-1 font-medium">Required</th>
                  {canManage && <th className="py-1.5 px-1 font-medium w-8" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const datalistId = `fm-fields-${i}`;
                  return (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1 px-1">
                        <input value={row.source_field ?? ''} disabled={!canManage}
                          onChange={(e) => updateRow(i, { source_field: e.target.value })}
                          placeholder="incoming.field.name"
                          className="w-full bg-transparent border border-border rounded px-1.5 py-1 text-[11px]" />
                      </td>
                      <td className="py-1 px-1">
                        <input list={datalistId} value={row.target_field ?? ''} disabled={!canManage}
                          onChange={(e) => updateRow(i, { target_field: e.target.value })}
                          placeholder="Pick or type"
                          className="w-full bg-transparent border border-border rounded px-1.5 py-1 text-[11px]" />
                        <datalist id={datalistId}>
                          {fieldOptions.map((opt: any) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </datalist>
                      </td>
                      <td className="py-1 px-1 text-center">
                        <input type="checkbox" checked={row.is_required ?? false} disabled={!canManage}
                          onChange={(e) => updateRow(i, { is_required: e.target.checked })}
                          className="rounded" />
                      </td>
                      {canManage && (
                        <td className="py-1 px-1">
                          <button onClick={() => removeRow(i)}
                            className="text-red-500 hover:text-red-700 text-[11px]">✕</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {canManage && (
            <Button variant="outline" size="sm" onClick={addRow}
              className="h-7 rounded-lg text-[11px]">
              <Plus className="mr-1 h-2.5 w-2.5" /> Add Mapping
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────── Shared: Routing Form ───────── */

function RoutingForm({
  destination, setDestination,
  campaignAction, setCampaignAction,
  selectedCampaignId, setSelectedCampaignId,
  newCampaignName, setNewCampaignName,
  selectedPipelineId, setSelectedPipelineId,
  campaigns, pipelines,
  showFieldMapping, setShowFieldMapping,
  fieldMappingRows, setFieldMappingRows,
  customFields, STANDARD_FIELDS,
  canManage, manifestName, needsFieldMapping, handleSave, savePending,
}: {
  destination: 'campaign' | 'pipeline';
  setDestination: (v: 'campaign' | 'pipeline') => void;
  campaignAction: 'existing' | 'new';
  setCampaignAction: (v: 'existing' | 'new') => void;
  selectedCampaignId: string;
  setSelectedCampaignId: (v: string) => void;
  newCampaignName: string;
  setNewCampaignName: (v: string) => void;
  selectedPipelineId: string;
  setSelectedPipelineId: (v: string) => void;
  campaigns: any[];
  pipelines: any[];
  showFieldMapping: boolean;
  setShowFieldMapping: (v: boolean) => void;
  fieldMappingRows: Partial<FieldMapping>[];
  setFieldMappingRows: (rows: Partial<FieldMapping>[]) => void;
  customFields: any[];
  STANDARD_FIELDS: Record<string, string[]>;
  canManage: boolean;
  manifestName: string;
  needsFieldMapping: boolean;
  handleSave: () => void;
  savePending: boolean;
}) {
  return (
    <Card className="bg-card border-border rounded-xl shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Routing</CardTitle>
        <CardDescription className="text-xs">
          Choose where incoming data from {manifestName} should go
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Destination</label>
          <div className="flex gap-3">
            <label className={cn(
              'flex-1 p-3 rounded-lg border cursor-pointer transition-colors',
              destination === 'campaign'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-muted-foreground/30',
            )}>
              <input type="radio" name="destination" value="campaign" checked={destination === 'campaign'}
                onChange={() => setDestination('campaign')} className="sr-only" />
              <span className="text-xs font-medium">Campaign</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">Route leads into a campaign</p>
            </label>
            <label className={cn(
              'flex-1 p-3 rounded-lg border cursor-pointer transition-colors',
              destination === 'pipeline'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-muted-foreground/30',
            )}>
              <input type="radio" name="destination" value="pipeline" checked={destination === 'pipeline'}
                onChange={() => setDestination('pipeline')} className="sr-only" />
              <span className="text-xs font-medium">Pipeline</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">Route directly into a pipeline</p>
            </label>
          </div>
        </div>

        {destination === 'campaign' ? (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Campaign Action</label>
              <div className="flex gap-3">
                <label className={cn(
                  'flex-1 p-3 rounded-lg border cursor-pointer transition-colors',
                  campaignAction === 'existing'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-muted-foreground/30',
                )}>
                  <input type="radio" name="campaign-action" value="existing" checked={campaignAction === 'existing'}
                    onChange={() => setCampaignAction('existing')} className="sr-only" />
                  <span className="text-xs font-medium">Use existing</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Pick an active campaign</p>
                </label>
                <label className={cn(
                  'flex-1 p-3 rounded-lg border cursor-pointer transition-colors',
                  campaignAction === 'new'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-muted-foreground/30',
                )}>
                  <input type="radio" name="campaign-action" value="new" checked={campaignAction === 'new'}
                    onChange={() => setCampaignAction('new')} className="sr-only" />
                  <span className="text-xs font-medium">Create new</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Start a dedicated campaign</p>
                </label>
              </div>
            </div>

            {campaignAction === 'existing' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Campaign</label>
                <select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                  <option value="">Select a campaign…</option>
                  {campaigns.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Campaign Name</label>
                  <Input value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)}
                    placeholder="e.g. Website Contact Forms" className="h-9 border-border bg-card text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Pipeline</label>
                  <select value={selectedPipelineId} onChange={(e) => setSelectedPipelineId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                    <option value="">Select a pipeline…</option>
                    {pipelines.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name ?? p.id}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Pipeline</label>
            <select value={selectedPipelineId} onChange={(e) => setSelectedPipelineId(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              <option value="">Select a pipeline…</option>
              {pipelines.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name ?? p.id}</option>
              ))}
            </select>
          </div>
        )}

        {needsFieldMapping && (
          <FieldMappingSection
            show={showFieldMapping}
            onToggle={() => setShowFieldMapping(!showFieldMapping)}
            rows={fieldMappingRows}
            setRows={setFieldMappingRows}
            customFields={customFields}
            STANDARD_FIELDS={STANDARD_FIELDS}
            canManage={canManage}
            manifestName={manifestName}
          />
        )}

        {canManage && (
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={handleSave} disabled={savePending}
              className="h-8 rounded-lg text-xs font-semibold">
              {savePending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}
              Save Setup
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
