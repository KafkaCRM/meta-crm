import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FilterChipsProps {
  filters: { id: string; value: any }[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

export function FilterChips({ filters, onRemove, onClearAll }: FilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-2 px-1 select-none animate-in fade-in duration-150">
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
        Active Filters:
      </span>
      
      {filters.map((filter) => {
        let displayValue = String(filter.value);
        try {
          if (typeof filter.value === 'object') {
            displayValue = JSON.stringify(filter.value);
          }
        } catch {
          displayValue = String(filter.value);
        }

        return (
          <Badge 
            key={filter.id} 
            variant="secondary" 
            className="bg-slate-100 text-foreground/80 hover:bg-slate-150 border border-border/60 rounded-md text-xs font-semibold px-2 py-0.5 flex items-center gap-1.5 transition-all"
          >
            <span className="text-muted-foreground capitalize">{filter.id.replace('_', ' ')}:</span>
            <span className="text-foreground font-bold">{displayValue}</span>
            <button 
              onClick={() => onRemove(filter.id)} 
              className="text-muted-foreground hover:text-red-500 hover:bg-slate-200/50 p-0.5 rounded-sm transition-colors cursor-pointer"
            >
              <X size={10} className="stroke-[3]" />
            </button>
          </Badge>
        );
      })}

      <button
        onClick={onClearAll}
        className="text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors uppercase tracking-wider ml-1 cursor-pointer"
      >
        Clear All
      </button>
    </div>
  );
}
