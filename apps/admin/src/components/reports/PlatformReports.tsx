import { useQuery } from '@tanstack/react-query';
import { getTenantCount, getMau, getCasesPerDay, getPluginUsage } from '@/api/platform';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export function PlatformReports() {
  const { data: tenantCount } = useQuery({
    queryKey: ['reports', 'tenant-count'],
    queryFn: getTenantCount,
  });

  const { data: mau } = useQuery({
    queryKey: ['reports', 'mau'],
    queryFn: () => getMau(),
  });

  const { data: casesPerDay } = useQuery({
    queryKey: ['reports', 'cases-per-day'],
    queryFn: () => getCasesPerDay(),
  });

  const { data: pluginUsage } = useQuery({
    queryKey: ['reports', 'plugin-usage'],
    queryFn: getPluginUsage,
  });

  const industryData = tenantCount?.by_industry.map((entry) => ({
    name: entry.industry,
    value: entry.count,
  })) ?? [];

  const mauData = mau?.monthly_active.map((entry) => ({
    tenant_id: entry.tenant_id.slice(0, 8),
    active_users: entry.active_users,
  })) ?? [];

  const casesData = casesPerDay?.daily.map((entry) => ({
    date: entry.date,
    count: entry.count,
  })) ?? [];

  const pluginData = pluginUsage?.plugins.map((entry) => ({
    name: entry.plugin_package,
    tenants: entry.tenant_count,
  })) ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-4 text-lg font-semibold">Tenant Count by Industry</h3>
          <div className="mb-3 text-3xl font-bold">{tenantCount?.total ?? 0}</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={industryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {industryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length] as string} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-4 text-lg font-semibold">Monthly Active Users by Tenant</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mauData}>
                <XAxis dataKey="tenant_id" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="active_users" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-4 text-lg font-semibold">Cases Per Day</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={casesData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-4 text-lg font-semibold">Plugin Usage</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pluginData} layout="vertical">
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="tenants" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
