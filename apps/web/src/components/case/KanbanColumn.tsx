import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  useVirtualizer,
  type VirtualItem,
} from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
import { evaluateVisibilityRules, type VisibilityRuleEntry } from '@meta-crm/types';
import type { CaseDto, WorkflowStageDto } from '@meta-crm/types';
import { KanbanCard } from './KanbanCard';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useLabels } from '@/hooks/useLabels';

dayjs.extend(relativeTime);

const CARD_HEIGHT = 112;

interface KanbanColumnProps {
  stage: WorkflowStageDto;
  cases: CaseDto[];
  selectedIds: Set<string>;
  onToggleSelect: (caseId: string) => void;
  onSelectAll: (stageId: string) => void;
  onAddCase: (stageId: string) => void;
  isOver: boolean;
  criteriaMet: boolean;
  unmetCriteria: string[];
}

function getLocalStorageKey(stageId: string): string {
  return `kanban:collapsed:${stageId}`;
}

function getWidthLocalStorageKey(stageId: string): string {
  return `kanban:width:${stageId}`;
}

export function KanbanColumn({
  stage,
  cases,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onAddCase,
  isOver,
  criteriaMet,
  unmetCriteria,
}: KanbanColumnProps) {
  const { t } = useLabels();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(getLocalStorageKey(stage.id)) === 'true';
    } catch {
      return false;
    }
  });

  const [columnWidth, setColumnWidth] = useState(() => {
    try {
      const stored = localStorage.getItem(getWidthLocalStorageKey(stage.id));
      return stored ? parseInt(stored, 10) : 320;
    } catch {
      return 320;
    }
  });

  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(getLocalStorageKey(stage.id), String(collapsed));
    } catch {}
  }, [collapsed, stage.id]);

  useEffect(() => {
    try {
      localStorage.setItem(getWidthLocalStorageKey(stage.id), String(columnWidth));
    } catch {}
  }, [columnWidth, stage.id]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidth;
  }, [columnWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.max(240, Math.min(600, resizeStartWidth.current + delta));
      setColumnWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const { setNodeRef: droppableRef, isOver: droppableIsOver } = useDroppable({
    id: `column-${stage.id}`,
    data: {
      type: 'kanban-column',
      stageId: stage.id,
      stage,
    },
  });

  const columnIsOver = droppableIsOver || isOver;

  const allSelected = cases.length > 0 && cases.every((c) => selectedIds.has(c.id));

  const avgAge = useMemo(() => {
    if (cases.length === 0) return null;
    const now = dayjs();
    const totalHours = cases.reduce((sum, c) => {
      if (!c.created_at) return sum;
      return sum + now.diff(dayjs(c.created_at), 'hour');
    }, 0);
    const avg = Math.round(totalHours / cases.length);
    if (avg < 1) return '<1h';
    if (avg < 24) return `${avg}h`;
    return `${Math.round(avg / 24)}d`;
  }, [cases]);

  const containerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: cases.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => CARD_HEIGHT,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  const columnHighlightClass = columnIsOver
    ? criteriaMet
      ? 'border-ring bg-ring/5'
      : 'border-red-400 bg-red-50 dark:bg-red-900/10'
    : '';

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border bg-muted/30 transition-colors',
        columnHighlightClass,
      )}
      style={{ width: columnWidth, minWidth: columnWidth, maxWidth: columnWidth }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <button
            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <h3 className="text-sm font-semibold truncate">{stage.name}</h3>
          <span className="flex-shrink-0 text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {cases.length}
          </span>
          {avgAge && (
            <span className="flex-shrink-0 text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              avg {avgAge}
            </span>
          )}

          {!criteriaMet && columnIsOver && unmetCriteria.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="z-50 rounded-md border bg-popover px-3 py-2 text-sm shadow-md max-w-xs">
                  <p className="font-medium text-red-600">Cannot drop here</p>
                  <ul className="mt-1 list-disc list-inside text-muted-foreground">
                    {unmetCriteria.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {cases.length > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted"
              onClick={() => onSelectAll(stage.id)}
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
          <button
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
            onClick={() => onAddCase(stage.id)}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div
            ref={containerRef}
            className="overflow-auto flex-1 p-2 space-y-2"
            style={{ maxHeight: 'calc(100vh - 220px)' }}
          >
            {paddingTop > 0 && (
              <div style={{ height: `${paddingTop}px` }} />
            )}

            {virtualItems.map((virtualRow: VirtualItem) => {
              const caseData = cases[virtualRow.index];
              if (!caseData) return null;

              return (
                <div key={caseData.id} data-index={virtualRow.index}>
                  <KanbanCard
                    caseData={caseData}
                    stage={stage}
                    isSelected={selectedIds.has(caseData.id)}
                    onToggleSelect={onToggleSelect}
                  />
                </div>
              );
            })}

            {paddingBottom > 0 && (
              <div style={{ height: `${paddingBottom}px` }} />
            )}

            {cases.length === 0 && (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                No {t('case.plural')?.toLowerCase() ?? 'cases'} in this stage
              </div>
            )}
          </div>

          <div
            className={cn(
              'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-ring/50 transition-colors',
              isResizing && 'bg-ring',
            )}
            onMouseDown={handleMouseDown}
            style={{ position: 'relative' }}
          />
        </>
      )}
    </div>
  );
}
