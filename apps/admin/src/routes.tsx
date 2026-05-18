import { createRouter, createRoute, createRootRoute, Outlet } from '@tanstack/react-router';
import { AuthProvider, useAuth } from '@/contexts/auth.context';
import { LoginPage } from '@/components/LoginPage';
import { UnauthorizedPage } from '@/components/UnauthorizedPage';
import { AdminLayout } from '@/components/AdminLayout';
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
      <div>
        <h1 className="text-2xl font-bold">Tenants</h1>
        <p className="mt-2 text-gray-600">Manage platform tenants</p>
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
      <div>
        <h1 className="text-2xl font-bold">Plugins</h1>
        <p className="mt-2 text-gray-600">Manage platform plugins</p>
      </div>
    </AuthGuard>
  ),
});

const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/reports',
  component: () => (
    <AuthGuard>
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="mt-2 text-gray-600">View platform reports</p>
      </div>
    </AuthGuard>
  ),
});

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/users',
  component: () => (
    <AuthGuard>
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="mt-2 text-gray-600">Manage platform users</p>
      </div>
    </AuthGuard>
  ),
});

const healthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/health',
  component: () => (
    <AuthGuard>
      <div>
        <h1 className="text-2xl font-bold">System Health</h1>
        <p className="mt-2 text-gray-600">Monitor system health</p>
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
  plansRoute,
  pluginsRoute,
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
