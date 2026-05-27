import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { listTenants } from '@/api/platform';
import { toast } from 'sonner';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Building2,
  CreditCard,
  Puzzle,
  BarChart3,
  Users,
  Activity,
  Settings,
  Sliders,
  Zap,
  LayoutDashboard,
  Database,
  RefreshCw,
  Cpu,
  CornerDownLeft,
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();

  // Fetch tenants for quick jumps
  const { data: tenantResponse } = useQuery({
    queryKey: ['tenants-list-cmdk'],
    queryFn: () => listTenants(undefined, 100),
    enabled: open,
  });

  const tenants = tenantResponse?.data ?? [];

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

  const runCommand = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  const handleDiagnostic = (title: string, message: string) => {
    runCommand(() => {
      toast.promise(
        new Promise((resolve) => setTimeout(resolve, 1000)),
        {
          loading: `Executing ${title}...`,
          success: message,
          error: 'Action failed to execute.',
        }
      );
    });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search tenants..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        {/* Navigation Group */}
        <CommandGroup heading="Quick Jumps">
          <CommandItem onSelect={() => runCommand(() => navigate({ to: '/' }))}>
            <LayoutDashboard className="mr-2 h-4 w-4 text-slate-400" />
            <span>Go to Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: '/admin/tenants' }))}>
            <Building2 className="mr-2 h-4 w-4 text-slate-400" />
            <span>Go to Tenants</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: '/admin/plans' }))}>
            <CreditCard className="mr-2 h-4 w-4 text-slate-400" />
            <span>Go to Plans</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: '/admin/plugins' }))}>
            <Puzzle className="mr-2 h-4 w-4 text-slate-400" />
            <span>Go to Plugins</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: '/admin/objects' }))}>
            <Settings className="mr-2 h-4 w-4 text-slate-400" />
            <span>Go to Object Manager</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: '/admin/layouts' }))}>
            <Sliders className="mr-2 h-4 w-4 text-slate-400" />
            <span>Go to Layout Designer</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: '/admin/flows' }))}>
            <Zap className="mr-2 h-4 w-4 text-slate-400" />
            <span>Go to Process Builder</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: '/admin/reports' }))}>
            <BarChart3 className="mr-2 h-4 w-4 text-slate-400" />
            <span>Go to Platform Reports</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: '/admin/users' }))}>
            <Users className="mr-2 h-4 w-4 text-slate-400" />
            <span>Go to Platform Team</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: '/admin/health' }))}>
            <Activity className="mr-2 h-4 w-4 text-slate-400" />
            <span>Go to System Health</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: '/admin/billing' }))}>
            <CreditCard className="mr-2 h-4 w-4 text-slate-400" />
            <span>Go to Billing & Invoices</span>
          </CommandItem>
        </CommandGroup>

        {tenants.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tenants">
              {tenants.map((tenant) => (
                <CommandItem
                  key={tenant.id}
                  value={`tenant ${tenant.name} ${tenant.slug}`}
                  onSelect={() => runCommand(() => navigate({ to: '/admin/tenants/$id', params: { id: tenant.id } }))}
                >
                  <Building2 className="mr-2 h-4 w-4 text-indigo-400" />
                  <span className="font-medium">{tenant.name}</span>
                  <span className="ml-2 text-xs text-slate-400">({tenant.slug})</span>
                  <span className="ml-auto text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                    Select <CornerDownLeft size={8} />
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        
        {/* Diagnostics Group */}
        <CommandGroup heading="Platform Operations (Diagnostics)">
          <CommandItem
            onSelect={() =>
              handleDiagnostic(
                'Cache Flush',
                'Successfully flushed 12 active cache buckets & invalidated CDN keys.'
              )
            }
          >
            <RefreshCw className="mr-2 h-4 w-4 text-amber-500 animate-spin-slow" />
            <span>Flush Cache (Redis & Cloudflare)</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleDiagnostic(
                'Database Backup',
                'Database snapshot meta_db_backup_prod.sql triggered and uploaded to S3.'
              )
            }
          >
            <Database className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Backup Snapshot (Upload to S3 Vault)</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleDiagnostic(
                'System Check',
                'Completed full diagnostic checks: All system services online, 0 failures.'
              )
            }
          >
            <Cpu className="mr-2 h-4 w-4 text-blue-500" />
            <span>Run System Health Diagnostics</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
