import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, Link, useLocation } from '@tanstack/react-router';
import { useAuth } from '@/contexts/auth.context';
import { AbilityProvider } from '@/contexts/permissions.context';
import { LabelsProvider } from '@/contexts/labels.context';
import { BranchProvider, useBranch } from '@/contexts/branch.context';
import { useLabels } from '@/hooks/useLabels';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import { CurrencyProvider, useCurrency } from '@/contexts/currency.context';
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
import { TooltipProvider } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/sonner';
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
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Globe,
  Sparkles,
  ArrowRight,
  MessageSquare,
  Search,
  UserCheck,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useCapabilities } from '@/hooks/useCapabilities';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { ThemeToggle } from '@/components/ui/theme-toggle';


/* ------------------------------------------------------------------ */
/*  App Shell Sidebar                                                  */
/* ------------------------------------------------------------------ */

// Helper to generate distinct glowing colors for pipelines in the sidebar
const getPipelineColor = (id: string) => {
  const colors = [
    'bg-emerald-500 shadow-emerald-500/25',
    'bg-blue-500 shadow-blue-500/25',
    'bg-indigo-500 shadow-indigo-500/25',
    'bg-amber-500 shadow-amber-500/25',
    'bg-pink-500 shadow-pink-500/25',
    'bg-violet-500 shadow-violet-500/25',
    'bg-rose-500 shadow-rose-500/25',
    'bg-cyan-500 shadow-cyan-500/25',
  ];
  let sum = 0;
  for (let i = 0; i < id.length; i++) {
    sum += id.charCodeAt(i);
  }
  return colors[sum % colors.length];
};

function BranchSelector() {
  const { selectedBranchId, setSelectedBranchId, branches, isLoading } = useBranch();
  const selectedBranch = branches.find((b: any) => b.id === selectedBranchId);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBranchId(e.target.value);
  }, [setSelectedBranchId]);

  return (
    <div className="relative w-full">
      <select
        value={selectedBranchId}
        onChange={handleChange}
        disabled={isLoading}
        className="flex h-8 w-full rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-2.5 py-1 text-xs font-medium text-sidebar-foreground shadow-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
      >
        <option value="">All Branches</option>
        {branches.map((b: any) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  );
}

function AppSidebar() {
  const { user, ability, logout } = useAuth();
  const location = useLocation();
  const { isEnabled } = useCapabilities();
  const { t } = useLabels();

  const { selectedBranchId, selectedVerticalIds, isLoading: branchLoading } = useBranch();
  const pipelineVerticalIds = selectedBranchId ? selectedVerticalIds : [];
  const hasBranchFilter = !!selectedBranchId && pipelineVerticalIds.length > 0;

  const { data: workflows = [], isLoading: pipelinesLoading } = useQuery({
    queryKey: ['settings', 'pipelines', selectedBranchId || 'all', ...pipelineVerticalIds],
    queryFn: () => settingsApi.pipelines.list(hasBranchFilter ? { vertical_ids: pipelineVerticalIds.join(',') } : undefined),
    enabled: !selectedBranchId || selectedVerticalIds.length > 0,
    staleTime: 10_000,
  });

  const pipelineDropdownLoading = pipelinesLoading || (!!selectedBranchId && selectedVerticalIds.length === 0);

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const mainItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Leads', path: '/leads', icon: UserCheck },
    { label: t('party.plural') ?? 'Contacts', path: '/parties', icon: Users },
    { label: 'Pipeline', path: '/pipeline', icon: Workflow },
    { label: 'Campaigns', path: '/campaigns', icon: Megaphone },
    { label: 'Integrations', path: '/integrations', icon: Link2 },
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
    '/settings/verticals': ['manage', 'Vertical'],
    '/settings/pipelines': ['manage', 'Workflow'],
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
    { label: 'Verticals', path: '/settings/verticals', icon: Layers },
    { label: 'Pipeline Settings', path: '/settings/pipelines', icon: Workflow },
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
    <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="px-4 py-4 border-b border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-fin-orange flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/10">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-primary leading-none tracking-tight">Meta CRM</p>
            <p className="text-[10px] text-sidebar-foreground/70 mt-0.5 font-medium">Workspace Console</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-1 pb-3 bg-sidebar">
        {/* Branch Selector */}
        <SidebarGroup className="pt-0 pb-1">
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] font-bold uppercase tracking-wider px-2 mb-1">
            Branch
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <BranchSelector />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2 bg-sidebar-border/40" />

        {/* Main Section */}
        <SidebarGroup className="pt-0 pb-1">
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] font-bold uppercase tracking-wider px-2 mb-1">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const search = location.search as any;
                const isActive = location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                
                if (item.path === '/pipeline' && workflows.length > 0) {
                  const isSubActive = location.pathname === '/pipeline' || location.pathname === '/cases';
                  return (
                    <DropdownMenu key={item.path}>
                      <SidebarMenuItem>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuButton isActive={isSubActive} tooltip={item.label} className="w-full justify-between pr-2.5">
                            <div className="flex items-center gap-2.5 font-medium">
                              <item.icon size={15} strokeWidth={isSubActive ? 2.5 : 1.75} className={isSubActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/60'} />
                              <span className="text-sm font-medium">{item.label}</span>
                            </div>
                            <ChevronRight size={13} className="text-sidebar-foreground/50 ml-auto" />
                          </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        
                          <DropdownMenuContent side="right" align="start" alignOffset={-6} className="w-56 bg-popover border border-border shadow-md rounded-xl p-1.5 space-y-0.5 animate-in slide-in-from-left-2 duration-150">
                          <DropdownMenuLabel className="text-[10px] text-sidebar-foreground/50 font-bold uppercase tracking-wider px-2.5 py-1.5">
                            Select Pipeline
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-sidebar-border/40 mx-1" />

                          {pipelineDropdownLoading ? (
                            <div className="space-y-1.5 px-2.5 py-2">
                              <div className="h-5 bg-sidebar-accent/50 rounded-md animate-pulse" />
                              <div className="h-5 bg-sidebar-accent/50 rounded-md animate-pulse w-3/4" />
                            </div>
                          ) : workflows.length === 0 ? (
                            <p className="text-xs text-sidebar-foreground/50 px-2.5 py-2 text-center">
                              No pipelines in this branch
                            </p>
                          ) : workflows.map((wf: any) => {
                            const isWfActive = (location.pathname === '/pipeline' || location.pathname === '/cases') && search.pipelineId === wf.id;
                            return (
                              <DropdownMenuItem key={wf.id} asChild className="p-0 focus:bg-transparent">
                                <Link
                                  to="/pipeline"
                                  search={{ pipelineId: wf.id }}
                                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all w-full duration-150 cursor-pointer ${
                                    isWfActive
                                      ? 'text-sidebar-accent-foreground bg-sidebar-accent font-bold'
                                      : 'text-sidebar-foreground/90 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/40'
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 mr-1.5 shadow-sm border border-white/10 ${getPipelineColor(wf.id)}`} />
                                  <span className="truncate flex-1 text-left">{wf.name}</span>
                                </Link>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </SidebarMenuItem>
                    </DropdownMenu>
                  );
                }

                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link
                        to={item.path}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all duration-150 ${
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm border border-sidebar-border/50'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground'
                        }`}
                      >
                        <item.icon size={15} strokeWidth={isActive ? 2.5 : 1.75} className={isActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/60'} />
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings/Configuration Section */}
        {visibleSettingsItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] font-bold uppercase tracking-wider px-2 mb-1">
              Configuration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isSettingsActive}>
                    <Link
                      to="/settings"
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm w-full transition-all duration-150 ${
                        isSettingsActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm border border-sidebar-border/50'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground'
                      }`}
                    >
                      <Settings size={15} strokeWidth={isSettingsActive ? 2.5 : 1.75} className={isSettingsActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/60'} />
                      <span className="flex-1">Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 bg-sidebar">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-xl hover:bg-sidebar-accent/55 transition-colors text-left text-sidebar-foreground cursor-pointer">
              <Avatar className="w-7 h-7 flex-shrink-0">
                <AvatarFallback className="bg-fin-orange text-white text-xs font-semibold shadow-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-sidebar-primary truncate leading-tight">{user?.name ?? 'User'}</p>
                <p className="text-[10px] text-sidebar-foreground/70 truncate mt-0.5">{user?.email ?? ''}</p>
              </div>
              <ChevronDown size={13} className="text-sidebar-foreground/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-popover border-border text-popover-foreground shadow-md">
            <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={logout}
              className="text-sm text-destructive focus:text-destructive focus:bg-accent cursor-pointer"
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

function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-sans">Currency:</span>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as 'USD' | 'INR')}
        className="text-xs font-semibold text-foreground border border-border px-2.5 py-1 rounded-xl bg-muted focus:outline-none focus:ring-1 focus:ring-primary select-none cursor-pointer"
      >
        <option value="INR">₹ INR</option>
        <option value="USD">$ USD</option>
      </select>
    </div>
  );
}

function RootLayout() {
  const { isAuthenticated, ability, isLoading, isImpersonating, logout } = useAuth();
  const location = useLocation();
  const router = useRouter();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-border border-t-[#0f172a] rounded-full animate-spin" />
          Loading…
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
                
                <div className="flex items-center gap-4">
                  {/* Command search launcher trigger */}
                  <button
                    onClick={() => setCommandPaletteOpen(true)}
                    className="relative w-full sm:w-[240px] h-8 bg-muted border border-border hover:bg-accent rounded-xl flex items-center justify-between px-3 text-muted-foreground text-xs font-medium select-none cursor-pointer transition-all"
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
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-[9px] font-bold text-blue-700 uppercase tracking-wider">Sandbox</span>
                    </div>
                  )}

                  <ThemeToggle />

                  {/* Currency Selector */}
                  <CurrencySelector />

                  {/* Tenant Workspace Selector */}
                  <div className="text-xs font-semibold text-foreground border border-border px-2.5 py-1 rounded-xl bg-muted select-none">
                    Workspace: {localStorage.getItem('meta_crm_tenant_name') || 'Workspace'}
                  </div>
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
/*  Login page                                                         */
/* ------------------------------------------------------------------ */

function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tenantSlug, setTenantSlug] = useState('');
  const [showTenantSlug, setShowTenantSlug] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<{ slug: string; name: string }[]>([]);
  const [showSelector, setShowSelector] = useState(false);

  // Load saved email if rememberMe was true
  useEffect(() => {
    const savedEmail = localStorage.getItem('meta_crm_remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  if (isAuthenticated) {
    router.navigate({ to: '/' });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem('meta_crm_remember_email', email);
      } else {
        localStorage.removeItem('meta_crm_remember_email');
      }
      
      const slug = showTenantSlug && tenantSlug.trim() ? tenantSlug.trim() : undefined;
      const res = await login(email, password, slug);
      if ('multiple_workspaces' in res && res.multiple_workspaces) {
        setWorkspaces(res.workspaces);
        setShowSelector(true);
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'INVALID_CREDENTIALS') {
          setError('Invalid email or password. Please check your credentials.');
        } else if (err.message === 'TENANT_NOT_FOUND') {
          setError('The requested workspace slug could not be found.');
        } else if (err.message === 'ACCOUNT_SUSPENDED') {
          setError('This workspace or account is currently suspended.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Login failed. Please verify your connection and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectWorkspace = async (slug: string) => {
    setError('');
    setIsLoading(true);
    const ws = workspaces.find((w) => w.slug === slug);
    if (ws) localStorage.setItem('meta_crm_tenant_name', ws.name);
    try {
      await login(email, password, slug);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'INVALID_CREDENTIALS') {
          setError('Invalid email or password. Please check your credentials.');
        } else if (err.message === 'TENANT_NOT_FOUND') {
          setError('The requested workspace slug could not be found.');
        } else if (err.message === 'ACCOUNT_SUSPENDED') {
          setError('This workspace or account is currently suspended.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Login failed. Please verify your connection and try again.');
      }
      setShowSelector(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loginStyles = `
    @keyframes float-y-1 {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(-12px) rotate(0.5deg); }
    }
    @keyframes float-y-2 {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(8px) rotate(-0.5deg); }
    }
    @keyframes pulse-glow-slow {
      0%, 100% { opacity: 0.3; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.03); }
    }
    .animate-float-1 {
      animation: float-y-1 6s ease-in-out infinite;
    }
    .animate-float-2 {
      animation: float-y-2 7s ease-in-out infinite;
    }
    .animate-pulse-glow {
      animation: pulse-glow-slow 5s ease-in-out infinite;
    }
  `;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground select-none font-sans">
      <div className="grid w-full lg:grid-cols-2">
        {/* Left Column: Form Panel */}
        <div className="flex min-h-screen flex-col justify-between px-6 py-6 sm:px-10 lg:max-w-lg">
          {/* Logo Branding */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
              <span className="text-white font-bold text-base">M</span>
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-foreground block">Meta CRM</span>
              <span className="text-xs text-muted-foreground font-medium">Workspace access</span>
            </div>
          </div>
 
          {/* Form Container (Enclosed in a beautiful white card with hairline border) */}
          <div className="my-auto max-w-sm w-full mx-auto">
            {!showSelector ? (
              <>
                <div className="mb-6">
                  <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                    Sign in
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1.5 font-normal leading-relaxed">
                    Access leads, follow-ups, customers, and pipeline work for your workspace.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200/40 p-3 text-xs text-rose-700 font-medium flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-xs font-semibold text-foreground block">
                      Email or Phone Number
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                      </span>
                      <Input
                        id="email"
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com or +1 555-0199"
                        className="bg-card border-border pl-9 h-10 rounded-md text-sm text-foreground"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="password" className="text-xs font-semibold text-foreground block">
                      Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-card border-border pl-9 pr-9 h-10 rounded-md text-sm text-foreground"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Workspace ID Option */}
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowTenantSlug(!showTenantSlug)}
                      className="text-xs font-semibold text-primary hover:underline transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {showTenantSlug ? 'Use default workspace' : 'Log into specific workspace'}
                    </button>
                    
                    {showTenantSlug && (
                      <div className="mt-2 space-y-1 transition-all">
                        <label htmlFor="tenantSlug" className="text-xs font-medium text-muted-foreground block">
                          Workspace slug
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                            <Building2 className="w-3.5 h-3.5" />
                          </span>
                          <Input
                            id="tenantSlug"
                            type="text"
                            value={tenantSlug}
                            onChange={(e) => setTenantSlug(e.target.value)}
                            placeholder="acme-corp"
                            className="bg-card border-border pl-9 h-9 rounded-md text-sm text-foreground"
                            required={showTenantSlug}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <input
                      id="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 border-border rounded accent-primary cursor-pointer"
                    />
                    <label htmlFor="remember-me" className="text-xs text-muted-foreground font-medium cursor-pointer select-none">
                      Remember my email
                    </label>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full font-semibold rounded-md h-10 mt-2 flex items-center justify-center gap-1.5 cursor-pointer text-sm"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-4">
                <div className="mb-6">
                  <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                    Select workspace
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1.5 font-normal leading-relaxed">
                    Choose which company workspace you would like to access.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200/40 p-3 text-xs text-rose-700 font-medium flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {workspaces.map((workspace) => (
                    <button
                      key={workspace.slug}
                      type="button"
                      onClick={() => handleSelectWorkspace(workspace.slug)}
                      disabled={isLoading}
                      className="w-full text-left p-3.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-all flex items-center justify-between group cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform flex-shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-foreground block leading-tight truncate">
                            {workspace.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium block truncate mt-0.5">
                            {workspace.slug}.crm.com
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSelector(false);
                      setError('');
                    }}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    ← Back to login
                  </button>
                </div>
              </div>
            )}
          </div>
 
          {/* Flat, Clean Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-4">
            <span className="font-medium">Meta CRM</span>
            <span>Secure workspace session</span>
          </div>
        </div>
 
        {/* Right Column: Visual Showcase Panel (Premium warm canvas with crisp mockup cards) */}
        <div className="hidden lg:flex lg:flex-col lg:justify-between lg:px-10 lg:py-6 bg-[#faf8f5]">
          {/* Quiet branding top bar */}
          <div className="relative z-10 flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#ff5600] flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Inbox & Operations Live Console</span>
          </div>
 
          {/* Editorial mockups without float/neon animations */}
          <div className="relative z-10 my-auto max-w-md w-full mx-auto space-y-6">
            <div className="space-y-2 text-center lg:text-left mb-6">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground leading-tight">
                Designed to let your product be the protagonist.
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                A clean, warm-cream ground and modest hairline frames. No SaaS noise, just editorial clarity.
              </p>
            </div>
 
            {/* Crisp Inbox Mockup Card */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#ebe7e1]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#0bdf50]" />
                  <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Customer Helpdesk Desk</span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#ff5600]/10 border border-[#ff5600]/20 text-[9px] font-bold text-[#ff5600] uppercase tracking-wider">
                  Fin AI Agent Active
                </span>
              </div>
 
              <div className="space-y-3">
                {/* Mock Row 1 */}
                <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#ebe7e1]/20 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-[#ff5600] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    KM
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground truncate">Karan Malhotra</p>
                      <span className="text-[9px] text-[#9c9fa5]">2m ago</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">Interested in unit A-402, auto-routed to Mumbai Desk.</p>
                  </div>
                </div>
 
                {/* Mock Row 2 */}
                <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#ebe7e1]/20 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-[#65b5ff] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    AS
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground truncate">Aarav Sharma</p>
                      <span className="text-[9px] text-[#9c9fa5]">18m ago</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">Token payment of ₹50,000 received via Razorpay.</p>
                  </div>
                </div>
              </div>
            </div>
 
            {/* Crisp Stats Mockup Card */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
              <div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Campaign Outreach</span>
                <span className="text-xl font-bold text-foreground block mt-0.5">₹48.6 Lakhs</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-[9px] text-[#0bdf50] font-semibold block">72% Completed</span>
                  <span className="text-[9px] text-muted-foreground block">Direct visits</span>
                </div>
                <div className="w-12 h-1.5 bg-[#ebe7e1] rounded-full overflow-hidden">
                  <div className="h-full bg-[#111111] rounded-full" style={{ width: '72%' }} />
                </div>
              </div>
            </div>
          </div>
 
          {/* Fine Print Footer */}
          <div className="relative z-10 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Active Instance: ap-south-1</span>
            <span>Vault Encrypted</span>
          </div>
        </div>
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
/*  Impersonation handshake landing page                              */
/* ------------------------------------------------------------------ */

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

import { appointmentsRoute } from './routes/appointments';
import { billingRoute } from './routes/billing';
import { propertiesRoute } from './routes/properties';
import { ordersRoute } from './routes/orders';
import { onboardingsRoute } from './routes/onboardings';
import { campaignsRoute } from './routes/campaigns';
import { leadsRoute, leadDetailRoute } from './routes/leads';
import { pipelineRoute } from './routes/pipeline';
import { integrationsRoute } from './routes/integrations';

/* ------------------------------------------------------------------ */
/*  Route tree + router                                                */
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
  campaignsRoute,
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
