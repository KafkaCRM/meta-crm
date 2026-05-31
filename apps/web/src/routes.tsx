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
    <div className="flex min-h-screen w-full bg-white select-none">
      <style dangerouslySetInnerHTML={{ __html: loginStyles }} />
      
      <div className="grid w-full lg:grid-cols-12">
        {/* Left Column: Form Panel */}
        <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-10 md:p-14 bg-slate-50/50">
          {/* Logo Branding */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-md shadow-indigo-500/25">
              <span className="text-white font-bold font-mono text-lg">M</span>
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight block">Meta CRM</span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Workspace Portal</span>
            </div>
          </div>

          {/* Form Container */}
          <div className="my-auto max-w-sm w-full mx-auto py-10">
            <div className="mb-8">
              <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">
                Welcome back
              </h1>
              <p className="text-sm text-slate-500 mt-2 font-medium">
                Sign in to manage your customer relations and campaigns.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl bg-rose-50/70 border border-rose-200/50 p-4 text-sm text-rose-700 font-medium flex items-start gap-2.5 animate-fadeIn">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="bg-white border-slate-200 pl-10 placeholder:text-slate-400 focus-visible:ring-indigo-600 focus-visible:border-indigo-600 h-11 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-white border-slate-200 pl-10 pr-10 focus-visible:ring-indigo-600 focus-visible:border-indigo-600 h-11 rounded-lg"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Workspace ID Selector Toggle */}
              <div className="pt-1.5">
                <button
                  type="button"
                  onClick={() => setShowTenantSlug(!showTenantSlug)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {showTenantSlug ? 'Hide workspace ID option' : 'Log into specific workspace ID'}
                </button>
                
                {showTenantSlug && (
                  <div className="mt-2.5 space-y-1.5 transition-all duration-300">
                    <label htmlFor="tenantSlug" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Workspace ID / Slug
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </span>
                      <Input
                        id="tenantSlug"
                        type="text"
                        value={tenantSlug}
                        onChange={(e) => setTenantSlug(e.target.value)}
                        placeholder="my-company"
                        className="bg-white border-slate-200 pl-10 focus-visible:ring-indigo-600 focus-visible:border-indigo-600 h-10 rounded-lg text-sm"
                        required={showTenantSlug}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="remember-me" className="text-xs font-medium text-slate-600 cursor-pointer select-none">
                  Remember this email
                </label>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg h-11 mt-3 shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Localized Footer */}
          <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-200/60 pt-4">
            <span className="flex items-center gap-1">
              <span className="text-slate-600 font-medium">🇮🇳 Localized</span> for Indian SMEs
            </span>
            <span>Secure Vault active</span>
          </div>
        </div>

        {/* Right Column: Visual Showcase Panel */}
        <div className="hidden lg:col-span-7 lg:flex relative overflow-hidden bg-[#060814] flex-col justify-between p-12 text-white border-l border-slate-900 select-none">
          {/* Background patterns */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(79,70,229,0.18)_0%,rgba(139,92,246,0.06)_50%,transparent_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px]" />
          
          {/* Decorative Orbs */}
          <div className="absolute top-1/4 -right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] animate-pulse-glow" />
          <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-violet-600/10 rounded-full blur-[90px] animate-pulse-glow" style={{ animationDelay: '2s' }} />

          {/* Header Info */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 backdrop-blur-md border border-white/20">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">System Status Console</span>
          </div>

          {/* Showcase Cards Container */}
          <div className="relative z-10 my-auto flex flex-col gap-6 max-w-md mx-auto w-full">
            
            {/* Pipeline Card */}
            <div className="bg-slate-950/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl shadow-indigo-950/20 animate-float-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Leads Pipeline Overview</span>
                </div>
                <span className="text-xs font-bold text-indigo-400 tracking-tight">₹48.6 Lakhs active</span>
              </div>
              
              <div className="space-y-3.5">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Direct Site Visits</span>
                    <span className="font-semibold text-slate-200">72% completed</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" style={{ width: '72%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>WhatsApp Nurturing Campaigns</span>
                    <span className="font-semibold text-slate-200">48% running</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full" style={{ width: '48%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Activity Feed Card */}
            <div className="bg-slate-950/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl shadow-indigo-950/20 animate-float-2">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Live Activity Feed</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-extrabold text-emerald-400 uppercase tracking-wider">
                  Live Stream
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3 text-xs">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-200">IndiaMART Lead: Karan Malhotra</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">Interested in unit A-402, auto-routed round-robin to Mumbai Desk.</p>
                  </div>
                </div>

                <div className="flex gap-3 text-xs">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-200">Token Amount Confirmed</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">₹50,000 received via Razorpay webhook from user "Aarav Sharma".</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="relative z-10 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400 animate-spin" style={{ animationDuration: '8s' }} />
              <span>Active Node: ap-south-1 (Mumbai)</span>
            </div>
            <span>AES-256 encrypted</span>
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
