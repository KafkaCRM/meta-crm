import { createRouter, createRoute, createRootRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/auth.context';
import { LoginPage } from '@/components/LoginPage';
import { UnauthorizedPage } from '@/components/UnauthorizedPage';
import { AdminLayout } from '@/components/AdminLayout';
import { TenantList, TenantDetail, CreateTenantForm, ImpersonateView } from '@/components/tenants';
import { PluginRegistry, PublishPlugin, PluginDetail } from '@/components/plugins';
import { PlatformUserList, InvitePlatformUser, PlatformRoleMatrix } from '@/components/team';
import { PlatformReports } from '@/components/reports';
import { QueueMonitor, WebhookFailures, PlanList, PlanForm, PlatformBilling, PlatformDashboard, SystemHealth, PlatformAuditLogs } from '@/components/system';
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
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

function LoginRouteComponent() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate({ from: '/login' });

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: '/' });
    }
  }, [isAuthenticated, navigate]);

  return <LoginPage />;
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginRouteComponent,
});

const unauthorizedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/unauthorized',
  component: UnauthorizedPage,
});

/* ------------------------------------------------------------------ */
/*  Platform Dashboard                                                 */
/* ------------------------------------------------------------------ */



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
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Tenants</h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage all workspace tenants</p>
          </div>
          <Link to="/admin/tenants/new">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9 px-4 text-sm font-medium shadow-sm transition-colors">
              <Plus size={15} className="mr-1.5" />
              Create Tenant
            </Button>
          </Link>
        </div>
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm">
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
      <div className="space-y-5 max-w-4xl">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Create Tenant</h1>
          <p className="text-sm text-slate-400 mt-0.5">Provision a new workspace tenant</p>
        </div>
        <CreateTenantForm />
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
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Tenant View</h1>
          <p className="text-sm text-slate-400 mt-0.5">Read-only access</p>
        </div>
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm">
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
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Tenant Details</h1>
        <p className="text-sm text-slate-400 mt-0.5">Configuration and settings for this tenant</p>
      </div>
      <TenantDetail tenantId={id} />
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
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Impersonate Tenant</h1>
          <p className="text-sm text-slate-400 mt-0.5">Viewing tenant workspace in read-only mode</p>
        </div>
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm">
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
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Plans</h1>
              <p className="text-sm text-slate-400 mt-0.5">Manage subscription plans and pricing</p>
            </div>
            {canCreate && (
              <Link to="/admin/plans/new">
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9 px-4 text-sm font-medium shadow-sm transition-colors">
                  <Plus size={15} className="mr-1.5" />
                  Create Plan
                </Button>
              </Link>
            )}
          </div>
          <Card className="bg-white border-slate-200 rounded-xl shadow-sm">
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
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Create Plan</h1>
          <p className="text-sm text-slate-400 mt-0.5">Define a new platform subscription plan</p>
        </div>
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm">
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
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Edit Plan</h1>
        <p className="text-sm text-slate-400 mt-0.5">Modify subscription plan limits and billing</p>
      </div>
      <Card className="bg-white border-slate-200 rounded-xl shadow-sm">
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
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Plugins</h1>
            <p className="text-sm text-slate-400 mt-0.5">Platform plugin registry</p>
          </div>
          <Link to="/admin/plugins/new">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9 px-4 text-sm font-medium shadow-sm transition-colors">
              <Plus size={15} className="mr-1.5" />
              Register Plugin
            </Button>
          </Link>
        </div>
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm overflow-hidden">
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
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Register Plugin</h1>
          <p className="text-sm text-slate-400 mt-0.5">Add a new plugin to the platform registry</p>
        </div>
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm">
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
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Plugin Details</h1>
          <p className="text-sm text-slate-400 mt-0.5">Plugin configuration and usage</p>
        </div>
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm">
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
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Platform Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Aggregate metrics only — no PII is displayed
          </p>
        </div>
        <Card className="bg-white border-slate-200 rounded-xl shadow-sm">
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
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Platform Team</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage platform-level admin users and roles</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-white border-slate-200 rounded-xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-900">Team Members</CardTitle>
            </CardHeader>
            <Separator className="bg-slate-100" />
            <CardContent className="pt-4">
              <PlatformUserList />
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 rounded-xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-900">Invite User</CardTitle>
            </CardHeader>
            <Separator className="bg-slate-100" />
            <CardContent className="pt-4">
              <InvitePlatformUser />
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white border-slate-200 rounded-xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">Role Permissions Matrix</CardTitle>
            <p className="text-sm text-slate-400 mt-0.5">
              Platform roles are system-defined and cannot be modified
            </p>
          </CardHeader>
          <Separator className="bg-slate-100" />
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
        <SystemHealth />
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
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Billing & Invoices</h1>
          <p className="text-sm text-slate-400 mt-0.5">Platform billing ledger and subscription payouts</p>
        </div>
        <PlatformBilling />
      </div>
    </AuthGuard>
  ),
});

/* ------------------------------------------------------------------ */
/*  Audit Logs                                                        */
/* ------------------------------------------------------------------ */

const auditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/audit',
  component: () => (
    <AuthGuard>
      <PlatformAuditLogs />
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
  auditRoute,
]);

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
});
