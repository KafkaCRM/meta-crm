import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiCall } from '@/lib/api';
import { 
  Columns,
  Plus, 
  Trash2, 
  ArrowDown, 
  ArrowUp,
  Save, 
  Sliders, 
  Sparkles, 
  FolderOpen,
  Layout,
  ListPlus,
  Eye,
  Lock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CustomObject, FieldDefinition } from './ObjectManager';

// Page Layout interface
export interface PageLayout {
  id: string;
  object_type: string;
  name: string;
  layout_json: {
    sections: LayoutSection[];
  };
  is_default: boolean;
}

export interface LayoutField {
  name: string;
  required: boolean;
  readonly: boolean;
}

export interface LayoutSection {
  name: string;
  columns: 1 | 2;
  fields: LayoutField[];
}

export function LayoutBuilder() {
  const queryClient = useQueryClient();
  const [selectedObject, setSelectedObject] = useState<string>('Party');
  const [sections, setSections] = useState<LayoutSection[]>([]);
  const [currentLayoutId, setCurrentLayoutId] = useState<string | null>(null);

  // Modal / Form state for adding new sections
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionColumns, setNewSectionColumns] = useState<1 | 2>(2);

  // Queries
  const { data: customObjects = [] } = useQuery<CustomObject[]>({
    queryKey: ['custom-objects'],
    queryFn: () => apiCall<CustomObject[]>('/custom-objects'),
  });

  const { data: fields = [], isLoading: isLoadingFields } = useQuery<FieldDefinition[]>({
    queryKey: ['fields', selectedObject],
    queryFn: () => apiCall<FieldDefinition[]>(`/field-definitions?entity_type=${selectedObject}`),
  });

  const { data: layouts = [], isLoading: isLoadingLayouts } = useQuery<PageLayout[]>({
    queryKey: ['layouts', selectedObject],
    queryFn: () => apiCall<PageLayout[]>(`/page-layouts?object_type=${selectedObject}`),
  });

  // Automatically map loaded page layout to current state
  useEffect(() => {
    if (layouts && layouts.length > 0) {
      const defaultLayout = layouts.find(l => l.is_default) || layouts[0];
      if (defaultLayout) {
        setSections(defaultLayout.layout_json?.sections || []);
        setCurrentLayoutId(defaultLayout.id);
      }
    } else {
      // If no layout exists, initialize a default boilerplate section
      setSections([
        {
          name: 'General Information',
          columns: 2,
          fields: [],
        }
      ]);
      setCurrentLayoutId(null);
    }
  }, [layouts, selectedObject]);

  // Mutations
  const saveLayoutMutation = useMutation({
    mutationFn: (data: { id?: string | null; object_type: string; name: string; layout_json: any }) => {
      if (data.id) {
        return apiCall<PageLayout>(`/page-layouts/${data.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: data.name,
            layout_json: data.layout_json,
          }),
        });
      } else {
        return apiCall<PageLayout>('/page-layouts', {
          method: 'POST',
          body: JSON.stringify({
            object_type: data.object_type,
            name: data.name,
            layout_json: data.layout_json,
            is_default: true,
          }),
        });
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['layouts', selectedObject] });
      setCurrentLayoutId(data.id);
      toast.success('Page layout metadata configuration saved successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to save page layout');
    }
  });

  // Layout Builders actions
  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;

    setSections(prev => [
      ...prev,
      {
        name: newSectionName.trim(),
        columns: newSectionColumns,
        fields: [],
      }
    ]);
    setShowSectionModal(false);
    setNewSectionName('');
    toast.success(`Section '${newSectionName}' added! Add fields to it below.`);
  };

  const handleRemoveSection = (sectionIndex: number) => {
    setSections(prev => prev.filter((_, idx) => idx !== sectionIndex));
    toast.info('Section removed from layout.');
  };

  const handleAddFieldToSection = (sectionIndex: number, fieldName: string) => {
    // Prevent duplicate additions
    const isAlreadyAdded = sections.some(s => s.fields.some(f => f.name === fieldName));
    if (isAlreadyAdded) {
      toast.warning('This field is already placed in another section of this layout.');
      return;
    }

    const fieldObj = fields.find(f => f.name === fieldName);
    if (!fieldObj) return;

    setSections(prev => {
      const copy = [...prev];
      const section = copy[sectionIndex];
      if (section) {
        section.fields = [
          ...section.fields,
          {
            name: fieldName,
            required: fieldObj.required,
            readonly: false
          }
        ];
      }
      return copy;
    });
  };

  const handleRemoveFieldFromSection = (sectionIndex: number, fieldIndex: number) => {
    setSections(prev => {
      const copy = [...prev];
      const section = copy[sectionIndex];
      if (section) {
        section.fields = section.fields.filter((_, idx) => idx !== fieldIndex);
      }
      return copy;
    });
  };

  const handleToggleFieldRequired = (sectionIndex: number, fieldIndex: number) => {
    setSections(prev => {
      const copy = [...prev];
      const section = copy[sectionIndex];
      if (section) {
        const field = section.fields[fieldIndex];
        if (field) {
          field.required = !field.required;
        }
      }
      return copy;
    });
  };

  const handleToggleFieldReadonly = (sectionIndex: number, fieldIndex: number) => {
    setSections(prev => {
      const copy = [...prev];
      const section = copy[sectionIndex];
      if (section) {
        const field = section.fields[fieldIndex];
        if (field) {
          field.readonly = !field.readonly;
        }
      }
      return copy;
    });
  };

  const handleMoveField = (sectionIndex: number, fieldIndex: number, direction: 'up' | 'down') => {
    setSections(prev => {
      const copy = [...prev];
      const section = copy[sectionIndex];
      if (section) {
        const fieldsCopy = [...section.fields];
        const targetIndex = direction === 'up' ? fieldIndex - 1 : fieldIndex + 1;
        if (targetIndex >= 0 && targetIndex < fieldsCopy.length) {
          const temp = fieldsCopy[fieldIndex];
          const target = fieldsCopy[targetIndex];
          if (temp && target) {
            fieldsCopy[fieldIndex] = target;
            fieldsCopy[targetIndex] = temp;
            section.fields = fieldsCopy;
          }
        }
      }
      return copy;
    });
  };

  const handleMoveSection = (sectionIndex: number, direction: 'up' | 'down') => {
    setSections(prev => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1;
      if (targetIndex >= 0 && targetIndex < copy.length) {
        const temp = copy[sectionIndex];
        const target = copy[targetIndex];
        if (temp && target) {
          copy[sectionIndex] = target;
          copy[targetIndex] = temp;
        }
      }
      return copy;
    });
  };

  const handleSaveLayout = () => {
    saveLayoutMutation.mutate({
      id: currentLayoutId,
      object_type: selectedObject,
      name: 'Default',
      layout_json: { sections },
    });
  };

  const standardObjects = [
    { api_name: 'Party', singular_label: 'Party (Contact/Account)' },
    { api_name: 'Case', singular_label: 'Case (Service Ticket)' },
    { api_name: 'Interaction', singular_label: 'Interaction Log' },
  ];

  const availableFieldOptions = fields.filter(
    field => !sections.some(s => s.fields.some(f => f.name === field.name))
  );

  return (
    <div className="space-y-6 max-w-[1280px]">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Layout className="text-indigo-600 w-6 h-6" />
            Page Layout Designer
          </h1>
          <p className="text-sm text-slate-500 mt-1">Design form fields positions, collapsible sections, read-only limits, and requirements parameters for each object.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setShowSectionModal(true)} 
            variant="outline"
            className="border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg h-9 px-4 text-xs font-semibold"
          >
            <Plus size={14} className="mr-1.5" />
            Add Layout Section
          </Button>
          <Button 
            onClick={handleSaveLayout} 
            disabled={saveLayoutMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9 px-4 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Save size={15} />
            {saveLayoutMutation.isPending ? 'Saving layout…' : 'Save Layout Metadata'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Selector sidebar */}
        <div className="lg:col-span-1 space-y-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1 mb-2">Select Target Object</h3>
            <div className="space-y-1">
              {standardObjects.map((obj) => (
                <button
                  key={obj.api_name}
                  onClick={() => setSelectedObject(obj.api_name)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                    selectedObject === obj.api_name
                      ? 'bg-indigo-50 border border-indigo-100 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <span className="truncate">{obj.singular_label}</span>
                </button>
              ))}
              
              {customObjects.map((obj) => (
                <button
                  key={obj.api_name}
                  onClick={() => setSelectedObject(obj.api_name)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                    selectedObject === obj.api_name
                      ? 'bg-indigo-50 border border-indigo-100 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <span className="truncate">{obj.singular_label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Unused fields list */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2 pl-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unplaced Fields</h3>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                {availableFieldOptions.length}
              </span>
            </div>
            
            <p className="text-[10px] text-slate-400 leading-normal pl-1 mb-3">These fields exist in the database schema but are not active on the rendering layouts form.</p>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {isLoadingFields ? (
                <div className="py-2 text-center text-xs text-slate-400">Loading fields…</div>
              ) : availableFieldOptions.length === 0 ? (
                <div className="py-4 text-center rounded-lg border border-dashed border-slate-200 text-slate-400 p-2 text-[10px]">
                  All fields are mapped on layout.
                </div>
              ) : (
                availableFieldOptions.map(field => (
                  <div 
                    key={field.name}
                    className="p-2 border border-slate-200 rounded bg-slate-50 flex items-center justify-between gap-2 shadow-sm"
                  >
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-slate-700 block truncate">{field.label}</span>
                      <span className="text-[9px] font-mono text-slate-400 block truncate">{field.name}</span>
                    </div>

                    <div className="flex gap-1">
                      {sections.map((sec, secIdx) => (
                        <button
                          key={sec.name}
                          onClick={() => handleAddFieldToSection(secIdx, field.name)}
                          className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-600 text-[9px] font-bold hover:bg-indigo-100 transition-colors"
                          title={`Add to section: ${sec.name}`}
                        >
                          + Sec {secIdx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Visual designer area */}
        <div className="lg:col-span-3 space-y-6">
          {sections.length === 0 ? (
            <Card className="bg-white border-slate-200 rounded-xl shadow-sm py-12 text-center">
              <CardContent className="space-y-3">
                <Sliders className="text-slate-300 w-12 h-12 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700">No Layout Sections Configured</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">Page Layouts require at least one visual section. Click &apos;Add Layout Section&apos; to get started.</p>
                <Button 
                  onClick={() => setShowSectionModal(true)} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9 px-4 text-xs font-semibold shadow-sm"
                >
                  <Plus size={14} className="mr-1.5" />
                  Add First Section
                </Button>
              </CardContent>
            </Card>
          ) : (
            sections.map((section, secIdx) => (
              <Card key={section.name} className="bg-white border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-indigo-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                      {secIdx + 1}
                    </span>
                    <CardTitle className="text-sm font-bold text-slate-800">{section.name}</CardTitle>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200/50 flex items-center gap-1">
                      <Columns size={10} />
                      {section.columns} Column{section.columns > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveSection(secIdx, 'up')}
                      disabled={secIdx === 0}
                      className="p-1 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
                      title="Move section up"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      onClick={() => handleMoveSection(secIdx, 'down')}
                      disabled={secIdx === sections.length - 1}
                      className="p-1 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
                      title="Move section down"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      onClick={() => handleRemoveSection(secIdx)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Delete section"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </CardHeader>
                
                <CardContent className="p-4">
                  {section.fields.length === 0 ? (
                    <div className="py-6 text-center rounded-lg border border-dashed border-slate-200 bg-slate-50/20 text-slate-400 p-2 text-xs">
                      No fields placed in this section yet. Use the sidebar on the left to map fields to this section.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase pb-1 border-b border-slate-100">
                        <div className="col-span-4">Field Name</div>
                        <div className="col-span-3">API Name</div>
                        <div className="col-span-2 text-center">Required</div>
                        <div className="col-span-2 text-center">Read Only</div>
                        <div className="col-span-1 text-right">Actions</div>
                      </div>

                      <div className="space-y-1.5 pt-1.5">
                        {section.fields.map((field, fieldIdx) => {
                          const fieldDef = fields.find(f => f.name === field.name);
                          return (
                            <div 
                              key={field.name}
                              className="grid grid-cols-12 items-center text-xs p-2.5 rounded-lg border border-slate-100 bg-white hover:border-slate-200 transition-colors shadow-sm"
                            >
                              <div className="col-span-4 font-bold text-slate-800 truncate">
                                {fieldDef?.label || field.name}
                              </div>
                              
                              <div className="col-span-3 font-mono text-slate-400 text-[10px] truncate">
                                {field.name}
                              </div>

                              <div className="col-span-2 flex justify-center">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={() => handleToggleFieldRequired(secIdx, fieldIdx)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </div>

                              <div className="col-span-2 flex justify-center">
                                <input
                                  type="checkbox"
                                  checked={field.readonly}
                                  onChange={() => handleToggleFieldReadonly(secIdx, fieldIdx)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </div>

                              <div className="col-span-1 flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleMoveField(secIdx, fieldIdx, 'up')}
                                  disabled={fieldIdx === 0}
                                  className="p-0.5 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
                                  title="Move up"
                                >
                                  <ArrowUp size={11} />
                                </button>
                                <button
                                  onClick={() => handleMoveField(secIdx, fieldIdx, 'down')}
                                  disabled={fieldIdx === section.fields.length - 1}
                                  className="p-0.5 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
                                  title="Move down"
                                >
                                  <ArrowDown size={11} />
                                </button>
                                <button
                                  onClick={() => handleRemoveFieldFromSection(secIdx, fieldIdx)}
                                  className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                  title="Remove from layout"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* CREATE SECTION MODAL */}
      {showSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Plus size={15} className="text-indigo-600" />
                Add Layout Section
              </h3>
              <button 
                onClick={() => setShowSectionModal(false)}
                className="text-slate-400 hover:text-slate-600 font-semibold text-sm px-2 py-0.5"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddSection} className="p-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Section Header Label</label>
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="e.g. Sales Metrics, Profile Preferences"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all font-semibold"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Grid Column Layout</label>
                <select
                  value={newSectionColumns}
                  onChange={(e) => setNewSectionColumns(Number(e.target.value) as 1 | 2)}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all cursor-pointer font-semibold"
                >
                  <option value={2}>2 Columns Layout (Split row)</option>
                  <option value={1}>1 Column Layout (Full row width)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSectionModal(false)}
                  className="h-9 px-4 text-xs font-semibold hover:bg-slate-50 border-slate-200 text-slate-600 rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                >
                  Add Section
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
