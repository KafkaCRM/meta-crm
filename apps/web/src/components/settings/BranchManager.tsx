import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, MapPin, Building2, ChevronRight, X } from 'lucide-react';
import { settingsApi, type Branch } from '@/api/settings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

export function BranchManager() {
  const { can } = usePermissions();
  const canManage = can('manage', 'Branch');
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', city: '' });
  
  const { data: branches, isLoading } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list(),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; address?: string; city?: string }) =>
      settingsApi.branches.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] });
      toast.success('Branch created successfully');
      setFormData({ name: '', address: '', city: '' });
    },
    onError: () => toast.error('Failed to create branch'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; address?: string; city?: string } }) =>
      settingsApi.branches.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] });
      toast.success('Branch updated successfully');
      setEditingId(null);
      setFormData({ name: '', address: '', city: '' });
    },
    onError: () => toast.error('Failed to update branch'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.branches.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] });
      toast.success('Branch deactivated');
    },
    onError: () => toast.error('Failed to deactivate branch'),
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim()) return;
      if (editingId) {
        updateMutation.mutate({ id: editingId, data: formData });
      } else {
        createMutation.mutate(formData);
      }
    },
    [formData, editingId, createMutation, updateMutation],
  );

  const handleEdit = useCallback((branch: Branch) => {
    setEditingId(branch.id);
    setFormData({
      name: branch.name,
      address: branch.address ?? '',
      city: branch.city ?? '',
    });
  }, []);

  const handleCancel = useCallback(() => {
    setEditingId(null);
    setFormData({ name: '', address: '', city: '' });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Branches</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure and manage your organisation's physical branches and locations
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Branch listing card */}
        <Card className={cn("bg-card border-border rounded-xl shadow-sm hover:shadow-md/5 transition-all duration-200", canManage ? "md:col-span-2" : "md:col-span-3")}>
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-medium text-foreground">
              Active Locations
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {branches?.length ?? 0} branches configured in this tenant
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {branches?.map((branch) => (
                <div
                  key={branch.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/40 transition-all duration-200 group first:rounded-t-none last:rounded-b-xl"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 p-2 bg-muted rounded-lg text-muted-foreground group-hover:bg-background group-hover:text-primary border border-transparent group-hover:border-border/80 transition-all duration-200">
                      <Building2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{branch.name}</p>
                      {(branch.address || branch.city) && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin size={12} className="text-muted-foreground/70" />
                          <span>
                            {branch.address}
                            {branch.address && branch.city && ', '}
                            {branch.city}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
                        onClick={() => handleEdit(branch)}
                      >
                        <Pencil size={14} className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive-foreground hover:bg-destructive/10 dark:hover:bg-destructive/20 transition-colors duration-150"
                        onClick={() => {
                          if (window.confirm(`Deactivate ${branch.name}?`)) {
                            removeMutation.mutate(branch.id);
                          }
                        }}
                      >
                        <Trash2 size={14} className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {branches?.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No active branches found. {canManage && 'Add one on the right.'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Form panel card */}
        {canManage && (
        <Card className="bg-card border-border rounded-xl shadow-sm hover:shadow-md/5 transition-all duration-200 h-fit">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-foreground">
                {editingId ? 'Edit Location' : 'New Location'}
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
              {editingId ? 'Modify location details' : 'Deploy a new physical office'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Branch Name</label>
                <Input
                  type="text"
                  placeholder="e.g. West Coast HQ"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="h-9 border-border bg-background/50 hover:bg-background/80 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary placeholder:text-muted-foreground/50 transition-all duration-200"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Street Address</label>
                <Input
                  type="text"
                  placeholder="e.g. 100 Pine St, Suite 400"
                  value={formData.address}
                  onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
                  className="h-9 border-border bg-background/50 hover:bg-background/80 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary placeholder:text-muted-foreground/50 transition-all duration-200"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">City</label>
                <Input
                  type="text"
                  placeholder="e.g. San Francisco"
                  value={formData.city}
                  onChange={(e) => setFormData((f) => ({ ...f, city: e.target.value }))}
                  className="h-9 border-border bg-background/50 hover:bg-background/80 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary placeholder:text-muted-foreground/50 transition-all duration-200"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 h-9 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 font-medium shadow-sm hover:shadow"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  )}
                  {editingId ? 'Save Changes' : 'Create Location'}
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
