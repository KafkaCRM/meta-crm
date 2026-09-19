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

  // Active group section based on current route
  const activeSection = useMemo(() => {
    return (
      NAV.find((section) => section.items.some((item) => item.id === currentSubPageId)) ||
      NAV[0]
    );
  }, [currentSubPageId]);

  const activeSectionVisibleItems = useMemo(() => {
    return (activeSection?.items || []).filter(
      (item) =>
        !item.permission ||
        can(item.permission[0] as any, item.permission[1] as any) ||
        can('read' as any, item.permission[1] as any)
    );
  }, [activeSection, can]);

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-56px)] max-w-[1360px] mx-auto w-full px-4 sm:px-6 py-4 space-y-6">
      {/* Top Header Navigation Bar (Replaces redundant second vertical sidebar) */}
      <div className="bg-card/70 backdrop-blur-md border border-border/80 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0 shadow-xs">
              <Settings2 size={18} strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold tracking-tight text-foreground">
                  Workspace Administration
                </h1>
                <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Settings & Studio
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Configure tenant boundaries, organizational hierarchy, permissions, and extensions
              </p>
            </div>
          </div>

          {/* Section Category Segmented Tabs */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/70 overflow-x-auto self-start md:self-auto scrollbar-none">
            {NAV.map((section) => {
              const isSectionActive = activeSection?.group === section.group;
              const visible = section.items.filter(
                (item) =>
                  !item.permission ||
                  can(item.permission[0] as any, item.permission[1] as any) ||
                  can('read' as any, item.permission[1] as any)
              );
              if (visible.length === 0) return null;

              return (
                <button
                  key={section.group}
                  onClick={() => {
                    const first = visible[0];
                    if (first) navigateTo(first.id);
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap select-none',
                    isSectionActive
                      ? 'bg-background text-foreground shadow-xs border border-border/60 font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                  )}
                >
                  {section.group}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-item Pills for the Active Section */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {activeSectionVisibleItems.map((item) => {
            const isActive = currentSubPageId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap select-none font-medium',
                  isActive
                    ? 'bg-primary text-white shadow-xs font-bold'
                    : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50'
                )}
              >
                <item.icon size={13} strokeWidth={isActive ? 2.5 : 1.75} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Settings Page Content - Full Width & Clean */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
