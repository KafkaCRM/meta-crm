import React, { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  OperationalStatusBadge,
  type OperationalStatus,
} from '@/components/shared';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InlineStatusOption {
  id: string;
  label: string;
  operationalStatus: OperationalStatus;
  color: string;
}

export const DEFAULT_LEAD_STATUS_OPTIONS: InlineStatusOption[] = [
  { id: 'new', label: 'New Lead', operationalStatus: 'new', color: 'text-amber-700 bg-amber-50 hover:bg-amber-100/80' },
  { id: 'contacted', label: 'Contacted', operationalStatus: 'contacted', color: 'text-blue-700 bg-blue-50 hover:bg-blue-100/80' },
  { id: 'qualified', label: 'Qualified', operationalStatus: 'qualified', color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80' },
  { id: 'hot', label: 'Hot Priority', operationalStatus: 'pending', color: 'text-rose-700 bg-rose-50 hover:bg-rose-100/80' },
  { id: 'converted', label: 'Converted', operationalStatus: 'converted', color: 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80' },
  { id: 'junk', label: 'Junk / Lost', operationalStatus: 'lost', color: 'text-slate-600 bg-slate-100 hover:bg-slate-200/80' },
];

interface InlineStatusSelectProps {
  status: string;
  options?: InlineStatusOption[];
  onStatusChange?: (newStatus: string) => Promise<void> | void;
  disabled?: boolean;
}

export function InlineStatusSelect({
  status,
  options = DEFAULT_LEAD_STATUS_OPTIONS,
  onStatusChange,
  disabled = false,
}: InlineStatusSelectProps) {
  const [open, setOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const currentOption = options.find((o) => o.id === status) || {
    id: status,
    label: status.replace('_', ' '),
    operationalStatus: 'pending' as OperationalStatus,
    color: 'text-slate-600 bg-slate-100',
  };

  const handleSelect = async (newStatus: string) => {
    if (newStatus === status) {
      setOpen(false);
      return;
    }
    if (!onStatusChange) return;

    setIsUpdating(true);
    try {
      await onStatusChange(newStatus);
      setOpen(false);
    } catch {
      // Error handled by parent
    } finally {
      setIsUpdating(false);
    }
  };

  if (!onStatusChange || disabled) {
    return <OperationalStatusBadge status={currentOption.operationalStatus} label={currentOption.label} />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="group/badge inline-flex items-center gap-1 cursor-pointer focus:outline-none transition-all rounded-md"
          title="Click to quick-change status"
        >
          <OperationalStatusBadge
            status={currentOption.operationalStatus}
            label={currentOption.label}
          />
          <span className="opacity-0 group-hover/badge:opacity-100 text-muted-foreground transition-opacity -ml-0.5">
            {isUpdating ? <Loader2 size={10} className="animate-spin" /> : <ChevronDown size={10} />}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        onClick={(e) => e.stopPropagation()}
        className="w-44 p-1.5 rounded-xl border border-border bg-popover shadow-xl z-50 animate-in fade-in zoom-in-95"
      >
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
          Change Status
        </div>
        <div className="space-y-0.5 mt-0.5">
          {options.map((opt) => {
            const isSelected = opt.id === status;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer',
                  isSelected
                    ? 'bg-accent text-accent-foreground font-semibold'
                    : 'text-foreground hover:bg-muted/70'
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      opt.operationalStatus === 'qualified'
                        ? 'bg-emerald-500'
                        : opt.operationalStatus === 'contacted'
                          ? 'bg-blue-500'
                          : opt.operationalStatus === 'converted'
                            ? 'bg-indigo-500'
                            : opt.operationalStatus === 'new'
                              ? 'bg-amber-500'
                              : opt.operationalStatus === 'lost'
                                ? 'bg-slate-400'
                                : 'bg-rose-500'
                    )}
                  />
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check size={13} className="text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
