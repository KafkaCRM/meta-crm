import { memo, useCallback, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useSortable } from '@dnd-kit/sortable';
import { GripVertical, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CaseDto, PipelineStageDto } from '@meta-crm/types';
import { CardQuickView } from './CardQuickView';

dayjs.extend(relativeTime);

interface KanbanCardProps {
  caseData: CaseDto;
  stage: PipelineStageDto;
  isSelected: boolean;
  onToggleSelect: (caseId: string) => void;
  disabled?: boolean;
}

function getAgeBadgeInfo(caseData: CaseDto, stage: PipelineStageDto): {
  hoursInStage: number;
  badgeColor: 'default' | 'amber' | 'red';
  label: string;
} | null {
  if (!stage.sla_hours || !caseData.last_stage_changed_at) return null;

  const hoursInStage = dayjs().diff(dayjs(caseData.last_stage_changed_at), 'hour');
  const slaPercent = (hoursInStage / stage.sla_hours) * 100;

  if (slaPercent > 150) {
    return {
      hoursInStage,
      badgeColor: 'red',
      label: `${hoursInStage}h (>${Math.round(slaPercent)}%)`,
    };
  }
  if (slaPercent >= 100) {
    return {
      hoursInStage,
      badgeColor: 'amber',
      label: `${hoursInStage}h (${Math.round(slaPercent)}%)`,
    };
  }
  return {
    hoursInStage,
    badgeColor: 'default',
    label: `${hoursInStage}h`,
  };
}

export const KanbanCard = memo(function KanbanCard({
  caseData,
  stage,
  isSelected,
  onToggleSelect,
  disabled = false,
}: KanbanCardProps) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: caseData.id,
    disabled,
    data: {
      type: 'kanban-card',
      caseData,
      stageId: caseData.stage,
    },
  });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
      : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const ageInfo = getAgeBadgeInfo(caseData, stage);

  const handleCardClick = useCallback(() => {
    setQuickViewOpen(true);
  }, []);

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect(caseData.id);
  }, [caseData.id, onToggleSelect]);

  const badgeColorClass =
    ageInfo?.badgeColor === 'red'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      : ageInfo?.badgeColor === 'amber'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        : 'bg-muted text-muted-foreground';

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group relative rounded-lg border bg-card p-3 shadow-sm cursor-pointer',
          'hover:shadow-md hover:border-ring transition-shadow',
          isSelected && 'ring-2 ring-ring border-ring',
          isDragging && 'shadow-lg rotate-1',
        )}
        onClick={handleCardClick}
      >
        <div className="flex items-start gap-2">
          <div
            className={cn(
              'mt-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity',
              'text-muted-foreground hover:text-foreground',
            )}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium truncate">{caseData.title}</h4>
              <div
                className={cn(
                  'opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0',
                )}
                onClick={handleCheckboxClick}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  className="h-4 w-4 rounded border-input cursor-pointer"
                  onChange={() => {}}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {caseData.assigned_to_id && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  Assigned
                </span>
              )}

              {ageInfo && (
                <span
                  className={cn(
                    'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full',
                    badgeColorClass,
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {ageInfo.label}
                </span>
              )}

              {(() => {
                const priority = caseData.attributes?.priority;
                if (!priority) return null;
                const priorityStr = String(priority);
                return (
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full',
                      priorityStr === 'high'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : priorityStr === 'medium'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                    )}
                  >
                    {priorityStr}
                  </span>
                );
              })()}
            </div>

            {(() => {
              const course = caseData.attributes?.course;
              if (!course) return null;
              return (
                <p className="text-xs text-muted-foreground mt-1.5">
                  {String(course)}
                </p>
              );
            })()}
          </div>
        </div>
      </div>

      <CardQuickView
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        caseData={caseData}
        stageName={stage.name}
      />
    </>
  );
});
