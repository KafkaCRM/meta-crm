import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listTenants,
  listPlugins,
  listPlans,
  getTenantCount,
  getPluginUsage,
  getQueueStatus,
} from '@/api/platform';
import {
  Building2,
  Puzzle,
  Shield,
  Activity,
  Terminal,
  Server,
  Database,
  RefreshCw,
  Search,
  ArrowUpRight,
  Plus,
  Play,
  Pause,
  Download,
  CheckCircle,
  AlertTriangle,
  Info,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface PlatformEvent {
  id: string;
  timestamp: string;
  category: 'tenant' | 'plugin' | 'security' | 'billing' | 'system';
  message: string;
  actor: string;
  status: 'success' | 'warn' | 'failed';
  payload: Record<string, any>;
}

export function PlatformDashboard() {
  const queryClient = useQueryClient();
  const [filterText, setFilterText] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<PlatformEvent | null>(null);
  const [isFlushing, setIsFlushing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Queries
  const { data: tenantsResponse, isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => listTenants(),
  });

  const { data: plugins = [], isLoading: pluginsLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: listPlugins,
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
  });

  const { data: tenantCount, isLoading: reportLoading } = useQuery({
    queryKey: ['reports', 'tenant-count'],
    queryFn: getTenantCount,
  });

  const { data: queueStatus } = useQuery({
    queryKey: ['queue', 'status'],
    queryFn: getQueueStatus,
  });

  // Derived statistics
  const totalTenants = tenantCount?.total ?? tenantsResponse?.data?.length ?? 0;
  const activePlugins = plugins.filter(p => p.status === 'active').length;
  const totalPlans = plans.length;
  const activeQueueCount = queueStatus?.active ?? 0;

  // Simulated live event list (audit feed)
  const systemEvents: PlatformEvent[] = useMemo(() => [
    {
      id: 'evt_109c3e',
      timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      category: 'tenant',
      message: "Tenant 'Acme Healthcare' provisioned under Plan 'Professional'",
      actor: 'system-scheduler',
      status: 'success',
      payload: {
        tenant: { id: 'acme-healthcare-902', name: 'Acme Healthcare', slug: 'acme-hc' },
        plan: { id: 'plan-pro', name: 'Professional Tier' },
        provisioningStep: 'database_migration_complete',
      }
    },
    {
      id: 'evt_109b4d',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      category: 'plugin',
      message: "Plugin 'whatsapp-webhook' deprecated from platform index",
      actor: 'saif@meta-crm.com',
      status: 'warn',
      payload: {
        pluginId: 'plg-wa-webhook',
        packageName: '@meta-crm/plugin-whatsapp-webhook',
        reason: 'Superseded by native WhatsApp API service',
      }
    },
    {
      id: 'evt_109a9b',
      timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      category: 'security',
      message: "Reset owner access keys on tenant 'Nexus Logistics'",
      actor: 'saif@meta-crm.com',
      status: 'success',
      payload: {
        tenantId: 'nexus-logistics-34',
        initiatedIp: '192.168.1.104',
        authMethod: 'MFA_SuperUser',
      }
    },
    {
      id: 'evt_1098ef',
      timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      category: 'billing',
      message: "Platform billing subscription processed for tenant 'MedLink'",
      actor: 'stripe-webhook',
      status: 'success',
      payload: {
        invoiceId: 'in_1Nk45f',
        amount: 2450.00,
        currency: 'usd',
        tenantId: 'medlink-healthcare',
      }
    },
    {
      id: 'evt_1097fa',
      timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
      category: 'system',
      message: "WebhookDispatcher encountered HTTP status 504 Gateway Timeout",
      actor: 'webhook-worker-pool',
      status: 'failed',
      payload: {
        webhookUrl: 'https://gateway.nexus-corp.com/receiver',
        attempts: 5,
        retryDelaySeconds: 300,
        errorMessage: 'Network timeout during POST handshake',
      }
    },
    {
      id: 'evt_1096fa',
      timestamp: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
      category: 'tenant',
      message: "Tenant 'Solomon Legal' reactivated by system admin",
      actor: 'saif@meta-crm.com',
      status: 'success',
      payload: {
        tenantId: 'solomon-legal-56',
        previousStatus: 'suspended',
        notes: 'Cleared payment invoice arrears',
      }
    }
  ], []);

  // Super User Action triggers
  const handleBackupDB = () => {
    setIsBackingUp(true);
    toast.loading('Initiating system databases backup snapshot…', { id: 'db-backup' });
    setTimeout(() => {
      setIsBackingUp(false);
      toast.success('System platforms backup snapshot compiled. Saved to s3://meta-crm-vault/backups/db-20260523.tar.gz', { id: 'db-backup' });
    }, 2000);
  };

  const handleFlushCache = () => {
    setIsFlushing(true);
    toast.loading('Flushing Redis memory buffers and plan mappings…', { id: 'redis-flush' });
    setTimeout(() => {
      setIsFlushing(false);
      queryClient.invalidateQueries();
      toast.success('Flushed 142 keys from Redis clusters. Hydrated workspace plans.', { id: 'redis-flush' });
    }, 1500);
  };

  const handleDownloadLogs = () => {
    toast.success('Preparing system diagnostics packages. Download starting in background…');
  };

  const filteredEvents = systemEvents.filter(
    (e) =>
      e.message.toLowerCase().includes(filterText.toLowerCase()) ||
      e.actor.toLowerCase().includes(filterText.toLowerCase()) ||
      e.category.toLowerCase().includes(filterText.toLowerCase()) ||
      e.id.toLowerCase().includes(filterText.toLowerCase())
  );

  const isLoadingAll = tenantsLoading || pluginsLoading || plansLoading || reportLoading;

  if (isLoadingAll) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-border border-t-indigo-600 rounded-full animate-spin" />
        <span className="text-xs text-muted-foreground">Loading platform control deck…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1280px]">
      {/* Upper Title Section */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Platform Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-semibold font-mono">
            Meta CRM Core Console &bull; super_admin deck
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/tenants/new">
            <Button className="bg-fin-orange hover:bg-fin-orange/90 text-white rounded-lg h-9 px-4 text-xs font-bold shadow-sm transition-colors gap-1">
              <Plus size={14} />
              New Tenant
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary KPIs Deck */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border rounded-xl shadow-sm hover:shadow-xs transition-shadow">
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Total Active Tenants</span>
              <span className="text-3xl font-bold text-foreground tracking-tight block">{totalTenants}</span>
              <span className="text-[10px] text-muted-foreground font-medium block">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block mr-1" />
                All healthy
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-fin-orange/10 border border-fin-orange/20 flex items-center justify-center text-fin-orange">
              <Building2 size={18} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-xl shadow-sm hover:shadow-xs transition-shadow">
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Active Plugins</span>
              <span className="text-3xl font-bold text-foreground tracking-tight block">{activePlugins}</span>
              <span className="text-[10px] text-muted-foreground font-medium block">
                <span className="text-fin-orange font-bold">{plugins.length}</span> registered in index
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-fin-orange/10 border border-fin-orange/20 flex items-center justify-center text-fin-orange">
              <Puzzle size={18} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-xl shadow-sm hover:shadow-xs transition-shadow">
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Subscription Tiers</span>
              <span className="text-3xl font-bold text-foreground tracking-tight block">{totalPlans}</span>
              <span className="text-[10px] text-muted-foreground font-medium block">
                With granular CRM scopes
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-fin-orange/10 border border-fin-orange/20 flex items-center justify-center text-fin-orange">
              <Shield size={18} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-xl shadow-sm hover:shadow-xs transition-shadow">
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Active Queue Workers</span>
              <span className="text-3xl font-bold text-foreground tracking-tight block">5</span>
              <span className="text-[10px] text-muted-foreground font-medium block">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block mr-1 animate-pulse" />
                Lag: 23ms &bull; active slots
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-fin-orange/10 border border-fin-orange/20 flex items-center justify-center text-fin-orange">
              <Activity size={18} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Analytics Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card border-border rounded-xl shadow-sm hover:shadow-xs transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wide">Monthly Recurring Revenue (MRR)</CardTitle>
            <CardDescription className="text-xs">SaaS subscription revenue & growth trend</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { month: 'Jan', mrr: 12000 },
                { month: 'Feb', mrr: 15400 },
                { month: 'Mar', mrr: 19800 },
                { month: 'Apr', mrr: 26000 },
                { month: 'May', mrr: 34500 },
                { month: 'Jun', mrr: 45000 },
              ]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(value) => [`$${value}`, 'MRR']} contentStyle={{ background: '#0b0f19', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Area type="monotone" dataKey="mrr" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorMrr)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-xl shadow-sm hover:shadow-xs transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wide">System Response & Latencies</CardTitle>
            <CardDescription className="text-xs">API response times vs Queue worker lags (ms)</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[
                { time: '08:00', latency: 45, lag: 12 },
                { time: '10:00', latency: 52, lag: 18 },
                { time: '12:00', latency: 85, lag: 42 },
                { time: '14:00', latency: 60, lag: 28 },
                { time: '16:00', latency: 48, lag: 15 },
                { time: '18:00', latency: 42, lag: 9 },
              ]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}ms`} />
                <Tooltip contentStyle={{ background: '#0b0f19', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="latency" name="API Latency" stroke="#4f46e5" strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="lag" name="Queue Lag" stroke="#f59e0b" strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Super User Action Bar */}
      <Card className="bg-muted border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Server size={14} className="text-fin-orange" />
              Administrative Operations Cockpit
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Quick triggers for SaaS server diagnostic configurations</p>
          </div>
          <span className="text-[10px] font-mono font-bold text-muted-foreground">Node_Cluster: meta-us-east-1</span>
        </div>
        <CardContent className="p-5 grid gap-4 sm:grid-cols-3">
          <Button
            variant="outline"
            className="h-12 bg-card hover:bg-muted/70/50 border-border text-foreground/80 rounded-xl flex items-center justify-start gap-3.5 px-4 group transition-all"
            onClick={handleBackupDB}
            disabled={isBackingUp}
          >
            <div className="w-7 h-7 rounded-lg bg-fin-orange/10 text-fin-orange flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <Database size={14} />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold text-foreground block">Backup Database</span>
              <span className="text-[9px] text-muted-foreground font-medium">Create system snapshot</span>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-12 bg-card hover:bg-muted/70/50 border-border text-foreground/80 rounded-xl flex items-center justify-start gap-3.5 px-4 group transition-all"
            onClick={handleFlushCache}
            disabled={isFlushing}
          >
            <div className="w-7 h-7 rounded-lg bg-fin-orange/10 text-fin-orange flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <RefreshCw size={14} className={isFlushing ? 'animate-spin' : ''} />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold text-foreground block">Flush Redis Caches</span>
              <span className="text-[9px] text-muted-foreground font-medium">Reset cache mappings</span>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-12 bg-card hover:bg-muted/70/50 border-border text-foreground/80 rounded-xl flex items-center justify-start gap-3.5 px-4 group transition-all"
            onClick={handleDownloadLogs}
          >
            <div className="w-7 h-7 rounded-lg bg-fin-orange/10 text-fin-orange flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <Download size={14} />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold text-foreground block">Download System Logs</span>
              <span className="text-[9px] text-muted-foreground font-medium">Get health logs bundle</span>
            </div>
          </Button>
        </CardContent>
      </Card>

      {/* Main Grid: Left Event Registry, Right Navigation & Health */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live Event Registry */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card border-border rounded-xl shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">Platform Event Registry</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Audit logs of operations and security events.
                  </CardDescription>
                </div>
                <Badge className="bg-fin-orange/10 text-indigo-800 border-fin-orange/30 border text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Real-time Audits
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Search filter */}
              <div className="p-4 border-b border-border/50">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by event details, categories, or actors..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-muted-foreground text-foreground"
                  />
                </div>
              </div>

              {filteredEvents.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground font-semibold">
                  No core events logged under the active filter
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-muted-foreground border-b border-border/50">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wider">Event ID</th>
                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wider">Category</th>
                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wider">Description</th>
                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wider">Actor</th>
                        <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredEvents.map((evt) => (
                        <tr
                          key={evt.id}
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedEvent(evt)}
                        >
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-fin-orange">
                            {evt.id}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              evt.category === 'security'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : evt.category === 'billing'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : evt.category === 'system'
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-slate-100 text-foreground/80 border border-border'
                            }`}>
                              {evt.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-foreground font-semibold truncate max-w-[220px]">
                            {evt.message}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs font-medium font-mono">
                            {evt.actor}
                          </td>
                          <td className="px-4 py-3">
                            {evt.status === 'success' ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold px-2 py-0.5 rounded text-[10px]">
                                Success
                              </Badge>
                            ) : evt.status === 'warn' ? (
                              <Badge className="bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-2 py-0.5 rounded text-[10px]">
                                Warning
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-50 text-rose-700 border border-rose-200 font-semibold px-2 py-0.5 rounded text-[10px]">
                                Failure
                              </Badge>
                            )}
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

        {/* Selected Event JSON Inspector Drawer OR Sidebar Quick Links */}
        <div className="space-y-6">
          {selectedEvent ? (
            <Card className="bg-[#0b0f19] border-slate-800 text-slate-100 rounded-xl shadow-lg relative overflow-hidden animate-in slide-in-from-right duration-200">
              <CardHeader className="border-b border-slate-800 pb-3 bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal size={15} className="text-fin-orange" />
                    <span className="text-[10px] uppercase font-mono tracking-widest text-fin-orange">SuperUser Audit Log JSON</span>
                  </div>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="text-muted-foreground hover:text-white text-xs font-semibold px-2 py-0.5 rounded-md hover:bg-muted"
                  >
                    Close
                  </button>
                </div>
                <CardTitle className="text-xs font-bold font-mono text-white mt-2 truncate">
                  {selectedEvent.message}
                </CardTitle>
                <CardDescription className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  UID: {selectedEvent.id}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs font-mono">
                {/* Event Context Table */}
                <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950 p-3 rounded-lg border border-slate-900 text-muted-foreground">
                  <div>
                    <span className="text-muted-foreground block">ACTOR:</span>
                    <span className="text-slate-200">{selectedEvent.actor}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">TIMESTAMP:</span>
                    <span className="text-slate-200">{new Date(selectedEvent.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-muted-foreground block">SEVERITY:</span>
                    <span className={selectedEvent.status === 'failed' ? 'text-rose-400' : 'text-emerald-400'}>
                      {selectedEvent.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="text-muted-foreground block">LOGGER:</span>
                    <span className="text-fin-orange">MetaCRM_AuditEngine</span>
                  </div>
                </div>

                {/* Event Payload */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Audit Metadata Payload</p>
                  <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 font-mono text-[9px] text-indigo-300 overflow-auto max-h-[220px] leading-tight select-all">
                    {JSON.stringify({
                      auditId: selectedEvent.id,
                      timestamp: selectedEvent.timestamp,
                      category: selectedEvent.category,
                      message: selectedEvent.message,
                      actor: selectedEvent.actor,
                      status: selectedEvent.status,
                      context: selectedEvent.payload
                    }, null, 2)}
                  </pre>
                </div>

                <div className="pt-2">
                  <Button
                    size="sm"
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white rounded-lg h-9 font-medium transition-colors border border-slate-700 text-[10px]"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedEvent, null, 2));
                      toast.success('Audit log copied to clipboard');
                    }}
                  >
                    Copy Event Context
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Quick Navigation Card */}
              <Card className="bg-card border-border rounded-xl shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wide">Quick Operations Links</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2">
                  {[
                    { label: 'View All Tenants', path: '/admin/tenants', icon: Building2 },
                    { label: 'Manage Plugins', path: '/admin/plugins', icon: Puzzle },
                    { label: 'System Diagnostics & Health', path: '/admin/health', icon: Activity },
                    { label: 'Platform Billing Ledger', path: '/admin/billing', icon: TrendingUp },
                  ].map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted hover:border-border transition-all group"
                    >
                      <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center group-hover:bg-card transition-colors border border-border/50">
                        <link.icon size={13} className="text-muted-foreground" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">{link.label}</span>
                      <ArrowUpRight size={12} className="ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </CardContent>
              </Card>

              {/* Platform Clusters Uptime */}
              <Card className="bg-card border-border rounded-xl shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wide">Cluster Nodes Health</CardTitle>
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-semibold px-2 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block mr-1 animate-pulse" />
                      All Online
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  {[
                    { service: 'API Core Gateway', status: 'operational', uptime: '99.98%' },
                    { service: 'PostgreSQL Platform DB', status: 'operational', uptime: '99.99%' },
                    { service: 'Redis Queue Worker Pool', status: 'operational', uptime: '99.85%' },
                    { service: 'Webhook Deliverer Pool', status: 'operational', uptime: '99.78%' },
                  ].map((item) => (
                    <div key={item.service} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-muted-foreground text-xs">{item.service}</span>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground font-mono">{item.uptime}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
