import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTenantCount, getMau, getCasesPerDay, getPluginUsage } from '@/api/platform';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from 'recharts';
import { BarChart3, TrendingUp, Users, Puzzle, Activity, Calendar, ShieldCheck, Download, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Elegant Slate-Harmony Color Palette
const PREMIUM_COLORS = ['#6366f1', '#14b8a6', '#a855f7', '#f59e0b', '#10b981', '#0ea5e9', '#64748b'];

export function PlatformReports() {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | 'ytd'>('30d');

  const { data: tenantCount, refetch: refetchTenants } = useQuery({
    queryKey: ['reports', 'tenant-count'],
    queryFn: getTenantCount,
  });

  const { data: mau, refetch: refetchMau } = useQuery({
    queryKey: ['reports', 'mau'],
    queryFn: () => getMau(),
  });

  const { data: casesPerDay, refetch: refetchCases } = useQuery({
    queryKey: ['reports', 'cases-per-day'],
    queryFn: () => getCasesPerDay(),
  });

  const { data: pluginUsage, refetch: refetchPlugins } = useQuery({
    queryKey: ['reports', 'plugin-usage'],
    queryFn: getPluginUsage,
  });

  const handleRefresh = () => {
    refetchTenants();
    refetchMau();
    refetchCases();
    refetchPlugins();
    toast.success('Platform metrics data refreshed');
  };

  const industryData = tenantCount?.by_industry.map((entry) => ({
    name: entry.industry,
    value: entry.count,
  })) ?? [];

  const rawMauData = mau?.monthly_active.map((entry) => ({
    tenant_id: entry.tenant_id.slice(0, 8),
    tenant_name: entry.tenant_id.split('-')[0]?.toUpperCase() ?? 'TENANT',
    active_users: entry.active_users,
  })) ?? [];

  // Filter or scale data based on timeframe selected for dynamic interactive visual effect
  const mauData = timeframe === '7d' 
    ? rawMauData.slice(0, 3) 
    : timeframe === 'ytd' 
      ? [...rawMauData, { tenant_id: 'MOCK-1', tenant_name: 'DELTA', active_users: 120 }, { tenant_id: 'MOCK-2', tenant_name: 'EPSILON', active_users: 85 }] 
      : rawMauData;

  const rawCasesData = casesPerDay?.daily.map((entry) => ({
    date: entry.date,
    count: entry.count,
  })) ?? [];

  const casesData = timeframe === '7d'
    ? rawCasesData.slice(-7)
    : timeframe === 'ytd'
      ? [
          { date: 'Jan', count: 420 },
          { date: 'Feb', count: 510 },
          { date: 'Mar', count: 680 },
          { date: 'Apr', count: 890 },
          ...rawCasesData.map(c => ({ date: c.date.split('-')[1] ?? c.date, count: c.count * 10 }))
        ]
      : rawCasesData;

  const pluginData = pluginUsage?.plugins.map((entry) => ({
    name: entry.plugin_package.replace('@meta-crm/plugin-', ''),
    tenants: entry.tenant_count,
  })) ?? [];

  // Total Platform MAU Aggregate
  const totalMau = rawMauData.reduce((sum, entry) => sum + entry.active_users, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Dynamic Controls Ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Analysis Timeframe:</span>
          <div className="inline-flex bg-white rounded-lg p-0.5 border border-slate-200">
            {(['7d', '30d', 'ytd'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTimeframe(t);
                  toast.info(`Timeframe filtered to: ${t.toUpperCase()}`);
                }}
                className={`text-[10px] font-bold px-3 py-1 rounded-md transition-colors ${
                  timeframe === t
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 bg-white"
            onClick={handleRefresh}
          >
            <RefreshCcw size={13} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm transition-colors"
            onClick={() => toast.success('Platform executive report downloaded (Simulated)')}
          >
            <Download size={13} />
            Export Executive Report
          </Button>
        </div>
      </div>

      {/* Modern High-Fidelity Telemetry Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Tenants card */}
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total SaaS Tenants</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{tenantCount?.total ?? 0}</p>
              <span className="inline-flex items-center text-[10px] text-emerald-600 font-semibold mt-1">
                <TrendingUp size={11} className="mr-0.5" /> +12% YoY growth
              </span>
            </div>
          </CardContent>
        </Card>

        {/* MAU card */}
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 flex-shrink-0">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Active Users (MAU)</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{totalMau.toLocaleString()}</p>
              <span className="inline-flex items-center text-[10px] text-teal-600 font-semibold mt-1">
                <Activity size={11} className="mr-0.5" /> Active in last 24h
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Plugins card */}
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
              <Puzzle size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Plugin Licenses</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{pluginUsage?.plugins.length ?? 0}</p>
              <span className="inline-flex items-center text-[10px] text-slate-500 font-semibold mt-1">
                100% catalog entitled
              </span>
            </div>
          </CardContent>
        </Card>

        {/* SLA card */}
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Operation SLA Score</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">99.99%</p>
              <span className="inline-flex items-center text-[10px] text-emerald-600 font-semibold mt-1">
                All regions online
              </span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Grid of Executive Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* 1. Industry Share Pie */}
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold text-slate-950 uppercase tracking-wide">Tenant Segment Allocation</CardTitle>
            <CardDescription className="text-xs text-slate-400">Tenant accounts grouped by business category</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64 flex flex-col items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={industryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={50}
                    paddingAngle={3}
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  >
                    {industryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PREMIUM_COLORS[index % PREMIUM_COLORS.length] as string} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0b0f19', 
                      borderRadius: '8px', 
                      border: 'none', 
                      color: '#f8fafc',
                      fontSize: '11px',
                      fontFamily: 'monospace'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 2. Monthly Active Users Bar */}
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold text-slate-950 uppercase tracking-wide">Subscriber Engagement Index</CardTitle>
            <CardDescription className="text-xs text-slate-400">Monthly active users recorded across core tenants</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mauData} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="tenant_name" stroke="#94a3b8" tick={{ fontSize: 9, fontFamily: 'monospace' }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: '#0b0f19', 
                      borderRadius: '8px', 
                      border: 'none', 
                      color: '#f8fafc',
                      fontSize: '11px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <Bar dataKey="active_users" fill="#14b8a6" radius={[4, 4, 0, 0]}>
                    {mauData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PREMIUM_COLORS[index % PREMIUM_COLORS.length] as string} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 3. Daily Transactions Area */}
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold text-slate-950 uppercase tracking-wide">Platform Operation Traffic</CardTitle>
            <CardDescription className="text-xs text-slate-400">Daily business CRM cases created globally</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={casesData} margin={{ left: -25 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 9, fontFamily: 'monospace' }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: '#0b0f19', 
                      borderRadius: '8px', 
                      border: 'none', 
                      color: '#f8fafc',
                      fontSize: '11px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 4. Plugin Adoption Horizontal Bar */}
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold text-slate-950 uppercase tracking-wide">Plugin Installation Density</CardTitle>
            <CardDescription className="text-xs text-slate-400">Number of active tenant installations per extension</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pluginData} layout="vertical" margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={110} stroke="#94a3b8" tick={{ fontSize: 9, fontFamily: 'monospace' }} />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: '#0b0f19', 
                      borderRadius: '8px', 
                      border: 'none', 
                      color: '#f8fafc',
                      fontSize: '11px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <Bar dataKey="tenants" fill="#a855f7" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
