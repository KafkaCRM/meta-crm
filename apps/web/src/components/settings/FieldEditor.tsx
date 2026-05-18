import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { settingsApi, type FieldDefinition } from '@/api/settings';
import type { VisibilityRuleEntry } from '@meta-crm/types';

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'multi_select', 'boolean', 'phone', 'email'];
const ENTITY_TYPES = ['Party', 'Case', 'Interaction'];

export function FieldEditor() {
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState('Party');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '', label: '', field_type: 'text', options: '', required: false, order: 0,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  const { data: fields, isLoading } = useQuery({
    queryKey: ['settings', 'fields', entityType],
    queryFn: () => settingsApi.fieldDefinitions.list(entityType),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => settingsApi.fieldDefinitions.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'fields', entityType] });
      toast.success('Field created');
      setShowForm(false);
      setFormData({ name: '', label: '', field_type: 'text', options: '', required: false, order: 0 });
    },
    onError: () => toast.error('Failed to create field'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.fieldDefinitions.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'fields', entityType] });
      toast.success('Field deleted');
    },
    onError: () => toast.error('Failed to delete field'),
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim() || !formData.label.trim()) return;
      const options = formData.options
        ? formData.options.split(',').map((o) => o.trim()).filter(Boolean)
        : undefined;
      createMutation.mutate({
        entity_type: entityType,
        name: formData.name,
        label: formData.label,
        field_type: formData.field_type,
        options,
        required: formData.required,
        order: formData.order,
        visibility_rules: [],
      });
    },
    [formData, entityType, createMutation],
  );

  const toggleRuleVisibility = useCallback((fieldId: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  }, []);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading fields...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fields</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage custom field definitions
        </p>
      </div>

      <div className="flex gap-3">
        {ENTITY_TYPES.map((et) => (
          <button
            key={et}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              entityType === et ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'
            }`}
            onClick={() => setEntityType(et)}
          >
            {et}
          </button>
        ))}
        <button
          onClick={() => setShowForm(!showForm)}
          className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Field
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="text"
              placeholder="Field name (key)"
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              className="rounded-md border border-input px-3 py-2 text-sm"
              required
            />
            <input
              type="text"
              placeholder="Display label"
              value={formData.label}
              onChange={(e) => setFormData((f) => ({ ...f, label: e.target.value }))}
              className="rounded-md border border-input px-3 py-2 text-sm"
              required
            />
            <select
              value={formData.field_type}
              onChange={(e) => setFormData((f) => ({ ...f, field_type: e.target.value }))}
              className="rounded-md border border-input px-3 py-2 text-sm"
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft} value={ft}>{ft}</option>
              ))}
            </select>
          </div>
          {['select', 'multi_select'].includes(formData.field_type) && (
            <input
              type="text"
              placeholder="Options (comma-separated)"
              value={formData.options}
              onChange={(e) => setFormData((f) => ({ ...f, options: e.target.value }))}
              className="rounded-md border border-input px-3 py-2 text-sm"
            />
          )}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.required}
                onChange={(e) => setFormData((f) => ({ ...f, required: e.target.checked }))}
              />
              Required
            </label>
            <div className="flex items-center gap-2 text-sm">
              <span>Order:</span>
              <input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData((f) => ({ ...f, order: parseInt(e.target.value, 10) }))}
                className="w-16 rounded-md border border-input px-2 py-1 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border divide-y">
        {fields?.map((field) => (
          <FieldRow
            key={field.id}
            field={field}
            expanded={expandedRules.has(field.id)}
            onToggleRules={() => toggleRuleVisibility(field.id)}
            onDelete={() => removeMutation.mutate(field.id)}
          />
        ))}
        {fields?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No fields for {entityType} yet. Add your first field above.
          </div>
        )}
      </div>
    </div>
  );
}

interface FieldRowProps {
  field: FieldDefinition;
  expanded: boolean;
  onToggleRules: () => void;
  onDelete: () => void;
}

function FieldRow({ field, expanded, onToggleRules, onDelete }: FieldRowProps) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{field.label}</span>
          <span className="text-xs bg-muted px-2 py-0.5 rounded">{field.field_type}</span>
          {field.required && (
            <span className="text-xs text-red-600">Required</span>
          )}
          {field.options && field.options.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {field.options.join(', ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {field.visibility_rules && field.visibility_rules.length > 0 && (
            <button
              onClick={onToggleRules}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {field.visibility_rules.length} rules
            </button>
          )}
          <button onClick={onDelete} className="p-1 rounded hover:bg-muted">
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>
      </div>
      {expanded && field.visibility_rules && field.visibility_rules.length > 0 && (
        <div className="mt-2 ml-4 text-xs text-muted-foreground space-y-1">
          {(field.visibility_rules as VisibilityRuleEntry[]).map((rule, i) => (
            <div key={i} className="flex items-center gap-2">
              <span>
                {(rule as any).field ?? 'group'} {(rule as any).operator ?? ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
