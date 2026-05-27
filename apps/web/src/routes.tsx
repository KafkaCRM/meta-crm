import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useRouter, Link, useLocation } from '@tanstack/react-router';
import { useAuth } from '@/contexts/auth.context';
import { AbilityProvider } from '@/contexts/permissions.context';
import { LabelsProvider } from '@/contexts/labels.context';
import { Dashboard } from '@/components/dashboard';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Building2,
  Workflow,
  GitBranch,
  Tags,
  Puzzle,
  Link2,
  Shield,
  UserCog,
  Layers,
  Sliders,
  Calendar,
  Receipt,
  Home,
  ShoppingCart,
  ClipboardList,
  Megaphone,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useCapabilities } from '@/hooks/useCapabilities';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { CommandPalette } from '@/components/shared/CommandPalette';


/* ------------------------------------------------------------------ */
/*  App Shell Sidebar                                                  */
/* ------------------------------------------------------------------ */

function AppSidebar() {
  const { user, ability, logout } = useAuth();
  const location = useLocation();
  const { isEnabled } = useCapabilities();

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const mainItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Contacts', path: '/parties', icon: Users },
    { label: 'Cases', path: '/cases', icon: Workflow },
    { label: 'Campaigns', path: '/campaigns', icon: Megaphone },
    ...(isEnabled('capability/appointment')
      ? [{ label: 'Appointments', path: '/appointments', icon: Calendar }]
      : []),
    ...(isEnabled('capability/billing')
      ? [{ label: 'Invoices', path: '/invoices', icon: Receipt }]
      : []),
    ...(isEnabled('capability/property-listing')
      ? [{ label: 'Properties', path: '/properties', icon: Home }]
      : []),
    ...(isEnabled('capability/order-management')
      ? [{ label: 'Orders', path: '/orders', icon: ShoppingCart }]
      : []),
    ...(isEnabled('capability/customer-onboarding')
      ? [{ label: 'Onboardings', path: '/onboardings', icon: ClipboardList }]
      : []),
  ];

  const settingsPermissions: Record<string, [string, string]> = {
    '/settings/users': ['manage', 'User'],
    '/settings/roles': ['manage', 'Role'],
    '/settings/branches': ['manage', 'Branch'],
    '/settings/brands': ['manage', 'Brand'],
    '/settings/assignments': ['manage', 'Branch'],
    '/settings/workflows': ['manage', 'Workflow'],
    '/settings/fields': ['manage', 'FieldDefinition'],
    '/settings/labels': ['manage', 'LabelOverride'],
    '/settings/capabilities': ['manage', 'Plugin'],
    '/settings/plugins': ['manage', 'Plugin'],
    '/settings/integrations': ['manage', 'Integration'],
  };

  const settingsItems = [
    { label: 'Users', path: '/settings/users', icon: Users },
    { label: 'Roles', path: '/settings/roles', icon: Shield },
    { label: 'Branches', path: '/settings/branches', icon: GitBranch },
    { label: 'Brands', path: '/settings/brands', icon: Building2 },
    { label: 'Assignments', path: '/settings/assignments', icon: UserCog },
    { label: 'Workflows', path: '/settings/workflows', icon: Workflow },
    { label: 'Fields', path: '/settings/fields', icon: Sliders },
    { label: 'Labels', path: '/settings/labels', icon: Tags },
    { label: 'Capabilities', path: '/settings/capabilities', icon: Layers },
    { label: 'Plugins', path: '/settings/plugins', icon: Puzzle },
    { label: 'Integrations', path: '/settings/integrations', icon: Link2 },
  ];

  const visibleSettingsItems = settingsItems.filter((item) => {
    const perm = settingsPermissions[item.path];
    return (
      !perm ||
      (ability
        ? ability.can(perm[0] as any, perm[1] as any) || ability.can('read' as any, perm[1] as any)
        : false)
    );
  });

  const isSettingsActive = location.pathname.startsWith('/settings');

  return (
    <Sidebar className="border-r border-slate-800 bg-[#0b0f19]">
      <SidebarHeader className="px-4 py-4 border-b border-slate-800 bg-[#0b0f19]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#4f46e5] flex items-center justify-center flex-shrink-0 shadow-sm shadow-indigo-500/20 animate-pulse">
            <span className="text-white text-xs font-bold font-mono">M</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-none tracking-tight">Meta CRM</p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Workspace Console</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 bg-[#0b0f19]">
        {/* Main Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-500 text-[10px] font-bold uppercase tracking-wider px-2 mb-1">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link
                        to={item.path}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 ${
                          isActive
                            ? 'bg-slate-800/80 text-white font-medium shadow-sm border border-slate-700/50'
                            : 'text-slate-300 hover:bg-slate-800/40 hover:text-white'
                        }`}
                      >
                        <item.icon size={15} strokeWidth={isActive ? 2 : 1.75} className={isActive ? 'text-indigo-400' : 'text-slate-400'} />
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2 bg-slate-800/50" />

        {/* Settings/Configuration Section */}
        {visibleSettingsItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-slate-500 text-[10px] font-bold uppercase tracking-wider px-2 mb-1">
              Configuration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isSettingsActive}>
                    <Link
                      to="/settings"
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm w-full transition-all duration-150 ${
                        isSettingsActive
                          ? 'bg-slate-800/80 text-white font-medium shadow-sm border border-slate-700/50'
                          : 'text-slate-300 hover:bg-slate-800/40 hover:text-white'
                      }`}
                    >
                      <Settings size={15} strokeWidth={isSettingsActive ? 2 : 1.75} className={isSettingsActive ? 'text-indigo-400' : 'text-slate-400'} />
                      <span className="flex-1">Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-800 p-3 bg-[#0b0f19]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-slate-800/40 transition-colors text-left text-slate-300">
              <Avatar className="w-7 h-7 flex-shrink-0">
                <AvatarFallback className="bg-[#4f46e5] text-white text-xs font-semibold shadow-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate leading-tight">{user?.name ?? 'User'}</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{user?.email ?? ''}</p>
              </div>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-[#0b0f19] border-slate-850 text-slate-100 shadow-md">
            <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-slate-500">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              onClick={logout}
              className="text-sm text-rose-400 focus:text-rose-400 focus:bg-slate-800/50 cursor-pointer"
            >
              <LogOut size={14} className="mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/* ------------------------------------------------------------------ */
/*  Root layout                                                        */
/* ------------------------------------------------------------------ */

function RootLayout() {
  const { isAuthenticated, ability, isLoading } = useAuth();
  const location = useLocation();
  const router = useRouter();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);


  console.log('RootLayout render:', { isAuthenticated, isLoading, pathname: location.pathname });

  // Redirect to login if not authenticated (called unconditionally)
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
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
          <div className="w-4 h-4 border-2 border-[#e2e8f0] border-t-[#0f172a] rounded-full animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AbilityProvider ability={ability}>
      <LabelsProvider>
        <SidebarProvider>
          <div className="flex min-h-screen w-full bg-[#f8fafc]">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              {/* Top bar */}
              <header className="h-14 bg-[#f8fafc] border-b border-[#e2e8f0]/60 flex items-center justify-between px-4 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <SidebarTrigger className="text-[#64748b] hover:text-[#0f172a]" />
                  <Separator orientation="vertical" className="h-4 bg-[#e2e8f0]" />
                  <Breadcrumbs />
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Command search launcher trigger */}
                  <button
                    onClick={() => setCommandPaletteOpen(true)}
                    className="relative w-full sm:w-[240px] h-8 bg-white border border-[#e2e8f0] hover:border-slate-350 rounded-lg flex items-center justify-between px-3 text-slate-400 text-xs font-semibold select-none cursor-pointer transition-all shadow-xs"
                  >
                    <span className="flex items-center gap-2">
                      <Search size={13} className="text-slate-400" />
                      Search console...
                    </span>
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[9px] font-bold text-slate-400 leading-none">
                      <span>⌘</span>K
                    </kbd>
                  </button>

                  {/* Sandbox Environment Badge */}
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/25 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider font-mono">Sandbox</span>
                  </div>

                  {/* Tenant Workspace Selector */}
                  <div className="text-xs font-bold text-slate-600 border border-[#e2e8f0] px-2.5 py-1 rounded-lg bg-white select-none shadow-xs">
                    Workspace: Acme Corp
                  </div>
                </div>
              </header>
              <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
              {/* Page content */}
              <main className="flex-1 p-6 overflow-auto">
                <Outlet />
              </main>
            </div>
          </div>
        </SidebarProvider>
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
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-10 h-10 rounded-xl bg-[#0f172a] items-center justify-center mb-4">
            <span className="text-white font-semibold">M</span>
          </div>
          <h1 className="text-2xl font-medium text-[#0f172a] tracking-tight mb-1">
            Welcome back
          </h1>
          <p className="text-sm text-[#64748b]">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-8 shadow-none">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-[#0f172a]">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-[#f8fafc] border-[#e2e8f0] placeholder:text-[#94a3b8] focus-visible:ring-[#0f172a] focus-visible:border-[#0f172a]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-[#0f172a]">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#f8fafc] border-[#e2e8f0] focus-visible:ring-[#0f172a] focus-visible:border-[#0f172a]"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0f172a] hover:bg-[#000000] text-white font-medium rounded-lg h-10 mt-2"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-[#94a3b8] mt-4">
          Meta CRM · All rights reserved
        </p>
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
  casesRoute,
  casesNewRoute,
  caseDetailRoute,
} from './routes/case';

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
  settingsObjectsRoute,
  settingsAuditTrailRoute,
  settingsLayoutBuilderRoute,
} from './routes/settings';

import { appointmentsRoute } from './routes/appointments';
import { billingRoute } from './routes/billing';
import { propertiesRoute } from './routes/properties';
import { ordersRoute } from './routes/orders';
import { onboardingsRoute } from './routes/onboardings';
import { campaignsRoute } from './routes/campaigns';

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
  casesRoute,
  casesNewRoute,
  caseDetailRoute,
  appointmentsRoute,
  billingRoute,
  propertiesRoute,
  ordersRoute,
  onboardingsRoute,
  campaignsRoute,
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
  settingsObjectsRoute,
  settingsAuditTrailRoute,
  settingsLayoutBuilderRoute,
]);

export const router = createRouter({ routeTree });
