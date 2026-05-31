import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
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
  Calendar,
  Search
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();

  // Handle global keydown events
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

  const handleSelectRoute = (to: string) => {
    navigate({ to });
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or record name to search..." />
      <CommandList>
        <CommandEmpty>No administrative actions matched.</CommandEmpty>
        
        {/* Core Nav Actions */}
        <CommandGroup heading="CRM Workspace Navigations">
          <CommandItem onSelect={() => handleSelectRoute('/')}>
            <LayoutDashboard className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Go to Dashboard</span>
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
          
          <CommandItem onSelect={() => handleSelectRoute('/parties')}>
            <Users className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Browse Contacts / Leads</span>
            <CommandShortcut>⌘C</CommandShortcut>
          </CommandItem>
          
          <CommandItem onSelect={() => handleSelectRoute('/cases')}>
            <Workflow className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Manage Case Tickets</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
          
          <CommandItem onSelect={() => handleSelectRoute('/campaigns')}>
            <Megaphone className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Campaign Promotions</span>
            <CommandShortcut>⌘M</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {/* Administration Configuration Actions */}
        <CommandGroup heading="Administrative Setup Areas">
          <CommandItem onSelect={() => handleSelectRoute('/settings/objects')}>
            <Settings2 className="mr-2 h-4 w-4 text-fin-orange" />
            <span>Platform Object Manager</span>
            <CommandShortcut>⌘O</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => handleSelectRoute('/settings/layout-builder')}>
            <Layers className="mr-2 h-4 w-4 text-fin-orange" />
            <span>Visual Layout Designer</span>
            <CommandShortcut>⌘L</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => handleSelectRoute('/settings/fields')}>
            <Sliders className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Custom Fields Configurator</span>
          </CommandItem>

          <CommandItem onSelect={() => handleSelectRoute('/settings/brands')}>
            <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Tenant Brands Manager</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
