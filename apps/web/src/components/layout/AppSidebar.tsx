import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { useAuth } from '@/contexts/auth.context';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useLabels } from '@/hooks/useLabels';
import { useBranch } from '@/contexts/branch.context';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import { franchiseApi } from '@/api/franchise';
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
  Search,
  Sparkles,
  GraduationCap,
  CheckCircle2,
  BarChart3,
  Inbox,
  CreditCard,
  ShieldCheck,
  PhoneCall,
  ArrowRightLeft,
  Network,
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
  Sparkles,
  GraduationCap,
};

const resolveIcon = (name?: string) => {
  if (!name) return Layers;
  return ICON_MAP[name] || Layers;
};

interface NavItem {
  label: string;
  path: string;
  icon: any;
  badge?: string;
  badgeVariant?: 'default' | 'outline' | 'secondary' | 'success';
}

interface NavGroup {
  id: string;
  label: string;
  icon: any;
  items: NavItem[];
}

export function AppSidebar() {
  const { user, ability, logout } = useAuth();
  const location = useLocation();
  const { isEnabled } = useCapabilities();
  const { t } = useLabels();

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { selectedBranchIds, selectedVerticalIds, isLoading: branchLoading } = useBranch();
  const hasBranchFilter = selectedBranchIds.length > 0;

  const { data: workflows = [], isLoading: pipelinesLoading } = useQuery({
    queryKey: ['settings', 'pipelines', selectedBranchIds.slice().sort().join(',') || 'all', ...selectedVerticalIds],
    queryFn: () => settingsApi.pipelines.list(hasBranchFilter ? { branch_ids: selectedBranchIds.join(',') } : undefined),
    enabled: !hasBranchFilter || selectedVerticalIds.length > 0 || !branchLoading,
    staleTime: 10_000,
  });

  const pipelineDropdownLoading = pipelinesLoading || (hasBranchFilter && selectedVerticalIds.length === 0 && branchLoading);

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  // Keyboard shortcut: "/" to focus filter search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data: franchiseStatus } = useQuery({
    queryKey: ['franchise', 'status'],
    queryFn: () => franchiseApi.getStatus(),
    staleTime: 60_000,
  });

  // --- 1. Main Workspace Group ---
  const coreItems: NavItem[] = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Leads', path: '/leads', icon: UserCheck },
    { label: t('party.plural') ?? 'Contacts', path: '/parties', icon: Users },
    { label: 'Pipeline', path: '/pipeline', icon: Workflow },
    { label: 'Campaigns', path: '/campaigns', icon: Megaphone },
    { label: 'Reports & Analytics', path: '/reports', icon: BarChart3 },
    ...(franchiseStatus?.is_franchisor || franchiseStatus?.is_franchisee
      ? [
          {
            label: franchiseStatus.is_franchisor ? 'Franchise Network' : 'Franchise Store',
            path: '/franchise',
            icon: Network,
          },
        ]
      : []),
    { label: 'Integrations', path: '/integrations', icon: Link2 },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  // --- 2. Modular Capability Domain Groups ---
  const capabilityGroups: NavGroup[] = [
    // Academics & Students (Higher Ed / Coaching)
    {
      id: 'academics-admin',
      label: 'Student & Academics',
      icon: GraduationCap,
      items: isEnabled('capability/academics')
        ? [
            { label: 'Admissions & Enrolment', path: '/enrollments', icon: UserCheck },
            { label: 'Courses & Programs', path: '/courses', icon: BookOpen },
            { label: 'Batches & Cohorts', path: '/batches', icon: CalendarRange },
            { label: 'Attendance', path: '/attendance', icon: ClipboardCheck },
            { label: 'Certificates', path: '/certificates', icon: Award },
          ]
        : [],
    },
    // Learning & LMS (Assessments & Study)
    {
      id: 'learning-assessment',
      label: 'Learning & Assessment',
      icon: BookOpen,
      items: isEnabled('capability/academics')
        ? [
            { label: 'Study Materials', path: '/study-materials', icon: FileText },
            { label: 'Assignments', path: '/assignments', icon: ClipboardList },
            { label: 'Tests & Scores', path: '/tests', icon: CheckCircle2 },
          ]
        : [],
    },
    // Finance, Billing & Fee Collections
    {
      id: 'finance-collections',
      label: 'Finance & Collections',
      icon: Receipt,
      items: [
        ...(isEnabled('capability/billing')
          ? [{ label: 'Fee Invoices', path: '/invoices', icon: Receipt }]
          : []),
        ...(isEnabled('capability/finance')
          ? [
              { label: 'Fee Management & Plans', path: '/fee-plans', icon: CreditCard },
              { label: 'Fee Collections & Online', path: '/student-fees', icon: DollarSign },
              { label: 'Scholarships & Discounts', path: '/scholarships', icon: Sparkles },
            ]
          : []),
      ],
    },
    // Sales, Orders & Conversions
    {
      id: 'sales-conversion',
      label: 'Sales & Conversion',
      icon: ShoppingCart,
      items: [
        ...(isEnabled('capability/order-management')
          ? [{ label: 'Orders & Closures', path: '/orders', icon: ShoppingCart }]
          : []),
        ...(isEnabled('capability/appointment')
          ? [{ label: 'Appointments & Visits', path: '/appointments', icon: Calendar }]
          : []),
        ...(isEnabled('capability/customer-onboarding')
          ? [{ label: 'Customer Onboarding', path: '/onboardings', icon: ClipboardList }]
          : []),
        ...(isEnabled('capability/property-listing')
          ? [{ label: 'Property Inventory', path: '/properties', icon: Home }]
          : []),
      ],
    },
    // Communications & Telephony
    {
      id: 'telephony-calls',
      label: 'Calls & Telephony',
      icon: PhoneCall,
      items: isEnabled('capability/telephony')
        ? [{ label: 'Call Logs & Recordings', path: '/call-logs', icon: PhoneCall }]
        : [],
    },
    // Workspace, Tasks & Collaboration
    {
      id: 'workspace-team',
      label: 'Workspace & Team',
      icon: MessageSquare,
      items: isEnabled('capability/workspace')
        ? [
            { label: 'Team Inbox', path: '/inbox', icon: Inbox },
            { label: 'Tasks & Follow-ups', path: '/tasks', icon: ClipboardList },
            { label: 'Notes & Knowledge', path: '/notes', icon: FileText },
          ]
        : [],
    },
    // Operations & Supply / ERP
    {
      id: 'operations-erp',
      label: 'Operations & Stock',
      icon: Package,
      items: isEnabled('capability/operations')
        ? [
            { label: 'Product Catalog', path: '/products', icon: Package },
            { label: 'Product Categories', path: '/product-categories', icon: Tags },
            { label: 'Warehouses', path: '/warehouses', icon: Building2 },
            { label: 'Stock Inventory', path: '/stock', icon: Layers },
            { label: 'Stock Movements', path: '/stock-movements', icon: ArrowRightLeft },
            { label: 'Assets & Facilities', path: '/assets', icon: Monitor },
          ]
        : [],
    },
    // HR & Workforce
    {
      id: 'hr-workforce',
      label: 'HR & Workforce',
      icon: Users,
      items: isEnabled('capability/hr')
        ? [
            { label: 'Departments', path: '/departments', icon: Building2 },
            { label: 'Employee Directory', path: '/employees', icon: Users },
            { label: 'Leave Requests', path: '/leave-requests', icon: Calendar },
            { label: 'Staff Attendance', path: '/employee-attendance', icon: ClipboardCheck },
            { label: 'Payslips & Salary', path: '/payslips', icon: Receipt },
          ]
        : [],
    },
  ].filter((g) => g.items.length > 0);

  // --- 3. Custom Objects Dynamic Groups ---
  const { data: customObjects = [] } = useQuery({
    queryKey: ['custom-objects'],
    queryFn: () => objectsApi.list(),
    staleTime: 30_000,
  });

  const dynamicDomainGroups: NavGroup[] = [];
  const customByDomain: Record<string, CustomObjectMeta[]> = {};
  customObjects.forEach((obj) => {
    const domain = obj.domain || 'Custom Objects';
    if (!customByDomain[domain]) customByDomain[domain] = [];
    customByDomain[domain]!.push(obj);
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
    ...capabilityGroups,
    ...dynamicDomainGroups,
  ];

  // Collapsible state per group - persisted and defaulting to expanded so capabilities are prominently shown
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('sidebar_expanded_domains');
      if (stored) return JSON.parse(stored);
    } catch {}
    return { main: true };
  });

  const toggleDomain = (id: string) => {
    setExpandedDomains((prev) => {
      const current = prev[id] !== undefined ? prev[id] : true;
      const updated = { ...prev, [id]: !current };
      try {
        localStorage.setItem('sidebar_expanded_domains', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const [customNames, setCustomNames] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('sidebar_domain_names') || '{}');
    } catch {
      return {};
    }
  });

  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

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

  // --- Filtering Logic for "Filter menu…" ---
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isFiltering = normalizedQuery.length > 0;

  const filteredCoreItems = useMemo(() => {
    if (!isFiltering) return coreItems;
    return coreItems.filter(
      (item) =>
        item.label.toLowerCase().includes(normalizedQuery) ||
        item.path.toLowerCase().includes(normalizedQuery)
    );
  }, [coreItems, normalizedQuery, isFiltering]);

  const filteredCapabilityGroups = useMemo(() => {
    if (!isFiltering) return allCapabilityGroups;
    return allCapabilityGroups
      .map((group) => {
        const groupMatches = group.label.toLowerCase().includes(normalizedQuery);
        const matchingItems = group.items.filter(
          (item) =>
            groupMatches ||
            item.label.toLowerCase().includes(normalizedQuery) ||
            item.path.toLowerCase().includes(normalizedQuery)
        );
        return {
          ...group,
          items: groupMatches ? group.items : matchingItems,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [allCapabilityGroups, normalizedQuery, isFiltering]);

  const totalMatches =
    filteredCoreItems.length +
    filteredCapabilityGroups.reduce((acc, g) => acc + g.items.length, 0);

  const renderNavItem = (item: NavItem) => {
    const search = location.search as any;
    const isActive =
      location.pathname === item.path ||
      (item.path !== '/' && location.pathname.startsWith(item.path));

    if (item.path === '/pipeline' && workflows.length > 0) {
      const isSubActive = location.pathname === '/pipeline' || location.pathname === '/cases';
      return (
        <SidebarMenuItem key={item.path}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                isActive={isSubActive}
                tooltip={item.label}
                className="w-full justify-between pr-2.5 h-8.5 rounded-lg"
              >
                <div className="flex items-center gap-2.5 font-medium min-w-0">
                  <item.icon
                    size={14}
                    strokeWidth={isSubActive ? 2.5 : 1.75}
                    className={isSubActive ? 'text-primary' : 'text-muted-foreground/70'}
                  />
                  <span className="text-xs font-medium truncate">{item.label}</span>
                </div>
                <ChevronRight size={12} className="text-muted-foreground/50 ml-auto flex-shrink-0" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              side="right"
              align="start"
              alignOffset={-6}
              className="w-56 bg-popover border border-border shadow-md rounded-xl p-1.5 space-y-0.5 animate-in slide-in-from-left-2 duration-150"
            >
              <DropdownMenuLabel className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider px-2.5 py-1.5">
                Select Pipeline
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/60 mx-1" />

              {pipelineDropdownLoading ? (
                <div className="space-y-1.5 px-2.5 py-2">
                  <div className="h-5 bg-muted rounded-md animate-pulse" />
                  <div className="h-5 bg-muted rounded-md animate-pulse w-3/4" />
                </div>
              ) : workflows.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2.5 py-2 text-center">
                  No pipelines in selected scope
                </p>
              ) : (
                workflows.map((wf: any) => {
                  const isWfActive =
                    (location.pathname === '/pipeline' || location.pathname === '/cases') &&
                    search.pipelineId === wf.id;
                  return (
                    <DropdownMenuItem key={wf.id} asChild className="p-0 focus:bg-transparent">
                      <Link
                        to="/pipeline"
                        search={{ pipelineId: wf.id }}
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all w-full duration-150 cursor-pointer ${
                          isWfActive
                            ? 'text-primary bg-primary/10 font-bold'
                            : 'text-foreground/80 hover:text-foreground hover:bg-accent'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 mr-1.5 shadow-sm border border-white/10 ${getPipelineColor(wf.id)}`}
                        />
                        <span className="truncate flex-1 text-left">{wf.name}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} className="h-8.5 rounded-lg">
          <Link
            to={item.path}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 ${
              isActive
                ? 'bg-primary/10 text-primary font-bold shadow-xs border border-primary/20'
                : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
            }`}
          >
            <item.icon
              size={14}
              strokeWidth={isActive ? 2.5 : 1.75}
              className={isActive ? 'text-primary' : 'text-sidebar-foreground/60'}
            />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge && (
              <Badge
                variant={item.badgeVariant || 'secondary'}
                className="text-[9px] px-1 py-0 h-4 uppercase font-bold"
              >
                {item.badge}
              </Badge>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground w-[260px]">
      {/* Workspace Brand Header */}
      <SidebarHeader className="px-3.5 py-3 border-b border-sidebar-border bg-sidebar">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/20">
              <span className="text-white text-xs font-bold tracking-tight">M</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-sidebar-foreground leading-none tracking-tight truncate">
                Meta CRM
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium truncate">
                Enterprise Workspace
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-[9px] font-mono font-semibold text-primary border-primary/30 bg-primary/5 px-1.5 py-0 h-4.5"
          >
            v2.4
          </Badge>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-2 pb-3 bg-sidebar space-y-1">
        {/* Branch Context Selector */}
        <div className="px-1 mb-1">
          <BranchSelector />
        </div>

        {/* Live Filter Menu Input (Matching user's friend's CRM) */}
        <div className="px-1 pb-1">
          <div className="relative flex items-center">
            <Search
              size={13}
              className="absolute left-2.5 text-muted-foreground/60 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter menu…"
              className="w-full bg-sidebar-accent/50 hover:bg-sidebar-accent/75 focus:bg-background border border-sidebar-border/70 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-lg pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 transition-all outline-none font-medium"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded transition-colors"
                title="Clear filter"
              >
                <X size={12} />
              </button>
            ) : (
              <span className="absolute right-2 text-[9px] font-mono text-muted-foreground/50 bg-background/80 border border-border/40 px-1 py-0.2 rounded select-none pointer-events-none">
                /
              </span>
            )}
          </div>
        </div>

        {isFiltering && (
          <div className="px-2 py-1 flex items-center justify-between text-[10px] text-muted-foreground border-b border-border/40 mb-1">
            <span>Filtering menu</span>
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-mono font-bold">
              {totalMatches} match{totalMatches === 1 ? '' : 'es'}
            </Badge>
          </div>
        )}

        {/* Empty Search State */}
        {isFiltering && totalMatches === 0 && (
          <div className="px-3 py-6 text-center space-y-2">
            <p className="text-xs text-muted-foreground">No menu items found</p>
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-primary hover:underline font-medium cursor-pointer"
            >
              Clear filter
            </button>
          </div>
        )}

        {/* 1. Core Workspace Navigation */}
        {filteredCoreItems.length > 0 && (
          <SidebarGroup className="p-0">
            <div className="px-2.5 py-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                Main
              </span>
              {isFiltering && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {filteredCoreItems.length}
                </span>
              )}
            </div>
            <SidebarGroupContent>
              <SidebarMenu>{filteredCoreItems.map((item) => renderNavItem(item))}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* 2. Capability Domains (Academics, Finance, Sales, Telephony, etc.) */}
        {filteredCapabilityGroups.map((group) => {
          const displayName = customNames[group.id] || group.label;
          const isEditing = editingName === group.id;
          const isChildActive = group.items.some(
            (it) => location.pathname === it.path || (it.path !== '/' && location.pathname.startsWith(`${it.path}/`))
          );
          const isOpen = isFiltering || isChildActive || (expandedDomains[group.id] ?? true);

          return (
            <Collapsible
              key={group.id}
              open={isOpen}
              onOpenChange={() => !isFiltering && toggleDomain(group.id)}
              className="group/collapsible"
            >
              <SidebarGroup className="p-0 pt-1">
                <div className="flex items-center justify-between px-2 py-1 group/header">
                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <group.icon size={13} className="text-primary flex-shrink-0" />
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(group.id);
                          if (e.key === 'Escape') cancelRename();
                        }}
                        className="flex-1 text-xs font-bold text-foreground bg-background rounded border border-border px-1.5 py-0.5 outline-none min-w-0"
                      />
                      <button
                        onClick={() => saveRename(group.id)}
                        className="p-0.5 rounded text-emerald-600 hover:bg-emerald-50 transition-colors flex-shrink-0 cursor-pointer"
                      >
                        <Check size={11} />
                      </button>
                      <button
                        onClick={cancelRename}
                        className="p-0.5 rounded text-rose-600 hover:bg-rose-50 transition-colors flex-shrink-0 cursor-pointer"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer select-none text-left py-0.5">
                          <group.icon size={13} className="text-primary/80 flex-shrink-0" />
                          <span className="text-xs font-bold text-foreground/90 tracking-tight truncate flex-1">
                            {displayName}
                          </span>
                          {isFiltering ? (
                            <span className="text-[10px] text-muted-foreground font-mono pr-1">
                              {group.items.length}
                            </span>
                          ) : (
                            <ChevronDown
                              size={12}
                              className="text-muted-foreground/60 flex-shrink-0 transition-transform duration-200 group-data-[state=closed]/collapsible:-rotate-90"
                            />
                          )}
                        </button>
                      </CollapsibleTrigger>
                      {!isFiltering && (
                        <button
                          onClick={() => startRename(group.id, displayName)}
                          className="opacity-0 group-hover/header:opacity-100 p-0.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-all flex-shrink-0 cursor-pointer ml-1"
                          title="Rename domain"
                        >
                          <Pencil size={10} />
                        </button>
                      )}
                    </>
                  )}
                </div>

                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>{group.items.map((item) => renderNavItem(item))}</SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      {/* User Footer Account Card */}
      <SidebarFooter className="border-t border-sidebar-border p-2 bg-sidebar">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 w-full p-2 rounded-xl hover:bg-sidebar-accent/60 transition-colors text-left text-sidebar-foreground cursor-pointer">
              <Avatar className="w-7 h-7 flex-shrink-0">
                <AvatarFallback className="bg-primary text-white text-xs font-bold shadow-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate leading-tight">
                  {user?.name ?? 'User'}
                </p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {user?.email ?? ''}
                </p>
              </div>
              <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-52 bg-popover border-border text-popover-foreground shadow-lg rounded-xl p-1.5"
          >
            <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-2 py-1">
              Active Session
            </DropdownMenuLabel>
            <div className="px-2 py-1 text-xs font-medium text-foreground">
              {user?.name}
              <div className="text-[10px] text-muted-foreground font-normal">{user?.email}</div>
            </div>
            <DropdownMenuSeparator className="bg-border/60 my-1" />
            <DropdownMenuItem asChild className="p-0">
              <Link
                to="/settings"
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-accent cursor-pointer"
              >
                <Settings size={13} />
                Workspace Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/60 my-1" />
            <DropdownMenuItem
              onClick={logout}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive cursor-pointer"
            >
              <LogOut size={13} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
