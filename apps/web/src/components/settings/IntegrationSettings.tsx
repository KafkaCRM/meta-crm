import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, Eye, EyeOff, Mail, MessageSquare, Share2, PhoneCall, Link, ShieldCheck } from 'lucide-react';
import { settingsApi, type IntegrationConfig } from '@/api/settings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';

const PROVIDERS = [
  { id: 'whatsapp', name: 'WhatsApp', description: 'WhatsApp Business API messaging integration', fields: ['api_key', 'phone_number_id'] },
  { id: 'facebook', name: 'Facebook', description: 'Facebook Lead Ads integration webhook', fields: ['access_token', 'page_id'] },
  { id: 'justdial', name: 'JustDial', description: 'JustDial developer API lead capture integration', fields: ['api_key', 'client_id'] },
  { id: 'email', name: 'Email', description: 'SMTP integration to send system notifications and updates', fields: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass'] },
];

export function IntegrationSettings() {
  const { can } = usePermissions();
  const canManage = can('manage', 'Integration');
  const queryClient = useQueryClient();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['settings', 'integrations'],
    queryFn: () => settingsApi.integrations.list(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#94a3b8]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0f172a]">Integrations</h1>
        <p className="text-sm text-[#64748b] mt-0.5">
          Connect your workspace with third-party service providers, API credentials, and email channels
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
              canManage={canManage}
              onConfigured={() => {
                queryClient.invalidateQueries({ queryKey: ['settings', 'integrations'] });
                toast.success(`${provider.name} configured successfully`);
              }}
              onDisconnected={() => {
                queryClient.invalidateQueries({ queryKey: ['settings', 'integrations'] });
                toast.success(`${provider.name} disconnected successfully`);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

interface IntegrationCardProps {
  provider: { id: string; name: string; description: string; fields: string[] };
  config: IntegrationConfig | undefined;
  onConfigured: () => void;
  onDisconnected: () => void;
  canManage: boolean;
}

function IntegrationCard({ provider, config, onConfigured, onDisconnected, canManage }: IntegrationCardProps) {
  const [showForm, setShowForm] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  const configureMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      settingsApi.integrations.configure(provider.id, data),
    onSuccess: () => {
      onConfigured();
      setShowForm(false);
    },
    onError: () => toast.error(`Failed to configure ${provider.name}`),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => settingsApi.integrations.disconnect(provider.id),
    onSuccess: () => {
      onDisconnected();
      setShowForm(false);
    },
    onError: () => toast.error(`Failed to disconnect ${provider.name}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    configureMutation.mutate(fieldValues);
  };

  const isConnected = config?.status === 'connected';

  // Resolve integration provider icons
  const getProviderIcon = (id: string) => {
    switch (id) {
      case 'whatsapp':
        return MessageSquare;
      case 'facebook':
        return Share2;
      case 'justdial':
        return PhoneCall;
      case 'email':
        return Mail;
      default:
        return Link;
    }
  };

  const ProviderIcon = getProviderIcon(provider.id);

  return (
    <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none overflow-hidden">
      <div className="flex items-center justify-between px-4 py-4 group select-none flex-wrap gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className={`p-2.5 rounded-lg border flex items-center justify-center flex-shrink-0 ${
            isConnected
              ? 'bg-emerald-50/50 text-emerald-600 border-emerald-100'
              : 'bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]'
          }`}>
            <ProviderIcon size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-[#0f172a]">{provider.name}</span>
              {isConnected && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] rounded-md font-bold py-0 px-1.5 flex items-center gap-0.5">
                  <CheckCircle2 size={8} />
                  Connected
                </Badge>
              )}
              {config?.status === 'error' && (
                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100 text-[8px] rounded-md font-bold py-0 px-1.5 flex items-center gap-0.5">
                  <XCircle size={8} />
                  Error
                </Badge>
              )}
            </div>
            <p className="text-xs text-[#64748b] mt-0.5 leading-relaxed">{provider.description}</p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            {!isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowForm(!showForm)}
                className="border-[#e2e8f0] text-[#0f172a] hover:bg-[#f8fafc] h-8 rounded-lg font-semibold"
              >
                {showForm ? 'Cancel' : 'Configure'}
              </Button>
            )}
            {isConnected && (
              <Button
                variant="outline"
                size="sm"
                disabled={disconnectMutation.isPending}
                onClick={() => {
                  if (window.confirm(`Are you sure you want to disconnect your ${provider.name} integration? This will erase credential logs.`)) {
                    disconnectMutation.mutate();
                  }
                }}
                className="border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 h-8 rounded-lg font-semibold"
              >
                {disconnectMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Disconnect
              </Button>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border-t border-[#e2e8f0] bg-[#f8fafc]/40 px-4 py-4 space-y-4">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            <ShieldCheck size={12} />
            <span>Secure API Credentials</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {provider.fields.map((field) => (
              <div key={field} className="space-y-1.5">
                <label className="text-xs font-medium text-[#64748b] capitalize">
                  {field.replace(/_/g, ' ')}
                </label>
                <div className="relative">
                  <Input
                    type={showValues[field] ? 'text' : 'password'}
                    value={fieldValues[field] ?? ''}
                    onChange={(e) =>
                      setFieldValues((f) => ({ ...f, [field]: e.target.value }))
                    }
                    placeholder={`Enter custom ${field.replace(/_/g, ' ')}`}
                    required
                    className="h-9 border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowValues((s) => ({ ...s, [field]: !s[field] }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a]"
                  >
                    {showValues[field] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] text-[#94a3b8] leading-normal max-w-xs">
              Credentials are encrypted at rest and never shown again post-validation.
            </span>
            <Button
              type="submit"
              disabled={configureMutation.isPending}
              className="bg-[#0f172a] hover:bg-[#1e293b] text-white h-9 rounded-lg"
            >
              {configureMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save Configuration
            </Button>
          </div>
        </form>
      )}

      {isConnected && config?.has_credentials && (
        <div className="border-t border-[#e2e8f0] bg-[#f8fafc]/30 px-4 py-3 flex items-center justify-between text-xs">
          <div>
            <p className="font-medium text-[#0f172a]">Active Connection Credentials</p>
            <p className="text-[10px] text-[#94a3b8] font-mono mt-0.5">SHA-256 Fingerprint: ••••••••••••</p>
          </div>
          {canManage && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setShowForm(true);
                setFieldValues({});
              }}
              className="border-[#e2e8f0] hover:bg-[#f8fafc] text-xs h-7 rounded-md font-semibold"
            >
              Update Credentials
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
