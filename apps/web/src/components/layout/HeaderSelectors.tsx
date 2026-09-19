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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Building2, Coins, ChevronDown, Check } from 'lucide-react';

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
  const {
    selectedBranchIds,
    setSelectedBranchIds,
    toggleBranchId,
    selectAllBranches,
    branches,
    isLoading,
    isSingleBranch,
  } = useBranch();

  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  // For individual or solo-branch workspaces, hide the branch selector completely to eliminate clutter
  if (isSingleBranch) {
    return null;
  }

  const filteredBranches = branches.filter((b: any) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.city && b.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isAllChecked =
    selectedBranchIds.length === 0 || (branches.length > 0 && selectedBranchIds.length === branches.length);

  let triggerLabel = 'All Branches';
  if (!isAllChecked && selectedBranchIds.length === 1) {
    const single = branches.find((b: any) => b.id === selectedBranchIds[0]);
    triggerLabel = single?.name || '1 Branch';
  } else if (!isAllChecked && selectedBranchIds.length > 1) {
    triggerLabel = `${selectedBranchIds.length} Branches`;
  }

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isLoading}
            className="h-8 w-full flex items-center justify-between gap-2 px-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent/30 text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors shadow-none text-left"
          >
            <div className="flex items-center gap-2 truncate min-w-0">
              <Building2 size={13} className="text-sidebar-foreground/60 shrink-0" />
              <span className="truncate">{triggerLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!isAllChecked && selectedBranchIds.length > 1 && (
                <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-white text-[10px] font-bold">
                  {selectedBranchIds.length}
                </span>
              )}
              <ChevronDown size={12} className="text-sidebar-foreground/50" />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2 rounded-xl border-border bg-popover shadow-lg" align="start">
          {branches.length > 5 && (
            <div className="mb-2">
              <Input
                placeholder="Search branches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-7 text-xs bg-muted/50 border-border"
              />
            </div>
          )}

          <div className="space-y-1 max-h-60 overflow-y-auto">
            {/* All Branches master toggle */}
            <div
              onClick={() => selectAllBranches()}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-accent cursor-pointer transition-colors text-xs font-medium text-foreground select-none"
            >
              <Checkbox
                checked={isAllChecked}
                onCheckedChange={() => selectAllBranches()}
                className="pointer-events-none"
              />
              <span className="flex-1">All Branches</span>
              <span className="text-[10px] text-muted-foreground">({branches.length})</span>
            </div>

            <div className="h-px bg-border/60 my-1" />

            {/* Individual branch rows */}
            {filteredBranches.map((b: any) => {
              const isChecked = !isAllChecked && selectedBranchIds.includes(b.id);
              return (
                <div
                  key={b.id}
                  onClick={() => toggleBranchId(b.id)}
                  className="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent cursor-pointer transition-colors text-xs text-foreground select-none"
                >
                  <div className="flex items-center gap-2.5 truncate min-w-0">
                    <Checkbox
                      checked={isChecked}
                      className="pointer-events-none"
                    />
                    <div className="truncate">
                      <span className="truncate block font-medium">{b.name}</span>
                      {b.city && <span className="text-[10px] text-muted-foreground block">{b.city}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBranchIds([b.id]);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-primary hover:underline px-1 py-0.5 rounded transition-opacity"
                  >
                    Only
                  </button>
                </div>
              );
            })}

            {filteredBranches.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No branches found</p>
            )}
          </div>

          {!isAllChecked && selectedBranchIds.length > 0 && (
            <div className="pt-2 mt-1 border-t border-border flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {selectedBranchIds.length} of {branches.length} selected
              </span>
              <button
                type="button"
                onClick={() => selectAllBranches()}
                className="text-[10px] text-primary hover:underline font-medium"
              >
                Reset to All
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function VerticalSelector() {
  const { selectedVerticalId, setSelectedVerticalId, verticals, isSingleVertical } = useBranch();

  if (isSingleVertical) {
    return null;
  }

  return (
    <div className="w-full">
      <Select
        value={selectedVerticalId || '__ALL__'}
        onValueChange={(val) => setSelectedVerticalId(val === '__ALL__' ? '' : val)}
      >
        <SelectTrigger size="sm" className="h-8 w-full rounded-xl border-sidebar-border bg-sidebar-accent/30 text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors shadow-none">
          <div className="flex items-center gap-2 truncate">
            <Building2 size={13} className="text-sidebar-foreground/60 shrink-0" />
            <SelectValue placeholder="All Lines of Business" />
          </div>
        </SelectTrigger>
        <SelectContent className="rounded-xl border-border bg-popover shadow-md">
          <SelectItem value="__ALL__" className="text-xs font-medium cursor-pointer">
            All Lines of Business
          </SelectItem>
          {verticals.map((v: any) => (
            <SelectItem key={v.id} value={v.id} className="text-xs font-medium cursor-pointer">
              {v.name}
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
