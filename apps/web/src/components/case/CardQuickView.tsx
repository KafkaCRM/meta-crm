import { Drawer } from 'vaul';
import { X, ExternalLink, Clock, User, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { cn } from '@/lib/utils';
import type { CaseDto, PipelineStageDto } from '@meta-crm/types';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { settingsApi } from '@/api/settings';
import { casesApi } from '@/api/cases';
import { toast } from 'sonner';
import { evaluateVisibilityRules } from '@meta-crm/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

dayjs.extend(relativeTime);

interface CardQuickViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseData: CaseDto;
  stageName: string;
  stages?: PipelineStageDto[];
}

export function CardQuickView({ open, onOpenChange, caseData, stageName, stages = [] }: CardQuickViewProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const attributeEntries = Object.entries(caseData.attributes ?? {});

  // Fetch custom field definitions dynamically
  const { data: fieldDefs = [] } = useQuery({
    queryKey: ['settings', 'field-definitions', 'case'],
    queryFn: () => settingsApi.fieldDefinitions.list('case'),
    staleTime: 30_000,
    enabled: open,
  });

  // Calculate sorted stages and the next sequential stage
  const sortedStages = useMemo(() => {
    return [...stages].sort((a, b) => a.order - b.order);
  }, [stages]);

  const currentStageIndex = useMemo(() => {
    return sortedStages.findIndex((s) => s.id === caseData.stage);
  }, [sortedStages, caseData.stage]);

  const nextStage = useMemo(() => {
    return currentStageIndex !== -1 && currentStageIndex < sortedStages.length - 1
      ? sortedStages[currentStageIndex + 1]
      : null;
  }, [sortedStages, currentStageIndex]);

  // Extract checklist entries for next stage
  const nextStageCriteria = useMemo(() => {
    if (!nextStage || !nextStage.entry_criteria) return [];
    return Array.isArray(nextStage.entry_criteria) ? nextStage.entry_criteria : [];
  }, [nextStage]);

  const checklistItems = useMemo(() => {
    const values = caseData.attributes ?? {};
    return nextStageCriteria.map((rule: any) => {
      const isMet = evaluateVisibilityRules([rule], values);
      const fieldDef = fieldDefs.find((f) => f.name === rule.field);
      return {
        rule,
        field: rule.field,
        isMet,
        fieldDef,
        label: fieldDef?.label || rule.field,
      };
    });
  }, [nextStageCriteria, caseData.attributes, fieldDefs]);

  // Mutation to update case attributes inline
  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      casesApi.update(caseData.id, {
        attributes: { ...caseData.attributes, [key]: value },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      toast.success('Attribute updated');
    },
    onError: () => {
      toast.error('Failed to update attribute');
    },
  });

  function renderChecklistInput(item: any, onChange: (val: any) => void) {
    const def = item.fieldDef;

    if (def?.field_type === 'select' && def.options) {
      return (
        <Select onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs border-border bg-card">
            <SelectValue placeholder={`Select ${def.label}...`} />
          </SelectTrigger>
          <SelectContent className="z-[60]">
            {def.options.map((opt: string) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (def?.field_type === 'boolean') {
      return (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox id={`check-${item.field}`} onCheckedChange={onChange} />
          <label htmlFor={`check-${item.field}`} className="text-xs text-muted-foreground font-semibold">
            Confirm {def.label}
          </label>
        </div>
      );
    }

    if (def?.field_type === 'number') {
      return (
        <Input
          type="number"
          className="h-8 text-xs bg-card"
          placeholder={`Enter number for ${def.label}...`}
          onBlur={(e) => {
            if (e.target.value) onChange(Number(e.target.value));
          }}
        />
      );
    }

    return (
      <Input
        type="text"
        className="h-8 text-xs bg-card"
        placeholder={`Enter value for ${item.label}...`}
        onBlur={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
      />
    );
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction="right">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed right-0 top-0 bottom-0 z-50 w-[420px] bg-background border-l border-border flex flex-col">
          <div className="flex items-start justify-between px-6 py-4 border-b">
            <div className="space-y-1">
              <Drawer.Title className="text-lg font-semibold">{caseData.title}</Drawer.Title>
              <Drawer.Description className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {stageName}
                </span>
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                  {caseData.type}
                </span>
              </Drawer.Description>
            </div>
            <Drawer.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Drawer.Close>
          </div>

          <div className="px-6 py-4 space-y-5 overflow-auto flex-1">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground bg-slate-50 dark:bg-slate-900/20 p-2 rounded-lg border border-border/50">
                <User className="h-4 w-4 text-slate-400" />
                <span className="truncate">{caseData.assigned_to_id ? 'Assigned' : 'Unassigned'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground bg-slate-50 dark:bg-slate-900/20 p-2 rounded-lg border border-border/50">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>{dayjs(caseData.created_at).fromNow()}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground bg-slate-50 dark:bg-slate-900/20 p-2 rounded-lg border border-border/50 col-span-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <span>Stage changed {dayjs(caseData.last_stage_changed_at).fromNow()}</span>
              </div>
            </div>

            {/* Next Stage Promotion Checklist */}
            {nextStage && (
              <div className="space-y-2.5 border-t border-border pt-4">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                    <span>Checklist to Stage:</span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 rounded-full normal-case">
                      {nextStage.name}
                    </span>
                  </h3>
                  <p className="text-[10px] text-muted-foreground">
                    Required attributes for transition. Drag & drop will be enabled when met.
                  </p>
                </div>

                <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/10 p-3 rounded-xl border border-border/60">
                  {checklistItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-2">
                      No entry criteria required for the next stage.
                    </p>
                  ) : (
                    checklistItems.map((item) => (
                      <div key={item.field} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            {item.isMet ? (
                              <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                            ) : (
                              <AlertCircle size={13} className="text-amber-500 flex-shrink-0" />
                            )}
                            {item.label}
                          </span>
                          {item.isMet && (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50/80 px-1 py-0.5 rounded border border-emerald-100">
                              MET
                            </span>
                          )}
                        </div>

                        {!item.isMet ? (
                          <div className="pl-4">
                            {renderChecklistInput(item, (val) => {
                              updateMutation.mutate({ key: item.field, value: val });
                            })}
                          </div>
                        ) : (
                          <div className="pl-4 text-xs font-semibold text-foreground bg-slate-100/30 dark:bg-slate-800/20 p-2 rounded-lg border border-border/40 font-mono select-all">
                            {String(caseData.attributes?.[item.field] ?? '')}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Current Attributes */}
            {attributeEntries.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">All Case Attributes</h3>
                <div className="rounded-xl border border-border/80 divide-y divide-border/60 overflow-hidden bg-card">
                  {attributeEntries.map(([key, value]) => {
                    const fieldDef = fieldDefs.find((f) => f.name === key);
                    return (
                      <div key={key} className="flex items-center justify-between px-3 py-2.5 text-xs">
                        <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                          {fieldDef?.label || key}
                        </span>
                        <span className="font-semibold text-foreground font-mono select-all">{String(value)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">Last Interaction</h3>
              <div className="rounded-xl border border-border/80 p-3.5 text-xs text-muted-foreground bg-card italic text-center">
                No recent interactions found.
              </div>
            </div>
          </div>

          <div className="flex flex-row justify-end gap-2 border-t px-6 py-4 bg-muted/20">
            <Drawer.Close asChild>
              <button className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-bold hover:bg-muted text-foreground">
                Close Panel
              </button>
            </Drawer.Close>
            <button
              className={cn(
                'rounded-lg bg-primary px-4 py-2 text-xs font-bold',
                'text-primary-foreground hover:bg-primary/90',
                'flex items-center gap-2 shadow-xs',
              )}
              onClick={() => {
                onOpenChange(false);
                navigate({ to: '/cases/$id', params: { id: caseData.id } });
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Open Detail Page
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
