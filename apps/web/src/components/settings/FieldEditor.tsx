import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ChevronDown, ChevronRight, Sliders, Users, Briefcase, MessageSquare, AlertCircle, X, CheckSquare, List } from 'lucide-react';
import { settingsApi, type FieldDefinition } from '@/api/settings';
import type { VisibilityRuleEntry } from '@meta-crm/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'multi_select', 'boolean', 'phone', 'email'];

const ENTITIES = [
  { id: 'Party', label: 'Contacts', icon: Users, desc: 'Contact profiles and details' },
  { id: 'Case', label: 'Cases', icon: Briefcase, desc: 'Deals, tickets, or applications' },
  { id: 'Interaction', label: 'Interactions', icon: MessageSquare, desc: 'Calls, emails, and meetings' },
];

export function FieldEditor() {
  const { can } = usePermissions();
  const canManage = can('manage', 'FieldDefinition');
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState('Party');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '', label: '', field_type: 'text', options: '', required: false, order: 0,
  });
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
      toast.success('Custom field created successfully');
      setShowForm(false);
      setFormData({ name: '', label: '', field_type: 'text', options: '', required: false, order: 0 });
    },
    onError: () => toast.error('Failed to create field'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.fieldDefinitions.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'fields', entityType] });
      toast.success('Field deleted successfully');
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
        name: formData.name.trim().toLowerCase().replace(/\s+/g, '_'),
        label: formData.label.trim(),
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
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#94a3b8]" />
      </div>
    );
  }

  const activeEntity = ENTITIES.find(e => e.id === entityType);

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0f172a]">Custom Fields</h1>
          <p className="text-sm text-[#64748b] mt-0.5">
            Configure system fields, establish required criteria, and control validation schemas
          </p>
        </div>
        {canManage && (
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#0f172a] hover:bg-[#1e293b] text-white h-9 rounded-lg"
        >
          <Plus size={15} className="mr-1.5" />
          Add Custom Field
        </Button>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="grid gap-2 grid-cols-3 border-b border-[#e2e8f0] pb-px">
        {ENTITIES.map((ent) => {
          const isActive = entityType === ent.id;
          return (
            <button
              key={ent.id}
              onClick={() => {
                setEntityType(ent.id);
                setShowForm(false);
              }}
              className={`flex flex-col items-start p-3 border-b-2 transition-all text-left outline-none ${
                isActive
                  ? 'border-[#0f172a] text-[#0f172a] bg-[#f8fafc]/30'
                  : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                <ent.icon size={13} className={isActive ? 'text-[#0f172a]' : 'text-[#94a3b8]'} />
                {ent.label}
              </span>
              <span className="text-[10px] text-[#94a3b8] mt-0.5 font-normal truncate w-full hidden sm:inline-block">
                {ent.desc}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-3 items-start">
        {/* Fields list column */}
        <div className={cn("space-y-4", canManage ? "md:col-span-2" : "md:col-span-3")}>
          <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none">
            <CardHeader className="pb-3 border-b border-[#e2e8f0]">
              <CardTitle className="text-base font-medium text-[#0f172a]">
                Field Registry: {activeEntity?.label}
              </CardTitle>
              <CardDescription className="text-xs text-[#94a3b8]">
                {fields?.length ?? 0} custom fields configured for this entity type
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[#e2e8f0]">
                {fields?.map((field) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    expanded={expandedRules.has(field.id)}
                    onToggleRules={() => toggleRuleVisibility(field.id)}
                    onDelete={() => {
                      if (window.confirm(`Are you sure you want to permanently delete custom field "${field.label}"?`)) {
                        removeMutation.mutate(field.id);
                      }
                    }}
                    canManage={canManage}
                  />
                ))}
                {fields?.length === 0 && (
                  <div className="p-8 text-center text-sm text-[#64748b]">
                    No custom fields configured for this entity. {canManage && 'Click "Add Custom Field" to begin.'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add/Edit field side card */}
        {canManage && showForm && (
          <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none h-fit">
            <CardHeader className="pb-3 border-b border-[#e2e8f0]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium text-[#0f172a] flex items-center gap-1.5">
                  <Sliders size={16} className="text-[#94a3b8]" />
                  New Field Definition
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-[#94a3b8] hover:text-[#0f172a]"
                  onClick={() => setShowForm(false)}
                >
                  <X size={14} />
                </Button>
              </div>
              <CardDescription className="text-xs text-[#94a3b8]">
                Create a custom validation schema node
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#64748b]">Display Label</label>
                  <Input
                    type="text"
                    placeholder="e.g. Lead Temperature"
                    value={formData.label}
                    onChange={(e) => setFormData((f) => ({ ...f, label: e.target.value }))}
                    required
                    className="h-9 border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#64748b]">API Key Identifier</label>
                  <Input
                    type="text"
                    placeholder="e.g. lead_temperature"
                    value={formData.name}
                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                    required
                    className="h-9 border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8] font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#64748b]">Field Type</label>
                  <select
                    value={formData.field_type}
                    onChange={(e) => setFormData((f) => ({ ...f, field_type: e.target.value }))}
                    className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none h-9 focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400/50"
                  >
                    {FIELD_TYPES.map((ft) => (
                      <option key={ft} value={ft}>{ft}</option>
                    ))}
                  </select>
                </div>

                {['select', 'multi_select'].includes(formData.field_type) && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#64748b]">Select Options (Comma-separated)</label>
                    <Input
                      type="text"
                      placeholder="e.g. Hot, Warm, Cold"
                      value={formData.options}
                      onChange={(e) => setFormData((f) => ({ ...f, options: e.target.value }))}
                      required
                      className="h-9 border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8]"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between p-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg">
                  <label className="flex items-center gap-2 text-xs font-medium text-[#64748b] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.required}
                      onChange={(e) => setFormData((f) => ({ ...f, required: e.target.checked }))}
                      className="h-4 w-4 rounded border-[#cbd5e1] text-[#0f172a] focus:ring-slate-400 cursor-pointer"
                    />
                    <span>Required Constraint</span>
                  </label>

                  <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
                    <span>Sort Order:</span>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) => setFormData((f) => ({ ...f, order: parseInt(e.target.value, 10) }))}
                      className="w-12 h-7 rounded-md border border-[#e2e8f0] bg-white text-center text-xs text-[#0f172a] focus-visible:border-slate-400"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="bg-[#0f172a] hover:bg-[#1e293b] text-white w-full h-9 rounded-lg flex items-center justify-center gap-1.5"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus size={15} />
                    )}
                    Deploy Field Definition
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
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
  canManage: boolean;
}

function FieldRow({ field, expanded, onToggleRules, onDelete, canManage }: FieldRowProps) {
  return (
    <div className="p-4 hover:bg-[#f8fafc]/30 transition-colors group">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="p-2 bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0] rounded-lg">
            <CheckSquare size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-[#0f172a]">{field.label}</span>
              <Badge variant="outline" className="bg-[#f8fafc] text-[#64748b] border-[#e2e8f0] text-[9px] rounded-md font-mono py-0 px-1.5 font-medium">
                {field.field_type}
              </Badge>
              {field.required && (
                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100 text-[9px] rounded-md py-0 px-1.5 font-medium">
                  Required
                </Badge>
              )}
            </div>
            <p className="text-[10px] font-mono text-[#94a3b8] mt-0.5 truncate">{field.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {field.options && field.options.length > 0 && (
            <div className="hidden lg:flex items-center gap-1 max-w-[200px] overflow-hidden truncate">
              <List size={11} className="text-[#94a3b8]" />
              <span className="text-[11px] text-[#64748b] truncate">{field.options.join(', ')}</span>
            </div>
          )}

          {field.visibility_rules && field.visibility_rules.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onToggleRules}
              className="text-xs text-[#64748b] hover:bg-[#f1f5f9] h-7 rounded-md"
            >
              {expanded ? <ChevronDown size={13} className="mr-1" /> : <ChevronRight size={13} className="mr-1" />}
              {field.visibility_rules.length} Rules
            </Button>
          )}

          {canManage && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 transition-all"
              onClick={onDelete}
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      </div>

      {expanded && field.visibility_rules && field.visibility_rules.length > 0 && (
        <div className="mt-3 ml-11 p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            <AlertCircle size={12} />
            <span>Conditional Visibility Gates</span>
          </div>
          <div className="space-y-1">
            {(field.visibility_rules as VisibilityRuleEntry[]).map((rule, i) => (
              <div key={i} className="text-[11px] font-mono text-[#475569] flex items-center gap-1">
                <span>• Show when </span>
                <span className="font-semibold text-[#0f172a]">{(rule as any).field ?? 'group'}</span>
                <span className="text-[#94a3b8]">{(rule as any).operator ?? ''}</span>
                {(rule as any).value !== undefined && <span className="bg-white px-1 border border-[#e2e8f0] rounded">"{(rule as any).value}"</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
