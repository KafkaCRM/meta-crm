import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Loader2, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CaseDto } from '@meta-crm/types';
import { casesApi } from '@/api/cases';
import { usePermissions } from '@/hooks/usePermissions';

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: string[];
}

interface CaseAttributePanelProps {
  caseData: CaseDto;
  fields: FieldDef[];
}

interface EditingField {
  key: string;
  value: string | number | boolean;
}

export function CaseAttributePanel({ caseData, fields }: CaseAttributePanelProps) {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const canUpdate = can('update', 'Case');

  const [editing, setEditing] = useState<EditingField | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      casesApi.update(caseData.id, {
        attributes: { ...caseData.attributes, [key]: value },
      }),
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey: ['cases', caseData.id] });
      const previous = queryClient.getQueryData<CaseDto>(['cases', caseData.id]);
      queryClient.setQueryData<CaseDto>(['cases', caseData.id], (old) => {
        if (!old) return old;
        return {
          ...old,
          attributes: { ...old.attributes, [key]: value },
        };
      });
      return { previous };
    },
    onError: (_err, { key }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['cases', caseData.id], context.previous);
      }
      toast.error('Failed to update attribute');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cases', caseData.id] });
    },
  });

  const handleStartEdit = useCallback((field: FieldDef) => {
    const currentValue = caseData.attributes?.[field.key];
    setEditing({
      key: field.key,
      value: currentValue !== undefined ? String(currentValue) : '',
    });
  }, [caseData.attributes]);

  const handleSave = useCallback(() => {
    if (!editing) return;
    updateMutation.mutate({ key: editing.key, value: editing.value });
    setEditing(null);
  }, [editing, updateMutation]);

  const handleCancel = useCallback(() => {
    setEditing(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Attributes</h3>
      </div>
      <div className="divide-y">
        {fields.map((field) => {
          const isEditing = editing?.key === field.key;
          const displayValue = caseData.attributes?.[field.key];
          const displayStr = displayValue !== undefined ? String(displayValue) : '—';

          return (
            <div key={field.key} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">{field.label}</span>

              {isEditing ? (
                <div className="flex items-center gap-1">
                  {field.type === 'select' && field.options ? (
                    <select
                      ref={inputRef as any}
                      value={editing?.value as string}
                      onChange={(e) => setEditing({ key: field.key, value: e.target.value })}
                      onKeyDown={handleKeyDown}
                      className="rounded-md border border-input px-2 py-1 text-sm"
                    >
                      <option value="">Select...</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      ref={inputRef}
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      value={editing?.value as string}
                      onChange={(e) => setEditing({ key: field.key, value: e.target.value })}
                      onKeyDown={handleKeyDown}
                      className="rounded-md border border-input px-2 py-1 text-sm w-40"
                    />
                  )}
                  <button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="p-1 rounded hover:bg-muted"
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </button>
                  <button onClick={handleCancel} className="p-1 rounded hover:bg-muted">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{displayStr}</span>
                  {canUpdate && (
                    <button
                      onClick={() => handleStartEdit(field)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
