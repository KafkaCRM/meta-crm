import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { campaignsApi } from '@/api/campaigns';
import { settingsApi } from '@/api/settings';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Filter, X, Check, Megaphone, Users, Clock, Globe, Shield, RefreshCw } from 'lucide-react';

export interface LeadFilterState {
  status?: string;
  source?: string;
  campaign_id?: string;
  assigned_to_id?: string;
  sla_status?: string;
}

interface LeadFilterBuilderProps {
  filters: LeadFilterState;
  onFilterChange: (filters: LeadFilterState) => void;
  onReset: () => void;
  rawLeadsCount?: number;
}

export function LeadFilterBuilder({
  filters,
  onFilterChange,
  onReset,
}: LeadFilterBuilderProps) {
  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => settingsApi.users.list(),
  });

  const activeCount = Object.values(filters).filter(Boolean).length;

  const updateField = (key: keyof LeadFilterState, val: string | undefined) => {
    onFilterChange({
      ...filters,
      [key]: filters[key] === val ? undefined : val,
    });
  };

  const SOURCES = [
    { id: 'website_webhook', label: 'Website Webhook' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'facebook', label: 'Facebook / Meta' },
    { id: 'justdial', label: 'JustDial' },
    { id: 'manual', label: 'Manual Intake' },
    { id: 'franchise_routed', label: 'Franchise HQ' },
  ];

  const STATUSES = [
    { id: 'new', label: 'New' },
    { id: 'contacted', label: 'Contacted' },
    { id: 'qualified', label: 'Qualified' },
    { id: 'converted', label: 'Converted' },
    { id: 'unqualified', label: 'Lost / Unqualified' },
    { id: 'hot', label: 'Hot Priority' },
    { id: 'junk', label: 'Junk / Spam' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-9 text-xs gap-1.5 border-border ${
                activeCount > 0 ? 'border-primary/60 bg-primary/5 text-primary font-semibold' : 'text-muted-foreground'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter Leads</span>
              {activeCount > 0 && (
                <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-primary text-white font-bold rounded-full">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-80 p-4 space-y-4 border-border bg-card shadow-xl rounded-xl text-xs">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-primary" />
                Advanced Lead Filters
              </span>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={onReset}
                  className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer font-medium"
                >
                  Reset All
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Lead Status
              </label>
              <div className="flex flex-wrap gap-1">
                {STATUSES.map((s) => {
                  const isSelected = filters.status === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => updateField('status', s.id)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-muted/40 border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campaign Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Megaphone className="w-3 h-3 text-primary" />
                Campaign Enrollment
              </label>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => updateField('campaign_id', 'unassigned')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md border text-[11px] transition-all flex items-center justify-between cursor-pointer ${
                    filters.campaign_id === 'unassigned'
                      ? 'bg-primary/10 border-primary text-primary font-semibold'
                      : 'border-border text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  <span>Unenrolled (No Campaign)</span>
                  {filters.campaign_id === 'unassigned' && <Check className="w-3 h-3" />}
                </button>

                {campaigns.map((c) => {
                  const isSelected = filters.campaign_id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => updateField('campaign_id', c.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md border text-[11px] transition-all flex items-center justify-between cursor-pointer truncate ${
                        isSelected
                          ? 'bg-primary/10 border-primary text-primary font-semibold'
                          : 'border-border text-foreground hover:bg-muted/30'
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      {isSelected && <Check className="w-3 h-3 flex-shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Source Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Globe className="w-3 h-3 text-primary" />
                Lead Source
              </label>
              <div className="flex flex-wrap gap-1">
                {SOURCES.map((src) => {
                  const isSelected = filters.source === src.id;
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => updateField('source', src.id)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-muted/40 border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      {src.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assignee Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3 text-primary" />
                Assigned Rep
              </label>
              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => updateField('assigned_to_id', 'unassigned')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md border text-[11px] transition-all flex items-center justify-between cursor-pointer ${
                    filters.assigned_to_id === 'unassigned'
                      ? 'bg-primary/10 border-primary text-primary font-semibold'
                      : 'border-border text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  <span>Unassigned</span>
                  {filters.assigned_to_id === 'unassigned' && <Check className="w-3 h-3" />}
                </button>

                {users.map((u) => {
                  const isSelected = filters.assigned_to_id === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => updateField('assigned_to_id', u.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md border text-[11px] transition-all flex items-center justify-between cursor-pointer truncate ${
                        isSelected
                          ? 'bg-primary/10 border-primary text-primary font-semibold'
                          : 'border-border text-foreground hover:bg-muted/30'
                      }`}
                    >
                      <span className="truncate">{u.name}</span>
                      {isSelected && <Check className="w-3 h-3 flex-shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, campaign_id: filters.campaign_id ? undefined : 'any' })}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              filters.campaign_id && filters.campaign_id !== 'unassigned'
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-muted/30 border-border/80 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Megaphone className="w-3 h-3" />
            In Campaign
          </button>

          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, status: filters.status === 'hot' ? undefined : 'hot' })}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              filters.status === 'hot'
                ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400'
                : 'bg-muted/30 border-border/80 text-muted-foreground hover:text-foreground'
            }`}
          >
            🔥 Hot Priority
          </button>

          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, assigned_to_id: filters.assigned_to_id === 'unassigned' ? undefined : 'unassigned' })}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              filters.assigned_to_id === 'unassigned'
                ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'bg-muted/30 border-border/80 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-3 h-3" />
            Unassigned
          </button>
        </div>
      </div>

      {/* Active Filter Chips Bar */}
      {activeCount > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mr-1">
            Active:
          </span>

          {filters.status && (
            <Badge variant="secondary" className="gap-1 text-xs py-0.5 px-2 bg-muted border border-border">
              <span>Status: <strong className="capitalize">{filters.status}</strong></span>
              <button
                type="button"
                onClick={() => updateField('status', undefined)}
                className="hover:text-rose-500 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {filters.campaign_id && (
            <Badge variant="secondary" className="gap-1 text-xs py-0.5 px-2 bg-muted border border-border">
              <Megaphone className="w-3 h-3 text-primary" />
              <span>
                Campaign:{' '}
                <strong>
                  {filters.campaign_id === 'unassigned'
                    ? 'None'
                    : campaigns.find((c) => c.id === filters.campaign_id)?.name || 'Active'}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => updateField('campaign_id', undefined)}
                className="hover:text-rose-500 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {filters.source && (
            <Badge variant="secondary" className="gap-1 text-xs py-0.5 px-2 bg-muted border border-border">
              <span>Source: <strong className="capitalize">{filters.source.replace('_', ' ')}</strong></span>
              <button
                type="button"
                onClick={() => updateField('source', undefined)}
                className="hover:text-rose-500 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {filters.assigned_to_id && (
            <Badge variant="secondary" className="gap-1 text-xs py-0.5 px-2 bg-muted border border-border">
              <span>
                Rep:{' '}
                <strong>
                  {filters.assigned_to_id === 'unassigned'
                    ? 'Unassigned'
                    : users.find((u) => u.id === filters.assigned_to_id)?.name || 'Assigned'}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => updateField('assigned_to_id', undefined)}
                className="hover:text-rose-500 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          <button
            type="button"
            onClick={onReset}
            className="text-xs text-primary hover:underline font-semibold ml-2 cursor-pointer"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
