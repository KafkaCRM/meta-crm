import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  Loader2, 
  Save, 
  Undo, 
  ArrowUp, 
  ArrowDown, 
  Columns, 
  Settings, 
  Check, 
  ExternalLink, 
  Layers, 
  Sliders, 
  Info,
  ChevronRight,
  Eye,
  Lock,
  ChevronLeft
} from 'lucide-react';
import { settingsApi, FieldDefinition } from '@/api/settings';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  DndContext, 
  DragEndEvent, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  KeyboardSensor,
  closestCenter
} from '@dnd-kit/core';
import { 
  SortableContext, 
  useSortable, 
  verticalListSortingStrategy,
  sortableKeyboardCoordinates 
} from '@dnd-kit/sortable';
const transformToString = (transform: any) => {
  if (!transform) return undefined;
  return `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX ?? 1}) scaleY(${transform.scaleY ?? 1})`;
};

// Standard Hardcoded Fields for the standard entities
const STANDARD_FIELDS: Record<string, { name: string; label: string; field_type: string; required?: boolean }[]> = {
  Party: [
    { name: 'name', label: 'Full Name', field_type: 'text', required: true },
    { name: 'type', label: 'Party Type', field_type: 'select' },
    { name: 'email', label: 'Email Address', field_type: 'email' },
    { name: 'phone_raw', label: 'Phone Number', field_type: 'phone' },
    { name: 'source', label: 'Lead Source', field_type: 'text' },
    { name: 'merge_status', label: 'Merge Status', field_type: 'text' },
  ],
  Case: [
    { name: 'title', label: 'Title / Subject', field_type: 'text', required: true },
    { name: 'type', label: 'Case Type', field_type: 'text' },
    { name: 'stage', label: 'Workflow Stage', field_type: 'text' },
    { name: 'assigned_to_id', label: 'Assigned User', field_type: 'lookup' },
    { name: 'vertical_id', label: 'Vertical ID', field_type: 'text' },
    { name: 'campaign_id', label: 'Campaign ID', field_type: 'text' },
  ],
  Interaction: [
    { name: 'channel', label: 'Interaction Channel', field_type: 'select' },
    { name: 'direction', label: 'Direction (In/Out)', field_type: 'select' },
    { name: 'content', label: 'Content', field_type: 'text' },
    { name: 'thread_id', label: 'Thread Identifier', field_type: 'text' },
  ]
};

interface LayoutField {
  name: string;
  required: boolean;
  readonly: boolean;
}

interface LayoutSection {
  name: string;
  columns: number;
  fields: LayoutField[];
}

interface PageLayoutPayload {
  id: string;
  object_type: string;
  name: string;
  layout_json: {
    sections: LayoutSection[];
  };
  is_default: boolean;
}

interface SortablePlacedFieldProps {
  placedField: LayoutField;
  sIdx: number;
  fIdx: number;
  allFieldsRegistry: any[];
  canManage: boolean;
  handleMoveField: (sIdx: number, fIdx: number, direction: 'up' | 'down') => void;
  handleMoveFieldToSection: (sIdx: number, fIdx: number, targetIdx: number) => void;
  handleToggleFieldProp: (sIdx: number, fIdx: number, prop: 'required' | 'readonly') => void;
  handleRemoveFieldFromSection: (sIdx: number, fIdx: number) => void;
  layoutSections: any[];
}

function SortablePlacedField({
  placedField, sIdx, fIdx, allFieldsRegistry, canManage,
  handleMoveField, handleMoveFieldToSection, handleToggleFieldProp, handleRemoveFieldFromSection,
  layoutSections
}: SortablePlacedFieldProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${sIdx}-${placedField.name}`
  });

  const style = {
    transform: transformToString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const registryInfo = allFieldsRegistry.find(r => r.name === placedField.name);
  const isRequired = placedField.required;
  const isReadonly = placedField.readonly;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between p-3 border border-border rounded-lg hover:border-slate-350 hover:shadow-xs transition-all bg-card group/field select-none",
        isDragging && "border-indigo-400 ring-2 ring-indigo-500/10"
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {canManage && (
          <div 
            {...attributes} 
            {...listeners} 
            className="cursor-grab active:cursor-grabbing text-muted-foreground/70 hover:text-muted-foreground p-1 rounded-sm shrink-0"
            title="Drag to reorder"
          >
            <div className="grid grid-cols-2 gap-0.5 w-3">
              <span className="w-1 h-1 bg-current rounded-full" />
              <span className="w-1 h-1 bg-current rounded-full" />
              <span className="w-1 h-1 bg-current rounded-full" />
              <span className="w-1 h-1 bg-current rounded-full" />
              <span className="w-1 h-1 bg-current rounded-full" />
              <span className="w-1 h-1 bg-current rounded-full" />
            </div>
          </div>
        )}
        
        <div className="min-w-0 pr-2 space-y-0.5">
          <div className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
            {registryInfo?.label || placedField.name}
            {isRequired && <Badge className="bg-red-50 text-red-600 border border-red-100 text-[8px] px-1 py-0 rounded">Req</Badge>}
            {isReadonly && <Badge className="bg-muted text-muted-foreground border border-border/50 text-[8px] px-1 py-0 rounded">R/O</Badge>}
          </div>
          <div className="text-[9px] font-mono text-muted-foreground truncate flex items-center gap-2">
            <span>{placedField.name}</span>
            <span className="capitalize px-1 bg-muted border border-border/50 rounded text-muted-foreground text-[8px]">
              {registryInfo?.field_type || 'text'}
            </span>
          </div>
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={fIdx === 0}
            onClick={() => handleMoveField(sIdx, fIdx, 'up')}
            className="h-6 w-6 text-muted-foreground hover:text-muted-foreground rounded disabled:opacity-20 pointer-events-auto"
          >
            <ArrowUp size={11} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={fIdx === layoutSections[sIdx].fields.length - 1}
            onClick={() => handleMoveField(sIdx, fIdx, 'down')}
            className="h-6 w-6 text-muted-foreground hover:text-muted-foreground rounded disabled:opacity-20 pointer-events-auto"
          >
            <ArrowDown size={11} />
          </Button>

          <select
            onChange={(e) => {
              handleMoveFieldToSection(sIdx, fIdx, parseInt(e.target.value));
            }}
            value={sIdx}
            className="text-[9px] h-6 border-border border rounded bg-card text-muted-foreground outline-none max-w-[60px]"
          >
            {layoutSections.map((sec, i) => (
              <option key={i} value={i}>Sec {i + 1}</option>
            ))}
          </select>

          <div className="relative group/pop">
            <Button
              variant="outline"
              size="icon-xs"
              className="h-6 w-6 border-border rounded text-muted-foreground hover:text-fin-orange"
            >
              <Settings size={11} />
            </Button>
            <div className="absolute right-0 bottom-full mb-1 bg-card border border-border rounded-lg shadow-lg p-2.5 z-10 w-[140px] hidden group-focus-within/pop:block group-hover/pop:block space-y-2">
              <p className="text-[9px] font-bold text-muted-foreground uppercase border-b pb-1">Properties</p>
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => handleToggleFieldProp(sIdx, fIdx, 'required')}>
                <input type="checkbox" checked={isRequired} readOnly className="h-3 w-3" />
                <span className="text-[10px] text-foreground/80 font-medium">Required</span>
              </div>
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => handleToggleFieldProp(sIdx, fIdx, 'readonly')}>
                <input type="checkbox" checked={isReadonly} readOnly className="h-3 w-3" />
                <span className="text-[10px] text-foreground/80 font-medium">Read-Only</span>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => handleRemoveFieldFromSection(sIdx, fIdx)}
            className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
          >
            <Trash2 size={11} />
          </Button>
        </div>
      )}
    </div>
  );
}

export function LayoutBuilder() {
  const { can } = usePermissions();
  const canManage = can('manage', 'FieldDefinition');
  const queryClient = useQueryClient();

  const [selectedObject, setSelectedObject] = useState<string>('Party');
  const [layout, setLayout] = useState<PageLayoutPayload | null>(null);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionColumns, setNewSectionColumns] = useState<number>(2);
  const [showAddSection, setShowAddSection] = useState(false);

  // Queries
  const { data: customObjects, isLoading: isLoadingCustomObjects } = useQuery({
    queryKey: ['settings', 'custom-objects'],
    queryFn: () => settingsApi.customObjects.list(),
  });

  const { data: customFields, isLoading: isLoadingCustomFields } = useQuery({
    queryKey: ['settings', 'custom-fields', selectedObject],
    queryFn: () => settingsApi.fieldDefinitions.list(selectedObject),
    enabled: !!selectedObject,
  });

  const { data: serverLayout, isLoading: isLoadingLayout, error: layoutError, refetch: refetchLayout } = useQuery({
    queryKey: ['settings', 'page-layouts', 'default', selectedObject],
    queryFn: () => settingsApi.pageLayouts.getDefault(selectedObject),
    enabled: !!selectedObject,
    retry: false, // Don't retry 404s endlessly
  });

  // Track if local layout changes exist
  const hasChanges = useMemo(() => {
    if (!layout || !serverLayout) return false;
    return JSON.stringify(layout.layout_json) !== JSON.stringify(serverLayout.layout_json) ||
           layout.name !== serverLayout.name;
  }, [layout, serverLayout]);

  // Sync state with server-fetched layout
  useEffect(() => {
    if (serverLayout) {
      // Ensure layout_json matches expected schema
      const cleanedLayout = {
        ...serverLayout,
        layout_json: serverLayout.layout_json || { sections: [] }
      };
      if (!cleanedLayout.layout_json.sections) {
        cleanedLayout.layout_json.sections = [{ name: 'General Information', columns: 2, fields: [] }];
      }
      setLayout(cleanedLayout);
    } else {
      setLayout(null);
    }
  }, [serverLayout]);

  // Combined field schema registry (Standard fields + Custom fields)
  const allFieldsRegistry = useMemo(() => {
    const std = STANDARD_FIELDS[selectedObject] || [];
    const cust = (customFields || []).map((f) => ({
      name: f.name,
      label: f.label,
      field_type: f.field_type,
      required: f.required
    }));
    
    // De-duplicate standard & custom
    const map = new Map<string, { name: string; label: string; field_type: string; required?: boolean }>();
    std.forEach(f => map.set(f.name, f));
    cust.forEach(f => map.set(f.name, f));
    
    return Array.from(map.values());
  }, [selectedObject, customFields]);

  // Map of placed field names in layout sections
  const placedFieldsMap = useMemo(() => {
    const map = new Map<string, { sectionIndex: number; fieldIndex: number }>();
    if (!layout?.layout_json?.sections) return map;
    
    layout.layout_json.sections.forEach((section, sIdx) => {
      section.fields.forEach((field, fIdx) => {
        map.set(field.name, { sectionIndex: sIdx, fieldIndex: fIdx });
      });
    });
    return map;
  }, [layout]);

  // Unplaced available fields in palette
  const availableFields = useMemo(() => {
    return allFieldsRegistry.filter(f => !placedFieldsMap.has(f.name));
  }, [allFieldsRegistry, placedFieldsMap]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent, sectionIdx: number) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !layout) return;

    const sections = [...layout.layout_json.sections];
    const section = sections[sectionIdx];
    if (!section) return;

    const fields = [...section.fields];
    
    const activeName = String(active.id).split('-')[1];
    const overName = String(over.id).split('-')[1];
    
    if (!activeName || !overName) return;
    
    const oldIndex = fields.findIndex((f) => f.name === activeName);
    const newIndex = fields.findIndex((f) => f.name === overName);

    if (oldIndex !== -1 && newIndex !== -1) {
      const [removed] = fields.splice(oldIndex, 1);
      if (removed) {
        fields.splice(newIndex, 0, removed);
      }
      
      sections[sectionIdx] = {
        ...section,
        fields
      };

      setLayout({
        ...layout,
        layout_json: { ...layout.layout_json, sections }
      });
      toast.success('Fields reordered');
    }
  };

  // Mutations
  const updateLayoutMutation = useMutation({
    mutationFn: (data: { id: string; payload: any }) => 
      settingsApi.pageLayouts.update(data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'page-layouts', 'default', selectedObject] });
      toast.success('Page layout updated successfully');
    },
    onError: () => toast.error('Failed to save layout changes'),
  });

  const initializeLayoutMutation = useMutation({
    mutationFn: (data: { object_type: string; name: string; layout_json: any }) => 
      settingsApi.pageLayouts.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'page-layouts', 'default', selectedObject] });
      toast.success('Page layout initialized successfully');
    },
    onError: () => toast.error('Failed to initialize page layout'),
  });

  // Handlers
  const handleSaveLayout = () => {
    if (!layout) return;
    updateLayoutMutation.mutate({
      id: layout.id,
      payload: {
        name: layout.name,
        layout_json: layout.layout_json
      }
    });
  };

  const handleResetLayout = () => {
    if (serverLayout) {
      setLayout(JSON.parse(JSON.stringify(serverLayout)));
      toast.info('Local changes discarded');
    }
  };

  const handleInitializeLayout = () => {
    // Generate default sections with standard fields auto-placed
    const initialFields = allFieldsRegistry.slice(0, 4).map(f => ({
      name: f.name,
      required: f.required || false,
      readonly: false
    }));

    const initialLayoutJson = {
      sections: [
        {
          name: 'General Information',
          columns: 2,
          fields: initialFields
        }
      ]
    };

    initializeLayoutMutation.mutate({
      object_type: selectedObject,
      name: 'Default Layout',
      layout_json: initialLayoutJson
    });
  };

  // Canvas Modifiers
  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!layout || !newSectionName.trim()) return;

    const newSections: LayoutSection[] = [
      ...layout.layout_json.sections,
      {
        name: newSectionName.trim(),
        columns: newSectionColumns,
        fields: []
      }
    ];

    setLayout({
      ...layout,
      layout_json: { ...layout.layout_json, sections: newSections }
    });

    setNewSectionName('');
    setShowAddSection(false);
    toast.success(`Section "${newSectionName.trim()}" added`);
  };

  const handleDeleteSection = (index: number) => {
    if (!layout) return;
    
    const section = layout.layout_json.sections[index];
    if (!section) return;
    if (section.fields.length > 0 && 
        !window.confirm(`Warning: Deleting this section will return all placed fields (${section.fields.length}) to the available fields list. Continue?`)) {
      return;
    }

    const newSections = layout.layout_json.sections.filter((_, i) => i !== index);
    setLayout({
      ...layout,
      layout_json: { ...layout.layout_json, sections: newSections }
    });
    toast.info('Section deleted');
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (!layout) return;
    const sections = [...layout.layout_json.sections];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    
    // Swap safely
    const temp = sections[index];
    const targetSection = sections[targetIdx];
    if (!temp || !targetSection) return;

    sections[index] = targetSection;
    sections[targetIdx] = temp;

    setLayout({
      ...layout,
      layout_json: { ...layout.layout_json, sections }
    });
  };

  const handleToggleSectionColumns = (index: number) => {
    if (!layout) return;
    const sections = [...layout.layout_json.sections];
    const section = sections[index];
    if (!section) return;

    sections[index] = {
      ...section,
      columns: section.columns === 1 ? 2 : 1
    };

    setLayout({
      ...layout,
      layout_json: { ...layout.layout_json, sections }
    });
  };

  const handleAddFieldToSection = (fieldName: string, sectionIdx: number) => {
    if (!layout) return;
    const sections = [...layout.layout_json.sections];
    const targetSection = sections[sectionIdx];
    if (!targetSection) return;
    
    // Verify field doesn't already exist
    if (targetSection.fields.some(f => f.name === fieldName)) return;

    // Resolve field details
    const fieldRegistry = allFieldsRegistry.find(r => r.name === fieldName);

    const newField: LayoutField = {
      name: fieldName,
      required: fieldRegistry?.required || false,
      readonly: false
    };

    sections[sectionIdx] = {
      ...targetSection,
      fields: [...targetSection.fields, newField]
    };

    setLayout({
      ...layout,
      layout_json: { ...layout.layout_json, sections }
    });
  };

  const handleRemoveFieldFromSection = (sectionIdx: number, fieldIdx: number) => {
    if (!layout) return;
    const sections = [...layout.layout_json.sections];
    const targetSection = sections[sectionIdx];
    if (!targetSection) return;
    
    const newFields = targetSection.fields.filter((_, idx) => idx !== fieldIdx);
    sections[sectionIdx] = {
      ...targetSection,
      fields: newFields
    };

    setLayout({
      ...layout,
      layout_json: { ...layout.layout_json, sections }
    });
  };

  const handleMoveField = (sectionIdx: number, fieldIdx: number, direction: 'up' | 'down') => {
    if (!layout) return;
    const sections = [...layout.layout_json.sections];
    const section = sections[sectionIdx];
    if (!section) return;

    const fields = [...section.fields];
    const targetIdx = direction === 'up' ? fieldIdx - 1 : fieldIdx + 1;

    if (targetIdx < 0 || targetIdx >= fields.length) return;

    // Swap safely
    const temp = fields[fieldIdx];
    const targetField = fields[targetIdx];
    if (!temp || !targetField) return;

    fields[fieldIdx] = targetField;
    fields[targetIdx] = temp;

    sections[sectionIdx] = {
      ...section,
      fields
    };

    setLayout({
      ...layout,
      layout_json: { ...layout.layout_json, sections }
    });
  };

  const handleMoveFieldToSection = (sourceSectionIdx: number, fieldIdx: number, targetSectionIdx: number) => {
    if (!layout || sourceSectionIdx === targetSectionIdx) return;
    const sections = [...layout.layout_json.sections];
    
    const sourceSection = sections[sourceSectionIdx];
    const targetSection = sections[targetSectionIdx];
    if (!sourceSection || !targetSection) return;

    const fieldToMove = sourceSection.fields[fieldIdx];
    if (!fieldToMove) return;
    
    // Remove from source
    sections[sourceSectionIdx] = {
      ...sourceSection,
      fields: sourceSection.fields.filter((_, idx) => idx !== fieldIdx)
    };

    // Add to target
    sections[targetSectionIdx] = {
      ...targetSection,
      fields: [...targetSection.fields, fieldToMove]
    };

    setLayout({
      ...layout,
      layout_json: { ...layout.layout_json, sections }
    });
    toast.success(`Moved field to section "${targetSection.name}"`);
  };

  const handleToggleFieldProp = (sectionIdx: number, fieldIdx: number, prop: 'required' | 'readonly') => {
    if (!layout) return;
    const sections = [...layout.layout_json.sections];
    const section = sections[sectionIdx];
    if (!section) return;

    const fields = [...section.fields];
    const field = fields[fieldIdx];
    if (!field) return;
    
    fields[fieldIdx] = {
      ...field,
      [prop]: !field[prop]
    };

    sections[sectionIdx] = {
      ...section,
      fields
    };

    setLayout({
      ...layout,
      layout_json: { ...layout.layout_json, sections }
    });
  };

  // Selector Options
  const objectOptions = useMemo(() => {
    const std = [
      { value: 'Party', label: 'Standard: Party (Contact/Lead)' },
      { value: 'Case', label: 'Standard: Case (Ticket/Deal)' },
      { value: 'Interaction', label: 'Standard: Interaction (Timeline)' }
    ];

    const cust = (customObjects || []).map((o) => ({
      value: o.api_name,
      label: `Custom: ${o.singular_label} (${o.api_name})`
    }));

    return [...std, ...cust];
  }, [customObjects]);

  const showLoading = isLoadingCustomObjects || isLoadingCustomFields || isLoadingLayout;

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Top Header Selector & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-6 w-6 text-foreground" />
            Visual Layout Designer
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Construct custom page block sections, arrange multi-column grids, and toggle required schema properties.
          </p>
        </div>

        {/* Change Actions bar */}
        {layout && canManage && (
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetLayout}
                className="h-9 border-border bg-card text-xs font-semibold text-foreground/80 rounded-lg flex items-center gap-1 hover:bg-muted transition-colors"
              >
                <Undo className="h-3.5 w-3.5" />
                Discard
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSaveLayout}
              disabled={!hasChanges || updateLayoutMutation.isPending}
              className={cn(
                "h-9 text-xs font-semibold text-white rounded-lg flex items-center gap-1 shadow-sm transition-all",
                hasChanges 
                  ? "bg-primary hover:bg-muted" 
                  : "bg-slate-200 text-muted-foreground cursor-not-allowed shadow-none"
              )}
            >
              {updateLayoutMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Layout
            </Button>
          </div>
        )}
      </div>

      {/* Target entity selector */}
      <Card className="bg-card border-border rounded-xl shadow-none p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted border border-border/50 rounded-lg text-muted-foreground">
            <Settings size={18} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Target Object Entity</label>
            <select
              value={selectedObject}
              onChange={(e) => setSelectedObject(e.target.value)}
              className="block w-full sm:w-[280px] h-8 px-2 rounded-lg border border-border bg-card text-xs text-foreground outline-none font-medium focus:border-slate-350"
            >
              {objectOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic Field Registry Link */}
        <div className="flex items-center gap-1.5 text-xs text-fin-orange hover:text-indigo-800 font-semibold cursor-pointer">
          <Sliders className="h-3.5 w-3.5" />
          <span>Fields schema manager</span>
          <ExternalLink className="h-3 w-3" />
        </div>
      </Card>

      {/* Loading Block */}
      {showLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <Loader2 className="h-7 w-7 animate-spin text-fin-orange" />
          <p className="text-xs text-muted-foreground font-medium">Fetching entity schema and layout matrices...</p>
        </div>
      ) : !layout ? (
        /* Initialization view for objects with no layouts */
        <Card className="p-10 text-center space-y-4 max-w-lg mx-auto bg-card border-border rounded-2xl shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-full bg-fin-orange/10 border border-fin-orange/20 flex items-center justify-center text-fin-orange">
            <Layers className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-foreground">No layout configured for "{selectedObject}"</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-normal">
              A structured form page is required to construct record views. Click initialize to provision a default empty page layout.
            </p>
          </div>
          {canManage && (
            <Button
              onClick={handleInitializeLayout}
              disabled={initializeLayoutMutation.isPending}
              className="bg-fin-orange hover:bg-fin-orange/90 text-white font-semibold rounded-lg text-xs h-9 px-4 flex items-center gap-1 mx-auto"
            >
              {initializeLayoutMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Initialize Default Layout
            </Button>
          )}
        </Card>
      ) : (
        /* Layout Builder Active Panel Workspace */
        <div className="grid gap-6 lg:grid-cols-4 items-start">
          
          {/* Left panel: Fields Palette */}
          <Card className="lg:col-span-1 bg-card border-border rounded-xl shadow-none self-start max-h-[700px] flex flex-col">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                Available Fields
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground leading-normal">
                Double-click or click + to add standard/custom fields into page layout blocks.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto max-h-[500px] divide-y divide-border/50">
              {availableFields.map((field) => (
                <div key={field.name} className="p-3 hover:bg-muted flex items-center justify-between group">
                  <div className="min-w-0 pr-2">
                    <div className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                      {field.label}
                      {field.required && <span className="text-red-500 font-bold">*</span>}
                    </div>
                    <div className="text-[9px] font-mono text-muted-foreground truncate mt-0.5">
                      {field.name}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Target Select section list popover / dropdown */}
                      <select
                        onChange={(e) => {
                          if (e.target.value !== '') {
                            handleAddFieldToSection(field.name, parseInt(e.target.value));
                            e.target.value = '';
                          }
                        }}
                        className="text-[9px] h-6 border-border border rounded bg-card text-muted-foreground font-medium px-1 outline-none opacity-0 group-hover:opacity-100 transition-opacity"
                        defaultValue=""
                      >
                        <option value="" disabled>+</option>
                        {layout.layout_json.sections.map((sec, sIdx) => (
                          <option key={sIdx} value={sIdx}>{sec.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}

              {availableFields.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  All defined fields have been placed in layout sections.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Panel: Sections Layout Designer Canvas */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Sections canvas list */}
            {layout.layout_json.sections.map((section, sIdx) => (
              <Card key={sIdx} className="bg-card border-border rounded-xl shadow-none overflow-hidden group/section">
                
                {/* Section Header toolbar */}
                <CardHeader className="pb-3 border-b border-border bg-muted/30 flex flex-row items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-background text-fin-orange border-fin-orange/20 text-[10px] font-bold rounded-md py-0 px-2 select-none">
                      Section {sIdx + 1}
                    </Badge>
                    <Input 
                      value={section.name}
                      disabled={!canManage}
                      onChange={(e) => {
                        const newSections = [...layout.layout_json.sections];
                        newSections[sIdx] = { ...section, name: e.target.value };
                        setLayout({
                          ...layout,
                          layout_json: { ...layout.layout_json, sections: newSections }
                        });
                      }}
                      className="h-7 text-xs font-semibold text-foreground border-none bg-transparent hover:bg-muted/70 focus-visible:bg-card rounded px-2 w-[240px] focus-visible:ring-1 focus-visible:ring-indigo-500 py-0"
                    />
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1.5">
                      {/* Column grid toggle */}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleToggleSectionColumns(sIdx)}
                        title={`Toggle Columns (Active: ${section.columns} Columns)`}
                        className="h-7 w-7 border-border text-muted-foreground rounded-md hover:bg-muted"
                      >
                        <Columns size={13} className={section.columns === 2 ? "text-fin-orange" : ""} />
                      </Button>

                      {/* Direction modifiers */}
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={sIdx === 0}
                        onClick={() => handleMoveSection(sIdx, 'up')}
                        className="h-7 w-7 border-border text-muted-foreground rounded-md hover:bg-muted disabled:opacity-30"
                      >
                        <ArrowUp size={13} />
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        disabled={sIdx === layout.layout_json.sections.length - 1}
                        onClick={() => handleMoveSection(sIdx, 'down')}
                        className="h-7 w-7 border-border text-muted-foreground rounded-md hover:bg-muted disabled:opacity-30"
                      >
                        <ArrowDown size={13} />
                      </Button>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteSection(sIdx)}
                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md opacity-0 group-hover/section:opacity-100 transition-opacity"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  )}
                </CardHeader>

                {/* Section Content Field placements grid */}
                <CardContent className={cn(
                  "p-4 gap-4",
                  section.columns === 2 ? "grid grid-cols-1 sm:grid-cols-2" : "flex flex-col"
                )}>
                  <DndContext 
                    sensors={sensors} 
                    collisionDetection={closestCenter} 
                    onDragEnd={(e) => handleDragEnd(e, sIdx)}
                  >
                    <SortableContext 
                      items={section.fields.map(f => `${sIdx}-${f.name}`)} 
                      strategy={verticalListSortingStrategy}
                    >
                      {section.fields.map((placedField, fIdx) => (
                        <SortablePlacedField
                          key={placedField.name}
                          placedField={placedField}
                          sIdx={sIdx}
                          fIdx={fIdx}
                          allFieldsRegistry={allFieldsRegistry}
                          canManage={canManage}
                          handleMoveField={handleMoveField}
                          handleMoveFieldToSection={handleMoveFieldToSection}
                          handleToggleFieldProp={handleToggleFieldProp}
                          handleRemoveFieldFromSection={handleRemoveFieldFromSection}
                          layoutSections={layout.layout_json.sections}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>

                  {section.fields.length === 0 && (
                    <div className="col-span-full py-8 text-center text-[11px] text-muted-foreground border border-dashed border-border rounded-lg bg-muted/30">
                      Empty Section. Select fields from the left palette to add them here.
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Add Section Trigger */}
            {canManage && (
              <div>
                {showAddSection ? (
                  <Card className="bg-card border-border rounded-xl shadow-none p-4">
                    <form onSubmit={handleAddSection} className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground">New Section Title</label>
                          <Input 
                            placeholder="e.g. Sales Metrics, Address Info"
                            value={newSectionName}
                            onChange={(e) => setNewSectionName(e.target.value)}
                            required
                            className="h-8 text-xs border-border"
                          />
                        </div>
                        <div className="space-y-1 sm:w-[150px]">
                          <label className="text-xs font-semibold text-muted-foreground">Column Layout</label>
                          <select
                            value={newSectionColumns}
                            onChange={(e) => setNewSectionColumns(parseInt(e.target.value))}
                            className="block w-full h-8 px-2 rounded-lg border border-border bg-card text-xs text-foreground outline-none"
                          >
                            <option value={1}>1 Column</option>
                            <option value={2}>2 Columns</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setShowAddSection(false)}
                          className="h-8 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="bg-primary hover:bg-muted text-white h-8 text-xs rounded-lg px-3 flex items-center gap-1"
                        >
                          <Plus size={13} />
                          Add Section
                        </Button>
                      </div>
                    </form>
                  </Card>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setShowAddSection(true)}
                    className="w-full h-11 border-dashed border-[#cbd5e1] text-muted-foreground hover:text-foreground hover:border-slate-350 hover:bg-muted bg-card/50 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-all"
                  >
                    <Plus size={15} />
                    Add Layout Section Block
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
