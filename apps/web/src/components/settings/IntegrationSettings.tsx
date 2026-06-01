import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  MessageSquare,
  Share2,
  PhoneCall,
  Link,
  ShieldCheck,
  Plug,
  Zap,
  Calendar,
  Inbox,
} from 'lucide-react';
import { settingsApi, type IntegrationConfig } from '@/api/settings';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';

// ── Icon mapping (driven by manifest, not hardcoded) ──────────────────────────

function resolveIcon(icon: string) {
  switch (icon) {
    case 'MessageSquare': return MessageSquare;
    case 'Share2':        return Share2;
    case 'PhoneCall':     return PhoneCall;
    case 'Mail':          return Mail;
    case 'Plug':          return Plug;
    case 'Zap':           return Zap;
    case 'Calendar':      return Calendar;
    case 'Inbox':         return Inbox;
    default:              return Link;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function IntegrationSettings() {
  const { can } = usePermissions();
  const canManage = can('manage', 'Integration');
  const queryClient = useQueryClient();

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['settings', 'integrations'],
    queryFn: () => settingsApi.integrations.list(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Connect your workspace with third-party services. Credentials are encrypted using AES-256-GCM and never stored in plaintext.
        </p>
      </div>

      <div className="space-y-4">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.provider}
            integration={integration}
            canManage={canManage}
            onConfigured={() => {
              queryClient.invalidateQueries({ queryKey: ['settings', 'integrations'] });
              toast.success(`${integration.name} configured successfully`);
            }}
            onDisconnected={() => {
              queryClient.invalidateQueries({ queryKey: ['settings', 'integrations'] });
              toast.success(`${integration.name} disconnected`);
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Card component ────────────────────────────────────────────────────────────

interface IntegrationCardProps {
  integration: IntegrationConfig;
  canManage: boolean;
  onConfigured: () => void;
  onDisconnected: () => void;
}

function IntegrationCard({ integration, canManage, onConfigured, onDisconnected }: IntegrationCardProps) {
  const [showForm, setShowForm] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  const configureMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      settingsApi.integrations.configure(integration.provider, data),
    onSuccess: () => {
      onConfigured();
      setShowForm(false);
      setFieldValues({});
    },
    onError: () => toast.error(`Failed to configure ${integration.name}`),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => settingsApi.integrations.disconnect(integration.provider),
    onSuccess: () => {
      onDisconnected();
      setShowForm(false);
    },
    onError: () => toast.error(`Failed to disconnect ${integration.name}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate all required fields are filled
    const missing = integration.credential_fields.filter((f) => !fieldValues[f]?.trim());
    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.join(', ')}`);
      return;
    }
    configureMutation.mutate(fieldValues);
  };

  const isConnected = integration.status === 'connected';
  const ProviderIcon = resolveIcon(integration.icon);

  return (
    <Card className="bg-card border-border rounded-xl shadow-none overflow-hidden">
      <div className="flex items-center justify-between px-4 py-4 group select-none flex-wrap gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className={`p-2.5 rounded-lg border flex items-center justify-center flex-shrink-0 ${
            isConnected
              ? 'bg-emerald-50/50 text-emerald-600 border-emerald-100'
              : 'bg-background text-muted-foreground border-border'
          }`}>
            <ProviderIcon size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{integration.name}</span>
              {isConnected && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] rounded-md font-bold py-0 px-1.5 flex items-center gap-0.5">
                  <CheckCircle2 size={8} />
                  Connected
                </Badge>
              )}
              {integration.status === 'error' && (
                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100 text-[8px] rounded-md font-bold py-0 px-1.5 flex items-center gap-0.5">
                  <XCircle size={8} />
                  Error
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{integration.description}</p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            {!isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowForm(!showForm)}
                className="border-border text-foreground hover:bg-background h-8 rounded-lg font-semibold"
              >
                {showForm ? 'Cancel' : 'Configure'}
              </Button>
            )}
            {isConnected && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowForm(!showForm);
                    setFieldValues({});
                  }}
                  className="border-border text-foreground hover:bg-background h-8 rounded-lg font-semibold"
                >
                  Update Credentials
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disconnectMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Disconnect ${integration.name}? This will erase all stored credentials.`)) {
                      disconnectMutation.mutate();
                    }
                  }}
                  className="border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 h-8 rounded-lg font-semibold"
                >
                  {disconnectMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  Disconnect
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Credential form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="border-t border-border bg-background/40 px-4 py-4 space-y-4">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck size={12} />
            <span>Secure API Credentials — Encrypted with AES-256-GCM</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {integration.credential_fields.map((field) => (
              <div key={field} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground capitalize">
                  {field.replace(/_/g, ' ')}
                </label>
                <div className="relative">
                  <Input
                    type={showValues[field] ? 'text' : 'password'}
                    value={fieldValues[field] ?? ''}
                    onChange={(e) =>
                      setFieldValues((f) => ({ ...f, [field]: e.target.value }))
                    }
                    placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                    required
                    className="h-9 border-border bg-card text-foreground placeholder-[#94a3b8] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowValues((s) => ({ ...s, [field]: !s[field] }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showValues[field] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] text-muted-foreground leading-normal max-w-xs">
              Credentials are encrypted at rest and never shown again post-save.
            </span>
            <Button
              type="submit"
              disabled={configureMutation.isPending}
              className="bg-primary hover:bg-[#1e293b] text-white h-9 rounded-lg"
            >
              {configureMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save & Encrypt
            </Button>
          </div>
        </form>
      )}

      {/* Connected credential fingerprint */}
      {isConnected && integration.has_credentials && !showForm && (
        <div className="border-t border-border bg-background/30 px-4 py-3 flex items-center justify-between text-xs">
          <div>
            <p className="font-medium text-foreground">Credentials stored (AES-256-GCM encrypted)</p>
            {integration.configured_at && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Last updated: {new Date(integration.configured_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 text-emerald-600">
            <ShieldCheck size={13} />
            <span className="text-[10px] font-semibold">Secure</span>
          </div>
        </div>
      )}
    </Card>
  );
}
