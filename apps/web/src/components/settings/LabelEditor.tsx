import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Type, Edit2, Check, X, Info } from 'lucide-react';
import { settingsApi } from '@/api/settings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';

const CORE_LABEL_KEYS = [
  { key: 'party.singular', default: 'Contact', desc: 'Singular label for individual customer profiles' },
  { key: 'party.plural', default: 'Contacts', desc: 'Plural label for customer index lists' },
  { key: 'case.singular', default: 'Case', desc: 'Singular label for deals or applications' },
  { key: 'case.plural', default: 'Cases', desc: 'Plural label for case tracking pipelines' },
  { key: 'workflow.stage.enquiry', default: 'Enquiry', desc: 'Visual label for the initial pipeline stage' },
  { key: 'workflow.stage.enrolled', default: 'Enrolled', desc: 'Visual label for the final conversion pipeline stage' },
];

export function LabelEditor() {
  const { can } = usePermissions();
  const canManage = can('manage', 'LabelOverride');
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
      toast.success('Label updated successfully');
      setEditingKey(null);
    },
    onError: () => toast.error('Failed to update label'),
  });

  const handleSave = useCallback(() => {
    if (!editingKey || !editValue.trim()) return;
    updateMutation.mutate({ key: editingKey, value: editValue.trim() });
  }, [editingKey, editValue, updateMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSave();
      if (e.key === 'Escape') setEditingKey(null);
    },
    [handleSave],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[900px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Labels</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Customize naming conventions and display terms across your tenant dashboard
        </p>
      </div>

      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-medium text-foreground flex items-center gap-1.5">
            <Type size={16} className="text-muted-foreground" />
            Tenant Dictionary
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Override default vocabulary descriptors for custom industry terminology
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[#e2e8f0]">
            {CORE_LABEL_KEYS.map(({ key, default: defaultVal, desc }) => {
              const currentValue = labels?.[key] ?? defaultVal;
              const isOverridden = labels?.[key] !== undefined;
              const isEditing = editingKey === key;

              return (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 hover:bg-background/30 transition-colors group gap-6"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-fin-orange bg-fin-orange/10/50 border border-fin-orange/20 rounded px-1.5 py-0.5">
                        {key}
                      </span>
                      {isOverridden && (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] rounded-md font-semibold py-0 px-1.5">
                          Customized
                        </Badge>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2 pt-1.5 max-w-sm">
                        <Input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="h-8 text-xs border-border bg-card text-foreground"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-foreground pt-0.5">
                        {currentValue}
                      </p>
                    )}

                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isEditing ? (
                      <>
                        <Button
                          onClick={handleSave}
                          disabled={updateMutation.isPending}
                          size="sm"
                          className="bg-primary hover:bg-[#1e293b] text-white text-xs h-7 px-2.5 rounded-md flex items-center gap-1"
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check size={13} />
                          )}
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingKey(null)}
                          className="text-muted-foreground hover:bg-[#f1f5f9] text-xs h-7 px-2.5 rounded-md"
                        >
                          Cancel
                        </Button>
                      </>
                    ) : canManage ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingKey(key);
                          setEditValue(currentValue);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-[#e2e8f0] text-xs h-7 px-2.5 rounded-md transition-all"
                      >
                        <Edit2 size={12} className="mr-1" />
                        Edit Label
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-2.5 bg-background border-t border-border flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Info size={12} className="text-muted-foreground" />
            <span>Updates apply globally across contact forms, pipeline column titles, and page headers.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
