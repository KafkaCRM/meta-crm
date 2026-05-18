import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useAuth } from '@/contexts/auth.context';
import { usePermissions } from '@/hooks/usePermissions';
import { useLabels } from '@/hooks/useLabels';
import { AbilityProvider } from '@/contexts/permissions.context';
import { LabelsProvider } from '@/contexts/labels.context';
import { Dashboard } from '@/components/dashboard';

/* ------------------------------------------------------------------ */
/*  Root layout                                                        */
/* ------------------------------------------------------------------ */

function RootLayout() {
  const { isAuthenticated, ability, user } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AbilityProvider ability={ability}>
      <LabelsProvider>
        <div className="min-h-screen bg-background">
          <header className="border-b px-4 py-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Meta CRM</span>
              <span className="text-sm text-muted-foreground">{user?.name}</span>
            </div>
          </header>
          <main className="p-4">
            <Outlet />
          </main>
        </div>
      </LabelsProvider>
    </AbilityProvider>
  );
}

export const rootRoute = createRootRoute({
  component: RootLayout,
});

/* ------------------------------------------------------------------ */
/*  Login page                                                         */
/* ------------------------------------------------------------------ */

function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    router.navigate({ to: '/' });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password, tenantSlug);
      router.navigate({ to: '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-center">Meta CRM</h1>
        <p className="text-center text-muted-foreground">Sign in to your account</p>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="tenant" className="block text-sm font-medium mb-1">
              Tenant
            </label>
            <input
              id="tenant"
              type="text"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
              placeholder="your-company"
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

/* ------------------------------------------------------------------ */
/*  Dashboard (index)                                                  */
/* ------------------------------------------------------------------ */

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
});

/* ------------------------------------------------------------------ */
/*  Party routes                                                       */
/* ------------------------------------------------------------------ */

import {
  partiesRoute,
  partiesNewRoute,
  partyDetailRoute,
  partyEditRoute,
} from './routes/party';

import {
  settingsRoute,
  settingsBranchesRoute,
  settingsBrandsRoute,
  settingsAssignmentsRoute,
  settingsUsersRoute,
  settingsRolesRoute,
  settingsWorkflowsRoute,
  settingsFieldsRoute,
  settingsLabelsRoute,
  settingsCapabilitiesRoute,
  settingsPluginsRoute,
  settingsIntegrationsRoute,
} from './routes/settings';

/* ------------------------------------------------------------------ */
/*  Route tree + router                                                */
/* ------------------------------------------------------------------ */

export const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  partiesRoute,
  partiesNewRoute,
  partyDetailRoute,
  partyEditRoute,
  settingsRoute,
  settingsBranchesRoute,
  settingsBrandsRoute,
  settingsAssignmentsRoute,
  settingsUsersRoute,
  settingsRolesRoute,
  settingsWorkflowsRoute,
  settingsFieldsRoute,
  settingsLabelsRoute,
  settingsCapabilitiesRoute,
  settingsPluginsRoute,
  settingsIntegrationsRoute,
]);

export const router = createRouter({ routeTree });
