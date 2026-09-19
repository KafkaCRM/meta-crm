import React, { useState, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Columns3,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  SlidersHorizontal,
  Bookmark,
  Sparkles,
  Flame,
  Star,
  Users,
  Target,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';

export interface CustomViewDefinition {
  id: string;
  name: string;
  icon?: string;
  isCustom?: boolean;
  filters?: Record<string, any>;
  columnIds?: string[];
}

export interface ColumnDefinition {
  id: string;
  label: string;
  defaultVisible?: boolean;
  isCustomField?: boolean;
}

const VIEW_ICONS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: 'bookmark', label: 'Bookmark', icon: <Bookmark size={12} /> },
  { id: 'star', label: 'Star', icon: <Star size={12} className="text-amber-500" /> },
  { id: 'flame', label: 'Hot', icon: <Flame size={12} className="text-red-500" /> },
  { id: 'sparkles', label: 'Sparkles', icon: <Sparkles size={12} className="text-blue-500" /> },
  { id: 'target', label: 'Target', icon: <Target size={12} className="text-emerald-500" /> },
  { id: 'users', label: 'Users', icon: <Users size={12} /> },
];

interface ViewAndColumnManagerProps {
  entityType: 'Lead' | 'Party' | 'Campaign' | 'Invoice' | string;
  defaultViews: CustomViewDefinition[];
  activeViewId: string;
  onViewChange: (view: CustomViewDefinition) => void;
  availableColumns: ColumnDefinition[];
  visibleColumnIds: string[];
  onVisibleColumnsChange: (columnIds: string[]) => void;
  currentFilters?: Record<string, any>;
  countsByViewId?: Record<string, number>;
}

export function ViewAndColumnManager({
  entityType,
  defaultViews,
  activeViewId,
  onViewChange,
  availableColumns,
  visibleColumnIds,
  onVisibleColumnsChange,
  currentFilters = {},
  countsByViewId = {},
}: ViewAndColumnManagerProps) {
  const normalizedEntityType = entityType.toLowerCase();
  const storageKeyViews = `mc_saved_views_${normalizedEntityType}`;
  const [customViews, setCustomViews] = useState<CustomViewDefinition[]>(() => {
    try {
      const stored = localStorage.getItem(storageKeyViews);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Create View Modal
  const [createViewOpen, setCreateViewOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewIcon, setNewViewIcon] = useState('bookmark');

  // Fetch dynamic custom fields from settings
  const { data: fieldDefs = [] } = useQuery({
    queryKey: ['settings', 'fields', normalizedEntityType],
    queryFn: () => settingsApi.fieldDefinitions.list(normalizedEntityType),
    staleTime: 60_000,
  });

  // Combine standard columns with dynamic custom fields
  const allAvailableColumns: ColumnDefinition[] = React.useMemo(() => {
    const existingIds = new Set(availableColumns.map((c) => c.id));
    const customCols: ColumnDefinition[] = fieldDefs
      .filter((f) => !existingIds.has(f.name))
      .map((f) => ({
        id: `custom_${f.name}`,
        label: f.label,
        defaultVisible: false,
        isCustomField: true,
      }));
    return [...availableColumns, ...customCols];
  }, [availableColumns, fieldDefs]);

  // Persist custom views
  const saveCustomViews = (views: CustomViewDefinition[]) => {
    setCustomViews(views);
    try {
      localStorage.setItem(storageKeyViews, JSON.stringify(views));
    } catch {}
  };

  const handleCreateView = () => {
    if (!newViewName.trim()) return;
    const newView: CustomViewDefinition = {
      id: `view_${Date.now()}`,
      name: newViewName.trim(),
      icon: newViewIcon,
      isCustom: true,
      filters: { ...currentFilters },
      columnIds: [...visibleColumnIds],
    };
    const updated = [...customViews, newView];
    saveCustomViews(updated);
    setNewViewName('');
    setCreateViewOpen(false);
    onViewChange(newView);
  };

  const handleDeleteView = (e: React.MouseEvent, viewId: string) => {
    e.stopPropagation();
    const updated = customViews.filter((v) => v.id !== viewId);
    saveCustomViews(updated);
    if (activeViewId === viewId) {
      onViewChange(defaultViews[0]!);
    }
  };

  const toggleColumn = (columnId: string) => {
    if (visibleColumnIds.includes(columnId)) {
      if (visibleColumnIds.length <= 1) return; // Must keep at least 1 column visible
      onVisibleColumnsChange(visibleColumnIds.filter((id) => id !== columnId));
    } else {
      onVisibleColumnsChange([...visibleColumnIds, columnId]);
    }
  };

  const resetColumnsToDefault = () => {
    const defaults = allAvailableColumns.filter((c) => c.defaultVisible !== false).map((c) => c.id);
    onVisibleColumnsChange(defaults);
  };

  const allViews = [...defaultViews, ...customViews];

  return (
    <div className="space-y-2">
      {/* Top Bar: Tabs + Action Controls */}
      <div className="flex items-center justify-between gap-4 border-b border-border overflow-x-auto scrollbar-none">
        {/* Views Tabs */}
        <div className="flex items-center gap-1 sm:gap-4 overflow-x-auto scrollbar-none pt-1">
          {allViews.map((view) => {
            const isActive = activeViewId === view.id;
            const count = countsByViewId[view.id];
            const iconObj = VIEW_ICONS.find((i) => i.id === view.icon);

            return (
              <button
                key={view.id}
                type="button"
                onClick={() => onViewChange(view)}
                className={cn(
                  'group/tab pb-2.5 pt-1 px-1.5 font-medium border-b-2 transition-all relative text-xs md:text-sm whitespace-nowrap flex items-center gap-1.5 cursor-pointer',
                  isActive
                    ? 'border-primary text-foreground font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {iconObj ? iconObj.icon : null}
                <span>{view.name}</span>
                {typeof count === 'number' && (
                  <span
                    className={cn(
                      'ml-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold transition-colors',
                      isActive ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                )}
                {view.isCustom && (
                  <span
                    onClick={(e) => handleDeleteView(e, view.id)}
                    className="opacity-0 group-hover/tab:opacity-100 hover:text-red-500 transition-opacity ml-1 p-0.5 rounded"
                    title="Delete custom view"
                  >
                    <Trash2 size={10} />
                  </span>
                )}
              </button>
            );
          })}

          {/* Add Custom View Button */}
          <button
            type="button"
            onClick={() => setCreateViewOpen(true)}
            className="pb-2.5 pt-1 px-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
            title="Save current filters as a new custom view tab"
          >
            <Plus size={12} />
            <span>New View</span>
          </button>
        </div>

        {/* Right Controls: Columns Popover & View Options */}
        <div className="flex items-center gap-2 shrink-0 pb-2">
          {/* Columns Visibility Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer shadow-none"
              >
                <Columns3 size={13} />
                <span className="hidden sm:inline">Columns</span>
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-muted text-muted-foreground">
                  {visibleColumnIds.length}
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-56 p-2 rounded-xl border border-border bg-popover shadow-xl z-50 animate-in fade-in zoom-in-95"
            >
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/60">
                <span className="text-xs font-semibold text-foreground">Customize Columns</span>
                <button
                  type="button"
                  onClick={resetColumnsToDefault}
                  className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors cursor-pointer"
                  title="Reset to default columns"
                >
                  <RotateCcw size={10} />
                  Reset
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
                {allAvailableColumns.map((col) => {
                  const isVisible = visibleColumnIds.includes(col.id);
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => toggleColumn(col.id)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-muted/70 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={cn(
                            'w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors',
                            isVisible
                              ? 'bg-primary border-primary text-white'
                              : 'border-muted-foreground/40 bg-transparent'
                          )}
                        >
                          {isVisible && <Check size={10} strokeWidth={3} />}
                        </span>
                        <span className="truncate">{col.label}</span>
                      </div>
                      {col.isCustomField && (
                        <span className="text-[9px] font-mono px-1 rounded bg-primary/10 text-primary uppercase">
                          Custom
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Save Custom View Modal */}
      <Dialog open={createViewOpen} onOpenChange={setCreateViewOpen}>
        <DialogContent className="sm:max-w-md p-6 bg-card border border-border rounded-2xl shadow-xl">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Bookmark size={16} className="text-primary" />
              <span>Save as New View</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Create a personalized tab that saves your current filter combination and column preferences.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">View Name</label>
              <Input
                type="text"
                placeholder="e.g. VIP WhatsApp Prospects"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                className="h-9 text-sm rounded-xl border-border bg-background"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Tab Icon</label>
              <div className="flex gap-2">
                {VIEW_ICONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setNewViewIcon(item.id)}
                    className={cn(
                      'p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center',
                      newViewIcon === item.id
                        ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    )}
                    title={item.label}
                  >
                    {item.icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Saved Attributes:</p>
              <p>• Filters: {Object.keys(currentFilters).length > 0 ? Object.keys(currentFilters).join(', ') : 'All leads'}</p>
              <p>• Visible Columns: {visibleColumnIds.length} columns selected</p>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border -mx-6 -mb-6 p-4 bg-muted/30 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateViewOpen(false)}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateView}
              disabled={!newViewName.trim()}
              className="h-9 text-xs bg-primary hover:bg-[#1e293b] text-white font-semibold flex items-center gap-1.5"
            >
              <Plus size={14} />
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
