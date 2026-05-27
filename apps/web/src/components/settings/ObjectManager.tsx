import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Settings2, Plus, Trash2, Loader2, ArrowLeft, Sliders, Info, Shield, HelpCircle, X } from 'lucide-react';
import { settingsApi } from '@/api/settings';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DependencyViewer } from './DependencyViewer';
import { SchemaGraph } from './SchemaGraph';

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'multi_select', 'boolean', 'phone', 'email', 'lookup'];

export function ObjectManager() {
  const { can } = usePermissions();
  const canManage = can('manage', 'FieldDefinition');
  const queryClient = useQueryClient();
  
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showFieldForm, setShowFieldForm] = useState(false);
  
  const [objectForm, setObjectForm] = useState({
    api_name: '', singular_label: '', plural_label: '', description: '',
  });

  const [fieldForm, setFieldForm] = useState({
    name: '', label: '', field_type: 'text', options: '', required: false, order: 0, related_to: '',
  });

  // Queries
  const { data: objects, isLoading: isLoadingObjects } = useQuery({
    queryKey: ['settings', 'custom-objects'],
    queryFn: () => settingsApi.customObjects.list(),
    staleTime: 30_000,
  });

  const selectedObject = objects?.find(o => o.id === selectedObjectId);

  const { data: fields, isLoading: isLoadingFields } = useQuery({
    queryKey: ['settings', 'custom-fields', selectedObject?.api_name],
    queryFn: () => selectedObject ? settingsApi.fieldDefinitions.list(selectedObject.api_name) : Promise.resolve([]),
    enabled: !!selectedObject,
    staleTime: 30_000,
  });

  // Mutations
  const createObjectMutation = useMutation({
    mutationFn: (data: typeof objectForm) => settingsApi.customObjects.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'custom-objects'] });
      toast.success('Custom Object defined successfully');
      setShowCreateDialog(false);
      setObjectForm({ api_name: '', singular_label: '', plural_label: '', description: '' });
    },
    onError: (err: any) => toast.error(`Failed to create custom object: ${err.message || 'Error'}`),
  });

  const removeObjectMutation = useMutation({
    mutationFn: (id: string) => settingsApi.customObjects.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'custom-objects'] });
      toast.success('Custom Object deleted successfully');
      setSelectedObjectId(null);
    },
    onError: () => toast.error('Failed to delete Custom Object'),
  });

  const createFieldMutation = useMutation({
    mutationFn: (data: any) => settingsApi.fieldDefinitions.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'custom-fields', selectedObject?.api_name] });
      toast.success('Custom Field added successfully');
      setShowFieldForm(false);
      setFieldForm({ name: '', label: '', field_type: 'text', options: '', required: false, order: 0, related_to: '' });
    },
    onError: () => toast.error('Failed to create field definition'),
  });

  const removeFieldMutation = useMutation({
    mutationFn: (id: string) => settingsApi.fieldDefinitions.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'custom-fields', selectedObject?.api_name] });
      toast.success('Field removed successfully');
    },
    onError: () => toast.error('Failed to delete field definition'),
  });

  // Handlers
  const handleCreateObject = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!objectForm.singular_label.trim() || !objectForm.plural_label.trim() || !objectForm.api_name.trim()) return;

    let apiName = objectForm.api_name.trim().replace(/\s+/g, '_');
    if (!apiName.endsWith('__c')) {
      apiName = `${apiName}__c`;
    }

    createObjectMutation.mutate({
      ...objectForm,
      api_name: apiName,
    });
  }, [objectForm, createObjectMutation]);

  const handleCreateField = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObject || !fieldForm.name.trim() || !fieldForm.label.trim()) return;

    const options = fieldForm.options
      ? fieldForm.options.split(',').map(o => o.trim()).filter(Boolean)
      : undefined;

    let fieldName = fieldForm.name.trim().toLowerCase().replace(/\s+/g, '_');
    if (!fieldName.endsWith('__c')) {
      fieldName = `${fieldName}__c`;
    }

    createFieldMutation.mutate({
      entity_type: selectedObject.api_name,
      name: fieldName,
      label: fieldForm.label.trim(),
      field_type: fieldForm.field_type,
      options,
      required: fieldForm.required,
      order: fieldForm.order,
      related_to: fieldForm.field_type === 'lookup' ? fieldForm.related_to.trim() : undefined,
      custom_obj_id: selectedObject.id,
      visibility_rules: [],
    });
  }, [fieldForm, selectedObject, createFieldMutation]);

  if (isLoadingObjects) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#94a3b8]" />
      </div>
    );
  }

  // Object details view
  if (selectedObject) {
    return (
      <div className="space-y-6 max-w-[1200px]">
        {/* Header navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setSelectedObjectId(null);
                setSelectedFieldId(null);
              }}
              className="h-8 w-8 rounded-lg border-[#e2e8f0]"
            >
              <ArrowLeft size={15} className="text-[#64748b]" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0f172a] flex items-center gap-2">
                {selectedObject.singular_label}
                <Badge variant="outline" className="bg-[#f8fafc] text-indigo-600 border-indigo-100 text-[10px] rounded-md font-mono py-0.5 px-2">
                  {selectedObject.api_name}
                </Badge>
              </h1>
              <p className="text-xs text-[#64748b] mt-0.5">
                {selectedObject.description || 'Custom Object Schema Definition'}
              </p>
            </div>
          </div>

          {canManage && (
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm(`Are you absolutely sure you want to permanently delete custom object "${selectedObject.singular_label}" and all its fields?`)) {
                  removeObjectMutation.mutate(selectedObject.id);
                }
              }}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-semibold h-8 rounded-lg"
            >
              <Trash2 size={13} className="mr-1.5" />
              Delete Object definition
            </Button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3 items-start">
          {/* Fields list column */}
          <Card className="lg:col-span-2 bg-white border-[#e2e8f0] rounded-xl shadow-none">
            <CardHeader className="pb-3 border-b border-[#e2e8f0] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-[#0f172a]">
                  Schema Fields
                </CardTitle>
                <CardDescription className="text-xs text-[#94a3b8]">
                  Custom properties configured for this custom object record payload
                </CardDescription>
              </div>
              {canManage && !showFieldForm && (
                <Button
                  onClick={() => {
                    setShowFieldForm(true);
                    setSelectedFieldId(null);
                  }}
                  className="bg-[#0f172a] hover:bg-[#1e293b] text-white h-7 text-xs rounded-md flex items-center gap-1 px-2.5"
                >
                  <Plus size={13} />
                  Add Field
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingFields ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#94a3b8]" />
                </div>
              ) : (
                <div className="divide-y divide-[#e2e8f0]">
                  {fields?.map((field) => (
                    <div 
                      key={field.id} 
                      onClick={() => {
                        setSelectedFieldId(selectedFieldId === field.id ? null : field.id);
                        setShowFieldForm(false);
                      }}
                      className={cn(
                        "flex items-center justify-between p-4 hover:bg-slate-50/50 cursor-pointer group transition-all",
                        selectedFieldId === field.id && "bg-slate-50 border-l-2 border-indigo-500 pl-3"
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#0f172a]">{field.label}</span>
                          <span className="text-[10px] font-mono text-[#94a3b8]">{field.name}</span>
                          {field.required && (
                            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100 text-[8px] font-medium py-0 px-1">
                              Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-[#64748b] mt-0.5 capitalize flex items-center gap-1.5">
                          Type: <span className="font-semibold text-slate-800">{field.field_type.replace('_', ' ')}</span>
                          {field.field_type === 'lookup' && (
                            <span className="text-[#94a3b8] font-mono">({field.related_to})</span>
                          )}
                          {field.options && field.options.length > 0 && (
                            <span className="text-slate-400 font-mono truncate max-w-[250px]">
                              Options: [{field.options.join(', ')}]
                            </span>
                          )}
                        </p>
                      </div>

                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation(); // Avoid selecting row on delete
                            if (window.confirm(`Delete custom field "${field.label}"?`)) {
                              removeFieldMutation.mutate(field.id);
                              if (selectedFieldId === field.id) {
                                setSelectedFieldId(null);
                              }
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 transition-all rounded-md"
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  ))}

                  {fields?.length === 0 && (
                    <div className="p-8 text-center text-xs text-[#64748b]">
                      No custom fields provisioned. Click "Add Field" to declare your first custom property.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Field Form, Dependency Viewer or Schema Graph Column */}
          <div className="lg:col-span-1 space-y-6">
            {showFieldForm && canManage ? (
              <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none">
                <CardHeader className="pb-3 border-b border-[#e2e8f0] flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium text-[#0f172a] flex items-center gap-1.5">
                      <Sliders size={14} className="text-[#94a3b8]" />
                      New Field
                    </CardTitle>
                    <CardDescription className="text-xs text-[#94a3b8]">
                      Declare a new database field column
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowFieldForm(false)}
                    className="h-6 w-6 rounded-md hover:bg-slate-100"
                  >
                    <X size={14} className="text-slate-400" />
                  </Button>
                </CardHeader>
                <CardContent className="pt-4">
                  <form onSubmit={handleCreateField} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[#64748b]">Field Label (UI Display)</label>
                      <Input
                        placeholder="e.g. Valuation Amount"
                        value={fieldForm.label}
                        onChange={(e) => setFieldForm(f => ({ ...f, label: e.target.value }))}
                        required
                        className="h-8 text-xs border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[#64748b]">API Name (API Slug)</label>
                      <Input
                        placeholder="e.g. valuation_amount"
                        value={fieldForm.name}
                        onChange={(e) => setFieldForm(f => ({ ...f, name: e.target.value }))}
                        required
                        className="h-8 text-xs border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8] font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[#64748b]">Field Data Type</label>
                      <select
                        value={fieldForm.field_type}
                        onChange={(e) => setFieldForm(f => ({ ...f, field_type: e.target.value }))}
                        className="w-full h-8 px-2.5 rounded-lg border border-[#e2e8f0] bg-white text-xs text-[#0f172a] outline-none"
                      >
                        {FIELD_TYPES.map(t => (
                          <option key={t} value={t}>{t.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>

                    {fieldForm.field_type === 'lookup' && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-[#64748b]">Related To (Target Object)</label>
                        <Input
                          placeholder="e.g. Party, Case, or custom name"
                          value={fieldForm.related_to}
                          onChange={(e) => setFieldForm(f => ({ ...f, related_to: e.target.value }))}
                          required
                          className="h-8 text-xs border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8]"
                        />
                      </div>
                    )}

                    {(fieldForm.field_type === 'select' || fieldForm.field_type === 'multi_select') && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-[#64748b] flex items-center gap-1">
                          Picklist Options
                          <span title="Comma separated options list">
                            <HelpCircle size={12} className="text-slate-400" />
                          </span>
                        </label>
                        <textarea
                          placeholder="e.g. Hot, Warm, Cold"
                          value={fieldForm.options}
                          onChange={(e) => setFieldForm(f => ({ ...f, options: e.target.value }))}
                          required
                          className="w-full min-h-[60px] rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-xs text-[#0f172a] placeholder-[#94a3b8] outline-none"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="required_field"
                        checked={fieldForm.required}
                        onChange={(e) => setFieldForm(f => ({ ...f, required: e.target.checked }))}
                        className="h-3.5 w-3.5 rounded border-[#cbd5e1] text-[#0f172a]"
                      />
                      <label htmlFor="required_field" className="text-xs text-[#475569] font-medium select-none cursor-pointer">
                        Mark as Required Field
                      </label>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={createFieldMutation.isPending}
                        className="w-full h-8 text-xs bg-[#0f172a] hover:bg-[#1e293b] text-white flex items-center justify-center gap-1"
                      >
                        {createFieldMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus size={13} />
                        )}
                        Deploy Field Column
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : selectedFieldId && fields?.find(f => f.id === selectedFieldId) ? (
              (() => {
                const f = fields.find(field => field.id === selectedFieldId);
                if (!f) return null;
                return (
                  <DependencyViewer
                    objectName={selectedObject.api_name}
                    fieldName={f.name}
                    fieldLabel={f.label}
                  />
                );
              })()
            ) : (
              <SchemaGraph 
                objects={objects || []} 
                fieldsByObject={{
                  [selectedObject.api_name]: fields || []
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Custom objects listing view (index page)
  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0f172a]">Object Manager</h1>
          <p className="text-sm text-[#64748b] mt-0.5">
            Model custom database entities, define custom field attributes, and construct platform schema graphs
          </p>
        </div>

        {canManage && (
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-[#0f172a] hover:bg-[#1e293b] text-white h-9 rounded-lg flex items-center gap-1 px-4 text-xs font-semibold"
          >
            <Plus size={15} />
            Create Custom Object
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Custom Objects list cards */}
        {objects?.map((obj) => (
          <Card
            key={obj.id}
            onClick={() => setSelectedObjectId(obj.id)}
            className="bg-white border-[#e2e8f0] rounded-xl shadow-none hover:border-slate-350 cursor-pointer transition-all flex flex-col justify-between hover:shadow-sm"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="p-2 bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0] rounded-lg">
                  <Settings2 size={16} />
                </div>
                <Badge variant="outline" className="bg-[#f8fafc] text-indigo-600 border-indigo-100 text-[9px] font-mono rounded-md py-0 px-1.5 font-semibold">
                  {obj.api_name}
                </Badge>
              </div>
              <CardTitle className="text-base font-semibold text-[#0f172a] pt-2">
                {obj.singular_label}
              </CardTitle>
              <CardDescription className="text-xs text-[#64748b] line-clamp-2 min-h-[32px] mt-1">
                {obj.description || 'No description provided.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 border-t border-[#e2e8f0]/60 pb-3 flex items-center justify-between text-[10px] text-[#94a3b8] font-medium">
              <span>Plural: {obj.plural_label}</span>
              <span>Updated {new Date(obj.updated_at).toLocaleDateString()}</span>
            </CardContent>
          </Card>
        ))}

        {objects?.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center space-y-3 p-6 border border-dashed border-slate-300 rounded-2xl bg-white">
            <div className="p-3 bg-slate-50 text-slate-400 border border-slate-100 rounded-full">
              <Settings2 size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-800">No Custom Objects</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Get started by defining a custom object registry like a Property Listing, Vehicle, or Loan record.
              </p>
            </div>
            {canManage && (
              <Button
                onClick={() => setShowCreateDialog(true)}
                size="sm"
                className="bg-[#0f172a] hover:bg-slate-800 text-white rounded-lg px-3 h-8 text-xs"
              >
                Create Custom Object
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Creation Modal dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Create Custom Object</h3>
                <p className="text-[11px] text-slate-500">Define a new database table and record type</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowCreateDialog(false)}
                className="h-6 w-6 rounded-md hover:bg-slate-100"
              >
                <X size={14} className="text-slate-400" />
              </Button>
            </div>

            <form onSubmit={handleCreateObject} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Singular Label</label>
                  <Input
                    placeholder="e.g. Property"
                    value={objectForm.singular_label}
                    onChange={(e) => setObjectForm(f => ({
                      ...f,
                      singular_label: e.target.value,
                      plural_label: f.plural_label || e.target.value + 's',
                      api_name: f.api_name || e.target.value.replace(/\s+/g, '') + '__c'
                    }))}
                    required
                    className="h-9 text-xs border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Plural Label</label>
                  <Input
                    placeholder="e.g. Properties"
                    value={objectForm.plural_label}
                    onChange={(e) => setObjectForm(f => ({ ...f, plural_label: e.target.value }))}
                    required
                    className="h-9 text-xs border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                  API Object Name
                  <span title="API slug identifier. Will automatically end with __c.">
                    <HelpCircle size={12} className="text-slate-400" />
                  </span>
                </label>
                <Input
                  placeholder="e.g. PropertyListing__c"
                  value={objectForm.api_name}
                  onChange={(e) => setObjectForm(f => ({ ...f, api_name: e.target.value }))}
                  required
                  className="h-9 text-xs border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8] font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Description</label>
                <textarea
                  placeholder="Outline context of custom records storage..."
                  value={objectForm.description}
                  onChange={(e) => setObjectForm(f => ({ ...f, description: e.target.value }))}
                  className="min-h-[70px] w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-xs text-[#0f172a] placeholder-[#94a3b8] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#e2e8f0] -mx-6 -mb-6 p-4 bg-slate-50/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  className="h-8 text-xs border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createObjectMutation.isPending}
                  className="h-8 text-xs bg-[#0f172a] hover:bg-[#1e293b] text-white flex items-center gap-1"
                >
                  {createObjectMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Deploy Custom Object
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
