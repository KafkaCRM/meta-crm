import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  Shield,
  Workflow,
  Settings2,
  Type,
  Puzzle,
  Plug,
  Layers,
  Link2,
  GitBranch,
  Sliders,
  Tags,
  UserCog,
  ChevronRight,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Settings nav structure                                             */
/* ------------------------------------------------------------------ */

interface SettingsNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  permission?: [string, string];
}

interface SettingsNavSection {
  group: string;
  items: SettingsNavItem[];
}

const NAV: SettingsNavSection[] = [
  {
    group: 'Organisation',
    items: [
      { id: 'branches', label: 'Branches', icon: GitBranch, permission: ['manage', 'Branch'] },
      { id: 'brands', label: 'Brands', icon: Building2, permission: ['manage', 'Brand'] },
      { id: 'assignments', label: 'Assignments', icon: UserCog, permission: ['manage', 'Branch'] },
    ],
  },
  {
    group: 'People',
    items: [
      { id: 'users', label: 'Users', icon: Users, permission: ['manage', 'User'] },
      { id: 'roles', label: 'Roles & Permissions', icon: Shield, permission: ['manage', 'Role'] },
    ],
  },
  {
    group: 'CRM',
    items: [
      { id: 'workflows', label: 'Workflows', icon: Workflow, permission: ['manage', 'Workflow'] },
      { id: 'fields', label: 'Custom Fields', icon: Sliders, permission: ['manage', 'FieldDefinition'] },
      { id: 'labels', label: 'Labels', icon: Tags, permission: ['manage', 'LabelOverride'] },
    ],
  },
  {
    group: 'Extensions',
    items: [
      { id: 'capabilities', label: 'Capabilities', icon: Layers, permission: ['manage', 'Plugin'] },
      { id: 'plugins', label: 'Plugins', icon: Puzzle, permission: ['manage', 'Plugin'] },
      { id: 'integrations', label: 'Integrations', icon: Link2, permission: ['manage', 'Integration'] },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Settings Layout                                                    */
/* ------------------------------------------------------------------ */

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const { can } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = location.pathname;

  const navigateTo = useCallback(
    (pageId: string) => {
      navigate({ to: `/settings/${pageId}`, replace: true });
    },
    [navigate],
  );

  // Calculate all visible items the user can read or manage
  const allVisibleItems = NAV.flatMap((section) =>
    section.items.filter(
      (item) =>
        !item.permission ||
        can(item.permission[0] as any, item.permission[1] as any) ||
        can('read' as any, item.permission[1] as any),
    ),
  );

  const subPageMatch = currentPath.match(/\/settings\/([^/]+)/);
  const currentSubPageId = subPageMatch ? subPageMatch[1] : null;

  useEffect(() => {
    const firstItem = allVisibleItems[0];
    if (firstItem && allVisibleItems.length > 0) {
      if (currentPath === '/settings' || currentPath === '/settings/') {
        navigate({ to: `/settings/${firstItem.id}`, replace: true });
        return;
      }
      if (currentSubPageId) {
        const isAuthorized = allVisibleItems.some((item) => item.id === currentSubPageId);
        if (!isAuthorized) {
          navigate({ to: `/settings/${firstItem.id}`, replace: true });
        }
      }
    }
  }, [currentPath, currentSubPageId, allVisibleItems, navigate]);

  if (allVisibleItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] p-6 bg-[#f8fafc]">
        <div className="w-full max-w-md p-8 bg-white border border-[#e2e8f0] rounded-2xl shadow-sm text-center space-y-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-[#0f172a] tracking-tight font-sans">Access Denied</h1>
            <p className="text-sm text-[#64748b] leading-relaxed">
              Your account does not have permissions to manage or view the configuration settings for this tenant.
            </p>
          </div>
          <Button
            onClick={() => navigate({ to: '/' })}
            className="w-full bg-[#0f172a] hover:bg-[#1e293b] text-white font-medium rounded-lg h-10 transition-colors"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-56px)] max-w-[1280px] gap-8">
      {/* Settings Navigation Sidebar */}
      <aside className="w-52 flex-shrink-0 border-r border-[#e2e8f0]/60 pr-6 py-2 overflow-auto hidden md:block">
        <nav className="space-y-5">
          {NAV.map((section) => {
            const visibleItems = section.items.filter(
              (item) =>
                !item.permission ||
                can(item.permission[0] as any, item.permission[1] as any) ||
                can('read' as any, item.permission[1] as any),
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={section.group} className="space-y-1">
                <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                  {section.group}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive = currentSubPageId === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigateTo(item.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 text-left',
                          isActive
                            ? 'bg-[#0f172a] text-white font-semibold shadow-sm'
                            : 'text-[#64748b] hover:bg-[#f1f5f9]/70 hover:text-[#0f172a]',
                        )}
                      >
                        <item.icon
                          size={14}
                          strokeWidth={isActive ? 2 : 1.75}
                          className={isActive ? 'text-indigo-400' : 'text-[#94a3b8]'}
                        />
                        <span className="flex-1">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Settings content */}
      <main className="flex-1 overflow-auto py-2 min-w-0">
        {children}
      </main>
    </div>
  );
}
