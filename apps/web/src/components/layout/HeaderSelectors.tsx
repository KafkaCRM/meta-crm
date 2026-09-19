import React from 'react';
import { useCurrency, type CurrencyType } from '@/contexts/currency.context';
import { useBranch } from '@/contexts/branch.context';
import { useAuth } from '@/contexts/auth.context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Coins } from 'lucide-react';

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();

  return (
    <div className="flex items-center gap-1.5">
      <Select value={currency} onValueChange={(val) => setCurrency(val as CurrencyType)}>
        <SelectTrigger size="sm" className="h-8 rounded-xl border-border bg-muted/60 text-xs font-semibold hover:bg-accent transition-colors gap-1.5 px-2.5">
          <Coins size={13} className="text-muted-foreground" />
          <SelectValue placeholder="Currency" />
        </SelectTrigger>
        <SelectContent align="end" className="rounded-xl border-border bg-popover shadow-md">
          <SelectItem value="INR" className="text-xs font-medium cursor-pointer">
            ₹ INR (Indian Rupee)
          </SelectItem>
          <SelectItem value="USD" className="text-xs font-medium cursor-pointer">
            $ USD (US Dollar)
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function BranchSelector() {
  const { selectedBranchId, setSelectedBranchId, branches, isLoading, isSingleBranch } = useBranch();

  // For individual or solo-branch workspaces, hide the branch selector completely to eliminate clutter
  if (isSingleBranch) {
    return null;
  }

  return (
    <div className="w-full">
      <Select
        value={selectedBranchId || '__ALL__'}
        onValueChange={(val) => setSelectedBranchId(val === '__ALL__' ? '' : val)}
        disabled={isLoading}
      >
        <SelectTrigger size="sm" className="h-8 w-full rounded-xl border-sidebar-border bg-sidebar-accent/30 text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors shadow-none">
          <div className="flex items-center gap-2 truncate">
            <Building2 size={13} className="text-sidebar-foreground/60 shrink-0" />
            <SelectValue placeholder="All Branches" />
          </div>
        </SelectTrigger>
        <SelectContent className="rounded-xl border-border bg-popover shadow-md">
          <SelectItem value="__ALL__" className="text-xs font-medium cursor-pointer">
            All Branches
          </SelectItem>
          {branches.map((b: any) => (
            <SelectItem key={b.id} value={b.id} className="text-xs font-medium cursor-pointer">
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function WorkspaceBadge() {
  const { user } = useAuth();
  const [workspaceName, setWorkspaceName] = React.useState<string>(() => {
    try {
      return localStorage.getItem('meta_crm_tenant_name') || 'Workspace';
    } catch {
      return 'Workspace';
    }
  });

  // Listen for storage updates or user changes
  React.useEffect(() => {
    const updateName = () => {
      const stored = localStorage.getItem('meta_crm_tenant_name');
      if (stored) setWorkspaceName(stored);
    };

    window.addEventListener('storage', updateName);
    updateName();
    return () => window.removeEventListener('storage', updateName);
  }, [user]);

  return (
    <div className="text-xs font-semibold text-foreground border border-border px-2.5 py-1 rounded-xl bg-muted select-none flex items-center gap-1.5 shadow-none">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Workspace:</span>
      <span className="truncate max-w-[140px]">{workspaceName}</span>
    </div>
  );
}
