import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
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
  RefreshCw,
  AlertTriangle,
  Activity,
  Radio,
  Settings2,
} from 'lucide-react';
import {
  settingsApi,
  type IntegrationConfig,
  type IntegrationTestResult,
} from '@/api/settings';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

type IntegrationCategory = 'lead_source' | 'communication' | 'automation' | 'calendar' | 'support';
type CategoryFilter = 'all' | IntegrationCategory;

const CATEGORY_META: Record<IntegrationCategory, { label: string; helper: string }> = {
  lead_source: {
    label: 'Lead sources',
    helper: 'Capture enquiries from ads, directories, forms, and marketplaces.',
  },
  communication: {
    label: 'Communication',
    helper: 'Send and receive customer messages from common outreach channels.',
  },
  automation: {
    label: 'Automation',
    helper: 'Push CRM events into external tools and workflow platforms.',
  },
  calendar: {
    label: 'Calendar',
    helper: 'Sync appointments and reminders with calendars.',
  },
  support: {
    label: 'Support intake',
    helper: 'Turn incoming customer requests into cases.',
  },
};

const PROVIDER_CATEGORY: Record<string, IntegrationCategory> = {
  facebook: 'lead_source',
  justdial: 'lead_source',
  whatsapp: 'communication',
  email: 'communication',
  zapier: 'automation',
  'google-calendar': 'calendar',
  'email-to-case': 'support',
};

function resolveIcon(icon: string) {
  switch (icon) {
    case 'MessageSquare': return MessageSquare;
    case 'Share2': return Share2;
    case 'PhoneCall': return PhoneCall;
    case 'Mail': return Mail;
    case 'Plug': return Plug;
    case 'Zap': return Zap;
    case 'Calendar': return Calendar;
    case 'Inbox': return Inbox;
    default: return Link;
  }
}

function getCategory(provider: string): IntegrationCategory {
  return PROVIDER_CATEGORY[provider] ?? 'automation';
}

function getHealth(integration: IntegrationConfig): IntegrationTestResult | null {
  const health = integration.config_json?.health;
  if (!health || typeof health !== 'object') return null;
  const candidate = health as Partial<IntegrationTestResult>;
  if (!candidate.status || !candidate.message || !candidate.last_checked_at) return null;
  return candidate as IntegrationTestResult;
}

function formatDateTime(value?: string) {
  if (!value) return 'Never checked';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function IntegrationSettings() {
  const { can } = usePermissions();
  const canManage = can('manage', 'Integration');
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['settings', 'integrations'],
    queryFn: () => settingsApi.integrations.list(),
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const connected = integrations.filter((item) => item.status === 'connected').length;
    const healthy = integrations.filter((item) => getHealth(item)?.status === 'healthy').length;
    const needsReview = integrations.filter((item) => {
      const health = getHealth(item);
      return item.status === 'connected' && (!health || health.status === 'error');
    }).length;

    return {
      connected,
      available: integrations.length,
      healthy,
      needsReview,
    };
  }, [integrations]);

  const filteredIntegrations = useMemo(() => {
    if (activeCategory === 'all') return integrations;
    return integrations.filter((item) => getCategory(item.provider) === activeCategory);
  }, [activeCategory, integrations]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1180px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Connect lead sources, communication channels, and automation tools used by this workspace.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatusMetric label="Connected" value={`${stats.connected}/${stats.available}`} icon={<Plug size={14} />} />
          <StatusMetric label="Healthy" value={stats.healthy} icon={<CheckCircle2 size={14} />} />
          <StatusMetric label="Needs review" value={stats.needsReview} icon={<AlertTriangle size={14} />} />
          <StatusMetric label="Encrypted" value="AES-256" icon={<ShieldCheck size={14} />} />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <CategoryButton
          active={activeCategory === 'all'}
          label="All"
          count={integrations.length}
          onClick={() => setActiveCategory('all')}
        />
        {(Object.keys(CATEGORY_META) as IntegrationCategory[]).map((category) => (
          <CategoryButton
            key={category}
            active={activeCategory === category}
            label={CATEGORY_META[category].label}
            count={integrations.filter((item) => getCategory(item.provider) === category).length}
            onClick={() => setActiveCategory(category)}
          />
        ))}
      </div>

      {activeCategory !== 'all' && (
        <div className="rounded-lg border border-border bg-muted/25 px-4 py-3">
          <p className="text-xs font-semibold text-foreground">{CATEGORY_META[activeCategory].label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{CATEGORY_META[activeCategory].helper}</p>
        </div>
      )}

      <div className="grid gap-3">
        {filteredIntegrations.map((integration) => (
          <IntegrationCard
            key={integration.provider}
            integration={integration}
            canManage={canManage}
            onChanged={() => {
              queryClient.invalidateQueries({ queryKey: ['settings', 'integrations'] });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function StatusMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <div className="min-w-[118px] rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function CategoryButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
      <span className={cn(
        'rounded-md px-1.5 py-0.5 text-[10px]',
        active ? 'bg-white/15 text-white' : 'bg-muted text-muted-foreground',
      )}>
        {count}
      </span>
    </button>
  );
}

interface IntegrationCardProps {
  integration: IntegrationConfig;
  canManage: boolean;
  onChanged: () => void;
}

function IntegrationCard({ integration, canManage, onChanged }: IntegrationCardProps) {
  const [showForm, setShowForm] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  const configureMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      settingsApi.integrations.configure(integration.provider, data),
    onSuccess: () => {
      onChanged();
      setShowForm(false);
      setFieldValues({});
      toast.success(`${integration.name} configured`);
    },
    onError: () => toast.error(`Failed to configure ${integration.name}`),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => settingsApi.integrations.disconnect(integration.provider),
    onSuccess: () => {
      onChanged();
      setShowForm(false);
      toast.success(`${integration.name} disconnected`);
    },
    onError: () => toast.error(`Failed to disconnect ${integration.name}`),
  });

  const testMutation = useMutation({
    mutationFn: () => settingsApi.integrations.test(integration.provider),
    onSuccess: (result) => {
      onChanged();
      if (result.status === 'healthy') {
        toast.success(`${integration.name} setup looks healthy`);
      } else {
        toast.error(result.message);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || `Could not test ${integration.name}`);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const missing = integration.credential_fields.filter((field) => !fieldValues[field]?.trim());
    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.join(', ')}`);
      return;
    }
    configureMutation.mutate(fieldValues);
  };

  const isConnected = integration.status === 'connected';
  const health = getHealth(integration);
  const ProviderIcon = resolveIcon(integration.icon);
  const category = getCategory(integration.provider);

  return (
    <Card className="bg-card border-border rounded-lg shadow-none overflow-hidden">
      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex min-w-0 gap-3.5">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
            isConnected
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : 'border-border bg-background text-muted-foreground',
          )}>
            <ProviderIcon size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{integration.name}</span>
              <Badge variant="outline" className="rounded-md text-[10px]">
                {CATEGORY_META[category].label}
              </Badge>
              <ConnectionBadge connected={isConnected} status={integration.status} />
              {health && <HealthBadge status={health.status} />}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{integration.description}</p>

            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              <StatusLine
                icon={<ShieldCheck size={13} />}
                label="Credentials"
                value={integration.has_credentials ? 'Stored securely' : 'Not configured'}
              />
              <StatusLine
                icon={<Activity size={13} />}
                label="Last check"
                value={formatDateTime(health?.last_checked_at)}
              />
              <StatusLine
                icon={<Radio size={13} />}
                label="Connector"
                value={health?.status === 'healthy' ? 'Ready' : isConnected ? 'Needs check' : 'Disconnected'}
              />
            </div>

            {health?.message && (
              <p className={cn(
                'mt-3 rounded-md border px-3 py-2 text-xs',
                health.status === 'healthy'
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                  : 'border-red-100 bg-red-50 text-red-700',
              )}>
                {health.message}
              </p>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={!isConnected || testMutation.isPending}
              onClick={() => testMutation.mutate()}
              className="h-8 rounded-lg text-xs font-semibold"
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Test setup
            </Button>

            <Button
              variant={isConnected ? 'outline' : 'default'}
              size="sm"
              onClick={() => {
                setShowForm(!showForm);
                setFieldValues({});
              }}
              className="h-8 rounded-lg text-xs font-semibold"
            >
              <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              {isConnected ? 'Update' : 'Configure'}
            </Button>

            {isConnected && (
              <Button
                variant="outline"
                size="sm"
                disabled={disconnectMutation.isPending}
                onClick={() => {
                  if (window.confirm(`Disconnect ${integration.name}? Stored credentials will be erased.`)) {
                    disconnectMutation.mutate();
                  }
                }}
                className="h-8 rounded-lg border-red-100 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                {disconnectMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Disconnect
              </Button>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border-t border-border bg-background/45 px-4 py-4">
          <div className="mb-4 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck size={12} />
            Secure credentials
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
                      setFieldValues((values) => ({ ...values, [field]: e.target.value }))
                    }
                    placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                    required
                    className="h-9 border-border bg-card pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowValues((values) => ({ ...values, [field]: !values[field] }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showValues[field] ? 'Hide value' : 'Show value'}
                  >
                    {showValues[field] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Values are encrypted at rest and are never displayed after saving.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowForm(false)}
                className="h-8 rounded-lg text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={configureMutation.isPending}
                className="h-8 rounded-lg text-xs font-semibold"
              >
                {configureMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save credentials
              </Button>
            </div>
          </div>
        </form>
      )}
    </Card>
  );
}

function ConnectionBadge({
  connected,
  status,
}: {
  connected: boolean;
  status: IntegrationConfig['status'];
}) {
  if (connected) {
    return (
      <Badge variant="outline" className="rounded-md border-emerald-100 bg-emerald-50 text-[10px] text-emerald-700">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Connected
      </Badge>
    );
  }

  if (status === 'error') {
    return (
      <Badge variant="outline" className="rounded-md border-red-100 bg-red-50 text-[10px] text-red-700">
        <XCircle className="mr-1 h-3 w-3" />
        Error
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-md text-[10px] text-muted-foreground">
      Disconnected
    </Badge>
  );
}

function HealthBadge({ status }: { status: IntegrationTestResult['status'] }) {
  return status === 'healthy' ? (
    <Badge variant="outline" className="rounded-md border-emerald-100 bg-emerald-50 text-[10px] text-emerald-700">
      Healthy
    </Badge>
  ) : (
    <Badge variant="outline" className="rounded-md border-red-100 bg-red-50 text-[10px] text-red-700">
      Needs review
    </Badge>
  );
}

function StatusLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/35 px-2.5 py-2">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="block truncate text-xs font-medium text-foreground">{value}</span>
      </span>
    </div>
  );
}
