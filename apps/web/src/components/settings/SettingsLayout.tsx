import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  Shield,
  Workflow,
  Settings2,
  Layers,
  Link2,
  GitBranch,
  Sliders,
  Tags,
  Puzzle,
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
      { id: 'verticals', label: 'Verticals', icon: Layers, permission: ['manage', 'Vertical'] },
      { id: 'audit-trail', label: 'Setup Audit Trail', icon: Sliders, permission: ['manage', 'FieldDefinition'] },
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
      { id: 'objects', label: 'Object Manager', icon: Settings2, permission: ['manage', 'FieldDefinition'] },
      { id: 'layout-builder', label: 'Layout Designer', icon: Layers, permission: ['manage', 'FieldDefinition'] },
      { id: 'pipelines', label: 'Pipeline Settings', icon: Workflow, permission: ['manage', 'Workflow'] },
      { id: 'fields', label: 'Custom Fields', icon: Sliders, permission: ['manage', 'FieldDefinition'] },
      { id: 'labels', label: 'Labels', icon: Tags, permission: ['manage', 'LabelOverride'] },
    ],
  },
  {
    group: 'Extensions',
    items: [
      { id: 'capabilities', label: 'Capabilities', icon: Layers, permission: ['manage', 'Plugin'] },
      { id: 'plugins', label: 'Plugins', icon: Puzzle, permission: ['manage', 'Plugin'] },
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
  const allVisibleItems = useMemo(() => {
    return NAV.flatMap((section) =>
      section.items.filter(
        (item) =>
          !item.permission ||
          can(item.permission[0] as any, item.permission[1] as any) ||
          can('read' as any, item.permission[1] as any),
      ),
    );
  }, [can]);

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
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] p-6 bg-background">
        <div className="w-full max-w-md p-8 bg-card border border-border rounded-2xl shadow-sm text-center space-y-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground tracking-tight font-sans">Access Denied</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your account does not have permissions to manage or view the configuration settings for this tenant.
            </p>
          </div>
          <Button
            onClick={() => navigate({ to: '/' })}
            className="w-full bg-primary hover:bg-primary/90 text-white font-medium rounded-lg h-10 transition-colors"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full min-h-[calc(100vh-56px)] max-w-[1280px] gap-6 md:gap-8 p-4 md:p-6">
      {/* Mobile Settings Selector */}
      <div className="md:hidden w-full border-b border-border pb-4">
        <label htmlFor="settings-mobile-nav" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
          Settings Section
        </label>
        <select
          id="settings-mobile-nav"
          value={currentSubPageId || ''}
          onChange={(e) => navigateTo(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {NAV.map((section) => {
            const visibleItems = section.items.filter(
              (item) =>
                !item.permission ||
                can(item.permission[0] as any, item.permission[1] as any) ||
                can('read' as any, item.permission[1] as any),
            );
            if (visibleItems.length === 0) return null;
            return (
              <optgroup key={section.group} label={section.group}>
                {visibleItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      {/* Settings Navigation Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-border pr-6 py-2 overflow-auto hidden md:block">
        <nav className="space-y-6">
          {NAV.map((section) => {
            const visibleItems = section.items.filter(
              (item) =>
                !item.permission ||
                can(item.permission[0] as any, item.permission[1] as any) ||
                can('read' as any, item.permission[1] as any),
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={section.group} className="space-y-1.5">
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
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
                          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 text-left relative group',
                          isActive
                            ? 'bg-primary/8 text-primary font-semibold border-l-2 border-primary rounded-l-none pl-2.5 shadow-[inset_1px_0_0_0_rgba(29,78,216,0.05)]'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground pl-3 hover:translate-x-0.5',
                        )}
                      >
                        <item.icon
                          size={14}
                          strokeWidth={isActive ? 2.25 : 1.75}
                          className={cn(
                            'transition-transform duration-200 group-hover:scale-105',
                            isActive ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground'
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
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
