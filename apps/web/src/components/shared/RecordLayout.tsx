import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import { Lock, FileText, ChevronDown, ChevronUp, AlertCircle, Copy } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';


interface RecordLayoutProps {
  objectType: string;
  record: any; // e.g. PartyResponse or CaseResponse
  t: (key: string) => string;
}

function LookupValue({ relatedTo, value }: { relatedTo: string; value: string }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['lookup-search', relatedTo, value],
    queryFn: async () => {
      const { apiCall } = await import('@/lib/api');
      return apiCall<any[]>(`/metadata/lookup/search?relatedTo=${relatedTo}&q=${value}`);
    },
    staleTime: 5 * 60_000,
    enabled: !!value && !!relatedTo,
  });

  if (isLoading) {
    return (
      <span className="text-slate-400 text-xs flex items-center gap-1.5 font-medium animate-pulse">
        <span className="animate-spin h-3.5 w-3.5 border-2 border-slate-200 border-t-slate-600 rounded-full inline-block" />
        Resolving reference...
      </span>
    );
  }

  const match = items.find((item: any) => item.id === value);
  if (match) {
    return (
      <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
        {match.label}
      </span>
    );
  }

  return <span className="font-semibold text-slate-800">{value}</span>;
}

export function RecordLayout({ objectType, record, t }: RecordLayoutProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Fetch field definitions for this object
  const { data: fields = [], isLoading: isLoadingFields } = useQuery({
    queryKey: ['settings', 'fields', objectType],
    queryFn: () => settingsApi.fieldDefinitions.list(objectType),
    staleTime: 60_000,
  });

  // Fetch default page layout for this object
  const { data: layout, isLoading: isLoadingLayout } = useQuery({
    queryKey: ['settings', 'layouts', objectType, 'default'],
    queryFn: () => settingsApi.pageLayouts.getDefault(objectType),
    staleTime: 60_000,
    retry: false,
  });

  const toggleSection = (sectionName: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionName)) {
        next.delete(sectionName);
      } else {
        next.add(sectionName);
      }
      return next;
    });
  };

  if (isLoadingFields || isLoadingLayout) {
    return (
      <div className="py-6 space-y-3">
        <div className="h-4 bg-slate-100 rounded w-1/3 animate-pulse" />
        <div className="h-24 bg-slate-50 border border-slate-200/60 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Parse sections
  const sections = layout?.layout_json?.sections || [
    {
      name: 'General Information',
      columns: 2,
      fields: fields.map(f => ({ name: f.name, required: f.required, readonly: false }))
    }
  ];

  const getFieldValue = (fieldName: string) => {
    // Standard fields are direct properties on the record
    if (record[fieldName] !== undefined) {
      return record[fieldName];
    }
    // Specific check for phone_raw fallback to phone
    if (fieldName === 'phone' && record.phone_raw !== undefined) {
      return record.phone_raw;
    }
    // Custom fields are placed inside the 'attributes' JSON object
    if (record.attributes && record.attributes[fieldName] !== undefined) {
      return record.attributes[fieldName];
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {sections.map((section: any) => {
        const isCollapsed = collapsedSections.has(section.name);
        if (!section.fields || section.fields.length === 0) return null;

        return (
          <div 
            key={section.name} 
            className="bg-white border border-[#e2e8f0] rounded-xl shadow-none overflow-hidden"
          >
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.name)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/50 hover:bg-slate-50 transition-colors text-left"
            >
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {section.name}
              </h3>
              {isCollapsed ? (
                <ChevronDown size={14} className="text-slate-400" />
              ) : (
                <ChevronUp size={14} className="text-slate-400" />
              )}
            </button>

            {/* Section Content */}
            {!isCollapsed && (
              <>
                <Separator className="bg-[#e2e8f0]" />
                <div className="p-4">
                  <div className={`grid gap-4 ${section.columns === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {section.fields.map((layoutField: any) => {
                      const fieldDef = fields.find(f => f.name === layoutField.name);
                      const rawVal = getFieldValue(layoutField.name);
                      const displayLabel = t(`field.${layoutField.name}`) ?? fieldDef?.label ?? layoutField.name;
                      
                      // Format values depending on type
                      let displayVal: React.ReactNode = '—';
                      if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
                        if (typeof rawVal === 'boolean') {
                          displayVal = rawVal ? 'Yes' : 'No';
                        } else if (fieldDef?.field_type === 'date') {
                          try {
                            displayVal = new Date(rawVal as string).toLocaleDateString('en-US', {
                              year: 'numeric', month: 'long', day: 'numeric'
                            });
                          } catch {
                            displayVal = String(rawVal);
                          }
                        } else if (fieldDef?.field_type === 'lookup' && fieldDef?.related_to) {
                          displayVal = <LookupValue relatedTo={fieldDef.related_to} value={String(rawVal)} />;
                        } else if (Array.isArray(rawVal)) {
                          displayVal = rawVal.join(', ');
                        } else {
                          displayVal = String(rawVal);
                        }
                      }

                      return (
                        <div key={layoutField.name} className="space-y-1 select-text">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            {displayLabel}
                          </label>
                          <div className="flex items-center gap-1.5 min-h-[28px] text-sm text-slate-800 font-semibold group/val">
                            {layoutField.readonly && <Lock size={12} className="text-slate-400 flex-shrink-0" />}
                            <span className="break-all">{displayVal}</span>
                            {rawVal !== null && rawVal !== undefined && rawVal !== '' && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(String(rawVal));
                                  toast.success('Copied to clipboard');
                                }}
                                className="opacity-0 group-hover/val:opacity-100 transition-opacity text-slate-400 hover:text-slate-700 cursor-pointer ml-1"
                                title="Copy to clipboard"
                              >
                                <Copy size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
