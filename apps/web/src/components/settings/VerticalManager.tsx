import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Loader2, Layers, X, Trash2 } from 'lucide-react';
import { settingsApi, type Vertical } from '@/api/settings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

export function VerticalManager() {
  const { can } = usePermissions();
  const canManage = can('manage', 'Vertical');
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ branch_id: '', name: '' });

  const { data: verticals, isLoading } = useQuery({
    queryKey: ['settings', 'verticals'],
    queryFn: () => settingsApi.verticals.list(),
    staleTime: 30_000,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list(),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: { branch_id: string; name: string }) =>
      settingsApi.verticals.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'verticals'] });
      toast.success('Vertical created successfully');
      setFormData({ branch_id: '', name: '' });
    },
    onError: () => toast.error('Failed to create vertical'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string } }) =>
      settingsApi.verticals.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'verticals'] });
      toast.success('Vertical updated successfully');
      setEditingId(null);
      setFormData({ branch_id: '', name: '' });
    },
    onError: () => toast.error('Failed to update vertical'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => settingsApi.verticals.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'verticals'] });
      toast.success('Vertical deleted');
    },
    onError: () => toast.error('Failed to delete vertical'),
  });

  const getBranchName = (id: string) => branches.find((b) => b.id === id)?.name ?? id;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim() || !formData.branch_id) return;
      if (editingId) {
        updateMutation.mutate({ id: editingId, data: { name: formData.name } });
      } else {
        createMutation.mutate({ branch_id: formData.branch_id, name: formData.name });
      }
    },
    [formData, editingId, createMutation, updateMutation],
  );

  const handleEdit = useCallback((vertical: Vertical) => {
    setEditingId(vertical.id);
    setFormData({ branch_id: vertical.branch_id, name: vertical.name });
  }, []);

  const handleCancel = useCallback(() => {
    setEditingId(null);
    setFormData({ branch_id: '', name: '' });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const gradients = [
    'from-indigo-500 to-purple-500',
    'from-emerald-500 to-teal-500',
    'from-blue-500 to-indigo-500',
    'from-rose-500 to-orange-500',
  ];

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Verticals</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage vertical categories linked to branches
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className={cn("bg-card border-border rounded-xl shadow-sm hover:shadow-md/5 transition-all duration-200", canManage ? "md:col-span-2" : "md:col-span-3")}>
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-medium text-foreground">
              Configured Verticals
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Active vertical configurations linked to branches
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {verticals?.map((vertical, index) => {
                const gradient = gradients[index % gradients.length];
                return (
                  <div
                    key={vertical.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 hover:border-muted-foreground/30 hover:shadow-sm transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-semibold text-sm shadow-sm flex-shrink-0`}>
                        {vertical.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{vertical.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{getBranchName(vertical.branch_id)}</p>
                        {vertical.created_at && (
                          <p className="text-[9px] text-muted-foreground/60 mt-0.5">{dayjs(vertical.created_at).format('DD MMM YYYY')}</p>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={() => handleEdit(vertical)}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (window.confirm(`Delete vertical "${vertical.name}"?`)) {
                              deleteMutation.mutate(vertical.id);
                            }
                          }}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {verticals?.length === 0 && (
                <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                  No configured verticals. {canManage && 'Add a new vertical to get started.'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {canManage && (
        <Card className="bg-card border-border rounded-xl shadow-sm hover:shadow-md/5 transition-all duration-200 h-fit">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-foreground">
                {editingId ? 'Edit Vertical' : 'New Vertical'}
              </CardTitle>
              {editingId && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={handleCancel}
                >
                  <X size={14} />
                </Button>
              )}
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              {editingId ? 'Modify vertical naming' : 'Configure a new vertical category'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Branch</label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => setFormData((f) => ({ ...f, branch_id: e.target.value }))}
                  disabled={!!editingId}
                  className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">Select Branch...</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Vertical Name</label>
                <Input
                  type="text"
                  placeholder="e.g. Residential Sales"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="h-9 border-border bg-background/50"
                />
              </div>
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="w-full h-9 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 font-medium shadow-sm"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  )}
                  {editingId ? 'Save Changes' : 'Create Vertical'}
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
