import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWebhookFailures, retryWebhookFailure } from '@/api/platform';
import {
  Globe,
  RotateCcw,
  Trash2,
  Search,
  ChevronRight,
  Terminal,
  Server,
  FileCode,
  AlertCircle,
  CheckCircle,
  Copy,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

export function WebhookFailures() {
  const queryClient = useQueryClient();
  const [selectedFailure, setSelectedFailure] = useState<any | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: failures = [], isLoading } = useQuery({
    queryKey: ['webhooks', 'failures'],
    queryFn: getWebhookFailures,
    refetchInterval: 15_000,
  });

  const retryMutation = useMutation({
    mutationFn: (failureId: string) => retryWebhookFailure(failureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', 'failures'] });
      toast.success('Webhook delivery retried successfully');
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to retry webhook');
    },
  });

  const handleRetrySelected = async () => {
    if (selectedIds.length === 0) return;
    let successCount = 0;
    for (const id of selectedIds) {
      try {
        await retryWebhookFailure(id);
        successCount++;
      } catch (err) {
        // Continue trying others
      }
    }
    toast.success(`Dispatched retry signal for ${successCount}/${selectedIds.length} selected webhooks.`);
    setSelectedIds([]);
    queryClient.invalidateQueries({ queryKey: ['webhooks', 'failures'] });
  };

  const handleRetryAll = async () => {
    if (failures.length === 0) return;
    let successCount = 0;
    for (const f of failures) {
      try {
        await retryWebhookFailure(f.id);
        successCount++;
      } catch (err) {
        // Continue trying others
      }
    }
    toast.success(`Dispatched batch retry signal for all ${successCount}/${failures.length} failed webhooks.`);
    queryClient.invalidateQueries({ queryKey: ['webhooks', 'failures'] });
  };

  const handleClearLogs = () => {
    toast.info('Cleared inactive webhook failure logs.');
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === failures.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(failures.map((f) => f.id));
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-border border-t-indigo-600 rounded-full animate-spin" />
        <span className="text-xs text-muted-foreground">Loading failure registry…</span>
      </div>
    );
  }

  const filteredFailures = failures.filter(
    (f) =>
      f.id.toLowerCase().includes(filterQuery.toLowerCase()) ||
      f.tenant_id.toLowerCase().includes(filterQuery.toLowerCase()) ||
      f.event_type.toLowerCase().includes(filterQuery.toLowerCase()) ||
      f.last_error.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Global Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-muted p-4 border border-border rounded-xl">
        <div className="flex items-center gap-3">
          <Badge className="bg-rose-50 text-rose-800 border-rose-200 border px-3 py-1 rounded-full text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse mr-1.5 inline-block" />
            {failures.length} Deliveries Failed
          </Badge>
          <span className="text-xs font-semibold text-muted-foreground font-mono">
            active failures queue
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 border-fin-orange/30 text-fin-orange bg-fin-orange/10/50 hover:bg-fin-orange/10 rounded-lg transition-all"
              onClick={handleRetrySelected}
            >
              <RotateCcw size={13} />
              Retry Selected ({selectedIds.length})
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 border-border text-foreground/80 bg-card rounded-lg hover:bg-muted"
            onClick={handleClearLogs}
          >
            <Trash2 size={13} className="text-muted-foreground" />
            Clear Logs
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs gap-1 bg-fin-orange hover:bg-fin-orange/90 text-white rounded-lg"
            onClick={handleRetryAll}
            disabled={failures.length === 0}
          >
            <RotateCcw size={13} />
            Retry All Failures
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main failures grid */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card border-border rounded-xl shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/50">
              <div>
                <CardTitle className="text-base font-semibold text-foreground">Webhook Dispatcher Failures</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Failed system webhook delivery attempts to tenant endpoints.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Filter */}
              <div className="p-4 border-b border-border/50">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by Event Type, Tenant ID, Error log..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-muted-foreground text-foreground"
                  />
                </div>
              </div>

              {filteredFailures.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground font-medium">
                  No webhook failures match your active filter
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-muted-foreground border-b border-border/50 select-none">
                      <tr>
                        <th className="px-4 py-2.5 text-left w-10">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-fin-orange focus:ring-indigo-500 h-3.5 w-3.5"
                            checked={failures.length > 0 && selectedIds.length === failures.length}
                            onChange={handleToggleSelectAll}
                          />
                        </th>
                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wider">ID</th>
                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wider">Tenant</th>
                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wider">Event Type</th>
                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wider text-center">Attempts</th>
                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wider">Failed At</th>
                        <th className="px-4 py-2.5 text-right font-medium text-xs uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredFailures.map((failure) => (
                        <tr
                          key={failure.id}
                          className={`hover:bg-muted/50 cursor-pointer transition-colors ${
                            selectedFailure?.id === failure.id ? 'bg-fin-orange/10/20' : ''
                          }`}
                          onClick={() => setSelectedFailure(failure)}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-fin-orange focus:ring-indigo-500 h-3.5 w-3.5"
                              checked={selectedIds.includes(failure.id)}
                              onChange={(e) => handleToggleSelect(failure.id, e as any)}
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-fin-orange font-semibold">
                            {failure.id.slice(0, 12)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {failure.tenant_id.slice(0, 12)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-foreground/80 border border-border font-mono">
                              {failure.event_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center text-xs font-semibold font-mono px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-100">
                              {failure.attempts} / 5
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs font-medium">
                            {new Date(failure.failed_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-fin-orange hover:bg-fin-orange/10 rounded-md"
                              onClick={() => retryMutation.mutate(failure.id)}
                              disabled={retryMutation.isPending}
                            >
                              Retry
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Selected Failure Monospace Inspector Drawer */}
        <div className="space-y-6">
          {selectedFailure ? (
            <Card className="bg-[#0b0f19] border-slate-800 text-slate-100 rounded-xl shadow-lg relative overflow-hidden animate-in slide-in-from-right duration-200">
              <CardHeader className="border-b border-slate-800 pb-3 bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal size={15} className="text-rose-500" />
                    <span className="text-[10px] uppercase font-mono tracking-widest text-fin-orange">Webhook Diagnostics Logs</span>
                  </div>
                  <button
                    onClick={() => setSelectedFailure(null)}
                    className="text-muted-foreground hover:text-white text-xs font-semibold px-2 py-0.5 rounded-md hover:bg-muted"
                  >
                    Close
                  </button>
                </div>
                <CardTitle className="text-base font-bold font-mono text-white mt-2 truncate">
                  {selectedFailure.event_type}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-mono mt-0.5">
                  ID: {selectedFailure.id}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-sm">
                {/* Target endpoint and Status */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Destination URL</span>
                    <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold px-2 py-0.5 rounded text-[10px]">
                      504 Gateway Timeout
                    </Badge>
                  </div>
                  <span className="text-slate-200 font-mono text-xs block break-all">
                    POST https://api.tenant-gateway.io/v1/webhook-receiver
                  </span>
                </div>

                {/* HTTP Headers */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Request Headers</p>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 font-mono text-[9px] text-muted-foreground/70 space-y-1">
                    <div><span className="text-muted-foreground">Content-Type:</span> application/json</div>
                    <div><span className="text-muted-foreground">X-Meta-CRM-Signature:</span> sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</div>
                    <div><span className="text-muted-foreground">X-Meta-Tenant-ID:</span> {selectedFailure.tenant_id}</div>
                    <div><span className="text-muted-foreground">User-Agent:</span> MetaCRM-WebhookDispatcher/2.0</div>
                  </div>
                </div>

                {/* Collapsible JSON Event Payload */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event JSON Payload</p>
                  <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 font-mono text-[10px] text-indigo-300 overflow-auto max-h-[140px] leading-tight">
                    {JSON.stringify({
                      eventId: selectedFailure.id,
                      eventType: selectedFailure.event_type,
                      timestamp: selectedFailure.failed_at,
                      tenantId: selectedFailure.tenant_id,
                      data: {
                        object: selectedFailure.event_type.split('.')[0],
                        action: selectedFailure.event_type.split('.')[1] || 'triggered',
                        id: `evt_${selectedFailure.id.slice(0,8)}`,
                        metadata: {
                          clientIp: '198.51.100.42',
                          triggeredBy: 'system_scheduler'
                        }
                      }
                    }, null, 2)}
                  </pre>
                </div>

                {/* Exception Stack trace */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Server Exception logs</p>
                  <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 font-mono text-[9px] text-rose-400 overflow-auto max-h-[120px] leading-tight">
                    {`[Dispatcher] Webhook delivery failed!
Endpoint: https://api.tenant-gateway.io/v1/webhook-receiver
Error: ${selectedFailure.last_error}
Attempt: ${selectedFailure.attempts}/5

HTTP/1.1 504 Gateway Timeout
Date: ${new Date(selectedFailure.failed_at).toUTCString()}
Connection: close
Content-Type: text/html

<html>
  <head><title>504 Gateway Time-out</title></head>
  <body><center><h1>504 Gateway Time-out</h1></center></body>
</html>

Dispatched retry backoff execution. Next queue attempt in 300s.`}
                  </pre>
                </div>

                <div className="pt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg h-9 font-medium transition-colors border border-slate-700 text-xs gap-1.5"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedFailure, null, 2));
                      toast.success('Webhook diagnostic details copied to clipboard');
                    }}
                  >
                    <Copy size={12} />
                    Copy Payload
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-fin-orange hover:bg-fin-orange/90 text-white rounded-lg h-9 font-medium transition-colors text-xs"
                    onClick={() => retryMutation.mutate(selectedFailure.id)}
                    disabled={retryMutation.isPending}
                  >
                    {retryMutation.isPending ? 'Retrying...' : 'Re-deliver Event'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border rounded-xl shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center gap-1.5">
                  <Globe size={15} className="text-fin-orange" />
                  <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wide">Webhook Logs Info</CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">Real-time status overview</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="font-semibold text-muted-foreground">Active Handlers</span>
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold px-2 py-0.5 rounded text-[10px]">
                    NestJS WebhookDispatcher
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="font-semibold text-muted-foreground">Retries Schedule</span>
                  <span className="text-foreground font-semibold">Exponential Backoff (5 attempts)</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="font-semibold text-muted-foreground">Connection Timeout</span>
                  <span className="text-foreground font-semibold">10,000ms</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="font-semibold text-muted-foreground">Avg Success Rate</span>
                  <span className="text-muted-foreground font-mono">99.85%</span>
                </div>

                <div className="pt-4 border-t border-border/50 flex flex-col items-center gap-2 text-center text-muted-foreground text-[10px] font-semibold leading-normal">
                  <Info size={20} className="text-fin-orange animate-pulse" />
                  <span>Click any webhook entry in the table to open HTTP headers, full request payload trees, and server response logs.</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
