import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { settingsApi, type Branch } from '@/api/settings';

export function BranchManager() {
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
      toast.success('Branch created');
      setFormData({ name: '', address: '', city: '' });
    },
    onError: () => toast.error('Failed to create branch'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; address?: string; city?: string } }) =>
      settingsApi.branches.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] });
      toast.success('Branch updated');
      setEditingId(null);
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
    return <div className="text-muted-foreground">Loading branches...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Branches</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your organisation's branches
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium">{editingId ? 'Edit Branch' : 'Add Branch'}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            placeholder="Branch name"
            value={formData.name}
            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
            className="rounded-md border border-input px-3 py-2 text-sm"
            required
          />
          <input
            type="text"
            placeholder="Address"
            value={formData.address}
            onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
            className="rounded-md border border-input px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="City"
            value={formData.city}
            onChange={(e) => setFormData((f) => ({ ...f, city: e.target.value }))}
            className="rounded-md border border-input px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {(createMutation.isPending || updateMutation.isPending) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {editingId ? 'Update' : 'Add'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="rounded-lg border divide-y">
        {branches?.map((branch) => (
          <div key={branch.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{branch.name}</p>
              {branch.city && (
                <p className="text-xs text-muted-foreground">{branch.city}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEdit(branch)}
                className="p-1 rounded hover:bg-muted"
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Deactivate ${branch.name}?`)) {
                    removeMutation.mutate(branch.id);
                  }
                }}
                className="p-1 rounded hover:bg-muted"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            </div>
          </div>
        ))}
        {branches?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No branches yet. Add your first branch above.
          </div>
        )}
      </div>
    </div>
  );
}
