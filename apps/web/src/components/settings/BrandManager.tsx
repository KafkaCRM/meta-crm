import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { settingsApi, type Brand } from '@/api/settings';

export function BrandManager() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', logo_url: '' });

  const { data: brands, isLoading } = useQuery({
    queryKey: ['settings', 'brands'],
    queryFn: () => settingsApi.brands.list(),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; logo_url?: string }) =>
      settingsApi.brands.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'brands'] });
      toast.success('Brand created');
      setFormData({ name: '', logo_url: '' });
    },
    onError: () => toast.error('Failed to create brand'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; logo_url?: string } }) =>
      settingsApi.brands.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'brands'] });
      toast.success('Brand updated');
      setEditingId(null);
    },
    onError: () => toast.error('Failed to update brand'),
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

  const handleEdit = useCallback((brand: Brand) => {
    setEditingId(brand.id);
    setFormData({ name: brand.name, logo_url: brand.logo_url ?? '' });
  }, []);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading brands...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Brands</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your organisation's brands
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium">{editingId ? 'Edit Brand' : 'Add Brand'}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Brand name"
            value={formData.name}
            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
            className="rounded-md border border-input px-3 py-2 text-sm"
            required
          />
          <input
            type="text"
            placeholder="Logo URL (optional)"
            value={formData.logo_url}
            onChange={(e) => setFormData((f) => ({ ...f, logo_url: e.target.value }))}
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
              onClick={() => {
                setEditingId(null);
                setFormData({ name: '', logo_url: '' });
              }}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="rounded-lg border divide-y">
        {brands?.map((brand) => (
          <div key={brand.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              {brand.logo_url ? (
                <img src={brand.logo_url} alt={brand.name} className="h-8 w-8 rounded object-cover" />
              ) : (
                <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-sm font-medium">
                  {brand.name.charAt(0)}
                </div>
              )}
              <p className="text-sm font-medium">{brand.name}</p>
            </div>
            <button
              onClick={() => handleEdit(brand)}
              className="p-1 rounded hover:bg-muted"
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ))}
        {brands?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No brands yet. Add your first brand above.
          </div>
        )}
      </div>
    </div>
  );
}
