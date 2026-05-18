import { type ReactNode } from 'react';
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
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Nav items                                                          */
/* ------------------------------------------------------------------ */

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
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
];

/* ------------------------------------------------------------------ */
/*  AdminLayout                                                        */
/* ------------------------------------------------------------------ */

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, ability, logout } = useAuth();
  const location = useLocation();

  if (!user || !ability) return null;

  const visibleItems = navItems.filter((item) => {
    if (!item.requiredPermission) return true;
    return ability.can(item.requiredPermission[0] as any, item.requiredPermission[1] as any);
  });

  const initials = user.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'AD';

  const currentLabel = visibleItems.find((item) =>
    item.path === location.pathname ||
    (item.path !== '/' && location.pathname.startsWith(item.path))
  )?.label ?? 'Dashboard';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#f5f1ec]">
        {/* Sidebar */}
        <Sidebar className="border-r border-[#d3cec6] bg-[#ebe7e1]">
          <SidebarHeader className="px-4 py-4 border-b border-[#d3cec6]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-[#111111] flex items-center justify-center flex-shrink-0">
                <Shield size={14} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#111111] leading-none">Meta CRM</p>
                <p className="text-[10px] text-[#9c9fa5] mt-0.5">Admin Console</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-[#9c9fa5] text-[10px] font-semibold uppercase tracking-wider px-2 mb-1">
                Platform
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const isActive =
                      location.pathname === item.path ||
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
                            <span className="flex-1">{item.label}</span>
                            {item.badge && (
                              <Badge className="bg-[#ff5600] text-white text-[10px] px-1.5 py-0 rounded-md border-0">
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

          <SidebarFooter className="border-t border-[#d3cec6] p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-[#f5f1ec] transition-colors text-left">
                  <Avatar className="w-7 h-7 flex-shrink-0">
                    <AvatarFallback className="bg-[#111111] text-white text-xs font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#111111] truncate">{user.email}</p>
                    <p className="text-[10px] text-[#9c9fa5] truncate">{user.platform_role}</p>
                  </div>
                  <ChevronDown size={12} className="text-[#9c9fa5] flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs text-[#9c9fa5]">Admin Account</DropdownMenuLabel>
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

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-14 bg-[#f5f1ec] border-b border-[#d3cec6]/60 flex items-center gap-3 px-4 sticky top-0 z-10">
            <SidebarTrigger className="text-[#626260] hover:text-[#111111]" />
            <Separator orientation="vertical" className="h-4 bg-[#d3cec6]" />
            <h2 className="text-sm font-medium text-[#111111]">{currentLabel}</h2>
          </header>

          {/* Page content */}
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
