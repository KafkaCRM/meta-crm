import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Loader2, Building2, X } from 'lucide-react';
import { settingsApi, type Brand } from '@/api/settings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

export function BrandManager() {
  const { can } = usePermissions();
  const canManage = can('manage', 'Brand');
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
      toast.success('Brand created successfully');
      setFormData({ name: '', logo_url: '' });
    },
    onError: () => toast.error('Failed to create brand'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; logo_url?: string } }) =>
      settingsApi.brands.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'brands'] });
      toast.success('Brand updated successfully');
      setEditingId(null);
      setFormData({ name: '', logo_url: '' });
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

  const handleCancel = useCallback(() => {
    setEditingId(null);
    setFormData({ name: '', logo_url: '' });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Predefined cool gradient backgrounds for text logo placeholders
  const gradients = [
    'from-indigo-500 to-purple-500',
    'from-emerald-500 to-teal-500',
    'from-blue-500 to-indigo-500',
    'from-rose-500 to-orange-500',
  ];

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Brands</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your enterprise identities, custom logos, and brand naming
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Brands listing grid */}
        <Card className={cn("bg-card border-border rounded-xl shadow-sm hover:shadow-md/5 transition-all duration-200", canManage ? "md:col-span-2" : "md:col-span-3")}>
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-medium text-foreground">
              Configured Brands
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Active brand configurations available to link with branches
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {brands?.map((brand, index) => {
                const gradient = gradients[index % gradients.length];
                return (
                  <div
                    key={brand.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 hover:border-muted-foreground/30 hover:shadow-sm transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {brand.logo_url ? (
                        <img
                          src={brand.logo_url}
                          alt={brand.name}
                          className="h-10 w-10 rounded-lg object-cover border border-border bg-card flex-shrink-0"
                          onError={(e) => {
                            // Fallback if image fails to load
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-semibold text-sm shadow-sm flex-shrink-0`}>
                          {brand.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{brand.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground truncate">{brand.id}</p>
                      </div>
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                        onClick={() => handleEdit(brand)}
                      >
                        <Pencil size={13} className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
              {brands?.length === 0 && (
                <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                  No configured brands. {canManage && 'Add a new brand to get started.'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Brand form card */}
        {canManage && (
        <Card className="bg-card border-border rounded-xl shadow-sm hover:shadow-md/5 transition-all duration-200 h-fit">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-foreground">
                {editingId ? 'Edit Brand' : 'New Brand'}
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
              {editingId ? 'Modify brand naming and assets' : 'Configure a new brand identity'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Brand Name</label>
                <Input
                  type="text"
                  placeholder="e.g. Apex Global"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="h-9 border-border bg-background/50 hover:bg-background/80 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary placeholder:text-muted-foreground/50 transition-all duration-200"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Logo URL</label>
                <Input
                  type="url"
                  placeholder="e.g. https://domain.com/logo.png"
                  value={formData.logo_url}
                  onChange={(e) => setFormData((f) => ({ ...f, logo_url: e.target.value }))}
                  className="h-9 border-border bg-background/50 hover:bg-background/80 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary placeholder:text-muted-foreground/50 transition-all duration-200"
                />
              </div>
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="w-full h-9 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 font-medium shadow-sm hover:shadow"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  )}
                  {editingId ? 'Save Changes' : 'Create Brand'}
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
