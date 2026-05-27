import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiCall } from '@/lib/api';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Database, 
  FileJson, 
  Sparkles, 
  HelpCircle,
  FolderOpen,
  ArrowRightLeft,
  Calendar,
  Lock,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Custom Object Definition interface
export interface CustomObject {
  id: string;
  api_name: string;
  singular_label: string;
  plural_label: string;
  description: string | null;
  created_at: string;
}

// Field Definition interface
export interface FieldDefinition {
  id: string;
  entity_type: string;
  name: string;
  label: string;
  field_type: string;
  options: string[] | null;
  required: boolean;
  order: number;
  related_to?: string | null;
}

export function ObjectManager() {
  const queryClient = useQueryClient();
  const [selectedObject, setSelectedObject] = useState<string>('Party');
  const [activeTab, setActiveTab] = useState<'fields' | 'details'>('fields');
  
  // Custom Object Form Modal State
  const [showObjectModal, setShowObjectModal] = useState(false);
  const [newObjectName, setNewObjectName] = useState('');
  const [newObjectSingular, setNewObjectSingular] = useState('');
  const [newObjectPlural, setNewObjectPlural] = useState('');
  const [newObjectDesc, setNewObjectDesc] = useState('');

  // Field Form Modal State
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldRelatedTo, setNewFieldRelatedTo] = useState('Party');

  // Queries
  const { data: customObjects = [], isLoading: isLoadingObjects } = useQuery<CustomObject[]>({
    queryKey: ['custom-objects'],
    queryFn: () => apiCall<CustomObject[]>('/custom-objects'),
  });

  const { data: fields = [], isLoading: isLoadingFields } = useQuery<FieldDefinition[]>({
    queryKey: ['fields', selectedObject],
    queryFn: () => apiCall<FieldDefinition[]>(`/field-definitions?entity_type=${selectedObject}`),
  });

  // Mutate Custom Object
  const createObjectMutation = useMutation({
    mutationFn: (data: { api_name: string; singular_label: string; plural_label: string; description?: string }) => 
      apiCall<CustomObject>('/custom-objects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['custom-objects'] });
      setSelectedObject(data.api_name);
      setShowObjectModal(false);
      setNewObjectName('');
      setNewObjectSingular('');
      setNewObjectPlural('');
      setNewObjectDesc('');
      toast.success(`Custom Object '${data.singular_label}' registered successfully!`);
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to create Custom Object');
    }
  });

  const deleteObjectMutation = useMutation({
    mutationFn: (id: string) => 
      apiCall(`/custom-objects/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-objects'] });
      setSelectedObject('Party');
      toast.success('Custom Object deleted successfully');
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to delete Custom Object');
    }
  });

  // Mutate Custom Fields
  const createFieldMutation = useMutation({
    mutationFn: (data: { 
      entity_type: string; 
      name: string; 
      label: string; 
      field_type: string; 
      options?: string[]; 
      required?: boolean; 
      order?: number; 
      related_to?: string;
    }) => 
      apiCall<FieldDefinition>('/field-definitions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fields', selectedObject] });
      setShowFieldModal(false);
      setNewFieldName('');
      setNewFieldLabel('');
      setNewFieldType('text');
      setNewFieldOptions('');
      setNewFieldRequired(false);
      toast.success(`Custom Field '${data.label}' added successfully!`);
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to create Custom Field');
    }
  });

  const deleteFieldMutation = useMutation({
    mutationFn: (id: string) => 
      apiCall(`/field-definitions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields', selectedObject] });
      toast.success('Custom Field deleted successfully');
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to delete Custom Field');
    }
  });

  // Handlers
  const handleCreateObject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObjectName.trim()) return;
    
    // Ensure suffix __c is appended to indicate Custom Object (Salesforce standard)
    let apiName = newObjectName.trim().replace(/\s+/g, '_');
    if (!apiName.endsWith('__c')) {
      apiName = `${apiName}__c`;
    }

    createObjectMutation.mutate({
      api_name: apiName,
      singular_label: newObjectSingular.trim(),
      plural_label: newObjectPlural.trim(),
      description: newObjectDesc.trim() || undefined,
    });
  };

  const handleCreateField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim() || !newFieldLabel.trim()) return;

    // Ensure suffix __c is appended to custom field name
    let name = newFieldName.trim().replace(/\s+/g, '_').toLowerCase();
    if (!name.endsWith('__c')) {
      name = `${name}__c`;
    }

    const options = newFieldOptions.trim()
      ? newFieldOptions.split(',').map(o => o.trim()).filter(Boolean)
      : undefined;

    createFieldMutation.mutate({
      entity_type: selectedObject,
      name,
      label: newFieldLabel.trim(),
      field_type: newFieldType,
      options,
      required: newFieldRequired,
      order: fields.length + 1,
      related_to: newFieldType === 'lookup' ? newFieldRelatedTo : undefined,
    });
  };

  const activeObjectDetails = customObjects.find(o => o.api_name === selectedObject);
  const isCustomObject = selectedObject.endsWith('__c');

  const standardObjects = [
    { api_name: 'Party', singular_label: 'Party (Account/Contact)', plural_label: 'Parties', description: 'Base physical entities in Meta CRM. Stores standard CRM customer profiles.' },
    { api_name: 'Case', singular_label: 'Case (Service Ticket)', plural_label: 'Cases', description: 'Represents service requests, support queries, or workflow issues.' },
    { api_name: 'Interaction', singular_label: 'Interaction Log', plural_label: 'Interactions', description: 'Represents timeline feeds, notes, calls, emails, or messages.' },
  ];

  return (
    <div className="space-y-6 max-w-[1280px]">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="text-indigo-600 w-6 h-6 animate-spin-slow" />
            Object Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">Configure metadata schemas, custom objects, standard layouts, and custom fields without code recompilation.</p>
        </div>
        <Button 
          onClick={() => setShowObjectModal(true)} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9 px-4 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
        >
          <Plus size={15} />
          Create Custom Object
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Side: Object Selector List */}
        <div className="lg:col-span-1 space-y-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1 mb-2">Standard Objects</h3>
            <div className="space-y-1">
              {standardObjects.map((obj) => (
                <button
                  key={obj.api_name}
                  onClick={() => { setSelectedObject(obj.api_name); setActiveTab('fields'); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                    selectedObject === obj.api_name
                      ? 'bg-indigo-50 border border-indigo-100 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <span className="truncate">{obj.singular_label}</span>
                  <Database size={12} className={selectedObject === obj.api_name ? 'text-indigo-500' : 'text-slate-400'} />
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1 mb-2 flex items-center justify-between">
              Custom Objects
              {customObjects.length > 0 && (
                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{customObjects.length}</span>
              )}
            </h3>
            
            {isLoadingObjects ? (
              <div className="py-4 text-center text-xs text-slate-400">Loading custom schemas…</div>
            ) : customObjects.length === 0 ? (
              <div className="py-6 text-center rounded-lg border border-dashed border-slate-200 text-slate-400 p-2 text-[11px] leading-relaxed">
                No custom tables registered yet. Click &apos;Create Custom Object&apos; above.
              </div>
            ) : (
              <div className="space-y-1">
                {customObjects.map((obj) => (
                  <button
                    key={obj.api_name}
                    onClick={() => { setSelectedObject(obj.api_name); setActiveTab('fields'); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                      selectedObject === obj.api_name
                        ? 'bg-indigo-50 border border-indigo-100 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <span className="truncate">{obj.singular_label}</span>
                    <Sparkles size={12} className={selectedObject === obj.api_name ? 'text-indigo-500' : 'text-slate-400'} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Fields and Details Panel */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="bg-white border-slate-200 rounded-xl shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-bold text-slate-900">
                      {isCustomObject 
                        ? activeObjectDetails?.singular_label 
                        : standardObjects.find(o => o.api_name === selectedObject)?.singular_label
                      }
                    </CardTitle>
                    <span className="font-mono text-xs text-slate-400 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded">
                      {selectedObject}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-normal">
                    {isCustomObject 
                      ? activeObjectDetails?.description || 'Custom data collection entity.'
                      : standardObjects.find(o => o.api_name === selectedObject)?.description
                    }
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/40 self-start sm:self-center">
                  <button
                    onClick={() => setActiveTab('fields')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                      activeTab === 'fields'
                        ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Fields & Relationships
                  </button>
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                      activeTab === 'details'
                        ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Object Details
                  </button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-4 px-0 pb-0">
              {activeTab === 'fields' && (
                <div className="space-y-4">
                  <div className="px-6 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Entity Schema Columns</h4>
                      <p className="text-[10px] text-slate-400">A mix of system hardcoded standard fields and tenant runtime custom fields.</p>
                    </div>
                    <Button 
                      onClick={() => setShowFieldModal(true)} 
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 rounded-lg h-8 px-3 text-[11px] font-bold transition-colors flex items-center gap-1"
                    >
                      <Plus size={13} />
                      Add Custom Field
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 font-bold border-y border-slate-100">
                          <th className="py-3 px-6">Field Label</th>
                          <th className="py-3 px-3">API Name</th>
                          <th className="py-3 px-3">Data Type</th>
                          <th className="py-3 px-3">Requirement</th>
                          <th className="py-3 px-3">Custom</th>
                          <th className="py-3 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {isLoadingFields ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400">Loading fields definition…</td>
                          </tr>
                        ) : fields.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400">No custom fields created on this object.</td>
                          </tr>
                        ) : (
                          fields.map((field) => (
                            <tr key={field.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3.5 px-6 font-bold text-slate-800">{field.label}</td>
                              <td className="py-3.5 px-3 font-mono text-slate-500 text-[11px]">{field.name}</td>
                              <td className="py-3.5 px-3">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-200/50 text-[10px] font-semibold text-slate-600 capitalize">
                                  {field.field_type === 'select' ? 'picklist' : field.field_type}
                                </span>
                              </td>
                              <td className="py-3.5 px-3">
                                {field.required ? (
                                  <span className="text-red-600 font-semibold flex items-center gap-0.5">Required</span>
                                ) : (
                                  <span className="text-slate-400">Optional</span>
                                )}
                              </td>
                              <td className="py-3.5 px-3">
                                {field.name.endsWith('__c') ? (
                                  <span className="text-indigo-600 font-bold">Yes</span>
                                ) : (
                                  <span className="text-slate-400">Standard</span>
                                )}
                              </td>
                              <td className="py-3.5 px-6 text-right">
                                {field.name.endsWith('__c') ? (
                                  <button
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to permanently delete custom field '${field.label}'?`)) {
                                        deleteFieldMutation.mutate(field.id);
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors inline-block"
                                    title="Delete custom field"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                ) : (
                                  <span className="text-slate-300 select-none cursor-not-allowed">
                                    <Lock size={12} className="inline" />
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'details' && (
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                    <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                      <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">API Name</span>
                      <span className="font-mono font-bold text-slate-800 text-sm block">{selectedObject}</span>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                      <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Classification Type</span>
                      <span className="font-bold text-slate-800 text-sm block capitalize flex items-center gap-1.5">
                        {isCustomObject ? (
                          <>
                            <Sparkles size={14} className="text-indigo-500" />
                            Polymorphic Custom Schema
                          </>
                        ) : (
                          <>
                            <Database size={14} className="text-slate-500" />
                            Hardcoded Base Schema
                          </>
                        )}
                      </span>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                      <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Singular Label</span>
                      <span className="font-bold text-slate-800 text-sm block">
                        {isCustomObject 
                          ? activeObjectDetails?.singular_label 
                          : standardObjects.find(o => o.api_name === selectedObject)?.singular_label
                        }
                      </span>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                      <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Plural Label</span>
                      <span className="font-bold text-slate-800 text-sm block">
                        {isCustomObject 
                          ? activeObjectDetails?.plural_label 
                          : standardObjects.find(o => o.api_name === selectedObject)?.plural_label
                        }
                      </span>
                    </div>
                  </div>

                  {isCustomObject && activeObjectDetails && (
                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                      <Button
                        onClick={() => {
                          if (confirm(`CAUTION: Deleting this object will delete all custom field parameters and polymorphic FlexRecords stored under '${activeObjectDetails.singular_label}'. Proceed?`)) {
                            deleteObjectMutation.mutate(activeObjectDetails.id);
                          }
                        }}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 h-9 px-4 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <Trash2 size={14} />
                        Delete Custom Object Definition
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CREATE CUSTOM OBJECT MODAL */}
      {showObjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Plus size={15} className="text-indigo-600" />
                New Custom Object
              </h3>
              <button 
                onClick={() => setShowObjectModal(false)}
                className="text-slate-400 hover:text-slate-600 font-semibold text-sm px-2 py-0.5"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateObject} className="p-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Object Label (Singular)</label>
                <input
                  type="text"
                  value={newObjectSingular}
                  onChange={(e) => {
                    setNewObjectSingular(e.target.value);
                    if (!newObjectName) {
                      setNewObjectName(e.target.value.replace(/\s+/g, ''));
                    }
                  }}
                  placeholder="e.g. Property Listing"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all font-semibold"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Plural Label</label>
                <input
                  type="text"
                  value={newObjectPlural}
                  onChange={(e) => setNewObjectPlural(e.target.value)}
                  placeholder="e.g. Property Listings"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all font-semibold"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">API Unique Name</label>
                <input
                  type="text"
                  value={newObjectName}
                  onChange={(e) => setNewObjectName(e.target.value)}
                  placeholder="e.g. PropertyListing__c"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all"
                  required
                />
                <p className="mt-1 text-[9px] text-slate-400 font-medium">Standard custom object API name should end in &apos;__c&apos;</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Description</label>
                <textarea
                  value={newObjectDesc}
                  onChange={(e) => setNewObjectDesc(e.target.value)}
                  placeholder="Explain the purpose of this custom entity..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowObjectModal(false)}
                  className="h-9 px-4 text-xs font-semibold hover:bg-slate-50 border-slate-200 text-slate-600 rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createObjectMutation.isPending}
                  className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                >
                  {createObjectMutation.isPending ? 'Provisioning…' : 'Create Object'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CUSTOM FIELD MODAL */}
      {showFieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Plus size={15} className="text-indigo-600" />
                Add Custom Field to {selectedObject}
              </h3>
              <button 
                onClick={() => setShowFieldModal(false)}
                className="text-slate-400 hover:text-slate-600 font-semibold text-sm px-2 py-0.5"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateField} className="p-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Field Label</label>
                <input
                  type="text"
                  value={newFieldLabel}
                  onChange={(e) => {
                    setNewFieldLabel(e.target.value);
                    if (!newFieldName) {
                      setNewFieldName(e.target.value.replace(/\s+/g, '_').toLowerCase());
                    }
                  }}
                  placeholder="e.g. Birth Date"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all font-semibold"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Field API Name</label>
                <input
                  type="text"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="e.g. birth_date__c"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all"
                  required
                />
                <p className="mt-1 text-[9px] text-slate-400 font-medium">Standard custom field API name should end in &apos;__c&apos;</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Data Type</label>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all cursor-pointer font-semibold"
                >
                  <option value="text">Text (String)</option>
                  <option value="number">Number (Float/Int)</option>
                  <option value="date">Date & Time</option>
                  <option value="boolean">Checkbox (Boolean)</option>
                  <option value="phone">Phone Number</option>
                  <option value="email">Email Address</option>
                  <option value="select">Picklist (Single Select)</option>
                  <option value="lookup">Lookup Relationship (Reference)</option>
                </select>
              </div>

              {newFieldType === 'lookup' && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Related Target Object</label>
                  <select
                    value={newFieldRelatedTo}
                    onChange={(e) => setNewFieldRelatedTo(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all cursor-pointer font-semibold"
                  >
                    <optgroup label="Standard CRM Tables">
                      <option value="Party">Party (Account/Contact)</option>
                      <option value="Case">Case (Service Ticket)</option>
                    </optgroup>
                    {customObjects.length > 0 && (
                      <optgroup label="Custom Low-Code Tables">
                        {customObjects.map(obj => (
                          <option key={obj.id} value={obj.api_name}>{obj.singular_label} ({obj.api_name})</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <p className="mt-1 text-[9px] text-slate-400 font-medium">Select the target record table this reference links to.</p>
                </div>
              )}

              {newFieldType === 'select' && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Picklist Options (Comma Separated)</label>
                  <textarea
                    value={newFieldOptions}
                    onChange={(e) => setNewFieldOptions(e.target.value)}
                    placeholder="Morning, Afternoon, Evening"
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all font-semibold"
                    required
                  />
                  <p className="mt-1 text-[9px] text-slate-400 font-medium">Provide choices separated by commas.</p>
                </div>
              )}

              <div className="flex items-center gap-2 py-2">
                <input
                  id="requiredCheckbox"
                  type="checkbox"
                  checked={newFieldRequired}
                  onChange={(e) => setNewFieldRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="requiredCheckbox" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  Require values for this field when saving records
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFieldModal(false)}
                  className="h-9 px-4 text-xs font-semibold hover:bg-slate-50 border-slate-200 text-slate-600 rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createFieldMutation.isPending}
                  className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                >
                  {createFieldMutation.isPending ? 'Adding…' : 'Add Field'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
