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
        <Loader2 className="h-6 w-6 animate-spin text-[#94a3b8]" />
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
        <h1 className="text-2xl font-semibold tracking-tight text-[#0f172a]">Brands</h1>
        <p className="text-sm text-[#64748b] mt-0.5">
          Manage your enterprise identities, custom logos, and brand naming
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Brands listing grid */}
        <Card className={cn("bg-white border-[#e2e8f0] rounded-xl shadow-none", canManage ? "md:col-span-2" : "md:col-span-3")}>
          <CardHeader className="pb-3 border-b border-[#e2e8f0]">
            <CardTitle className="text-base font-medium text-[#0f172a]">
              Configured Brands
            </CardTitle>
            <CardDescription className="text-xs text-[#94a3b8]">
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
                    className="flex items-center justify-between p-3.5 rounded-xl border border-[#e2e8f0] hover:border-slate-400 bg-white hover:bg-[#f8fafc]/40 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {brand.logo_url ? (
                        <img
                          src={brand.logo_url}
                          alt={brand.name}
                          className="h-10 w-10 rounded-lg object-cover border border-[#e2e8f0] bg-white flex-shrink-0"
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
                        <p className="text-sm font-medium text-[#0f172a] truncate">{brand.name}</p>
                        <p className="text-[10px] font-mono text-[#94a3b8] truncate">{brand.id}</p>
                      </div>
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100 text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0] transition-all"
                        onClick={() => handleEdit(brand)}
                      >
                        <Pencil size={13} />
                      </Button>
                    )}
                  </div>
                );
              })}
              {brands?.length === 0 && (
                <div className="col-span-full py-8 text-center text-sm text-[#64748b]">
                  No configured brands. {canManage && 'Add a new brand to get started.'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Brand form card */}
        {canManage && (
        <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none h-fit">
          <CardHeader className="pb-3 border-b border-[#e2e8f0]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-[#0f172a]">
                {editingId ? 'Edit Brand' : 'New Brand'}
              </CardTitle>
              {editingId && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-[#94a3b8] hover:text-[#0f172a]"
                  onClick={handleCancel}
                >
                  <X size={14} />
                </Button>
              )}
            </div>
            <CardDescription className="text-xs text-[#94a3b8]">
              {editingId ? 'Modify brand naming and assets' : 'Configure a new brand identity'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#64748b]">Brand Name</label>
                <Input
                  type="text"
                  placeholder="e.g. Apex Global"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="h-9 border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#64748b]">Logo URL</label>
                <Input
                  type="url"
                  placeholder="e.g. https://domain.com/logo.png"
                  value={formData.logo_url}
                  onChange={(e) => setFormData((f) => ({ ...f, logo_url: e.target.value }))}
                  className="h-9 border-[#e2e8f0] bg-white text-[#0f172a] placeholder-[#94a3b8]"
                />
              </div>
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-[#0f172a] hover:bg-[#1e293b] text-white w-full h-9 rounded-lg"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
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
