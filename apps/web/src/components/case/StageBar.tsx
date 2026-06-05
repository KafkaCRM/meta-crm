import { useCallback } from 'react';
import { Check, Circle, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
import type { PipelineStageDto, CaseDto } from '@meta-crm/types';
import { evaluateVisibilityRules } from '@meta-crm/types';

interface StageBarProps {
  stages: PipelineStageDto[];
  currentStageId: string;
  caseData: CaseDto;
  onTransition: (toStageId: string) => void;
  allowedTransitions: string[];
}

function checkEntryCriteria(caseData: CaseDto, stage: PipelineStageDto): { met: boolean; unmet: string[] } {
  const criteria = stage.entry_criteria;
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

export function StageBar({ stages, currentStageId, caseData, onTransition, allowedTransitions }: StageBarProps) {
  const handleClick = useCallback((stageId: string) => {
    if (allowedTransitions.includes(stageId)) {
      onTransition(stageId);
    }
  }, [allowedTransitions, onTransition]);

  const currentIndex = stages.findIndex((s) => s.id === currentStageId);

  return (
    <div className="flex items-center gap-1 w-full overflow-x-auto py-2">
      {stages.map((stage, index) => {
        const isCurrent = stage.id === currentStageId;
        const isCompleted = index < currentIndex;
        const isAllowed = allowedTransitions.includes(stage.id);
        const isClickable = isAllowed && !isCurrent;
        const criteria = checkEntryCriteria(caseData, stage);

        return (
          <TooltipProvider key={stage.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'flex items-center gap-1 flex-shrink-0',
                    isClickable && 'cursor-pointer hover:opacity-80',
                  )}
                  onClick={() => isClickable && handleClick(stage.id)}
                >
                  <div className="flex items-center gap-1.5">
                    {isCompleted ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    ) : isCurrent ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Circle className="h-3 w-3 fill-current" />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full border-2',
                          isClickable
                            ? criteria.met
                              ? 'border-ring hover:border-primary'
                              : 'border-red-400'
                            : 'border-muted-foreground/30',
                        )}
                      >
                        {!criteria.met && isClickable && (
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                    )}

                    <span
                      className={cn(
                        'text-sm font-medium whitespace-nowrap',
                        isCurrent && 'text-primary',
                        isCompleted && 'text-green-600 dark:text-green-400',
                        !isCurrent && !isCompleted && 'text-muted-foreground',
                      )}
                    >
                      {stage.name}
                    </span>
                  </div>

                  {index < stages.length - 1 && (
                    <div
                      className={cn(
                        'h-px w-8 flex-shrink-0',
                        isCompleted ? 'bg-green-500' : 'bg-border',
                      )}
                    />
                  )}
                </div>
              </TooltipTrigger>
              {!criteria.met && isClickable && (
                <TooltipContent side="bottom" className="z-50 rounded-md border bg-popover px-3 py-2 text-sm shadow-md max-w-xs">
                  <p className="font-medium text-red-600">Cannot transition</p>
                  <ul className="mt-1 list-disc list-inside text-muted-foreground">
                    {criteria.unmet.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </TooltipContent>
              )}
              {criteria.met && isClickable && (
                <TooltipContent side="bottom" className="z-50 rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
                  Click to move to {stage.name}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}
