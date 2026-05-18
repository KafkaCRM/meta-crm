import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { settingsApi } from '@/api/settings';

const CORE_LABEL_KEYS = [
  { key: 'party.singular', default: 'Contact' },
  { key: 'party.plural', default: 'Contacts' },
  { key: 'case.singular', default: 'Case' },
  { key: 'case.plural', default: 'Cases' },
  { key: 'workflow.stage.enquiry', default: 'Enquiry' },
  { key: 'workflow.stage.enrolled', default: 'Enrolled' },
];

export function LabelEditor() {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { data: labels, isLoading } = useQuery({
    queryKey: ['settings', 'labels'],
    queryFn: () => settingsApi.labels.list(),
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      settingsApi.labels.update(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'labels'] });
      toast.success('Label updated');
      setEditingKey(null);
    },
    onError: () => toast.error('Failed to update label'),
  });

  const handleSave = useCallback(() => {
    if (!editingKey || !editValue.trim()) return;
    updateMutation.mutate({ key: editingKey, value: editValue });
  }, [editingKey, editValue, updateMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSave();
      if (e.key === 'Escape') setEditingKey(null);
    },
    [handleSave],
  );

  if (isLoading) {
    return <div className="text-muted-foreground">Loading labels...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Labels</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Override display labels for your tenant
        </p>
      </div>

      <div className="rounded-lg border divide-y">
        {CORE_LABEL_KEYS.map(({ key, default: defaultVal }) => {
          const currentValue = labels?.[key] ?? defaultVal;
          const isOverridden = labels?.[key] !== undefined;
          const isEditing = editingKey === key;

          return (
            <div key={key} className="flex items-center justify-between px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-mono text-muted-foreground">{key}</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="mt-1 rounded-md border border-input px-3 py-1.5 text-sm w-64"
                    autoFocus
                  />
                ) : (
                  <p className="text-sm font-medium mt-0.5">
                    {currentValue}
                    {isOverridden && (
                      <span className="ml-2 text-xs text-muted-foreground">(overridden)</span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                    >
                      {updateMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      Save
                    </button>
                    <button
                      onClick={() => setEditingKey(null)}
                      className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setEditingKey(key);
                      setEditValue(currentValue);
                    }}
                    className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
