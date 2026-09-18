import React, { useState, useCallback } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { useAuth } from '@/contexts/auth.context';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useLabels } from '@/hooks/useLabels';
import { useBranch } from '@/contexts/branch.context';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import { objectsApi, type CustomObjectMeta } from '@/api/objects';
import { BranchSelector } from './HeaderSelectors';
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
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  Layers,
  Sliders,
  Calendar,
  Receipt,
  Home,
  ShoppingCart,
  ClipboardList,
  Megaphone,
  UserCheck,
  BookOpen,
  CalendarRange,
  ClipboardCheck,
  DollarSign,
  Phone,
  Package,
  Monitor,
  FileText,
  Award,
  Pencil,
  Check,
  X,
  ArrowRight,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';

const getPipelineColor = (id: string) => {
  const colors = [
    'bg-emerald-500 shadow-emerald-500/25',
    'bg-blue-500 shadow-blue-500/25',
    'bg-indigo-500 shadow-indigo-500/25',
    'bg-amber-500 shadow-amber-500/25',
    'bg-pink-500 shadow-pink-500/25',
    'bg-violet-500 shadow-violet-500/25',
    'bg-rose-500 shadow-rose-500/25',
    'bg-cyan-500 shadow-cyan-500/25',
  ];
  let sum = 0;
  for (let i = 0; i < id.length; i++) {
    sum += id.charCodeAt(i);
  }
  return colors[sum % colors.length];
};

const ICON_MAP: Record<string, any> = {
  Layers,
  Calendar,
  Receipt,
  Home,
  BookOpen,
  Phone,
  MessageSquare,
  Package,
  Users,
  Building2,
  FileText,
  DollarSign,
  UserCheck,
  Award,
  Monitor,
  Workflow,
  Shield,
  Tags,
};

const resolveIcon = (name?: string) => {
  if (!name) return Layers;
  return ICON_MAP[name] || Layers;
};

export function AppSidebar() {
  const { user, ability, logout } = useAuth();
  const location = useLocation();
  const { isEnabled } = useCapabilities();
  const { t } = useLabels();

  const { selectedBranchId, selectedVerticalIds, isLoading: branchLoading } = useBranch();
  const pipelineVerticalIds = selectedBranchId ? selectedVerticalIds : [];
  const hasBranchFilter = !!selectedBranchId && pipelineVerticalIds.length > 0;

  const { data: workflows = [], isLoading: pipelinesLoading } = useQuery({
    queryKey: ['settings', 'pipelines', selectedBranchId || 'all', ...pipelineVerticalIds],
    queryFn: () => settingsApi.pipelines.list(hasBranchFilter ? { vertical_ids: pipelineVerticalIds.join(',') } : undefined),
    enabled: !selectedBranchId || selectedVerticalIds.length > 0,
    staleTime: 10_000,
  });

  const pipelineDropdownLoading = pipelinesLoading || (!!selectedBranchId && selectedVerticalIds.length === 0);

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const coreItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Leads', path: '/leads', icon: UserCheck },
    { label: t('party.plural') ?? 'Contacts', path: '/parties', icon: Users },
    { label: 'Pipeline', path: '/pipeline', icon: Workflow },
    { label: 'Campaigns', path: '/campaigns', icon: Megaphone },
    { label: 'Reports', path: '/reports', icon: TrendingUp },
    { label: 'Integrations', path: '/integrations', icon: Link2 },
  ];

  const capabilityGroups = [
    {
      id: 'crm-sales',
      label: 'CRM & Sales',
      icon: Calendar,
      items: [
        ...(isEnabled('capability/appointment') ? [{ label: 'Appointments', path: '/appointments', icon: Calendar }] : []),
        ...(isEnabled('capability/order-management') ? [{ label: 'Orders', path: '/orders', icon: ShoppingCart }] : []),
        ...(isEnabled('capability/customer-onboarding') ? [{ label: 'Onboardings', path: '/onboardings', icon: ClipboardList }] : []),
      ],
    },
    {
      id: 'finance',
      label: 'Finance & Billing',
      icon: Receipt,
      items: [
        ...(isEnabled('capability/billing') ? [{ label: 'Invoices', path: '/invoices', icon: Receipt }] : []),
        ...(isEnabled('capability/finance')
          ? [
              { label: 'Fee Plans', path: '/fee-plans', icon: Receipt },
              { label: 'Student Fees', path: '/student-fees', icon: DollarSign },
              { label: 'Scholarships', path: '/scholarships', icon: DollarSign },
            ]
          : []),
      ],
    },
    {
      id: 'property',
      label: 'Property',
      icon: Home,
      items: [
        ...(isEnabled('capability/property-listing') ? [{ label: 'Properties', path: '/properties', icon: Home }] : []),
      ],
    },
    {
      id: 'academics',
      label: 'Academics',
      icon: BookOpen,
      items: isEnabled('capability/academics')
        ? [
            { label: 'Enrollments', path: '/enrollments', icon: UserCheck },
            { label: 'Courses', path: '/courses', icon: BookOpen },
            { label: 'Batches', path: '/batches', icon: CalendarRange },
            { label: 'Attendance', path: '/attendance', icon: ClipboardCheck },
            { label: 'Tests', path: '/tests', icon: ClipboardList },
            { label: 'Assignments', path: '/assignments', icon: ClipboardList },
            { label: 'Study Materials', path: '/study-materials', icon: FileText },
            { label: 'Certificates', path: '/certificates', icon: Award },
          ]
        : [],
    },
    {
      id: 'telephony',
      label: 'Communications',
      icon: Phone,
      items: isEnabled('capability/telephony')
        ? [{ label: 'Call Logs', path: '/call-logs', icon: Phone }]
        : [],
    },
    {
      id: 'workspace',
      label: 'Workspace',
      icon: MessageSquare,
      items: isEnabled('capability/workspace')
        ? [
            { label: 'Inbox', path: '/inbox', icon: MessageSquare },
            { label: 'Tasks', path: '/tasks', icon: ClipboardList },
            { label: 'Notes', path: '/notes', icon: FileText },
          ]
        : [],
    },
    {
      id: 'operations',
      label: 'Operations',
      icon: Package,
      items: isEnabled('capability/operations')
        ? [
            { label: 'Products', path: '/products', icon: Package },
            { label: 'Categories', path: '/product-categories', icon: Tags },
            { label: 'Warehouses', path: '/warehouses', icon: Building2 },
            { label: 'Stock', path: '/stock', icon: Layers },
            { label: 'Movements', path: '/stock-movements', icon: ArrowRight },
            { label: 'Assets', path: '/assets', icon: Monitor },
          ]
        : [],
    },
    {
      id: 'hr',
      label: 'HR & People',
      icon: Users,
      items: isEnabled('capability/hr')
        ? [
            { label: 'Departments', path: '/departments', icon: Building2 },
            { label: 'Employees', path: '/employees', icon: Users },
            { label: 'Leave Requests', path: '/leave-requests', icon: Calendar },
            { label: 'Payslips', path: '/payslips', icon: Receipt },
            { label: 'Attendance', path: '/employee-attendance', icon: Calendar },
          ]
        : [],
    },
  ].filter((g) => g.items.length > 0);

  const { data: customObjects = [] } = useQuery({
    queryKey: ['custom-objects'],
    queryFn: () => objectsApi.list(),
    staleTime: 30_000,
  });

  // Dynamic distribution of custom objects
  const dynamicDomainGroups: Array<{ id: string; label: string; icon: any; items: Array<{ label: string; path: string; icon: any }> }> = [];
  const customByDomain: Record<string, CustomObjectMeta[]> = {};

  customObjects.forEach((obj) => {
    const domainNorm = (obj.domain || '').trim().toLowerCase();
    const matchedBuiltin = capabilityGroups.find(
      (g) => g.label.toLowerCase() === domainNorm || g.id === domainNorm
    );
    if (matchedBuiltin) {
      matchedBuiltin.items.push({
        label: obj.plural_label,
        path: `/objects/${obj.key}`,
        icon: resolveIcon(obj.icon),
      });
    } else {
      const d = obj.domain || 'Custom Objects';
      if (!customByDomain[d]) customByDomain[d] = [];
      customByDomain[d].push(obj);
    }
  });

  Object.entries(customByDomain).forEach(([domain, objs]) => {
    dynamicDomainGroups.push({
      id: `custom-domain-${domain.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      label: domain,
      icon: resolveIcon(objs[0]?.icon),
      items: objs.map((obj) => ({
        label: obj.plural_label,
        path: `/objects/${obj.key}`,
        icon: resolveIcon(obj.icon),
      })),
    });
  });

  const allCapabilityGroups = [
    ...capabilityGroups.filter((g) => g.items.length > 0),
    ...dynamicDomainGroups,
  ];

  const renderNavItem = (item: { label: string; path: string; icon: any }) => {
    const search = location.search as any;
    const isActive = location.pathname === item.path ||
      (item.path !== '/' && location.pathname.startsWith(item.path));

    if (item.path === '/pipeline' && workflows.length > 0) {
      const isSubActive = location.pathname === '/pipeline' || location.pathname === '/cases';
      return (
        <SidebarMenuItem key={item.path}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton isActive={isSubActive} tooltip={item.label} className="w-full justify-between pr-2.5">
                <div className="flex items-center gap-2.5 font-medium">
                  <item.icon size={15} strokeWidth={isSubActive ? 2.5 : 1.75} className={isSubActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/60'} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <ChevronRight size={13} className="text-sidebar-foreground/50 ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent side="right" align="start" alignOffset={-6} className="w-56 bg-popover border border-border shadow-md rounded-xl p-1.5 space-y-0.5 animate-in slide-in-from-left-2 duration-150">
              <DropdownMenuLabel className="text-[10px] text-sidebar-foreground/50 font-bold uppercase tracking-wider px-2.5 py-1.5">
                Select Pipeline
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-sidebar-border/40 mx-1" />

              {pipelineDropdownLoading ? (
                <div className="space-y-1.5 px-2.5 py-2">
                  <div className="h-5 bg-sidebar-accent/50 rounded-md animate-pulse" />
                  <div className="h-5 bg-sidebar-accent/50 rounded-md animate-pulse w-3/4" />
                </div>
              ) : workflows.length === 0 ? (
                <p className="text-xs text-sidebar-foreground/50 px-2.5 py-2 text-center">
                  No pipelines in this branch
                </p>
              ) : workflows.map((wf: any) => {
                const isWfActive = (location.pathname === '/pipeline' || location.pathname === '/cases') && search.pipelineId === wf.id;
                return (
                  <DropdownMenuItem key={wf.id} asChild className="p-0 focus:bg-transparent">
                    <Link
                      to="/pipeline"
                      search={{ pipelineId: wf.id }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all w-full duration-150 cursor-pointer ${
                        isWfActive
                          ? 'text-sidebar-accent-foreground bg-sidebar-accent font-bold'
                          : 'text-sidebar-foreground/90 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/40'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 mr-1.5 shadow-sm border border-white/10 ${getPipelineColor(wf.id)}`} />
                      <span className="truncate flex-1 text-left">{wf.name}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
          <Link
            to={item.path}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all duration-150 ${
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm border border-sidebar-border/50'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground'
            }`}
          >
            <item.icon size={15} strokeWidth={isActive ? 2.5 : 1.75} className={isActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/60'} />
            <span className="flex-1">{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const settingsPermissions: Record<string, [string, string]> = {
    '/settings/users': ['manage', 'User'],
    '/settings/roles': ['manage', 'Role'],
    '/settings/branches': ['manage', 'Branch'],
    '/settings/verticals': ['manage', 'Vertical'],
    '/settings/pipelines': ['manage', 'Workflow'],
    '/settings/workflows': ['manage', 'Workflow'],
    '/settings/fields': ['manage', 'FieldDefinition'],
    '/settings/labels': ['manage', 'LabelOverride'],
    '/settings/capabilities': ['manage', 'Plugin'],
    '/settings/plugins': ['manage', 'Plugin'],
    '/settings/integrations': ['manage', 'Integration'],
    '/settings/objects': ['manage', 'FieldDefinition'],
  };

  const settingsItems = [
    { label: 'Users', path: '/settings/users', icon: Users },
    { label: 'Roles', path: '/settings/roles', icon: Shield },
    { label: 'Branches', path: '/settings/branches', icon: GitBranch },
    { label: 'Verticals', path: '/settings/verticals', icon: Layers },
    { label: 'Pipeline Settings', path: '/settings/pipelines', icon: Workflow },
    { label: 'Fields', path: '/settings/fields', icon: Sliders },
    { label: 'Custom Objects', path: '/settings/objects', icon: Layers },
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

  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>(
    () => Object.fromEntries(capabilityGroups.map((g) => [g.id, true]))
  );

  const [customNames, setCustomNames] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('sidebar_domain_names') || '{}');
    } catch { return {}; }
  });

  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const toggleDomain = (id: string) => {
    setExpandedDomains((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const startRename = (id: string, currentLabel: string) => {
    setEditingName(id);
    setEditValue(customNames[id] || currentLabel);
  };

  const saveRename = (id: string) => {
    const val = editValue.trim();
    if (!val) {
      const updated = { ...customNames };
      delete updated[id];
      setCustomNames(updated);
      localStorage.setItem('sidebar_domain_names', JSON.stringify(updated));
    } else {
      const updated = { ...customNames, [id]: val };
      setCustomNames(updated);
      localStorage.setItem('sidebar_domain_names', JSON.stringify(updated));
    }
    setEditingName(null);
  };

  const cancelRename = () => {
    setEditingName(null);
  };

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="px-4 py-4 border-b border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/10">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-primary leading-none tracking-tight">Meta CRM</p>
            <p className="text-[10px] text-sidebar-foreground/70 mt-0.5 font-medium">Workspace Console</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-1 pb-3 bg-sidebar">
        {/* Branch Selector */}
        <SidebarGroup className="pt-0 pb-1">
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] font-bold uppercase tracking-wider px-2 mb-1">
            Branch
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <BranchSelector />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2 bg-sidebar-border/40" />

        {/* Core Section */}
        <SidebarGroup className="pt-0 pb-1">
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] font-bold uppercase tracking-wider px-2 mb-1">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {coreItems.map((item) => renderNavItem(item))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Capability Domain Sections */}
        {allCapabilityGroups.map((group) => {
          const displayName = customNames[group.id] || group.label;
          const isEditing = editingName === group.id;

          return (
            <Collapsible
              key={group.id}
              open={expandedDomains[group.id] ?? true}
              onOpenChange={() => toggleDomain(group.id)}
              className="group/collapsible"
            >
              <SidebarGroup className="pt-1 pb-0">
                <div className="flex items-center gap-1 px-2 mb-1 group/header">
                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <group.icon size={12} className="text-sidebar-foreground/40 flex-shrink-0" />
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(group.id);
                          if (e.key === 'Escape') cancelRename();
                        }}
                        className="flex-1 text-xs font-bold text-sidebar-foreground bg-sidebar-accent/60 rounded border border-sidebar-border px-1.5 py-0.5 outline-none min-w-0"
                      />
                      <button onClick={() => saveRename(group.id)} className="p-0.5 rounded text-sidebar-foreground/50 hover:text-emerald-500 hover:bg-sidebar-accent/60 transition-colors flex-shrink-0 cursor-pointer">
                        <Check size={11} />
                      </button>
                      <button onClick={cancelRename} className="p-0.5 rounded text-sidebar-foreground/50 hover:text-rose-500 hover:bg-sidebar-accent/60 transition-colors flex-shrink-0 cursor-pointer">
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer select-none text-left">
                          <group.icon size={14} className="text-primary flex-shrink-0" />
                          <span className="text-sm font-semibold text-foreground/90 tracking-tight truncate">{displayName}</span>
                          <ChevronDown size={12} className="text-muted-foreground/60 flex-shrink-0 transition-transform duration-200 group-data-[state=closed]/collapsible:-rotate-90" />
                        </button>
                      </CollapsibleTrigger>
                      <button
                        onClick={() => startRename(group.id, displayName)}
                        className="opacity-0 group-hover/header:opacity-100 p-0.5 rounded text-sidebar-foreground/30 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-all flex-shrink-0 cursor-pointer"
                      >
                        <Pencil size={11} />
                      </button>
                    </>
                  )}
                </div>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => renderNavItem(item))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}

        {/* Configuration Section */}
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
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm w-full transition-all duration-150 ${
                        isSettingsActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm border border-sidebar-border/50'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground'
                      }`}
                    >
                      <Settings size={15} strokeWidth={isSettingsActive ? 2.5 : 1.75} className={isSettingsActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/60'} />
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
            <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-xl hover:bg-sidebar-accent/55 transition-colors text-left text-sidebar-foreground cursor-pointer">
              <Avatar className="w-7 h-7 flex-shrink-0">
                <AvatarFallback className="bg-primary text-white text-xs font-semibold shadow-sm">
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
