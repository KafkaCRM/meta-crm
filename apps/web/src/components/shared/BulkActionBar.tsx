import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { X, Loader2, UserPlus, ArrowRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export interface BulkAction<TData = any> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  action: (selectedRows: TData[]) => Promise<void>;
  confirmMessage?: string;
}

interface BulkActionBarProps<TData = any> {
  selectedRows: TData[];
  actions: BulkAction<TData>[];
  onClearSelection: () => void;
  resource: string;
}

const defaultIcons: Record<string, React.ReactNode> = {
  assign: <UserPlus size={14} />,
  'move-stage': <ArrowRight size={14} />,
  export: <Download size={14} />,
};

export function BulkActionBar<TData>({
  selectedRows,
  actions,
  onClearSelection,
  resource,
}: BulkActionBarProps<TData>) {
  const [executing, setExecuting] = useState<string | null>(null);

  const handleAction = useCallback(
    async (action: BulkAction<TData>) => {
      if (action.confirmMessage && !window.confirm(action.confirmMessage)) {
        return;
      }

      setExecuting(action.id);

      try {
        await action.action(selectedRows);
        toast.success(
          `${action.label} applied to ${selectedRows.length} ${selectedRows.length === 1 ? 'item' : 'items'}`,
        );
        onClearSelection();
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to ${action.label.toLowerCase()}`;
        toast.error(message);
      } finally {
        setExecuting(null);
      }
    },
    [selectedRows, onClearSelection],
  );

  if (selectedRows.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <div className="pointer-events-auto mx-auto mb-4 flex items-center gap-3 rounded-xl border border-[#d3cec6] bg-white px-4 py-3 shadow-lg shadow-black/5">
        <span className="text-sm font-semibold text-[#111111] min-w-[80px]">
          {selectedRows.length} selected
        </span>

        <Separator orientation="vertical" className="h-5 bg-[#d3cec6]" />

        <div className="flex items-center gap-1.5">
          {actions.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              className="h-8 text-xs border-[#d3cec6] hover:bg-[#f5f1ec] hover:text-[#111111]"
              onClick={() => handleAction(action)}
              disabled={executing !== null}
            >
              {executing === action.id ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                action.icon ?? defaultIcons[action.id]
              )}
              {executing === action.id ? 'Processing...' : action.label}
            </Button>
          ))}
        </div>

        <Separator orientation="vertical" className="h-5 bg-[#d3cec6]" />

        <button
          className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-[#f5f1ec] transition-colors text-[#9c9fa5] hover:text-[#111111]"
          onClick={onClearSelection}
          disabled={executing !== null}
          aria-label="Clear selection"
        >
          <X size={15} />
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
