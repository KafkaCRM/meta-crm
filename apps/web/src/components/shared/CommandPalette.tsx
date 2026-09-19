import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { 
  CommandDialog, 
  CommandInput, 
  CommandList, 
  CommandEmpty, 
  CommandGroup, 
  CommandItem, 
  CommandShortcut 
} from '@/components/ui/command';
import { 
  LayoutDashboard, 
  Users, 
  Megaphone, 
  Settings2, 
  Sliders, 
  Building2,
  Phone,
  MessageSquare,
  ExternalLink,
  UserPlus,
  Loader2,
  Kanban,
  Receipt,
  GraduationCap,
  Puzzle,
  Shield,
  Briefcase,
  Layers,
  ArrowRight,
  Target,
} from 'lucide-react';
import { leadsApi, type LeadResponse } from '@/api/leads';
import { campaignsApi, type Campaign } from '@/api/campaigns';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandItemType {
  id: string;
  label: string;
  to?: string;
  action?: () => void;
  icon: any;
  shortcut?: string;
  keywords?: string[];
  highlight?: boolean;
}

interface CommandGroupType {
  heading: string;
  items: CommandItemType[];
}

const STATIC_COMMANDS: CommandGroupType[] = [
  {
    heading: 'Quick Operations',
    items: [
      {
        id: 'create-lead',
        label: 'Create New Lead',
        icon: UserPlus,
        shortcut: 'C',
        keywords: ['add lead', 'new contact', 'capture lead', 'prospect'],
        action: () => {
          window.dispatchEvent(new CustomEvent('open-create-lead'));
        },
        to: '/leads',
        highlight: true,
      },
      {
        id: 'new-deal',
        label: 'New Pipeline Deal',
        icon: Kanban,
        keywords: ['deal', 'opportunity', 'stage', 'sales pipeline'],
        to: '/pipeline',
      },
      {
        id: 'new-campaign',
        label: 'Launch New Campaign',
        icon: Megaphone,
        keywords: ['marketing', 'campaign', 'ad', 'outreach'],
        to: '/campaigns',
      },
    ],
  },
  {
    heading: 'Core Workspace',
    items: [
      { id: 'dashboard', label: 'Executive Dashboard', to: '/', icon: LayoutDashboard, shortcut: '⌘D', keywords: ['home', 'overview', 'stats', 'kpi'] },
      { id: 'leads', label: 'Leads Cockpit', to: '/leads', icon: Users, shortcut: '⌘L', keywords: ['contacts', 'prospects', 'calling', 'speed to lead'] },
      { id: 'pipeline', label: 'Deals & Pipeline Kanban', to: '/pipeline', icon: Kanban, shortcut: '⌘P', keywords: ['deals', 'sales', 'funnel', 'stages'] },
      { id: 'campaigns', label: 'Campaigns & Marketing', to: '/campaigns', icon: Megaphone, shortcut: '⌘M', keywords: ['ads', 'channels', 'roi', 'utm'] },
      { id: 'billing', label: 'Billing & Invoices', to: '/billing/invoices', icon: Receipt, keywords: ['payments', 'finance', 'invoice', 'receipts'] },
      { id: 'finance', label: 'Financial Accounts & Ledger', to: '/finance', icon: Briefcase, keywords: ['money', 'accounting', 'ledger', 'balance'] },
    ],
  },
  {
    heading: 'Operations & Academics',
    items: [
      { id: 'academics-courses', label: 'Course Catalog & Syllabus', to: '/academics/courses', icon: GraduationCap, keywords: ['education', 'courses', 'curriculum'] },
      { id: 'academics-batches', label: 'Batches & Attendance', to: '/academics/batches', icon: Layers, keywords: ['students', 'classes', 'roster', 'cohorts'] },
      { id: 'integrations', label: 'Integrations & Webhooks', to: '/integrations', icon: Puzzle, keywords: ['api', 'justdial', 'whatsapp', 'facebook', 'webhook', 'connect'] },
    ],
  },
  {
    heading: 'Administration & Studio',
    items: [
      { id: 'settings-fields', label: 'Custom Fields & Metadata', to: '/settings/fields', icon: Sliders, keywords: ['attributes', 'schema', 'properties', 'custom fields'] },
      { id: 'settings-extensions', label: 'Extensions & Capabilities', to: '/settings/extensions', icon: Puzzle, keywords: ['plugins', 'modules', 'addons', 'capabilities'] },
      { id: 'settings-branches', label: 'Franchise Branches', to: '/settings/branches', icon: Building2, keywords: ['stores', 'locations', 'franchise', 'units'] },
      { id: 'settings-roles', label: 'Roles & Access Control', to: '/settings/roles', icon: Shield, keywords: ['permissions', 'rbac', 'users', 'access'] },
      { id: 'settings-objects', label: 'Custom Objects Studio', to: '/settings/objects', icon: Settings2, keywords: ['schema', 'entities', 'custom objects'] },
    ],
  },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle global keydown events for shortcut (⌘K / Ctrl+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Reset search state when closed
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setDebouncedSearch('');
    }
  }, [open]);

  // Parse prefixes (e.g. "call John" or "wa 9876543210")
  const parsedAction = useMemo(() => {
    const trimmed = searchQuery.trim();
    const callMatch = trimmed.match(/^call\s+(.+)$/i);
    const waMatch = trimmed.match(/^(wa|whatsapp)\s+(.+)$/i);

    if (callMatch && callMatch[1]) {
      return { prefix: 'call', target: callMatch[1] };
    } else if (waMatch && waMatch[2]) {
      return { prefix: 'whatsapp', target: waMatch[2] };
    }
    return null;
  }, [searchQuery]);

  // Determine search term for API
  const apiSearchTerm = useMemo(() => {
    if (parsedAction) return parsedAction.target || '';
    return debouncedSearch.trim();
  }, [parsedAction, debouncedSearch]);

  // Fetch matching leads via API
  const { data: matchingLeadsData, isLoading: isLeadsLoading } = useQuery({
    queryKey: ['command-palette-leads', apiSearchTerm],
    queryFn: async () => {
      if (!apiSearchTerm) return [];
      try {
        const res = await leadsApi.list({ name: apiSearchTerm, limit: 5 });
        return res?.data ?? [];
      } catch {
        return [];
      }
    },
    enabled: apiSearchTerm.length > 0,
    staleTime: 10_000,
  });

  const matchingLeads = matchingLeadsData ?? [];

  // Fetch campaigns for cross-search
  const { data: campaignsData = [] } = useQuery({
    queryKey: ['command-palette-campaigns'],
    queryFn: async () => {
      try {
        const res = await campaignsApi.list();
        return Array.isArray(res) ? res : (res as any)?.data ?? [];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  const matchingCampaigns = useMemo(() => {
    if (!apiSearchTerm) return [];
    const term = apiSearchTerm.toLowerCase();
    return campaignsData
      .filter((c: any) => c.name?.toLowerCase().includes(term) || c.channel?.toLowerCase().includes(term))
      .slice(0, 4);
  }, [campaignsData, apiSearchTerm]);

  // Direct actions
  const openPhone = useCallback((phone: string) => {
    window.location.href = `tel:${phone}`;
    onOpenChange(false);
  }, [onOpenChange]);

  const openWhatsApp = useCallback((phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = `91${cleaned}`;
    window.open(`https://api.whatsapp.com/send?phone=${cleaned}`, '_blank');
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSelectItem = useCallback((item: CommandItemType) => {
    if (item.action) {
      item.action();
    }
    if (item.to) {
      navigate({ to: item.to });
    }
    onOpenChange(false);
  }, [navigate, onOpenChange]);

  // Filter static commands manually
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return STATIC_COMMANDS;

    const query = searchQuery.toLowerCase();

    return STATIC_COMMANDS.map((group) => {
      const filteredItems = group.items.filter((item) => {
        if (item.label.toLowerCase().includes(query)) return true;
        if (item.keywords?.some((k) => k.toLowerCase().includes(query))) return true;
        return false;
      });
      return {
        ...group,
        items: filteredItems,
      };
    }).filter((group) => group.items.length > 0);
  }, [searchQuery]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput 
        placeholder="Type a command, lead name, campaign, or action ('call 987...', 'wa +1...')..." 
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        {isLeadsLoading && (
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Searching CRM records...</span>
          </div>
        )}

        {filteredGroups.length === 0 && matchingLeads.length === 0 && matchingCampaigns.length === 0 && !parsedAction && (
          <CommandEmpty>No administrative actions, leads, or campaigns matched.</CommandEmpty>
        )}

        {/* Dynamic Action Trigger (Prefix matches) */}
        {parsedAction && parsedAction.target && (
          <CommandGroup heading="Direct Action Operations">
            {parsedAction.prefix === 'call' ? (
              <CommandItem onSelect={() => openPhone(parsedAction.target)}>
                <Phone className="mr-2 h-4 w-4 text-emerald-500 animate-pulse" />
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">Dial "{parsedAction.target}"</span>
                  <span className="text-[10px] text-muted-foreground">Press Enter to initiate phone call directly</span>
                </div>
              </CommandItem>
            ) : (
              <CommandItem onSelect={() => openWhatsApp(parsedAction.target)}>
                <MessageSquare className="mr-2 h-4 w-4 text-emerald-500 animate-pulse" />
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">Send WhatsApp to "{parsedAction.target}"</span>
                  <span className="text-[10px] text-muted-foreground">Press Enter to open WhatsApp conversation</span>
                </div>
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {/* Matching Leads Search Results */}
        {matchingLeads.length > 0 && (
          <CommandGroup heading="Matching Leads">
            {matchingLeads.map((lead: LeadResponse) => (
              <CommandItem 
                key={lead.id} 
                onSelect={() => {
                  navigate({ to: `/leads/$id`, params: { id: lead.id } });
                  onOpenChange(false);
                }}
                className="group flex items-center justify-between py-2.5 cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <Users className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  <div className="flex flex-col truncate">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">{lead.name}</span>
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase border",
                        lead.status === 'converted'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : lead.status === 'hot'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-muted text-muted-foreground border-border'
                      )}>
                        {lead.status}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono truncate">{lead.phone}</span>
                  </div>
                </div>

                {/* Quick Action Dial Buttons */}
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      openPhone(lead.phone);
                    }}
                    className="p-1.5 rounded-md hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground transition-all duration-200 cursor-pointer"
                    title="Call"
                  >
                    <Phone size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      openWhatsApp(lead.phone);
                    }}
                    className="p-1.5 rounded-md hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground transition-all duration-200 cursor-pointer"
                    title="WhatsApp"
                  >
                    <MessageSquare size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      navigate({ to: `/leads/$id`, params: { id: lead.id } });
                      onOpenChange(false);
                    }}
                    className="p-1.5 rounded-md hover:bg-blue-50 hover:text-blue-600 text-muted-foreground transition-all duration-200 cursor-pointer"
                    title="View Profile"
                  >
                    <ExternalLink size={13} />
                  </button>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Matching Campaigns Search Results */}
        {matchingCampaigns.length > 0 && (
          <CommandGroup heading="Matching Campaigns">
            {matchingCampaigns.map((camp: Campaign) => (
              <CommandItem
                key={camp.id}
                onSelect={() => {
                  navigate({ to: '/campaigns' });
                  onOpenChange(false);
                }}
                className="group flex items-center justify-between py-2 cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <Megaphone className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col truncate">
                    <span className="font-medium text-foreground truncate">{camp.name}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">Channel: {camp.channel || 'All'} · Status: {camp.status}</span>
                  </div>
                </div>
                <ArrowRight size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Static Navigation and Actions */}
        {filteredGroups.map((group) => (
          <CommandGroup key={group.heading} heading={group.heading}>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelectItem(item)}
                  className={cn(
                    "cursor-pointer",
                    item.highlight && "text-primary font-semibold"
                  )}
                >
                  <Icon className={cn("mr-2 h-4 w-4", item.highlight ? "text-primary" : "text-muted-foreground")} />
                  <span>{item.label}</span>
                  {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
