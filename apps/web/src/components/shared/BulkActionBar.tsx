import { useState, useCallback } from 'react';
import { toast } from 'sonner';

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

      const previousState = [...selectedRows];

      try {
        await action.action(selectedRows);
        toast.success(`${action.label} applied to ${selectedRows.length} items`);
        onClearSelection();
      } catch (error) {
        toast.error(`Failed to ${action.label.toLowerCase()}`);
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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-popover px-4 py-3 shadow-lg">
      <span className="text-sm font-medium">
        {selectedRows.length} selected
      </span>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            onClick={() => handleAction(action)}
            disabled={executing !== null}
          >
            {action.icon}
            {executing === action.id ? 'Processing...' : action.label}
          </button>
        ))}
      </div>

      <button
        className="ml-2 text-sm text-muted-foreground hover:text-foreground"
        onClick={onClearSelection}
        disabled={executing !== null}
      >
        Clear
      </button>
    </div>
  );
}
