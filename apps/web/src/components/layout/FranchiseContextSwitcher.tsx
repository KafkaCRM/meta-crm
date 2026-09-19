import React from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { franchiseApi } from '@/api/franchise';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Store, Network, ChevronDown, CheckCircle2 } from 'lucide-react';

export function FranchiseContextSwitcher() {
  const { data: status, isLoading } = useQuery({
    queryKey: ['franchise', 'status'],
    queryFn: () => franchiseApi.getStatus(),
    staleTime: 60_000,
  });

  if (isLoading || !status) return null;

  if (status.is_franchisor) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 text-xs font-semibold select-none cursor-pointer transition-colors">
            <Network size={13} className="text-purple-500" />
            <span>Franchisor HQ</span>
            <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] bg-purple-500/20 text-purple-600 dark:text-purple-300 border-none font-bold">
              {status.franchisee_count} Stores
            </Badge>
            <ChevronDown size={11} className="opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-xl border-border bg-popover shadow-lg p-1.5">
          <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider px-2 py-1">
            Enterprise Hierarchy
          </DropdownMenuLabel>
          <div className="px-2 py-1.5 text-xs text-foreground">
            <p className="font-semibold">{status.tenant_name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Primary Franchisor Authority</p>
          </div>
          <DropdownMenuSeparator className="my-1 bg-border/60" />
          <div className="px-2 py-1.5 text-xs space-y-1">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Managed Stores:</span>
              <span className="font-bold text-foreground">{status.franchisee_count} active</span>
            </div>
            {status.royalty_percentage !== null && (
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Standard Royalty:</span>
                <span className="font-bold text-foreground">{status.royalty_percentage}%</span>
              </div>
            )}
          </div>
          <DropdownMenuSeparator className="my-1 bg-border/60" />
          <div className="p-1">
            <Link
              to="/franchise"
              className="w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition-colors"
            >
              <span>HQ Command Console</span>
              <span className="text-[10px]">➔</span>
            </Link>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (status.is_franchisee) {
    return (
      <Link
        to="/franchise"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-xs font-semibold select-none transition-colors"
      >
        <Store size={13} className="text-blue-500" />
        <span className="truncate max-w-[120px]">
          {status.parent_franchisor?.name ? `Store of ${status.parent_franchisor.name}` : 'Franchise Store'}
        </span>
        <CheckCircle2 size={12} className="text-blue-500 shrink-0" />
      </Link>
    );
  }

  return null;
}
