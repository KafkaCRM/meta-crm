import { useEffect, useState, useRef, useMemo } from 'react';
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
  Workflow, 
  Megaphone, 
  Settings2, 
  Layers, 
  Sliders, 
  Building2,
  Phone,
  MessageSquare,
  ExternalLink,
  UserPlus,
  Loader2,
  User
} from 'lucide-react';
import { partiesApi } from '@/api/parties';
import { PartyType } from '@meta-crm/types';
import type { PartyResponse } from '@meta-crm/types';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandItemType {
  id: string;
  label: string;
  to: string;
  icon: any;
  shortcut?: string;
  highlight?: boolean;
}

interface CommandGroupType {
  heading: string;
  items: CommandItemType[];
}

const navigationCommands: CommandGroupType[] = [
  {
    heading: "CRM Workspace Navigations",
    items: [
      { id: "dashboard", label: "Go to Dashboard", to: "/", icon: LayoutDashboard, shortcut: "⌘D" },
      { id: "parties", label: "Browse Contacts / Leads", to: "/parties", icon: Users, shortcut: "⌘C" },
      { id: "cases", label: "Manage Case Tickets", to: "/cases", icon: Workflow, shortcut: "⌘S" },
      { id: "campaigns", label: "Campaign Promotions", to: "/campaigns", icon: Megaphone, shortcut: "⌘M" },
    ]
  },
  {
    heading: "Quick Operations",
    items: [
      { id: "create-lead", label: "Create New Contact / Lead", to: "/parties/new", icon: UserPlus },
      { id: "create-case", label: "Create New Case Ticket", to: "/cases/new", icon: Workflow },
    ]
  },
  {
    heading: "Administrative Setup Areas",
    items: [
      { id: "settings-objects", label: "Platform Object Manager", to: "/settings/objects", icon: Settings2, shortcut: "⌘O", highlight: true },
      { id: "settings-layout", label: "Visual Layout Designer", to: "/settings/layout-builder", icon: Layers, shortcut: "⌘L", highlight: true },
      { id: "settings-fields", label: "Custom Fields Configurator", to: "/settings/fields", icon: Sliders },
      { id: "settings-brands", label: "Tenant Brands Manager", to: "/settings/brands", icon: Building2 },
    ]
  }
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle global keydown events for shortcut
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
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
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
    return debouncedSearch;
  }, [parsedAction, debouncedSearch]);

  // Fetch matching contacts/leads via API
  const { data: matchingParties = [], isLoading } = useQuery({
    queryKey: ['command-palette-parties', apiSearchTerm],
    queryFn: async () => {
      if (!apiSearchTerm.trim()) return [];
      const params: any = { limit: 5 };
      if (/^\+?\d/.test(apiSearchTerm)) {
        params.phone = apiSearchTerm;
      } else {
        params.name = apiSearchTerm;
      }
      try {
        const res = await partiesApi.list(params);
        return res.data ?? [];
      } catch (err) {
        console.error(err);
        return [];
      }
    },
    enabled: apiSearchTerm.trim().length > 0,
  });

  // Action methods
  const openPhone = (phone: string) => {
    window.location.href = `tel:${phone}`;
    onOpenChange(false);
  };

  const openWhatsApp = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = `91${cleaned}`;
    window.open(`https://api.whatsapp.com/send?phone=${cleaned}`, '_blank');
    onOpenChange(false);
  };

  // Filter static commands manually (since shouldFilter={false} is set)
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return navigationCommands;

    const query = searchQuery.toLowerCase();
    
    return navigationCommands.map(group => {
      const filteredItems = group.items.filter(item => 
        item.label.toLowerCase().includes(query)
      );
      return {
        ...group,
        items: filteredItems
      };
    }).filter(group => group.items.length > 0);
  }, [searchQuery]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput 
        placeholder="Type a command or record name (e.g. 'call John' or 'wa +1...')..." 
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        {isLoading && (
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Searching CRM records...</span>
          </div>
        )}
        
        {filteredGroups.length === 0 && matchingParties.length === 0 && !parsedAction && (
          <CommandEmpty>No administrative actions or contacts matched.</CommandEmpty>
        )}

        {/* Dynamic Action Trigger (Prefix matches) */}
        {parsedAction && parsedAction.target && (
          <CommandGroup heading="Direct Action Operations">
            {parsedAction.prefix === 'call' ? (
              <CommandItem onSelect={() => openPhone(parsedAction.target)}>
                <Phone className="mr-2 h-4 w-4 text-emerald-500 animate-pulse" />
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">Dial "{parsedAction.target}"</span>
                  <span className="text-[10px] text-muted-foreground">Press Enter to dial this number directly</span>
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

        {/* Dynamic Contact Search Results */}
        {matchingParties.length > 0 && (
          <CommandGroup heading="Matching Contacts / Leads">
            {matchingParties.map((party: PartyResponse) => (
              <CommandItem 
                key={party.id} 
                onSelect={() => {
                  navigate({ to: `/parties/${party.id}` });
                  onOpenChange(false);
                }}
                className="group flex items-center justify-between py-2.5 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{party.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{party.phone_raw}</span>
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-2 capitalize border",
                    party.type === PartyType.Individual 
                      ? "bg-blue-50 text-blue-700 border-blue-200" 
                      : "bg-purple-50 text-purple-700 border-purple-200"
                  )}>
                    {party.type === PartyType.Individual ? 'Individual' : 'Organization'}
                  </span>
                </div>
                
                {/* Hover Action Shortcuts */}
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      openPhone(party.phone_raw);
                    }}
                    className="p-1.5 rounded-md hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground transition-all duration-200"
                    title="Call"
                  >
                    <Phone size={13} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      openWhatsApp(party.phone_raw);
                    }}
                    className="p-1.5 rounded-md hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground transition-all duration-200"
                    title="WhatsApp"
                  >
                    <MessageSquare size={13} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      navigate({ to: `/parties/${party.id}` });
                      onOpenChange(false);
                    }}
                    className="p-1.5 rounded-md hover:bg-blue-50 hover:text-blue-600 text-muted-foreground transition-all duration-200"
                    title="View Profile"
                  >
                    <ExternalLink size={13} />
                  </button>
                </div>
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
                  onSelect={() => {
                    navigate({ to: item.to });
                    onOpenChange(false);
                  }}
                  className={cn(
                    "cursor-pointer",
                    item.highlight && "text-fin-orange font-medium"
                  )}
                >
                  <Icon className={cn("mr-2 h-4 w-4", item.highlight ? "text-fin-orange" : "text-muted-foreground")} />
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
