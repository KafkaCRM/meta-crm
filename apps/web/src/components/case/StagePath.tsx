import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StagePathProps {
  currentStage: string;
  stages: string[];
  onStageSelect?: (stage: string) => void;
  disabled?: boolean;
}

export function StagePath({ currentStage, stages, onStageSelect, disabled = false }: StagePathProps) {
  const currentIdx = stages.findIndex((s) => s.toLowerCase() === currentStage.toLowerCase());

  return (
    <div className="w-full border border-[#e2e8f0] bg-white rounded-xl overflow-hidden p-1 shadow-xs flex select-none mb-5">
      <div className="flex items-center w-full divide-x divide-slate-100">
        {stages.map((stage, idx) => {
          const isActive = stage.toLowerCase() === currentStage.toLowerCase();
          const isCompleted = idx < currentIdx;
          const isUnreached = idx > currentIdx;

          return (
            <button
              key={stage}
              type="button"
              disabled={disabled || !onStageSelect}
              onClick={() => onStageSelect?.(stage)}
              className={cn(
                "flex-1 text-center py-2 text-[10px] font-bold uppercase tracking-wider transition-all relative flex items-center justify-center gap-1.5 cursor-pointer outline-none",
                isActive 
                  ? "bg-[#0f172a] text-white font-extrabold shadow-sm" 
                  : isCompleted 
                  ? "bg-slate-50 text-indigo-600 hover:bg-slate-100" 
                  : "bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              )}
            >
              {isCompleted && (
                <span className="w-3.5 h-3.5 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                  <Check size={9} className="stroke-[3] text-indigo-600" />
                </span>
              )}
              {stage.replace('_', ' ')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
