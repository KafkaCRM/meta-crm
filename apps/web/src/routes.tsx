import { createRootRoute, createRoute, createRouter, Outlet, useRouter, useLocation } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { AbilityProvider } from '@/contexts/permissions.context';
import { LabelsProvider } from '@/contexts/labels.context';
import { BranchProvider } from '@/contexts/branch.context';
import { CurrencyProvider } from '@/contexts/currency.context';
import { Dashboard } from '@/components/dashboard';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/sonner';
import { Search } from 'lucide-react';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { LoginPage } from '@/components/auth/LoginPage';
import { CurrencySelector, WorkspaceBadge } from '@/components/layout/HeaderSelectors';
import { FranchiseContextSwitcher } from '@/components/layout/FranchiseContextSwitcher';

/* ------------------------------------------------------------------ */
/*  Root Shell Layout                                                  */
/* ------------------------------------------------------------------ */

function RootLayout() {
  const { isAuthenticated, ability, isLoading, isImpersonating, logout } = useAuth();
  const location = useLocation();
  const router = useRouter();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (location.pathname !== '/login' && !isAuthenticated && !isLoading) {
      router.navigate({ to: '/login' });
    }
  }, [isAuthenticated, isLoading, location.pathname, router]);

  if (location.pathname === '/login') {
    return <Outlet />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
          Loading workspace session…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <TooltipProvider>
      <AbilityProvider ability={ability}>
        <CurrencyProvider>
          <LabelsProvider>
            <BranchProvider>
              <SidebarProvider>
                <div className="flex min-h-screen w-full bg-background text-foreground flex-col">
                  {/* Support Impersonation Banner */}
                  {isImpersonating && (
                    <div className="bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 text-white px-4 py-2 flex items-center justify-between text-xs sm:text-sm font-semibold tracking-wide shadow-md border-b border-orange-700/50 relative z-50">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping flex-shrink-0" />
                        <span>
                          Support Impersonation Mode Active: Viewing Workspace as Customer Support
                        </span>
                      </div>
                      <Button
                        onClick={logout}
                        size="xs"
                        className="bg-card/10 hover:bg-card/20 text-white border border-white/20 hover:border-white/40 h-7 rounded px-3 transition-all flex items-center gap-1.5 shadow-sm font-bold cursor-pointer"
                      >
                        Exit Session
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-1 w-full bg-background text-foreground">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col min-w-0">
                      {/* Top bar */}
                      <header className="h-14 bg-background border-b border-border/60 flex items-center justify-between px-6 sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                          <Separator orientation="vertical" className="h-4 bg-border" />
                          <Breadcrumbs />
                        </div>

                        <div className="flex items-center gap-3.5">
                          {/* Command search launcher trigger */}
                          <button
                            onClick={() => setCommandPaletteOpen(true)}
                            className="relative w-full sm:w-[220px] h-8 bg-muted/60 border border-border hover:bg-accent rounded-xl flex items-center justify-between px-3 text-muted-foreground text-xs font-medium select-none cursor-pointer transition-all"
                          >
                            <span className="flex items-center gap-2">
                              <Search size={13} className="text-muted-foreground" />
                              Search console...
                            </span>
                            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[9px] font-bold text-muted-foreground leading-none">
                              <span>⌘</span>K
                            </kbd>
                          </button>

                          {import.meta.env.DEV && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              <span className="text-[9px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Sandbox</span>
                            </div>
                          )}

                          {/* Franchise & Store Context Switcher */}
                          <FranchiseContextSwitcher />

                          <ThemeToggle />

                          {/* Currency Selector */}
                          <CurrencySelector />

                          {/* Tenant Workspace Selector */}
                          <WorkspaceBadge />
                        </div>
                      </header>

                      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

                      {/* Page content */}
                      <main className="flex-1 p-8 overflow-auto">
                        <Outlet />
                      </main>
                    </div>
                  </div>
                </div>
              </SidebarProvider>
            </BranchProvider>
          </LabelsProvider>
        </CurrencyProvider>
      </AbilityProvider>
      <Toaster />
    </TooltipProvider>
  );
}

export const rootRoute = createRootRoute({
  component: RootLayout,
});

/* ------------------------------------------------------------------ */
/*  Core Routes (Auth, Dashboard)                                      */
/* ------------------------------------------------------------------ */

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

function ImpersonatePage() {
  const { impersonate } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userStr = params.get('user');

    if (!token || !userStr) {
      setError('Invalid or expired support session handshake.');
      return;
    }

    try {
      const user = JSON.parse(userStr);
      impersonate(token, user);
      router.navigate({ to: '/' });
    } catch {
      setError('Malformed session metadata payload.');
    }
  }, [impersonate, router]);

  if (error) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background px-6 font-sans">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-10 h-10 rounded-md bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
            <span className="text-rose-600 font-bold text-xl">!</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Support session failed</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
          <Button onClick={() => window.close()} className="w-full text-sm h-9 rounded-md">
            Close Window
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background font-sans">
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground font-semibold">
        <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
        Establishing secure support session…
      </div>
    </div>
  );
}

const impersonateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/impersonate',
  component: ImpersonatePage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
});

/* ------------------------------------------------------------------ */
/*  Domain Routes                                                      */
/* ------------------------------------------------------------------ */

import { partiesRoute, partiesNewRoute, partyDetailRoute, partyEditRoute } from './routes/party';
import {
  settingsRoute,
  settingsBranchesRoute,
  settingsVerticalsRoute,
  settingsBrandsRoute,
  settingsUsersRoute,
  settingsRolesRoute,
  settingsPipelinesRoute,
  settingsWorkflowsRoute,
  settingsFieldsRoute,
  settingsLabelsRoute,
  settingsCapabilitiesRoute,
  settingsPluginsRoute,
  settingsIntegrationsRoute,
  settingsObjectsRoute,
  settingsAuditTrailRoute,
  settingsLayoutBuilderRoute,
} from './routes/settings';
import { reportsRoute } from './routes/reports';
import { appointmentsRoute } from './routes/appointments';
import { billingRoute } from './routes/billing';
import { propertiesRoute } from './routes/properties';
import { ordersRoute } from './routes/orders';
import { onboardingsRoute } from './routes/onboardings';
import { campaignsRoute } from './routes/campaigns';
import { leadsRoute, leadDetailRoute } from './routes/leads';
import { pipelineRoute } from './routes/pipeline';
import { integrationsRoute } from './routes/integrations';
import {
  coursesRoute,
  batchesRoute,
  attendanceRoute,
  testsRoute,
  assignmentsRoute,
  enrollmentsRoute,
  studyMaterialsRoute,
  certificatesRoute,
} from './routes/academics';
import { feePlansRoute, studentFeesRoute, scholarshipsRoute } from './routes/finance';
import { callLogsRoute } from './routes/telephony';
import {
  departmentsRoute,
  employeesRoute,
  leaveRequestsRoute,
  payslipsRoute,
  employeeAttendanceRoute,
} from './routes/hr';
import { tasksRoute, notesRoute, inboxRoute } from './routes/workspace';
import {
  productCategoriesRoute,
  productsRoute,
  warehousesRoute,
  stockRoute,
  stockMovementsRoute,
  assetsRoute,
} from './routes/operations';

/* ------------------------------------------------------------------ */
/*  Route Tree & Router                                                */
/* ------------------------------------------------------------------ */

export const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  impersonateRoute,
  partiesRoute,
  leadsRoute,
  leadDetailRoute,
  pipelineRoute,
  partiesNewRoute,
  partyDetailRoute,
  partyEditRoute,
  appointmentsRoute,
  billingRoute,
  propertiesRoute,
  ordersRoute,
  onboardingsRoute,
  coursesRoute,
  batchesRoute,
  attendanceRoute,
  testsRoute,
  assignmentsRoute,
  enrollmentsRoute,
  studyMaterialsRoute,
  certificatesRoute,
  feePlansRoute,
  studentFeesRoute,
  scholarshipsRoute,
  callLogsRoute,
  departmentsRoute,
  employeesRoute,
  leaveRequestsRoute,
  payslipsRoute,
  employeeAttendanceRoute,
  inboxRoute,
  tasksRoute,
  notesRoute,
  productCategoriesRoute,
  productsRoute,
  warehousesRoute,
  stockRoute,
  stockMovementsRoute,
  assetsRoute,
  campaignsRoute,
  reportsRoute,
  integrationsRoute,
  settingsRoute,
  settingsBranchesRoute,
  settingsVerticalsRoute,
  settingsBrandsRoute,
  settingsUsersRoute,
  settingsRolesRoute,
  settingsPipelinesRoute,
  settingsWorkflowsRoute,
  settingsFieldsRoute,
  settingsLabelsRoute,
  settingsCapabilitiesRoute,
  settingsPluginsRoute,
  settingsIntegrationsRoute,
  settingsObjectsRoute,
  settingsAuditTrailRoute,
  settingsLayoutBuilderRoute,
]);

export const router = createRouter({ routeTree });
