import { createRouter, createRoute, createRootRoute, Outlet } from '@tanstack/react-router';
import { AuthProvider, useAuth } from '@/contexts/auth.context';
import { LoginPage } from '@/components/LoginPage';
import { UnauthorizedPage } from '@/components/UnauthorizedPage';
import { AdminLayout } from '@/components/AdminLayout';
import { TenantList, TenantDetail, CreateTenantForm, ImpersonateView } from '@/components/tenants';
import { PluginRegistry, PublishPlugin, PluginDetail } from '@/components/plugins';
import { PlatformUserList, InvitePlatformUser, PlatformRoleMatrix } from '@/components/team';
import { PlatformReports } from '@/components/reports';
import { QueueMonitor, WebhookFailures } from '@/components/system';
import { queryClient } from '@/lib/query-client';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isUnauthorized } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (isUnauthorized) {
    return <UnauthorizedPage />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

const rootRoute = createRootRoute({
  component: () => (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  ),
});

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

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <AuthGuard>
      <div>
        <h1 className="text-2xl font-bold">Platform Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome to Meta CRM Admin</p>
      </div>
    </AuthGuard>
  ),
});

const tenantsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/tenants',
  component: () => (
    <AuthGuard>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tenants</h1>
          <a
            href="/admin/tenants/new"
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Create Tenant
          </a>
        </div>
        <TenantList />
      </div>
    </AuthGuard>
  ),
});

const createTenantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/tenants/new',
  component: () => (
    <AuthGuard>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Create Tenant</h1>
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
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Tenant View (Read-Only)</h1>
        <ImpersonateView tenantId={id} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tenant Details</h1>
      <TenantDetail tenantId={id} />
    </div>
  );
}

const tenantImpersonateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/tenants/$id/impersonate',
  component: () => (
    <AuthGuard>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Tenant View (Read-Only)</h1>
        <ImpersonateView tenantId={tenantImpersonateRoute.useParams().id} />
      </div>
    </AuthGuard>
  ),
});

const plansRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/plans',
  component: () => (
    <AuthGuard>
      <div>
        <h1 className="text-2xl font-bold">Plans</h1>
        <p className="mt-2 text-gray-600">Manage subscription plans</p>
      </div>
    </AuthGuard>
  ),
});

const pluginsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/plugins',
  component: () => (
    <AuthGuard>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Plugins</h1>
          <a
            href="/admin/plugins/new"
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Register Plugin
          </a>
        </div>
        <PluginRegistry />
      </div>
    </AuthGuard>
  ),
});

const publishPluginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/plugins/new',
  component: () => (
    <AuthGuard>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Register Plugin</h1>
        <PublishPlugin />
      </div>
    </AuthGuard>
  ),
});

const pluginDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/plugins/$id',
  component: () => (
    <AuthGuard>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Plugin Details</h1>
        <PluginDetail pluginId={pluginDetailRoute.useParams().id} />
      </div>
    </AuthGuard>
  ),
});

const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/reports',
  component: () => (
    <AuthGuard>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Platform Reports</h1>
        <p className="text-sm text-gray-500">
          Aggregate metrics only — no PII is displayed.
        </p>
        <PlatformReports />
      </div>
    </AuthGuard>
  ),
});

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/users',
  component: () => (
    <AuthGuard>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Platform Team</h1>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-lg font-semibold">Team Members</h2>
            <PlatformUserList />
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold">Invite User</h2>
            <InvitePlatformUser />
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Role Permissions Matrix</h2>
          <p className="mb-3 text-sm text-gray-500">
            Platform roles are system-defined and cannot be modified.
          </p>
          <PlatformRoleMatrix />
        </div>
      </div>
    </AuthGuard>
  ),
});

const healthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/health',
  component: () => (
    <AuthGuard>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">System Health</h1>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Queue Monitor</h2>
          <QueueMonitor />
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Webhook Failures</h2>
          <WebhookFailures />
        </div>
      </div>
    </AuthGuard>
  ),
});

const billingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/billing',
  component: () => (
    <AuthGuard>
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="mt-2 text-gray-600">Manage billing records</p>
      </div>
    </AuthGuard>
  ),
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  unauthorizedRoute,
  dashboardRoute,
  tenantsRoute,
  createTenantRoute,
  tenantDetailRoute,
  tenantImpersonateRoute,
  plansRoute,
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
