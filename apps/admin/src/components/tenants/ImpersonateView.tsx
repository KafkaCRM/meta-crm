import { useQuery, useMutation } from '@tanstack/react-query';
import { getTenant, impersonateTenant } from '@/api/platform';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ExternalLink, RefreshCw, Zap, Server, Activity, Users, Settings } from 'lucide-react';
import { useState } from 'react';

interface ImpersonateViewProps {
  tenantId: string;
}

export function ImpersonateView({ tenantId }: ImpersonateViewProps) {
  const [errorMsg, setErrorMsg] = useState('');
  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => getTenant(tenantId),
  });

  const impersonateMutation = useMutation({
    mutationFn: () => impersonateTenant(tenantId),
    onSuccess: (data) => {
      setErrorMsg('');
      const targetHost = window.location.hostname;
      const protocol = window.location.protocol;
      const webPort = '5173';
      const webAppUrl = `${protocol}//${targetHost}:${webPort}/auth/impersonate?token=${encodeURIComponent(
        data.access_token
      )}&user=${encodeURIComponent(JSON.stringify(data.user))}`;
      window.open(webAppUrl, '_blank');
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to start impersonation session. Verify tenant has active users.');
    },
  });

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <RefreshCw size={24} className="animate-spin text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Loading workspace details...</span>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="py-24 text-center">
        <ShieldAlert size={40} className="mx-auto text-destructive mb-3" />
        <h3 className="text-base font-bold text-foreground">Tenant Not Found</h3>
        <p className="text-xs text-muted-foreground mt-1">The requested tenant workspace could not be verified.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Alert Banner / Security Notice */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5 shadow-xs flex gap-3.5 items-start">
        <ShieldAlert className="text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" size={18} />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-amber-900 dark:text-amber-400 uppercase tracking-wider leading-none">Security Audit Notice</h4>
          <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
            Support impersonation logs all actions to the system audit trail. Sessions represent access as the primary active tenant user. Use only for diagnosing client-reported configuration issues.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Live Session Control Panel */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Zap size={16} className="text-fin-orange" />
                Live Workspace Support Portal
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Launches the client CRM console in a secure support context. A persistent session banner will display at the top of the interface.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs font-semibold text-destructive">
                {errorMsg}
              </div>
            )}

            <div className="pt-2">
              <Button
                onClick={() => impersonateMutation.mutate()}
                disabled={impersonateMutation.isPending}
                className="w-full sm:w-auto px-6 py-5 rounded-lg bg-fin-orange hover:bg-fin-orange/90 text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 transition-all text-xs"
              >
                {impersonateMutation.isPending ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Generating access token...
                  </>
                ) : (
                  <>
                    <ExternalLink size={14} />
                    Launch Impersonation Session
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Database stats */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-1.5">
              <Server size={16} className="text-muted-foreground" />
              Workspace Metadata Context
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-muted-foreground block">Workspace Domain Name (Slug)</span>
                <p className="rounded bg-muted px-3 py-2 font-mono text-foreground font-semibold">{tenant.slug}</p>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-muted-foreground block">Vertical Classification</span>
                <p className="rounded bg-muted px-3 py-2 font-mono text-foreground capitalize font-semibold">{tenant.industry}</p>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-muted-foreground block">Operational Status</span>
                <p className="rounded bg-muted px-3 py-2 font-mono text-foreground font-semibold flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${tenant.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                  <span className="capitalize">{tenant.status}</span>
                </p>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-muted-foreground block">Provisioning Timestamp</span>
                <p className="rounded bg-muted px-3 py-2 font-mono text-foreground font-semibold">
                  {new Date(tenant.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Plugins & Stats Overview */}
        <div className="space-y-6">
          {/* Tenant Stats Card */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-2.5">
              <Activity size={14} className="text-muted-foreground" />
              Usage Summary
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg text-center space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Branches</span>
                <span className="text-lg font-bold text-foreground block">{tenant.branch_count}</span>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Users</span>
                <span className="text-lg font-bold text-foreground block">{tenant.user_count}</span>
              </div>
            </div>
          </div>

          {/* Plugin list */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-2.5">
              <Settings size={14} className="text-muted-foreground" />
              Active Plugins ({tenant.plugin_list.length})
            </h4>

            {tenant.plugin_list.length > 0 ? (
              <ul className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {tenant.plugin_list.map((plugin) => (
                  <li key={plugin} className="rounded bg-muted px-3 py-1.5 text-[11px] font-mono text-muted-foreground truncate">
                    {plugin}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No plugins installed.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
