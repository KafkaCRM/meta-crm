import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2,
  Plug,
  Link2,
  Settings2,
  ArrowLeftRight,
  Workflow,
  History,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  Plus,
  Save,
  ArrowLeft,
} from 'lucide-react';
import { integrationsApi } from '@/api/integrations';
import type { ConnectionDto, IntegrationManifest, IntakeRoute, FieldMapping, InboundEvent } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

import { settingsApi } from '@/api/settings';

type Tab = 'connection' | 'routing' | 'mapping' | 'automation' | 'activity';

interface Props {
  connectionId: string;
  manifest: IntegrationManifest;
  onBack: () => void;
}

export function IntegrationDetail({ connectionId, manifest, onBack }: Props) {
  const { can } = usePermissions();
  const canManage = can('manage', 'Integration');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('connection');

  const { data: connection, isLoading } = useQuery({
    queryKey: ['integrations', 'connections', connectionId],
    queryFn: () => integrationsApi.connections.get(connectionId),
    enabled: !!connectionId,
  });

  if (isLoading || !connection) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'connection', label: 'Connection', icon: Plug },
    { id: 'routing', label: 'Lead Routing', icon: ArrowLeftRight },
    { id: 'mapping', label: 'Field Mapping', icon: Link2 },
    { id: 'automation', label: 'Automation', icon: Workflow },
    { id: 'activity', label: 'Activity & Errors', icon: History },
  ];

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={onBack} className="h-8 w-8">
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{manifest.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{manifest.description}</p>
        </div>
        <Badge variant="outline" className={cn(
          'ml-auto rounded-md text-xs font-semibold',
          connection.status === 'connected'
            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
            : 'border-border text-muted-foreground',
        )}>
          {connection.status}
        </Badge>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'connection' && (
        <ConnectionTab connection={connection} manifest={manifest} canManage={canManage} onChanged={() => queryClient.invalidateQueries({ queryKey: ['integrations', 'connections', connectionId] })} />
      )}
      {activeTab === 'routing' && (
        <RoutingTab connectionId={connectionId} canManage={canManage} />
      )}
      {activeTab === 'mapping' && (
        <MappingTab connectionId={connectionId} canManage={canManage} />
      )}
      {activeTab === 'automation' && (
        <AutomationTab canManage={canManage} />
      )}
      {activeTab === 'activity' && (
        <ActivityTab connectionId={connectionId} />
      )}
    </div>
  );
}

function ConnectionTab({ connection, manifest, canManage, onChanged }: {
  connection: ConnectionDto;
  manifest: IntegrationManifest;
  canManage: boolean;
  onChanged: () => void;
}) {
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

  const disconnectMutation = useMutation({
    mutationFn: () => integrationsApi.connections.disconnect(connection.id),
    onSuccess: () => {
      onChanged();
      toast.success(`${manifest.name} disconnected`);
    },
    onError: () => toast.error(`Failed to disconnect ${manifest.name}`),
  });

  const testMutation = useMutation({
    mutationFn: () => integrationsApi.connections.test(connection.id),
    onSuccess: (result) => {
      onChanged();
      if (result.status === 'healthy') {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSave = () => {
    const missing = manifest.credential_fields.filter((f) => !fieldValues[f]?.trim());
    if (missing.length > 0) {
      toast.error(`Fill in: ${missing.join(', ')}`);
      return;
    }
    connectMutation.mutate(fieldValues);
  };

  const health = (connection.config_json?.health as { status?: string; last_tested_at?: string; message?: string } | undefined) ?? null;

  return (
    <div className="grid gap-5 md:grid-cols-2">
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
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleSave} disabled={connectMutation.isPending} className="h-8 rounded-lg text-xs font-semibold">
                {connectMutation.isPending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}
                Save Credentials
              </Button>
              {connection.status === 'connected' && (
                <Button variant="outline" size="sm" onClick={() => { if (window.confirm(`Disconnect ${manifest.name}?`)) disconnectMutation.mutate(); }}
                  className="h-8 rounded-lg text-xs text-red-600 border-red-100 hover:bg-red-50">
                  <Trash2 className="mr-1.5 h-3 w-3" /> Disconnect
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Connection Test</CardTitle>
          <CardDescription className="text-xs">Verify provider connectivity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant="outline" className={cn(
              'rounded-md text-xs',
              health?.status === 'healthy'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                : 'border-amber-100 bg-amber-50 text-amber-700',
            )}>
              {health?.status ?? 'untested'}
            </Badge>
          </div>
          {health?.last_tested_at && (
            <p className="text-xs text-muted-foreground">
              Last tested: {new Date(health.last_tested_at as string).toLocaleString()}
            </p>
          )}
          {health?.message && (
            <p className="text-xs p-2 rounded-md bg-muted/50">{health.message as string}</p>
          )}
          {canManage && (
            <Button variant="outline" size="sm" disabled={testMutation.isPending} onClick={() => testMutation.mutate()}
              className="h-8 rounded-lg text-xs font-semibold">
              {testMutation.isPending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1.5 h-3 w-3" />}
              Test Connection
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RoutingTab({ connectionId, canManage }: { connectionId: string; canManage: boolean }) {
  const queryClient = useQueryClient();

  const { data: route, isLoading, isError } = useQuery({
    queryKey: ['integrations', 'routes', connectionId],
    queryFn: () => integrationsApi.routes.get(connectionId),
    retry: false,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await settingsApi.integrations.list();
      return [] as any[];
    },
    enabled: false,
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ['settings', 'pipelines'],
    queryFn: () => settingsApi.pipelines.list(),
    staleTime: 30_000,
  });

  const [mode, setMode] = useState<string>(route?.mode ?? 'create_lead');
  const [campaignId, setCampaignId] = useState(route?.campaign_id ?? '');
  const [pipelineId, setPipelineId] = useState(route?.pipeline_id ?? '');
  const [assignmentType, setAssignmentType] = useState<string>(
    (route?.assignment_rule as any)?.type ?? 'fixed',
  );
  const [duplicateStrategy, setDuplicateStrategy] = useState<string>(
    route?.duplicate_strategy ?? 'skip',
  );

  const upsertMutation = useMutation({
    mutationFn: (data: Partial<IntakeRoute>) =>
      integrationsApi.routes.upsert(connectionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'routes', connectionId] });
      toast.success('Routing configuration saved');
    },
    onError: () => toast.error('Failed to save routing configuration'),
  });

  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const handleSave = () => {
    upsertMutation.mutate({
      mode: mode as any,
      ...(campaignId ? { campaign_id: campaignId } : { campaign_id: null }),
      ...(pipelineId ? { pipeline_id: pipelineId } : { pipeline_id: null }),
      assignment_rule: { type: assignmentType },
      duplicate_strategy: duplicateStrategy as any,
    });
  };

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Intake Policy</CardTitle>
          <CardDescription className="text-xs">How incoming events should be routed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} disabled={!canManage}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              <option value="create_lead">Create a Lead for qualification</option>
              <option value="create_contact_opportunity">Create/update Contact + Opportunity</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Default Campaign</label>
            <input value={campaignId} onChange={(e) => setCampaignId(e.target.value)}
              placeholder="Campaign ID — auto-derives Branch, Brand, Vertical, Pipeline"
              disabled={!canManage}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground">Campaign represents attribution. Pipeline represents the sales process. Both can coexist.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Pipeline (for Contact+Opportunity mode)</label>
            <select value={pipelineId} onChange={(e) => setPipelineId(e.target.value)} disabled={!canManage}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              <option value="">Auto (from campaign or default)</option>
              {pipelines.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Assignment Rule</label>
            <select value={assignmentType} onChange={(e) => setAssignmentType(e.target.value)} disabled={!canManage}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              <option value="fixed">Fixed (specified owner)</option>
              <option value="round_robin">Round Robin</option>
              <option value="capacity">Capacity-based</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Duplicate Handling</label>
            <select value={duplicateStrategy} onChange={(e) => setDuplicateStrategy(e.target.value)} disabled={!canManage}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              <option value="skip">Skip duplicates</option>
              <option value="update">Update existing record</option>
              <option value="always_create">Always create new</option>
            </select>
          </div>

          {canManage && (
            <Button size="sm" onClick={handleSave} disabled={upsertMutation.isPending}
              className="h-8 rounded-lg text-xs font-semibold">
              {upsertMutation.isPending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}
              Save Routing
            </Button>
          )}
        </CardContent>
      </Card>

      {route && (
        <Card className="bg-card border-border rounded-xl shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Current Configuration</CardTitle>
            <CardDescription className="text-xs">Saved intake policy for this integration</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-auto max-h-64">{JSON.stringify(route, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MappingTab({ connectionId, canManage }: { connectionId: string; canManage: boolean }) {
  const queryClient = useQueryClient();

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ['integrations', 'mappings', connectionId],
    queryFn: () => integrationsApi.mappings.list(connectionId),
  });

  const [rows, setRows] = useState<Partial<FieldMapping>[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [activeEntity, setActiveEntity] = useState<string>('lead');

  const { data: customFields = [] } = useQuery({
    queryKey: ['settings', 'field-definitions', activeEntity],
    queryFn: () => settingsApi.fieldDefinitions.list(activeEntity),
    staleTime: 60_000,
  });

  if (!initialized && mappings.length > 0) {
    setRows(mappings);
    setInitialized(true);
  }

  const upsertMutation = useMutation({
    mutationFn: (data: Partial<FieldMapping>[]) =>
      integrationsApi.mappings.upsert(connectionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'mappings', connectionId] });
      toast.success('Field mappings saved');
    },
    onError: () => toast.error('Failed to save field mappings'),
  });

  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const STANDARD_FIELDS: Record<string, string[]> = {
    lead: ['name', 'email', 'phone', 'source', 'status', 'notes', 'campaign_id', 'assigned_to_id'],
    party: ['name', 'email', 'phone_raw', 'type', 'source'],
    case: ['title', 'type', 'stage', 'assigned_to_id'],
  };

  const getTargetFieldOptions = (entity: string) => {
    const standard = (STANDARD_FIELDS[entity] ?? []).map((f) => ({ value: f, label: `${f} (standard)` }));
    const custom = customFields.map((f) => ({ value: f.name, label: `${f.label} (custom)` }));
    return [...standard, ...custom];
  };

  const addRow = () => setRows([...rows, { source_field: '', target_entity: 'lead', target_field: '', transform: 'direct', is_required: false }]);
  const updateRow = (i: number, update: Partial<FieldMapping>) => {
    const next = [...rows];
    next[i] = { ...next[i], ...update };
    setRows(next);
  };
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));

  return (
    <Card className="bg-card border-border rounded-xl shadow-none">
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-medium">Field Mappings</CardTitle>
          <CardDescription className="text-xs">Map provider fields to CRM fields. Standard and custom fields from Field Definitions are listed.</CardDescription>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={addRow} className="h-8 rounded-lg text-xs">
            <Plus className="mr-1 h-3 w-3" /> Add Mapping
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 px-2 font-medium">Source Field</th>
                <th className="py-2 px-2 font-medium">Target Entity</th>
                <th className="py-2 px-2 font-medium">Target Field</th>
                <th className="py-2 px-2 font-medium">Transform</th>
                <th className="py-2 px-2 font-medium">Required</th>
                {canManage && <th className="py-2 px-2 font-medium w-10" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const entity = row.target_entity ?? 'lead';
                const fieldOptions = getTargetFieldOptions(entity);
                const datalistId = `fields-${i}`;
                return (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-1.5 px-2">
                    <input value={row.source_field ?? ''} disabled={!canManage}
                      onChange={(e) => updateRow(i, { source_field: e.target.value })}
                      placeholder="e.g. ad_lead.email"
                      className="w-full bg-transparent border border-border rounded px-2 py-1 text-xs" />
                  </td>
                  <td className="py-1.5 px-2">
                    <select value={row.target_entity ?? 'lead'} disabled={!canManage}
                      onChange={(e) => { updateRow(i, { target_entity: e.target.value, target_field: '' }); setActiveEntity(e.target.value); }}
                      className="w-full bg-transparent border border-border rounded px-2 py-1 text-xs">
                      <option value="lead">Lead</option>
                      <option value="party">Party</option>
                      <option value="case">Case</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      list={datalistId}
                      value={row.target_field ?? ''}
                      disabled={!canManage}
                      onChange={(e) => updateRow(i, { target_field: e.target.value })}
                      placeholder="Pick or type field name"
                      className="w-full bg-transparent border border-border rounded px-2 py-1 text-xs"
                    />
                    <datalist id={datalistId}>
                      {fieldOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </datalist>
                  </td>
                  <td className="py-1.5 px-2">
                    <select value={row.transform ?? 'direct'} disabled={!canManage}
                      onChange={(e) => updateRow(i, { transform: e.target.value })}
                      className="w-full bg-transparent border border-border rounded px-2 py-1 text-xs">
                      <option value="direct">Direct</option>
                      <option value="split(' ',0)">Split First Word</option>
                      <option value="split(' ',1)">Split Second Word</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <input type="checkbox" checked={row.is_required ?? false} disabled={!canManage}
                      onChange={(e) => updateRow(i, { is_required: e.target.checked })}
                      className="rounded" />
                  </td>
                  {canManage && (
                    <td className="py-1.5 px-2">
                      <button onClick={() => removeRow(i)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                    </td>
                  )}
                </tr>
              )})}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No field mappings configured.
                    {canManage && ' Click "Add Mapping" to start.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage && rows.length > 0 && (
          <div className="mt-4">
            <Button size="sm" onClick={() => upsertMutation.mutate(rows)} disabled={upsertMutation.isPending}
              className="h-8 rounded-lg text-xs font-semibold">
              {upsertMutation.isPending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}
              Save All Mappings
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AutomationTab({ canManage }: { canManage: boolean }) {
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['automation-workflows'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/v1/automation-flows');
        if (!res.ok) return [];
        return (await res.json()) as any[];
      } catch { return []; }
    },
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      fetch(`/api/v1/automation-flows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      }).then((r) => r.json()),
    onSuccess: () => toast.success('Workflow updated'),
    onError: () => toast.error('Failed to update workflow'),
  });

  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <Card className="bg-card border-border rounded-xl shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Automation Workflows</CardTitle>
        <CardDescription className="text-xs">Workflows triggered when intake events are processed</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 px-2 font-medium">Name</th>
                <th className="py-2 px-2 font-medium">Trigger Event</th>
                <th className="py-2 px-2 font-medium">Status</th>
                {canManage && <th className="py-2 px-2 font-medium w-10">Toggle</th>}
              </tr>
            </thead>
            <tbody>
              {workflows.map((wf: any) => {
                const relevantEvents = ['Lead:create', 'Party:create', 'Case:create', 'integration:intake'];
                const isRelevant = relevantEvents.includes(wf.trigger_event);
                return (
                  <tr key={wf.id} className={cn('border-b border-border/50', !isRelevant && 'opacity-50')}>
                    <td className="py-2 px-2 font-medium">{wf.name}</td>
                    <td className="py-2 px-2">
                      <Badge variant="outline" className={cn(
                        'rounded-md text-[10px]',
                        isRelevant ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-border text-muted-foreground',
                      )}>
                        {wf.trigger_event}
                      </Badge>
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant="outline" className={cn(
                        'rounded-md text-[10px]',
                        wf.is_active ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-border text-muted-foreground',
                      )}>
                        {wf.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="py-2 px-2">
                        <button
                          onClick={() => toggleMutation.mutate({ id: wf.id, is_active: !wf.is_active })}
                          className={cn(
                            'text-xs px-2 py-0.5 rounded border transition-colors',
                            wf.is_active
                              ? 'border-red-100 text-red-600 hover:bg-red-50'
                              : 'border-emerald-100 text-emerald-600 hover:bg-emerald-50',
                          )}
                        >
                          {wf.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {workflows.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 4 : 3} className="py-8 text-center text-muted-foreground">
                    No automation workflows configured. Create them in Pipeline Settings → Workflows.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityTab({ connectionId }: { connectionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['integrations', 'events', connectionId],
    queryFn: () => integrationsApi.events.list(connectionId),
  });

  const events: InboundEvent[] = (data as any)?.data ?? [];

  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <Card className="bg-card border-border rounded-xl shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Inbound Events</CardTitle>
        <CardDescription className="text-xs">Raw events received from this provider</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 px-2 font-medium">Event ID</th>
                <th className="py-2 px-2 font-medium">Type</th>
                <th className="py-2 px-2 font-medium">Status</th>
                <th className="py-2 px-2 font-medium">Result</th>
                <th className="py-2 px-2 font-medium">Received</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-border/50">
                  <td className="py-1.5 px-2 font-mono text-[10px]">{event.provider_event_id.substring(0, 12)}...</td>
                  <td className="py-1.5 px-2">{event.event_type}</td>
                  <td className="py-1.5 px-2">
                    <Badge variant="outline" className={cn(
                      'rounded-md text-[10px]',
                      event.status === 'routed' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' :
                      event.status === 'failed' ? 'border-red-100 bg-red-50 text-red-700' :
                      event.status === 'deduplicated' ? 'border-amber-100 bg-amber-50 text-amber-700' :
                      'border-border text-muted-foreground',
                    )}>
                      {event.status}
                    </Badge>
                  </td>
                  <td className="py-1.5 px-2">
                    {event.result_entity_type && `${event.result_entity_type}:${event.result_entity_id?.substring(0, 8)}`}
                    {event.error_message && <span className="text-red-600 block text-[10px]">{event.error_message.substring(0, 60)}</span>}
                  </td>
                  <td className="py-1.5 px-2 text-muted-foreground">
                    {new Date(event.received_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No inbound events received yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
