import { useState, useCallback } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
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
  Link,
} from 'lucide-react';

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  permission?: [string, string];
  children: { id: string; label: string }[];
}

const SECTIONS: SettingsSection[] = [
  {
    id: 'organisation',
    label: 'Organisation',
    icon: <Building2 className="h-4 w-4" />,
    permission: ['manage', 'Branch'],
    children: [
      { id: 'branches', label: 'Branches' },
      { id: 'brands', label: 'Brands' },
      { id: 'assignments', label: 'Assignments' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    icon: <Users className="h-4 w-4" />,
    permission: ['manage', 'User'],
    children: [
      { id: 'users', label: 'Users' },
      { id: 'roles', label: 'Roles' },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: <Workflow className="h-4 w-4" />,
    permission: ['manage', 'Workflow'],
    children: [
      { id: 'workflows', label: 'Workflows' },
      { id: 'fields', label: 'Fields' },
      { id: 'labels', label: 'Labels' },
    ],
  },
  {
    id: 'extensions',
    label: 'Extensions',
    icon: <Puzzle className="h-4 w-4" />,
    permission: ['manage', 'Plugin'],
    children: [
      { id: 'capabilities', label: 'Capabilities' },
      { id: 'plugins', label: 'Plugins' },
      { id: 'integrations', label: 'Integrations' },
    ],
  },
];

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const { can } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(SECTIONS.map((s) => s.id)),
  );

  const currentPath = location.pathname;

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const navigateTo = useCallback(
    (pageId: string) => {
      navigate({ to: `/settings/${pageId}`, replace: true });
    },
    [navigate],
  );

  const visibleSections = SECTIONS.filter(
    (s) => !s.permission || can(s.permission[0] as any, s.permission[1] as any),
  );

  return (
    <div className="flex h-[calc(100vh-60px)]">
      <aside className="w-64 border-r bg-card overflow-auto flex-shrink-0">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Settings
          </h2>
        </div>

        <nav className="p-2 space-y-1">
          {visibleSections.map((section) => {
            const isExpanded = expandedSections.has(section.id);
            const hasActiveChild = section.children.some(
              (c) => currentPath === `/settings/${c.id}`,
            );

            return (
              <div key={section.id}>
                <button
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors',
                    hasActiveChild
                      ? 'bg-muted font-medium'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                  onClick={() => toggleSection(section.id)}
                >
                  <span className="flex items-center gap-2">
                    {section.icon}
                    {section.label}
                  </span>
                  <svg
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isExpanded && 'rotate-90',
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="ml-6 mt-1 space-y-0.5">
                    {section.children.map((child) => {
                      const isActive = currentPath === `/settings/${child.id}`;
                      return (
                        <button
                          key={child.id}
                          className={cn(
                            'w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors',
                            isActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                          )}
                          onClick={() => navigateTo(child.id)}
                        >
                          {child.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
