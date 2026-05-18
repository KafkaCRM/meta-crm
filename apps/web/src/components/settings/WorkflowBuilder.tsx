import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VisibilityRuleEntry } from '@meta-crm/types';
import { evaluateVisibilityRules } from '@meta-crm/types';

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
  const queryClient = useQueryClient();
  const [stages, setStages] = useState<Stage[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [editingCriteria, setEditingCriteria] = useState<string | null>(null);
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
      toast.success('Workflow saved');
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

  const updateCriteria = useCallback((stageId: string, criteria: VisibilityRuleEntry[]) => {
    setStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, entry_criteria: criteria } : s)),
    );
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Workflows</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define stages, transitions, and entry criteria
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); addStage(); }} className="flex gap-3 rounded-lg border bg-card p-4">
        <input
          type="text"
          placeholder="Stage name"
          value={newStage.name}
          onChange={(e) => setNewStage((f) => ({ ...f, name: e.target.value }))}
          className="flex-1 rounded-md border border-input px-3 py-2 text-sm"
          required
        />
        <input
          type="number"
          placeholder="SLA hours"
          value={newStage.sla_hours}
          onChange={(e) => setNewStage((f) => ({ ...f, sla_hours: e.target.value }))}
          className="w-32 rounded-md border border-input px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Stage
        </button>
      </form>

      <div className="space-y-2">
        {stages.map((stage, index) => (
          <StageRow
            key={stage.id}
            stage={stage}
            index={index}
            allStages={stages}
            transitions={transitions}
            onRemove={() => removeStage(stage.id)}
            onUpdateCriteria={(criteria) => updateCriteria(stage.id, criteria)}
            onAddTransition={(toId) => addTransition(stage.id, toId)}
          />
        ))}
        {stages.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No stages yet. Add your first stage above.
          </div>
        )}
      </div>

      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
      >
        {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Workflow
      </button>
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
}

function StageRow({ stage, index, allStages, transitions, onRemove, onUpdateCriteria, onAddTransition }: StageRowProps) {
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
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        <span className="text-xs text-muted-foreground w-6">{index + 1}</span>
        <span className="text-sm font-medium flex-1">{stage.name}</span>
        {stage.sla_hours && (
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">SLA: {stage.sla_hours}h</span>
        )}
        <button
          onClick={() => setShowCriteria(!showCriteria)}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
        >
          Criteria ({stage.entry_criteria.length})
        </button>
        <button onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-muted">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <button onClick={onRemove} className="p-1 rounded hover:bg-muted">
          <Trash2 className="h-4 w-4 text-red-500" />
        </button>
      </div>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Add transition to:</label>
            <div className="flex gap-2 flex-wrap">
              {allStages
                .filter((s) => s.id !== stage.id && !outgoingTransitions.some((t) => t.to_stage_id === s.id))
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onAddTransition(s.id)}
                    className="text-xs border rounded-full px-3 py-1 hover:bg-muted"
                  >
                    → {s.name}
                  </button>
                ))}
            </div>
          </div>

          {outgoingTransitions.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1">Transitions:</p>
              <div className="flex gap-2 flex-wrap">
                {outgoingTransitions.map((t) => {
                  const target = allStages.find((s) => s.id === t.to_stage_id);
                  return (
                    <span key={t.id} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                      → {target?.name ?? t.to_stage_id}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {showCriteria && (
        <div className="border-t px-4 py-3 space-y-2">
          <p className="text-xs font-medium">Entry Criteria</p>
          {stage.entry_criteria.map((rule, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {(rule as any).field ?? 'unknown'} {(rule as any).operator ?? ''}
              </span>
              <button onClick={() => removeCriterion(idx)} className="p-0.5 rounded hover:bg-muted">
                <Trash2 className="h-3 w-3 text-red-500" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Field name"
              value={criteriaField.field}
              onChange={(e) => setCriteriaField((f) => ({ ...f, field: e.target.value }))}
              className="rounded-md border border-input px-2 py-1 text-sm w-32"
            />
            <select
              value={criteriaField.operator}
              onChange={(e) => setCriteriaField((f) => ({ ...f, operator: e.target.value }))}
              className="rounded-md border border-input px-2 py-1 text-sm"
            >
              <option value="is_not_empty">is not empty</option>
              <option value="is_empty">is empty</option>
              <option value="eq">equals</option>
              <option value="neq">not equals</option>
            </select>
            <button
              onClick={addCriterion}
              className="rounded-md border px-2 py-1 text-sm hover:bg-muted"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
