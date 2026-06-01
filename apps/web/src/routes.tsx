import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useRouter, Link, useLocation } from '@tanstack/react-router';
import { useAuth } from '@/contexts/auth.context';
import { AbilityProvider } from '@/contexts/permissions.context';
import { LabelsProvider } from '@/contexts/labels.context';
import { useLabels } from '@/hooks/useLabels';
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
  Eye,
  EyeOff,
  Lock,
  Mail,
  Globe,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  Check,
  Search,
  UserCheck,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
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
  const { t } = useLabels();

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const mainItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Leads', path: '/leads', icon: UserCheck },
    { label: t('party.plural') ?? 'Contacts', path: '/parties', icon: Users },
    { label: t('case.plural') ?? 'Cases', path: '/cases', icon: Workflow },
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
    '/settings/industry': ['manage', 'FieldDefinition'],
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
    { label: 'Industry Vertical', path: '/settings/industry', icon: Globe },
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
    <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="px-4 py-4 border-b border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-fin-orange flex items-center justify-center flex-shrink-0 shadow-sm shadow-orange-500/20">
            <span className="text-white text-xs font-bold font-mono">M</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-primary leading-none tracking-tight">Meta CRM</p>
            <p className="text-[10px] text-sidebar-foreground/70 mt-0.5 font-medium">Workspace Console</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 bg-sidebar">
        {/* Main Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] font-bold uppercase tracking-wider px-2 mb-1">
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
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs border border-sidebar-border/60'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground'
                        }`}
                      >
                        <item.icon size={15} strokeWidth={isActive ? 2 : 1.75} className={isActive ? 'text-fin-orange' : 'text-sidebar-foreground/60'} />
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2 bg-sidebar-border/40" />

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
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm w-full transition-all duration-150 ${
                        isSettingsActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs border border-sidebar-border/60'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground'
                      }`}
                    >
                      <Settings size={15} strokeWidth={isSettingsActive ? 2 : 1.75} className={isSettingsActive ? 'text-fin-orange' : 'text-sidebar-foreground/60'} />
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
            <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-sidebar-accent/55 transition-colors text-left text-sidebar-foreground cursor-pointer">
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
        className="text-xs font-semibold text-foreground border border-border px-2.5 py-1 rounded-lg bg-card focus:outline-none focus:ring-1 focus:ring-primary select-none shadow-xs cursor-pointer"
      >
        <option value="INR">₹ INR</option>
        <option value="USD">$ USD</option>
      </select>
    </div>
  );
}

function RootLayout() {
  const { isAuthenticated, ability, isLoading } = useAuth();
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
    <AbilityProvider ability={ability}>
      <CurrencyProvider>
        <LabelsProvider>
          <SidebarProvider>
            <div className="flex min-h-screen w-full bg-background text-foreground">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              {/* Top bar */}
              <header className="h-14 bg-background border-b border-border flex items-center justify-between px-4 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                  <Separator orientation="vertical" className="h-4 bg-border" />
                  <Breadcrumbs />
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Command search launcher trigger */}
                  <button
                    onClick={() => setCommandPaletteOpen(true)}
                    className="relative w-full sm:w-[240px] h-8 bg-card border border-border hover:border-border/80 rounded-lg flex items-center justify-between px-3 text-muted-foreground text-xs font-medium select-none cursor-pointer transition-all shadow-xs"
                  >
                    <span className="flex items-center gap-2">
                      <Search size={13} className="text-muted-foreground" />
                      Search console...
                    </span>
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[9px] font-bold text-muted-foreground leading-none">
                      <span>⌘</span>K
                    </kbd>
                  </button>

                  {/* Sandbox Environment Badge */}
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/25 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider font-mono">Sandbox</span>
                  </div>

                  {/* Currency Selector */}
                  <CurrencySelector />

                  {/* Tenant Workspace Selector */}
                  <div className="text-xs font-semibold text-foreground border border-border px-2.5 py-1 rounded-lg bg-card select-none shadow-xs">
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
      </CurrencyProvider>
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
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tenantSlug, setTenantSlug] = useState('');
  const [showTenantSlug, setShowTenantSlug] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="flex min-h-screen w-full bg-[#f5f1ec] text-foreground select-none font-sans">
      <div className="grid w-full lg:grid-cols-12">
        {/* Left Column: Form Panel */}
        <div className="lg:col-span-5 flex flex-col justify-between p-8 sm:p-12 bg-[#f5f1ec]">
          {/* Logo Branding */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#ff5600] shadow-sm shadow-orange-500/10">
              <span className="text-white font-bold text-base">M</span>
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-foreground block">Meta CRM</span>
              <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Workspace Portal</span>
            </div>
          </div>
 
          {/* Form Container (Enclosed in a beautiful white card with hairline border) */}
          <div className="my-auto max-w-sm w-full mx-auto bg-card border border-border rounded-xl p-6 sm:p-8 shadow-sm">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                Sign in to workspace
              </h1>
              <p className="text-xs text-muted-foreground mt-1.5 font-normal leading-relaxed">
                Enter your credentials to access your CRM console and campaigns.
              </p>
            </div>
 
            {error && (
              <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200/40 p-3 text-xs text-rose-700 font-medium flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1 shrink-0" />
                <p>{error}</p>
              </div>
            )}
 
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="email" className="text-[10px] font-semibold text-foreground uppercase tracking-wider block">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" />
                  </span>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="bg-card border-border pl-9 placeholder:text-[#9c9fa5] focus-visible:ring-[#111111] focus-visible:border-[#111111] h-10 rounded-md text-sm text-foreground"
                    required
                  />
                </div>
              </div>
 
              <div className="space-y-1">
                <label htmlFor="password" className="text-[10px] font-semibold text-foreground uppercase tracking-wider block">
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
                    className="bg-card border-border pl-9 pr-9 focus-visible:ring-[#111111] focus-visible:border-[#111111] h-10 rounded-md text-sm text-foreground"
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
                  className="text-xs font-semibold text-[#ff5600] hover:underline transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {showTenantSlug ? 'Use default workspace' : 'Log into specific workspace'}
                </button>
                
                {showTenantSlug && (
                  <div className="mt-2 space-y-1 transition-all">
                    <label htmlFor="tenantSlug" className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Workspace Domain / Slug
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
                        className="bg-card border-border pl-9 focus-visible:ring-[#111111] focus-visible:border-[#111111] h-9 rounded-md text-xs text-foreground"
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
                  className="w-3.5 h-3.5 border-border rounded accent-[#111111] cursor-pointer"
                />
                <label htmlFor="remember-me" className="text-xs text-muted-foreground font-medium cursor-pointer select-none">
                  Remember my email
                </label>
              </div>
 
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#111111] hover:bg-[#000000] text-white font-semibold rounded-md h-10 mt-2 hover:scale-[1.005] active:scale-[0.995] transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in to workspace
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </form>
          </div>
 
          {/* Flat, Clean Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-4">
            <span className="font-medium">Meta CRM Suite</span>
            <span>Secured Session</span>
          </div>
        </div>
 
        {/* Right Column: Visual Showcase Panel (Premium warm canvas with crisp mockup cards) */}
        <div className="hidden lg:col-span-7 lg:flex relative overflow-hidden bg-[#ebe7e1] flex-col justify-between p-12 border-l border-border select-none">
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
  settingsIndustryRoute,
} from './routes/settings';

import { appointmentsRoute } from './routes/appointments';
import { billingRoute } from './routes/billing';
import { propertiesRoute } from './routes/properties';
import { ordersRoute } from './routes/orders';
import { onboardingsRoute } from './routes/onboardings';
import { campaignsRoute } from './routes/campaigns';
import { leadsRoute } from './routes/leads';

/* ------------------------------------------------------------------ */
/*  Route tree + router                                                */
/* ------------------------------------------------------------------ */

export const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  partiesRoute,
  leadsRoute,
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
  settingsIndustryRoute,
]);

export const router = createRouter({ routeTree });
