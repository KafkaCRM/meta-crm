import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Loader2, Play, AlertCircle, Clock, ShieldAlert, Settings, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VisibilityRuleEntry } from '@meta-crm/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { usePermissions } from '@/hooks/usePermissions';

interface Stage {
  id: string;
  name: string;
  order: number;
  sla_hours?: number | null;
  entry_criteria: VisibilityRuleEntry[];
}

interface Transition {
  id: string;
  from_stage_id: string;
  to_stage_id: string;
}

export function WorkflowBuilder() {
  const { can } = usePermissions();
  const canManage = can('manage', 'Workflow');
  const queryClient = useQueryClient();
  const [stages, setStages] = useState<Stage[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [newStage, setNewStage] = useState({ name: '', sla_hours: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'workflows'],
    queryFn: () => Promise.resolve({ stages: [] as Stage[], transitions: [] as Transition[] }),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (data) {
      setStages(data.stages);
      setTransitions(data.transitions);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      Promise.resolve({ stages, transitions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'workflows'] });
      toast.success('Workflow saved successfully');
    },
    onError: () => toast.error('Failed to save workflow'),
  });

  const addStage = useCallback(() => {
    if (!newStage.name.trim()) return;
    const stage: Stage = {
      id: `stage_${Date.now()}`,
      name: newStage.name,
      order: stages.length,
      sla_hours: newStage.sla_hours ? parseInt(newStage.sla_hours, 10) : null,
      entry_criteria: [],
    };
    setStages((prev) => [...prev, stage]);
    setNewStage({ name: '', sla_hours: '' });
  }, [newStage, stages]);

  const removeStage = useCallback((id: string) => {
    setStages((prev) => prev.filter((s) => s.id !== id));
    setTransitions((prev) => prev.filter((t) => t.from_stage_id !== id && t.to_stage_id !== id));
  }, []);

  const addTransition = useCallback((fromId: string, toId: string) => {
    setTransitions((prev) => [
      ...prev,
      { id: `trans_${Date.now()}`, from_stage_id: fromId, to_stage_id: toId },
    ]);
  }, []);

  const removeTransition = useCallback((transId: string) => {
    setTransitions((prev) => prev.filter((t) => t.id !== transId));
  }, []);

  const updateCriteria = useCallback((stageId: string, criteria: VisibilityRuleEntry[]) => {
    setStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, entry_criteria: criteria } : s)),
    );
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#94a3b8]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0f172a]">Workflows</h1>
          <p className="text-sm text-[#64748b] mt-0.5">
            Design lead pipelines, enforce transition criteria, and regulate timing thresholds
          </p>
        </div>
        {canManage && (
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-[#0f172a] hover:bg-[#1e293b] text-white h-9 rounded-lg"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
          Publish Pipeline
        </Button>
        )}
      </div>

      {/* Main interface split */}
      <div className="grid gap-6 md:grid-cols-3 items-start">
        {/* Stages Timeline Column */}
        <div className={cn("space-y-6 relative", canManage ? "md:col-span-2" : "md:col-span-3")}>
          <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-[#e2e8f0] -z-10" />

          {stages.map((stage, index) => (
            <div key={stage.id} className="relative flex items-start gap-6">
              {/* Timeline circle node */}
              <div className={cn(
                "h-12 w-12 rounded-full border-2 flex items-center justify-center font-bold text-sm bg-white shadow-sm flex-shrink-0 z-10",
                index === 0 ? "border-emerald-500 text-emerald-500" : "border-slate-300 text-slate-500"
              )}>
                {index === 0 ? <Play size={13} className="fill-emerald-500 translate-x-0.5" /> : index + 1}
              </div>

              {/* Stage details card */}
              <StageRow
                stage={stage}
                index={index}
                allStages={stages}
                transitions={transitions}
                onRemove={() => removeStage(stage.id)}
                onUpdateCriteria={(criteria) => updateCriteria(stage.id, criteria)}
                onAddTransition={(toId) => addTransition(stage.id, toId)}
                onRemoveTransition={removeTransition}
                canManage={canManage}
              />
            </div>
          ))}

          {stages.length === 0 && (
            <Card className="bg-[#f8fafc]/50 border-dashed border-2 border-[#e2e8f0] rounded-xl py-12 text-center shadow-none">
              <CardContent className="flex flex-col items-center justify-center p-6">
                <AlertCircle className="h-8 w-8 text-[#94a3b8] mb-3" />
                <p className="text-sm font-medium text-[#0f172a]">No workflow pipeline stages deployed</p>
                <p className="text-xs text-[#64748b] mt-1">Configure your first stage using the builder panel.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Builder Add Stage Column */}
        {canManage && (
        <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none h-fit">
          <CardHeader className="pb-3 border-b border-[#e2e8f0]">
            <CardTitle className="text-base font-medium text-[#0f172a] flex items-center gap-1.5">
              <Settings size={16} className="text-[#94a3b8]" />
              Pipeline Builder
            </CardTitle>
            <CardDescription className="text-xs text-[#94a3b8]">
              Insert a new workflow milestone stage
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={(e) => { e.preventDefault(); addStage(); }} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#64748b]">Stage Title</label>
                <Input
                  type="text"
                  placeholder="e.g. Initial Interview"
                  value={newStage.name}
                  onChange={(e) => setNewStage((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="h-9 border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#64748b] flex items-center gap-1">
                  <Clock size={12} className="text-[#94a3b8]" />
                  SLA Threshold (Hours)
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 24"
                  value={newStage.sla_hours}
                  onChange={(e) => setNewStage((f) => ({ ...f, sla_hours: e.target.value }))}
                  className="h-9 border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8]"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="bg-[#0f172a] hover:bg-[#1e293b] text-white w-full h-9 rounded-lg flex items-center justify-center gap-1"
                >
                  <Plus size={15} />
                  Add Stage Node
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}

interface StageRowProps {
  stage: Stage;
  index: number;
  allStages: Stage[];
  transitions: Transition[];
  onRemove: () => void;
  onUpdateCriteria: (criteria: VisibilityRuleEntry[]) => void;
  onAddTransition: (toId: string) => void;
  onRemoveTransition: (transId: string) => void;
  canManage: boolean;
}

function StageRow({ stage, index, allStages, transitions, onRemove, onUpdateCriteria, onAddTransition, onRemoveTransition, canManage }: StageRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [showCriteria, setShowCriteria] = useState(false);
  const [criteriaField, setCriteriaField] = useState({ field: '', operator: 'is_not_empty' as string, value: '' });

  const outgoingTransitions = transitions.filter((t) => t.from_stage_id === stage.id);

  const addCriterion = useCallback(() => {
    if (!criteriaField.field) return;
    const rule: VisibilityRuleEntry = {
      field: criteriaField.field,
      operator: criteriaField.operator as any,
      value: criteriaField.value,
    };
    onUpdateCriteria([...stage.entry_criteria, rule]);
    setCriteriaField({ field: '', operator: 'is_not_empty', value: '' });
  }, [criteriaField, stage.entry_criteria, onUpdateCriteria]);

  const removeCriterion = useCallback(
    (idx: number) => {
      onUpdateCriteria(stage.entry_criteria.filter((_, i) => i !== idx));
    },
    [stage.entry_criteria, onUpdateCriteria],
  );

  return (
    <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none flex-1 overflow-hidden hover:border-slate-300 transition-all">
      <div className="flex items-center justify-between p-4 group select-none">
        <div className="flex items-center gap-3.5 min-w-0">
          {canManage && (
            <div className="p-1.5 bg-[#f8fafc] border border-[#e2e8f0] text-[#94a3b8] rounded-md cursor-grab active:cursor-grabbing">
              <GripVertical size={13} />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#0f172a]">{stage.name}</span>
              {stage.sla_hours && (
                <Badge variant="outline" className="bg-[#f8fafc] text-[#64748b] border-[#e2e8f0] text-[9px] rounded-md py-0 px-1.5 font-mono flex items-center gap-1 font-semibold">
                  <Clock size={9} />
                  SLA {stage.sla_hours}h
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-[#94a3b8] mt-0.5 font-mono">{stage.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Criteria trigger */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCriteria(!showCriteria)}
            className={cn(
              "text-xs h-7 rounded-md",
              stage.entry_criteria.length > 0
                ? "bg-indigo-50/50 text-indigo-600 border-indigo-100 hover:bg-indigo-100"
                : "text-[#64748b] hover:bg-[#f1f5f9]"
            )}
          >
            Criteria ({stage.entry_criteria.length})
          </Button>

          {/* Transitions trigger */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-[#64748b] hover:bg-[#f1f5f9] h-7 rounded-md flex items-center gap-1"
          >
            Transitions ({outgoingTransitions.length})
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </Button>

          {/* Delete stage */}
          {canManage && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={onRemove}
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      </div>

      {/* Criteria Config Panel */}
      {showCriteria && (
        <div className="bg-[#f8fafc] border-t border-[#e2e8f0] p-4 space-y-3">
          <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            <ShieldAlert size={12} />
            <span>Entry Gate Criteria</span>
          </div>

          {stage.entry_criteria.length === 0 && !canManage && (
            <p className="text-xs text-[#64748b]">No entry criteria configured for this stage.</p>
          )}

          <div className="space-y-1.5">
            {stage.entry_criteria.map((rule, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-white border border-[#e2e8f0] rounded-lg text-xs font-mono">
                <div className="flex items-center gap-1.5 text-[#0f172a]">
                  <span className="font-semibold">{(rule as any).field ?? 'unknown'}</span>
                  <span className="text-[#94a3b8]">{(rule as any).operator ?? ''}</span>
                  {(rule as any).value !== undefined && <span className="bg-[#f1f5f9] text-[#475569] px-1 rounded">"{(rule as any).value}"</span>}
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeCriterion(idx)}
                    className="text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={11} />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {canManage && (
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <Input
                type="text"
                placeholder="Field API identifier"
                value={criteriaField.field}
                onChange={(e) => setCriteriaField((f) => ({ ...f, field: e.target.value }))}
                className="h-8 text-xs bg-white border-[#e2e8f0] flex-1 text-[#0f172a]"
              />
              <select
                value={criteriaField.operator}
                onChange={(e) => setCriteriaField((f) => ({ ...f, operator: e.target.value }))}
                className="rounded-lg border border-[#e2e8f0] bg-white px-2 py-0.5 text-xs text-[#0f172a] outline-none h-8 w-32 focus-visible:border-slate-400"
              >
                <option value="is_not_empty">is not empty</option>
                <option value="is_empty">is empty</option>
                <option value="eq">equals</option>
                <option value="neq">not equals</option>
              </select>
              {['eq', 'neq'].includes(criteriaField.operator) && (
                <Input
                  type="text"
                  placeholder="Value"
                  value={criteriaField.value}
                  onChange={(e) => setCriteriaField((f) => ({ ...f, value: e.target.value }))}
                  className="h-8 text-xs bg-white border-[#e2e8f0] w-28 text-[#0f172a]"
                />
              )}
              <Button
                type="button"
                onClick={addCriterion}
                size="sm"
                className="bg-[#0f172a] hover:bg-[#1e293b] text-white h-8"
              >
                Add Gate
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Transitions Config Panel */}
      {expanded && (
        <div className="bg-[#f8fafc] border-t border-[#e2e8f0] p-4 space-y-4">
          {canManage && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">Configure Routing Paths</label>
              <div className="flex gap-1.5 flex-wrap">
                {allStages
                  .filter((s) => s.id !== stage.id && !outgoingTransitions.some((t) => t.to_stage_id === s.id))
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onAddTransition(s.id)}
                      className="text-xs bg-white border border-[#e2e8f0] rounded-full px-3 py-1 text-[#64748b] hover:border-slate-400 hover:text-[#0f172a] transition-colors"
                    >
                      → {s.name}
                    </button>
                  ))}
                {allStages.filter((s) => s.id !== stage.id && !outgoingTransitions.some((t) => t.to_stage_id === s.id)).length === 0 && (
                  <span className="text-[11px] text-[#94a3b8]">No further stages available to transition to</span>
                )}
              </div>
            </div>
          )}

          {outgoingTransitions.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">Connected Target Pipelines</p>
              <div className="flex gap-2 flex-wrap">
                {outgoingTransitions.map((t) => {
                  const target = allStages.find((s) => s.id === t.to_stage_id);
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-1 text-xs bg-white border border-indigo-100 text-indigo-600 px-3 py-1 rounded-full shadow-sm"
                    >
                      <span>→ {target?.name ?? t.to_stage_id}</span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => onRemoveTransition(t.id)}
                          className="text-indigo-400 hover:text-indigo-600 ml-1.5 rounded-full"
                        >
                          <X size={10} className="stroke-[3px]" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            !canManage && (
              <span className="text-[11px] text-[#94a3b8]">No outbound transitions configured for this stage.</span>
            )
          )}
        </div>
      )}
    </Card>
  );
}

// Internal close helper icon
function X({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
