import { useState, useCallback, useMemo, useEffect } from 'react';
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
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { produce } from 'immer';
import { evaluateVisibilityRules } from '@meta-crm/types';
import type { CaseDto, WorkflowStageDto } from '@meta-crm/types';
import { casesApi, type CasesByStage } from '@/api/cases';
import { settingsApi } from '@/api/settings';
import { useRealtime } from '@/hooks/useRealtime';
import { usePermissions } from '@/hooks/usePermissions';
import { useLabels } from '@/hooks/useLabels';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { BulkActionBar, type BulkAction } from '@/components/shared/BulkActionBar';
import { VirtualTable } from '@/components/shared/VirtualTable';
import type { ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';

dayjs.extend(relativeTime);

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { t } = useLabels();

  const { data: workflows = [] } = useQuery({
    queryKey: ['settings', 'workflows'],
    queryFn: () => settingsApi.workflows.list(),
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);
  const [view, setView] = useState<'kanban' | 'list'>(() => {
    try {
      return (localStorage.getItem('case-view') as 'kanban' | 'list') ?? 'kanban';
    } catch {
      return 'kanban';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('case-view', view);
    } catch {}
  }, [view]);

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
    navigate({ to: '/cases/new' });
  }, [navigate]);

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

  const allCases = useMemo(() => {
    const result: CaseDto[] = [];
    for (const cases of Object.values(casesByStage)) {
      result.push(...cases);
    }
    return result;
  }, [casesByStage]);

  const listColumns = useMemo((): ColumnDef<CaseDto>[] => {
    return [
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <div className="font-medium truncate max-w-xs" title={row.original.title}>
            {row.original.title}
          </div>
        ),
      },
      {
        accessorKey: 'stage',
        header: 'Stage',
        cell: ({ row }) => {
          const stage = stageMap.get(row.original.stage);
          return stage ? (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {stage.name}
            </span>
          ) : (
            row.original.stage
          );
        },
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <span className="capitalize">{row.original.type}</span>
        ),
      },
      {
        accessorKey: 'assigned_to_id',
        header: 'Assigned',
        cell: ({ row }) => (
          row.original.assigned_to_id ? 'Yes' : 'No'
        ),
      },
      {
        accessorKey: 'attributes.priority',
        header: 'Priority',
        cell: ({ row }) => {
          const priority = row.original.attributes?.priority;
          if (!priority) return null;
          const priorityStr = String(priority);
          const colorClass =
            priorityStr === 'high'
              ? 'text-red-700'
              : priorityStr === 'medium'
                ? 'text-blue-700'
                : 'text-green-700';
          return <span className={`capitalize font-medium ${colorClass}`}>{priorityStr}</span>;
        },
      },
      {
        accessorKey: 'attributes.course',
        header: 'Course',
        cell: ({ row }) => {
          const course = row.original.attributes?.course;
          return course ? String(course) : null;
        },
      },
      {
        header: 'Age',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {dayjs(row.original.created_at).fromNow()}
          </span>
        ),
      },
    ];
  }, [stageMap]);

  const handleSelectionChange = useCallback((rows: CaseDto[]) => {
    setSelectedIds(new Set(rows.map((r) => r.id)));
  }, []);

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

  const totalCases = allCases.length;

  return (
    <div className="space-y-4">
      {/* Visual Header & Hot-swapper */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card border rounded-xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {workflows.find((wf: any) => wf.id === workflowDefinitionId)?.name || 'Pipeline Board'}
            </h1>
            {workflows.length > 1 && (
              <div className="relative inline-block text-left ml-2">
                <select
                  value={workflowDefinitionId}
                  onChange={(e) => {
                    navigate({ to: '/cases', search: { workflowId: e.target.value } });
                  }}
                  className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted focus:outline-hidden focus:ring-1 focus:ring-fin-orange cursor-pointer"
                >
                  {workflows.map((wf: any) => (
                    <option key={wf.id} value={wf.id}>
                      {wf.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your opportunities, track conversations, and slide pipeline items across stages.
          </p>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/15">
            <span className="text-xs text-muted-foreground font-medium">
              {totalCases} {totalCases === 1 ? 'pipeline item' : 'pipeline items'}
            </span>
        <div className="flex items-center gap-1 bg-muted rounded-md p-1">
          <button
            className={cn(
              'flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
              view === 'kanban'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setView('kanban')}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Kanban
          </button>
          <button
            className={cn(
              'flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
              view === 'list'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setView('list')}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
        </div>
      </div>

      {view === 'kanban' ? (
        <>
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
        </>
      ) : (
        <div className="p-4">
          <VirtualTable
            data={allCases}
            columns={listColumns}
            rowCount={allCases.length}
            isLoading={false}
            resource="Case"
            tableId="cases-list"
            onRowClick={(row) => {
              navigate({ to: '/cases/$id', params: { id: row.id } });
            }}
            onSelectionChange={handleSelectionChange}
          />
        </div>
      )}
      </div>

      <BulkActionBar
        selectedRows={selectedCases}
        actions={bulkActions}
        onClearSelection={handleClearSelection}
        resource="Case"
      />
      </DndContext>
    </div>
  );
}
