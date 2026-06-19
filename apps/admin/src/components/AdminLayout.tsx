import { type ReactNode, useState } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { Link, useLocation } from '@tanstack/react-router';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2,
  CreditCard,
  Puzzle,
  BarChart3,
  Users,
  Activity,
  ChevronDown,
  LogOut,
  Shield,
  LayoutDashboard,
  History,
  Search,
  X,
  DollarSign,
} from 'lucide-react';
import { CommandPalette } from './shared/CommandPalette';
import { SupportImpersonationBanner } from './shared/SupportImpersonationBanner';
import { Toaster } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Nav items                                                          */
/* ------------------------------------------------------------------ */

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  requiredPermission?: [string, string];
  badge?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Tenants', path: '/admin/tenants', icon: Building2, requiredPermission: ['read', 'PlatformTenant'] },
  { label: 'Plans', path: '/admin/plans', icon: CreditCard, requiredPermission: ['read', 'PlatformPlan'] },
  { label: 'Plugins', path: '/admin/plugins', icon: Puzzle, requiredPermission: ['read', 'PlatformPlugin'] },
  { label: 'Reports', path: '/admin/reports', icon: BarChart3, requiredPermission: ['read', 'PlatformReport'] },
  { label: 'Platform Team', path: '/admin/users', icon: Users, requiredPermission: ['read', 'PlatformUser'] },
  { label: 'System Health', path: '/admin/health', icon: Activity, requiredPermission: ['read', 'SystemHealth'] },
  { label: 'Billing', path: '/admin/billing', icon: CreditCard, requiredPermission: ['read', 'Billing'] },
  { label: 'Capability Pricing', path: '/admin/capabilities/pricing', icon: DollarSign, requiredPermission: ['read', 'Billing'] },
  { label: 'Audit Trail', path: '/admin/audit', icon: History, requiredPermission: ['read', 'PlatformReport'] },
];

/* ------------------------------------------------------------------ */
/*  AdminLayout                                                        */
/* ------------------------------------------------------------------ */

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, ability, logout } = useAuth();
  const location = useLocation();
  const [quickFind, setQuickFind] = useState('');
  const [cmdkOpen, setCmdkOpen] = useState(false);

  if (!user || !ability) return null;

  const visibleItems = navItems.filter((item) => {
    if (!item.requiredPermission) return true;
    return ability.can(item.requiredPermission[0] as any, item.requiredPermission[1] as any);
  });

  const filteredVisibleItems = visibleItems.filter((item) =>
    item.label.toLowerCase().includes(quickFind.toLowerCase())
  );

  const initials = user.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'AD';

  const currentLabel = visibleItems.find((item) =>
    item.path === location.pathname ||
    (item.path !== '/' && location.pathname.startsWith(item.path))
  )?.label ?? 'Dashboard';

  const getEnvDetails = () => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    if (host === 'localhost' || host === '127.0.0.1') {
      return { label: 'Sandbox Env', style: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
    }
    if (host.includes('staging')) {
      return { label: 'Staging Env', style: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
    }
    return { label: 'Production Env', style: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' };
  };

  const env = getEnvDetails();

  return (
    <SidebarProvider>
      <div className="flex flex-col w-full min-h-screen">
        {/* Persistent Support Impersonation Header */}
        <SupportImpersonationBanner />

        <div className="flex-1 flex min-h-screen w-full bg-background text-foreground">
          {/* Sidebar */}
          <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <SidebarHeader className="px-4 py-4 border-b border-sidebar-border bg-sidebar">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-fin-orange flex items-center justify-center flex-shrink-0 shadow-sm shadow-orange-500/10">
                  <Shield size={14} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-sidebar-primary leading-none tracking-tight">Meta CRM</p>
                  <p className="text-[10px] text-sidebar-foreground/75 mt-0.5 font-medium">Admin Console</p>
                </div>
              </div>
            </SidebarHeader>
 
            <SidebarContent className="px-2 py-3 bg-sidebar">
              {/* Command Palette Trigger & Search */}
              <div className="px-2 mb-4">
                <button
                  type="button"
                  onClick={() => setCmdkOpen(true)}
                  className="flex items-center justify-between w-full bg-muted hover:bg-accent border border-border rounded-xl px-3 py-2 transition-colors cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-2">
                    <Search size={12} className="text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                    <span className="text-muted-foreground group-hover:text-foreground text-xs font-medium py-0.5">Quick Search...</span>
                  </div>
                  <kbd className="flex items-center gap-0.5 bg-muted border border-border rounded-md px-1.5 py-0.5 text-[9px] text-muted-foreground font-semibold tracking-wider">
                    <span>Ctrl</span>
                    <span>K</span>
                  </kbd>
                </button>
              </div>
 
              {/* Sidebar Quick Find (Fallback Sidebar Filter) */}
              <div className="px-2 mb-4">
                <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-2.5 py-1">
                  <Search size={12} className="text-muted-foreground flex-shrink-0" />
                  <input 
                    type="text" 
                    placeholder="Filter menu..." 
                    value={quickFind}
                    onChange={e => setQuickFind(e.target.value)}
                    className="bg-transparent border-none outline-none text-foreground text-xs w-full placeholder:text-muted-foreground py-0.5"
                  />
                  {quickFind && (
                    <button onClick={() => setQuickFind('')} className="text-muted-foreground hover:text-foreground">
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>
 
              <SidebarGroup>
                <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] font-bold uppercase tracking-wider px-2 mb-1">
                  Platform
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredVisibleItems.map((item) => {
                      const isActive =
                        location.pathname === item.path ||
                        (item.path !== '/' && location.pathname.startsWith(item.path));
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
                              <item.icon size={15} strokeWidth={isActive ? 2.5 : 1.75} className={isActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/65'} />
                              <span className="flex-1">{item.label}</span>
                              {item.badge && (
                                <Badge className="bg-fin-orange text-white text-[10px] px-1.5 py-0 rounded-md border-0">
                                  {item.badge}
                                </Badge>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
 
            <SidebarFooter className="border-t border-sidebar-border p-3 bg-sidebar">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-sidebar-accent/55 transition-colors text-left group cursor-pointer text-sidebar-foreground">
                    <Avatar className="w-7 h-7 flex-shrink-0">
                      <AvatarFallback className="bg-fin-orange text-white text-xs font-semibold shadow-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-sidebar-primary truncate transition-colors">{user.email}</p>
                      <p className="text-[10px] text-sidebar-foreground/70 truncate">{user.platform_role}</p>
                    </div>
                    <ChevronDown size={12} className="text-sidebar-foreground/60 flex-shrink-0 transition-colors" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-popover border-border text-popover-foreground">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Admin Account</DropdownMenuLabel>
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

          {/* Main content area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top bar */}
            <header className="h-14 bg-background border-b border-border/60 flex items-center gap-3 px-6 sticky top-0 z-10">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <Separator orientation="vertical" className="h-4 bg-border" />
              <h2 className="text-sm font-semibold text-foreground tracking-tight">{currentLabel}</h2>
 
              {/* Environment Indicator Badge */}
              <div className="ml-auto flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${env.style} shadow-sm`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${env.dot} animate-pulse`} />
                  <span>{env.label}</span>
                </div>
              </div>
            </header>

            {/* Page content */}
            <main className="flex-1 p-8 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </div>
      
      {/* Cmdk Palette & Toaster Notifications */}
      <CommandPalette open={cmdkOpen} onOpenChange={setCmdkOpen} />
      <Toaster position="top-right" richColors />
    </SidebarProvider>
  );
}
