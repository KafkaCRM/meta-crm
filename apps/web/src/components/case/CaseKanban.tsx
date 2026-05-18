import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { produce } from 'immer';
import { evaluateVisibilityRules } from '@meta-crm/types';
import type { CaseDto, WorkflowStageDto } from '@meta-crm/types';
import { casesApi, type CasesByStage } from '@/api/cases';
import { useRealtime } from '@/hooks/useRealtime';
import { usePermissions } from '@/hooks/usePermissions';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { BulkActionBar, type BulkAction } from '@/components/shared/BulkActionBar';

interface CaseKanbanProps {
  workflowDefinitionId: string;
}

interface OptimisticMove {
  caseId: string;
  fromStageId: string;
  toStageId: string;
}

function evaluateCriteriaForStage(
  caseData: CaseDto,
  targetStage: WorkflowStageDto,
): { met: boolean; unmet: string[] } {
  const criteria = targetStage.entry_criteria;
  if (!criteria || (Array.isArray(criteria) && criteria.length === 0)) return { met: true, unmet: [] };

  const values = caseData.attributes ?? {};
  const rules = criteria as any;
  const result = evaluateVisibilityRules(rules, values);

  if (result) return { met: true, unmet: [] };

  const unmet = (rules as any[])
    .filter((rule: any) => {
      if ('all' in rule || 'any' in rule) {
        return !evaluateVisibilityRules([rule], values);
      }
      return !evaluateVisibilityRules([rule], values);
    })
    .map((rule: any) => {
      if ('all' in rule || 'any' in rule) {
        return 'Required criteria not met';
      }
      return `Field "${rule.field ?? 'unknown'}" does not meet the required condition`;
    });

  return { met: false, unmet };
}

export function CaseKanban({ workflowDefinitionId }: CaseKanbanProps) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<CasesByStage>({
    queryKey: ['cases', 'kanban', workflowDefinitionId],
    queryFn: () => casesApi.listByStage(workflowDefinitionId),
    staleTime: 30_000,
  });

  const transitionMutation = useMutation({
    mutationFn: ({ caseId, toStageId }: { caseId: string; toStageId: string }) =>
      casesApi.transitionStage(caseId, { to_stage_id: toStageId }),
    onError: (error: { code?: string; message?: string; unmet?: string[] }, { caseId }) => {
      if (error.code === 'CRITERIA_UNMET' && error.unmet) {
        toast.error('Cannot move case', {
          description: (
            <ul className="mt-1 list-disc list-inside">
              {error.unmet.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          ),
        });
      } else {
        toast.error('Stage transition failed', {
          description: error.message ?? 'An unexpected error occurred',
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cases', 'kanban', workflowDefinitionId] });
    },
  });

  useRealtime('case:stage_changed', (payload: { case_id: string; to_stage: string }) => {
    queryClient.setQueryData<CasesByStage>(
      ['cases', 'kanban', workflowDefinitionId],
      (old) => {
        if (!old) return old;
        return produce(old, (draft) => {
          const stageIds = Object.keys(draft.cases);
          for (const stageId of stageIds) {
            const stageCases = draft.cases[stageId];
            if (!stageCases) continue;
            const idx = stageCases.findIndex((c: CaseDto) => c.id === payload.case_id);
            if (idx === -1) continue;
            const [caseData] = stageCases.splice(idx, 1) as [CaseDto];
            caseData.stage = payload.to_stage;
            caseData.last_stage_changed_at = new Date().toISOString();
            if (!draft.cases[payload.to_stage]) {
              draft.cases[payload.to_stage] = [];
            }
            draft.cases[payload.to_stage]!.push(caseData);
            break;
          }
        });
      },
    );
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const stages = useMemo(() => data?.stages ?? [], [data?.stages]);
  const casesByStage = useMemo(() => data?.cases ?? {}, [data?.cases]);

  const stageMap = useMemo(() => {
    const map = new Map<string, WorkflowStageDto>();
    for (const stage of stages) {
      map.set(stage.id, stage);
    }
    return map;
  }, [stages]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const over = event.over;
    if (over) {
      const overData = over.data.current;
      if (overData?.type === 'kanban-column') {
        setOverStageId(overData.stageId);
      }
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverStageId(null);

      if (!over) return;

      const overData = over.data.current;
      if (overData?.type !== 'kanban-column') return;

      const targetStageId = overData.stageId;
      const caseId = active.id as string;

      let sourceStageId: string | null = null;
      let caseData: CaseDto | null = null;

      for (const [stageId, cases] of Object.entries(casesByStage)) {
        const found = cases.find((c) => c.id === caseId);
        if (found) {
          sourceStageId = stageId;
          caseData = found;
          break;
        }
      }

      if (!sourceStageId || !caseData) return;
      if (sourceStageId === targetStageId) return;

      const targetStage = stageMap.get(targetStageId);
      if (!targetStage) return;

      const { met: criteriaMet, unmet: unmetCriteria } = evaluateCriteriaForStage(caseData, targetStage);

      if (!criteriaMet) {
        toast.error('Cannot move case', {
          description: (
            <ul className="mt-1 list-disc list-inside">
              {unmetCriteria.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          ),
        });
        return;
      }

      queryClient.setQueryData<CasesByStage>(
        ['cases', 'kanban', workflowDefinitionId],
        (old) => {
          if (!old) return old;
          return produce(old, (draft) => {
            const sourceCases = draft.cases[sourceStageId!];
            if (!sourceCases) return;
            const idx = sourceCases.findIndex((c: CaseDto) => c.id === caseId);
            if (idx === -1) return;
            const [movedCase] = sourceCases.splice(idx, 1) as [CaseDto];
            movedCase.stage = targetStageId;
            movedCase.last_stage_changed_at = new Date().toISOString();
            if (!draft.cases[targetStageId]) {
              draft.cases[targetStageId] = [];
            }
            draft.cases[targetStageId]!.push(movedCase);
          });
        },
      );

      transitionMutation.mutate({ caseId, toStageId: targetStageId });
    },
    [casesByStage, stageMap, queryClient, workflowDefinitionId, transitionMutation],
  );

  const handleToggleSelect = useCallback((caseId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((stageId: string) => {
    const stageCases = casesByStage[stageId] ?? [];
    setSelectedIds((prev) => {
      const allSelected = stageCases.every((c) => prev.has(c.id));
      const next = new Set(prev);
      for (const c of stageCases) {
        if (allSelected) {
          next.delete(c.id);
        } else {
          next.add(c.id);
        }
      }
      return next;
    });
  }, [casesByStage]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleAddCase = useCallback((_stageId: string) => {
    toast.info('Create case form coming in TASK-022');
  }, []);

  const activeCase = useMemo(() => {
    if (!activeId) return null;
    for (const cases of Object.values(casesByStage)) {
      const found = cases.find((c) => c.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, casesByStage]);

  const activeCaseStage = useMemo(() => {
    if (!activeCase) return null;
    return stageMap.get(activeCase.stage) ?? null;
  }, [activeCase, stageMap]);

  const selectedCases = useMemo(() => {
    const result: CaseDto[] = [];
    for (const cases of Object.values(casesByStage)) {
      for (const c of cases) {
        if (selectedIds.has(c.id)) {
          result.push(c);
        }
      }
    }
    return result;
  }, [selectedIds, casesByStage]);

  const bulkActions = useMemo((): BulkAction<CaseDto>[] => {
    const actions: BulkAction<CaseDto>[] = [];

    if (can('update', 'Case')) {
      actions.push({
        id: 'bulk-assign',
        label: 'Assign',
        action: async (rows) => {
          toast.info('Assign dialog coming in TASK-022', {
            description: `${rows.length} cases selected`,
          });
        },
      });

      actions.push({
        id: 'bulk-move',
        label: 'Move Stage',
        action: async (rows) => {
          toast.info('Move stage dialog coming in TASK-022', {
            description: `${rows.length} cases selected`,
          });
        },
      });
    }

    actions.push({
      id: 'bulk-export',
      label: 'Export CSV',
      action: async (rows) => {
        const headers = 'id,title,stage,type,assigned_to_id,created_at\n';
        const csvRows = rows.map((c) =>
          `${c.id},"${c.title.replace(/"/g, '""')}",${c.stage},${c.type},${c.assigned_to_id ?? ''},${c.created_at}`,
        );
        const blob = new Blob([headers + csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cases-export-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${rows.length} cases`);
      },
    });

    return actions;
  }, [can]);

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto p-4 h-[calc(100vh-140px)]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-80 flex-shrink-0 rounded-lg border bg-muted/30 p-3">
            <div className="h-6 bg-muted rounded w-3/4 mb-3 animate-pulse" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-24 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto p-4 h-[calc(100vh-140px)]">
        {stages.map((stage) => {
          const stageCases = casesByStage[stage.id] ?? [];

          const overStage = overStageId === stage.id;

          const criteriaCheck = activeCase && stageMap.has(stage.id)
            ? evaluateCriteriaForStage(activeCase, stageMap.get(stage.id)!)
            : { met: true, unmet: [] };

          return (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              cases={stageCases}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onAddCase={handleAddCase}
              isOver={overStage}
              criteriaMet={criteriaCheck.met}
              unmetCriteria={criteriaCheck.unmet}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeCase && activeCaseStage ? (
          <div className="w-72 rotate-2 shadow-xl">
            <KanbanCard
              caseData={activeCase}
              stage={activeCaseStage}
              isSelected={false}
              onToggleSelect={() => {}}
              disabled
            />
          </div>
        ) : null}
      </DragOverlay>

      <BulkActionBar
        selectedRows={selectedCases}
        actions={bulkActions}
        onClearSelection={handleClearSelection}
        resource="Case"
      />
    </DndContext>
  );
}
