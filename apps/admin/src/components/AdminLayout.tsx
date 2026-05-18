import { type ReactNode } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { Link, useLocation } from '@tanstack/react-router';

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  requiredPermission?: [string, string];
}

function TenantIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2" />
      <path d="M18 11v-2a2 2 0 0 0-2-2h-2" />
      <path d="M22 15v-2a2 2 0 0 0-2-2h-2" />
    </svg>
  );
}

function PluginIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2" />
      <path d="M18 11v-2a2 2 0 0 0-2-2h-2" />
      <path d="M22 15v-2a2 2 0 0 0-2-2h-2" />
    </svg>
  );
}

function HealthIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, ability, logout } = useAuth();
  const location = useLocation();

  if (!user || !ability) return null;

  const navItems: NavItem[] = [
    { label: 'Tenants', path: '/admin/tenants', icon: <TenantIcon />, requiredPermission: ['read', 'PlatformTenant'] },
    { label: 'Plans', path: '/admin/plans', icon: <PlanIcon />, requiredPermission: ['read', 'PlatformPlan'] },
    { label: 'Plugins', path: '/admin/plugins', icon: <PluginIcon />, requiredPermission: ['read', 'PlatformPlugin'] },
    { label: 'Reports', path: '/admin/reports', icon: <ReportIcon />, requiredPermission: ['read', 'PlatformReport'] },
    { label: 'Users', path: '/admin/users', icon: <UserIcon />, requiredPermission: ['read', 'PlatformUser'] },
    { label: 'System Health', path: '/admin/health', icon: <HealthIcon />, requiredPermission: ['read', 'SystemHealth'] },
    { label: 'Billing', path: '/admin/billing', icon: <BillingIcon />, requiredPermission: ['read', 'Billing'] },
  ];

  const visibleItems = navItems.filter((item) => {
    if (!item.requiredPermission) return true;
    return ability.can(item.requiredPermission[0] as any, item.requiredPermission[1] as any);
  });

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-gray-900 text-white">
        <div className="flex h-16 items-center border-b border-gray-700 px-6">
          <h1 className="text-lg font-bold">Meta CRM Admin</h1>
        </div>
        <nav className="mt-4 space-y-1 px-3">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 rounded px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-64 border-t border-gray-700 p-4">
          <div className="mb-2 text-sm text-gray-400">{user.email}</div>
          <div className="mb-3 text-xs text-gray-500">{user.platform_role}</div>
          <button
            onClick={logout}
            className="w-full rounded bg-red-600 px-3 py-2 text-sm hover:bg-red-700"
          >
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
          <h2 className="text-xl font-semibold">
            {visibleItems.find((item) => item.path === location.pathname)?.label ?? 'Dashboard'}
          </h2>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
