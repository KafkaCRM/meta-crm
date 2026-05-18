import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { useState } from 'react';
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
} from '@/components/ui/sidebar';
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
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  App Shell Sidebar                                                  */
/* ------------------------------------------------------------------ */

const navItems = [
  {
    group: 'Main',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard },
      { label: 'Contacts', path: '/parties', icon: Users },
    ],
  },
  {
    group: 'Settings',
    items: [
      { label: 'Users', path: '/settings/users', icon: UserCog },
      { label: 'Roles', path: '/settings/roles', icon: Shield },
      { label: 'Branches', path: '/settings/branches', icon: GitBranch },
      { label: 'Brands', path: '/settings/brands', icon: Building2 },
      { label: 'Workflows', path: '/settings/workflows', icon: Workflow },
      { label: 'Fields', path: '/settings/fields', icon: Sliders },
      { label: 'Labels', path: '/settings/labels', icon: Tags },
      { label: 'Capabilities', path: '/settings/capabilities', icon: Layers },
      { label: 'Plugins', path: '/settings/plugins', icon: Puzzle },
      { label: 'Integrations', path: '/settings/integrations', icon: Link2 },
    ],
  },
];

function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <Sidebar className="border-r border-[#d3cec6] bg-[#ebe7e1]">
      <SidebarHeader className="px-4 py-4 border-b border-[#d3cec6]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#111111] flex items-center justify-center">
            <span className="text-white text-xs font-semibold">M</span>
          </div>
          <span className="font-semibold text-[#111111] text-sm tracking-tight">Meta CRM</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {navItems.map((group) => (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel className="text-[#9c9fa5] text-xs font-medium px-2 mb-1 uppercase tracking-wider">
              {group.group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          to={item.path}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? 'bg-[#ffffff] text-[#111111] font-medium shadow-sm'
                              : 'text-[#626260] hover:bg-[#f5f1ec] hover:text-[#111111]'
                          }`}
                        >
                          <item.icon size={15} strokeWidth={isActive ? 2 : 1.75} />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
            <Separator className="my-2 bg-[#d3cec6]/60" />
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-[#d3cec6] p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-[#f5f1ec] transition-colors text-left">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-[#111111] text-white text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#111111] truncate">{user?.name ?? 'User'}</p>
                <p className="text-xs text-[#9c9fa5] truncate">{user?.email ?? ''}</p>
              </div>
              <ChevronDown size={13} className="text-[#9c9fa5]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-[#9c9fa5]">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-sm text-[#c41c1c] focus:text-[#c41c1c] cursor-pointer"
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
  const { isAuthenticated, ability } = useAuth();
  const location = useLocation();

  if (location.pathname === '/login') {
    return <Outlet />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AbilityProvider ability={ability}>
      <LabelsProvider>
        <SidebarProvider>
          <div className="flex min-h-screen w-full bg-[#f5f1ec]">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              {/* Top bar */}
              <header className="h-14 bg-[#f5f1ec] border-b border-[#d3cec6]/60 flex items-center gap-3 px-4 sticky top-0 z-10">
                <SidebarTrigger className="text-[#626260] hover:text-[#111111]" />
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9c9fa5]" />
                  <Input
                    placeholder="Search contacts, companies…"
                    className="pl-8 h-8 bg-white border-[#d3cec6] text-sm placeholder:text-[#9c9fa5] focus-visible:ring-[#d3cec6]"
                  />
                </div>
              </header>
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
    <div className="flex min-h-screen items-center justify-center bg-[#f5f1ec]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-10 h-10 rounded-xl bg-[#111111] items-center justify-center mb-4">
            <span className="text-white font-semibold">M</span>
          </div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight mb-1">
            Welcome back
          </h1>
          <p className="text-sm text-[#626260]">Sign in to your workspace</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#d3cec6] p-8 shadow-none">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="tenant" className="text-sm font-medium text-[#111111]">
                Workspace
              </label>
              <Input
                id="tenant"
                type="text"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                placeholder="your-company"
                className="bg-[#f5f1ec] border-[#d3cec6] placeholder:text-[#9c9fa5] focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-[#111111]">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-[#f5f1ec] border-[#d3cec6] placeholder:text-[#9c9fa5] focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-[#111111]">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#f5f1ec] border-[#d3cec6] focus-visible:ring-[#111111] focus-visible:border-[#111111]"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#111111] hover:bg-[#000000] text-white font-medium rounded-lg h-10 mt-2"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-[#9c9fa5] mt-4">
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
