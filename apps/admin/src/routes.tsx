import { createRouter, createRoute, createRootRoute, Outlet } from '@tanstack/react-router';
import { AuthProvider, useAuth } from '@/contexts/auth.context';
import { LoginPage } from '@/components/LoginPage';
import { UnauthorizedPage } from '@/components/UnauthorizedPage';
import { AdminLayout } from '@/components/AdminLayout';
import { TenantList, TenantDetail, CreateTenantForm, ImpersonateView } from '@/components/tenants';
import { PluginRegistry, PublishPlugin, PluginDetail } from '@/components/plugins';
import { PlatformUserList, InvitePlatformUser, PlatformRoleMatrix } from '@/components/team';
import { PlatformReports } from '@/components/reports';
import { QueueMonitor, WebhookFailures, PlanList, PlanForm } from '@/components/system';
import { queryClient } from '@/lib/query-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  CreditCard,
  Puzzle,
  BarChart3,
  Users,
  Activity,
  TrendingUp,
  ArrowUpRight,
  Plus,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isUnauthorized } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f1ec]">
        <div className="flex items-center gap-2 text-sm text-[#9c9fa5]">
          <div className="w-4 h-4 border-2 border-[#d3cec6] border-t-[#111111] rounded-full animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  if (isUnauthorized) {
    return <UnauthorizedPage />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

/* ------------------------------------------------------------------ */
/*  Root route                                                         */
/* ------------------------------------------------------------------ */

const rootRoute = createRootRoute({
  component: () => (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  ),
});

/* ------------------------------------------------------------------ */
/*  Login & unauthorized                                               */
/* ------------------------------------------------------------------ */

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const unauthorizedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/unauthorized',
  component: UnauthorizedPage,
});

/* ------------------------------------------------------------------ */
/*  Platform Dashboard                                                 */
/* ------------------------------------------------------------------ */

function PlatformDashboard() {
  const quickStats = [
    { label: 'Total Tenants', value: '—', icon: Building2, color: '#65b5ff' },
    { label: 'Active Plans', value: '—', icon: CreditCard, color: '#0bdf50' },
    { label: 'Installed Plugins', value: '—', icon: Puzzle, color: '#b3e01c' },
    { label: 'Platform Users', value: '—', icon: Users, color: '#ff5600' },
  ];

  const quickLinks = [
    { label: 'View All Tenants', path: '/admin/tenants', icon: Building2 },
    { label: 'Manage Plugins', path: '/admin/plugins', icon: Puzzle },
    { label: 'Platform Reports', path: '/admin/reports', icon: BarChart3 },
    { label: 'System Health', path: '/admin/health', icon: Activity },
  ];

  return (
    <div className="space-y-6 max-w-[1280px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight">Platform Dashboard</h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">Meta CRM Admin Console</p>
        </div>
        <Link to="/admin/tenants/new">
          <Button className="bg-[#111111] hover:bg-black text-white rounded-lg h-9 px-4 text-sm font-medium">
            <Plus size={15} className="mr-1.5" />
            New Tenant
          </Button>
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickStats.map((stat) => (
          <Card key={stat.label} className="bg-white border-[#d3cec6] rounded-xl shadow-none">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-medium text-[#9c9fa5] uppercase tracking-wider">{stat.label}</p>
                <stat.icon size={14} style={{ color: stat.color }} />
              </div>
              <p className="text-3xl font-medium text-[#111111] tracking-tight">{stat.value}</p>
              <div className="mt-2 w-full h-0.5 rounded-full" style={{ backgroundColor: stat.color + '40' }}>
                <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: stat.color }} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick links + recent */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Quick navigation */}
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-[#111111]">Quick Navigation</CardTitle>
          </CardHeader>
          <Separator className="bg-[#ebe7e1]" />
          <CardContent className="pt-4 space-y-2">
            {quickLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="flex items-center gap-3 p-3 rounded-lg border border-[#ebe7e1] hover:bg-[#f5f1ec] hover:border-[#d3cec6] transition-all group"
              >
                <div className="w-8 h-8 rounded-md bg-[#f5f1ec] flex items-center justify-center group-hover:bg-white transition-colors">
                  <link.icon size={15} className="text-[#626260]" />
                </div>
                <span className="text-sm font-medium text-[#111111]">{link.label}</span>
                <ArrowUpRight size={13} className="ml-auto text-[#9c9fa5] opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Platform health overview */}
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-[#111111]">Platform Health</CardTitle>
              <Badge className="bg-[#0bdf50]/10 text-[#0a7f2e] border border-[#0bdf50]/20 rounded-md text-xs">
                <Activity size={11} className="mr-1" />
                Operational
              </Badge>
            </div>
          </CardHeader>
          <Separator className="bg-[#ebe7e1]" />
          <CardContent className="pt-4 space-y-3">
            {[
              { service: 'API Gateway', status: 'operational', uptime: '99.9%' },
              { service: 'Database', status: 'operational', uptime: '99.99%' },
              { service: 'Queue Workers', status: 'operational', uptime: '99.7%' },
              { service: 'Webhooks', status: 'operational', uptime: '99.5%' },
            ].map((item) => (
              <div key={item.service} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0bdf50]" />
                  <span className="text-sm text-[#111111]">{item.service}</span>
                </div>
                <span className="text-xs text-[#9c9fa5]">{item.uptime}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <AuthGuard>
      <PlatformDashboard />
    </AuthGuard>
  ),
});

/* ------------------------------------------------------------------ */
/*  Tenant routes                                                      */
/* ------------------------------------------------------------------ */

const tenantsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/tenants',
  component: () => (
    <AuthGuard>
      <div className="space-y-5 max-w-[1280px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium text-[#111111] tracking-tight">Tenants</h1>
            <p className="text-sm text-[#9c9fa5] mt-0.5">Manage all workspace tenants</p>
          </div>
          <Link to="/admin/tenants/new">
            <Button className="bg-[#111111] hover:bg-black text-white rounded-lg h-9 px-4 text-sm font-medium">
              <Plus size={15} className="mr-1.5" />
              Create Tenant
            </Button>
          </Link>
        </div>
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
          <CardContent className="p-0 overflow-hidden">
            <TenantList />
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  ),
});

const createTenantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/tenants/new',
  component: () => (
    <AuthGuard>
      <div className="space-y-5 max-w-2xl">
        <div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight">Create Tenant</h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">Provision a new workspace tenant</p>
        </div>
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
          <CardContent className="pt-6">
            <CreateTenantForm />
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  ),
});

const tenantDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/tenants/$id',
  component: () => (
    <AuthGuard>
      <TenantDetailRouteContent />
    </AuthGuard>
  ),
});

function TenantDetailRouteContent() {
  const { ability } = useAuth();
  const { id } = tenantDetailRoute.useParams();
  const isSupport = ability?.cannot('update', 'PlatformTenant') ?? false;

  if (isSupport) {
    return (
      <div className="space-y-5 max-w-[1280px]">
        <div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight">Tenant View</h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">Read-only access</p>
        </div>
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
          <CardContent className="pt-6">
            <ImpersonateView tenantId={id} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1280px]">
      <div>
        <h1 className="text-2xl font-medium text-[#111111] tracking-tight">Tenant Details</h1>
        <p className="text-sm text-[#9c9fa5] mt-0.5">Configuration and settings for this tenant</p>
      </div>
      <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
        <CardContent className="pt-6">
          <TenantDetail tenantId={id} />
        </CardContent>
      </Card>
    </div>
  );
}

const tenantImpersonateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/tenants/$id/impersonate',
  component: () => (
    <AuthGuard>
      <div className="space-y-5 max-w-[1280px]">
        <div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight">Impersonate Tenant</h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">Viewing tenant workspace in read-only mode</p>
        </div>
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
          <CardContent className="pt-6">
            <ImpersonateView tenantId={tenantImpersonateRoute.useParams().id} />
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  ),
});

/* ------------------------------------------------------------------ */
/*  Plans                                                              */
/* ------------------------------------------------------------------ */

const plansRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/plans',
  component: () => {
    const { ability } = useAuth();
    const canCreate = ability?.can('create', 'PlatformPlan') ?? false;

    return (
      <AuthGuard>
        <div className="space-y-5 max-w-[1280px]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-medium text-[#111111] tracking-tight">Plans</h1>
              <p className="text-sm text-[#9c9fa5] mt-0.5">Manage subscription plans and pricing</p>
            </div>
            {canCreate && (
              <Link to="/admin/plans/new">
                <Button className="bg-[#111111] hover:bg-black text-white rounded-lg h-9 px-4 text-sm font-medium">
                  <Plus size={15} className="mr-1.5" />
                  Create Plan
                </Button>
              </Link>
            )}
          </div>
          <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
            <CardContent className="p-0 overflow-hidden">
              <PlanList />
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    );
  },
});

const createPlanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/plans/new',
  component: () => (
    <AuthGuard>
      <div className="space-y-5 max-w-2xl">
        <div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight">Create Plan</h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">Define a new platform subscription plan</p>
        </div>
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
          <CardContent className="pt-6">
            <PlanForm />
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  ),
});

const editPlanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/plans/$id',
  component: () => (
    <AuthGuard>
      <EditPlanRouteContent />
    </AuthGuard>
  ),
});

function EditPlanRouteContent() {
  const { id } = editPlanRoute.useParams();
  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-medium text-[#111111] tracking-tight">Edit Plan</h1>
        <p className="text-sm text-[#9c9fa5] mt-0.5">Modify subscription plan limits and billing</p>
      </div>
      <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
        <CardContent className="pt-6">
          <PlanForm planId={id} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Plugins                                                            */
/* ------------------------------------------------------------------ */

const pluginsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/plugins',
  component: () => (
    <AuthGuard>
      <div className="space-y-5 max-w-[1280px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium text-[#111111] tracking-tight">Plugins</h1>
            <p className="text-sm text-[#9c9fa5] mt-0.5">Platform plugin registry</p>
          </div>
          <Link to="/admin/plugins/new">
            <Button className="bg-[#111111] hover:bg-black text-white rounded-lg h-9 px-4 text-sm font-medium">
              <Plus size={15} className="mr-1.5" />
              Register Plugin
            </Button>
          </Link>
        </div>
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none overflow-hidden">
          <CardContent className="p-0">
            <PluginRegistry />
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  ),
});

const publishPluginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/plugins/new',
  component: () => (
    <AuthGuard>
      <div className="space-y-5 max-w-2xl">
        <div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight">Register Plugin</h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">Add a new plugin to the platform registry</p>
        </div>
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
          <CardContent className="pt-6">
            <PublishPlugin />
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  ),
});

const pluginDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/plugins/$id',
  component: () => (
    <AuthGuard>
      <div className="space-y-5 max-w-[1280px]">
        <div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight">Plugin Details</h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">Plugin configuration and usage</p>
        </div>
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
          <CardContent className="pt-6">
            <PluginDetail pluginId={pluginDetailRoute.useParams().id} />
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  ),
});

/* ------------------------------------------------------------------ */
/*  Reports                                                            */
/* ------------------------------------------------------------------ */

const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/reports',
  component: () => (
    <AuthGuard>
      <div className="space-y-5 max-w-[1280px]">
        <div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight">Platform Reports</h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">
            Aggregate metrics only — no PII is displayed
          </p>
        </div>
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
          <CardContent className="pt-6">
            <PlatformReports />
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  ),
});

/* ------------------------------------------------------------------ */
/*  Platform team                                                      */
/* ------------------------------------------------------------------ */

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/users',
  component: () => (
    <AuthGuard>
      <div className="space-y-5 max-w-[1280px]">
        <div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight">Platform Team</h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">Manage platform-level admin users and roles</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-[#111111]">Team Members</CardTitle>
            </CardHeader>
            <Separator className="bg-[#ebe7e1]" />
            <CardContent className="pt-4">
              <PlatformUserList />
            </CardContent>
          </Card>

          <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-[#111111]">Invite User</CardTitle>
            </CardHeader>
            <Separator className="bg-[#ebe7e1]" />
            <CardContent className="pt-4">
              <InvitePlatformUser />
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-[#111111]">Role Permissions Matrix</CardTitle>
            <p className="text-sm text-[#9c9fa5] mt-0.5">
              Platform roles are system-defined and cannot be modified
            </p>
          </CardHeader>
          <Separator className="bg-[#ebe7e1]" />
          <CardContent className="pt-4">
            <PlatformRoleMatrix />
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  ),
});

/* ------------------------------------------------------------------ */
/*  System health                                                      */
/* ------------------------------------------------------------------ */

const healthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/health',
  component: () => (
    <AuthGuard>
      <div className="space-y-5 max-w-[1280px]">
        <div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight">System Health</h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">Monitor queue workers and webhook delivery</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-[#111111]">Queue Monitor</CardTitle>
            </CardHeader>
            <Separator className="bg-[#ebe7e1]" />
            <CardContent className="pt-4">
              <QueueMonitor />
            </CardContent>
          </Card>

          <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-[#111111]">Webhook Failures</CardTitle>
            </CardHeader>
            <Separator className="bg-[#ebe7e1]" />
            <CardContent className="pt-4">
              <WebhookFailures />
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  ),
});

/* ------------------------------------------------------------------ */
/*  Billing                                                            */
/* ------------------------------------------------------------------ */

const billingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/billing',
  component: () => (
    <AuthGuard>
      <div className="space-y-5 max-w-[1280px]">
        <div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight">Billing</h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">Platform billing and revenue records</p>
        </div>
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-10 h-10 rounded-full bg-[#f5f1ec] flex items-center justify-center mb-3">
              <CreditCard size={20} className="text-[#9c9fa5]" />
            </div>
            <h3 className="text-base font-medium text-[#111111] mb-1">Billing records</h3>
            <p className="text-sm text-[#9c9fa5]">Manage invoices and payment information</p>
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  ),
});

/* ------------------------------------------------------------------ */
/*  Router                                                             */
/* ------------------------------------------------------------------ */

const routeTree = rootRoute.addChildren([
  loginRoute,
  unauthorizedRoute,
  dashboardRoute,
  tenantsRoute,
  createTenantRoute,
  tenantDetailRoute,
  tenantImpersonateRoute,
  plansRoute,
  createPlanRoute,
  editPlanRoute,
  pluginsRoute,
  publishPluginRoute,
  pluginDetailRoute,
  reportsRoute,
  usersRoute,
  healthRoute,
  billingRoute,
]);

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
});
