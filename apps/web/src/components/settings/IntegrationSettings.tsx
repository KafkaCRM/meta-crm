import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Settings2, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { settingsApi, type IntegrationConfig } from '@/api/settings';

const PROVIDERS = [
  { id: 'whatsapp', name: 'WhatsApp', description: 'WhatsApp Business API', fields: ['api_key', 'phone_number_id'] },
  { id: 'facebook', name: 'Facebook', description: 'Facebook Lead Ads', fields: ['access_token', 'page_id'] },
  { id: 'justdial', name: 'JustDial', description: 'JustDial lead integration', fields: ['api_key', 'client_id'] },
  { id: 'email', name: 'Email', description: 'SMTP email integration', fields: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass'] },
];

export function IntegrationSettings() {
  const queryClient = useQueryClient();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['settings', 'integrations'],
    queryFn: () => settingsApi.integrations.list(),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect third-party services
        </p>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const config = integrations?.find((i) => i.provider === provider.id);
          return (
            <IntegrationCard
              key={provider.id}
              provider={provider}
              config={config}
              onConfigured={() => {
                queryClient.invalidateQueries({ queryKey: ['settings', 'integrations'] });
                toast.success(`${provider.name} configured`);
              }}
              onDisconnected={() => {
                queryClient.invalidateQueries({ queryKey: ['settings', 'integrations'] });
                toast.success(`${provider.name} disconnected`);
              }}
            />
          );
        })}
      </div>

      {integrations?.length === 0 && !isLoading && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No integrations configured.
        </div>
      )}
    </div>
  );
}

interface IntegrationCardProps {
  provider: { id: string; name: string; description: string; fields: string[] };
  config: IntegrationConfig | undefined;
  onConfigured: () => void;
  onDisconnected: () => void;
}

function IntegrationCard({ provider, config, onConfigured, onDisconnected }: IntegrationCardProps) {
  const [showForm, setShowForm] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  const configureMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      settingsApi.integrations.configure(provider.id, data),
    onSuccess: () => onConfigured(),
    onError: () => toast.error(`Failed to configure ${provider.name}`),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => settingsApi.integrations.disconnect(provider.id),
    onSuccess: () => onDisconnected(),
    onError: () => toast.error(`Failed to disconnect ${provider.name}`),
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      configureMutation.mutate(fieldValues);
    },
    [fieldValues, configureMutation],
  );

  const isConnected = config?.status === 'connected';

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{provider.name}</p>
            <p className="text-xs text-muted-foreground">{provider.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </span>
          )}
          {config?.status === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-600">
              <XCircle className="h-3 w-3" />
              Error
            </span>
          )}
          {!isConnected && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              {showForm ? 'Cancel' : 'Configure'}
            </button>
          )}
          {isConnected && (
            <button
              onClick={() => {
                if (window.confirm(`Disconnect ${provider.name}?`)) {
                  disconnectMutation.mutate();
                }
              }}
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border-t px-4 py-3 space-y-3">
          <p className="text-xs font-medium">API Credentials</p>
          <p className="text-xs text-muted-foreground">
            Credentials are stored securely and never shown again after saving.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {provider.fields.map((field) => (
              <div key={field} className="space-y-1">
                <label className="text-xs font-medium capitalize">{field.replace(/_/g, ' ')}</label>
                <div className="relative">
                  <input
                    type={showValues[field] ? 'text' : 'password'}
                    value={fieldValues[field] ?? ''}
                    onChange={(e) =>
                      setFieldValues((f) => ({ ...f, [field]: e.target.value }))
                    }
                    className="w-full rounded-md border border-input px-3 py-2 text-sm pr-10"
                    placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowValues((s) => ({ ...s, [field]: !s[field] }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showValues[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={configureMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {configureMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Credentials
          </button>
        </form>
      )}

      {isConnected && config?.has_credentials && (
        <div className="border-t px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">Stored Credentials</p>
              <p className="text-xs text-muted-foreground font-mono mt-1">••••••••••••</p>
            </div>
            <button
              onClick={() => {
                setShowForm(true);
                setFieldValues({});
              }}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
