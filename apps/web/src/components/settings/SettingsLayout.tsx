import { useCallback } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
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
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
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
      { id: 'brands', label: 'Brands', icon: Building2, permission: ['manage', 'Branch'] },
      { id: 'assignments', label: 'Assignments', icon: UserCog, permission: ['manage', 'Branch'] },
    ],
  },
  {
    group: 'People',
    items: [
      { id: 'users', label: 'Users', icon: Users, permission: ['manage', 'User'] },
      { id: 'roles', label: 'Roles & Permissions', icon: Shield, permission: ['manage', 'User'] },
    ],
  },
  {
    group: 'CRM',
    items: [
      { id: 'workflows', label: 'Workflows', icon: Workflow, permission: ['manage', 'Workflow'] },
      { id: 'fields', label: 'Custom Fields', icon: Sliders, permission: ['manage', 'Workflow'] },
      { id: 'labels', label: 'Labels', icon: Tags, permission: ['manage', 'Workflow'] },
    ],
  },
  {
    group: 'Extensions',
    items: [
      { id: 'capabilities', label: 'Capabilities', icon: Layers, permission: ['manage', 'Plugin'] },
      { id: 'plugins', label: 'Plugins', icon: Puzzle, permission: ['manage', 'Plugin'] },
      { id: 'integrations', label: 'Integrations', icon: Link2, permission: ['manage', 'Plugin'] },
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

  return (
    <div className="flex h-full min-h-[calc(100vh-56px)] max-w-[1280px] gap-0">
      {/* Settings sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-[#d3cec6] bg-[#f5f1ec] pr-0">
        {/* Header */}
        <div className="px-4 py-4 flex items-center gap-2">
          <Settings2 size={16} className="text-[#9c9fa5]" />
          <h2 className="text-sm font-semibold text-[#111111] tracking-tight">Settings</h2>
        </div>
        <Separator className="bg-[#d3cec6]" />

        {/* Nav groups */}
        <nav className="py-3 space-y-4 px-2">
          {NAV.map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.permission || can(item.permission[0] as any, item.permission[1] as any),
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.group}>
                <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#9c9fa5]">
                  {section.group}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive = currentPath === `/settings/${item.id}` ||
                      currentPath === `/settings/${item.id}/`;
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigateTo(item.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors text-left',
                          isActive
                            ? 'bg-white text-[#111111] font-medium shadow-sm border border-[#d3cec6]'
                            : 'text-[#626260] hover:bg-[#ebe7e1] hover:text-[#111111]',
                        )}
                      >
                        <item.icon size={14} strokeWidth={isActive ? 2 : 1.75} />
                        <span className="flex-1">{item.label}</span>
                        {isActive && (
                          <ChevronRight size={12} className="text-[#9c9fa5]" />
                        )}
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
      <main className="flex-1 overflow-auto p-6 min-w-0">
        {children}
      </main>
    </div>
  );
}
