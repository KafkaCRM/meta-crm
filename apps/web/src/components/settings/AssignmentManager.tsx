import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, GitBranch, Building2, ChevronRight, Link2 } from 'lucide-react';
import { settingsApi } from '@/api/settings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

export function AssignmentManager() {
  const { can } = usePermissions();
  const canManage = can('manage', 'Branch');
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState('');
  const [brandId, setBrandId] = useState('');

  const { data: branches } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list(),
    staleTime: 30_000,
  });

  const { data: brands } = useQuery({
    queryKey: ['settings', 'brands'],
    queryFn: () => settingsApi.brands.list(),
    staleTime: 30_000,
  });

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['settings', 'assignments'],
    queryFn: () => settingsApi.assignments.list(),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: { branch_id: string; brand_id: string; is_primary?: boolean }) =>
      settingsApi.assignments.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'assignments'] });
      toast.success('Assignment created successfully');
      setBranchId('');
      setBrandId('');
    },
    onError: () => toast.error('Failed to create assignment'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.assignments.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'assignments'] });
      toast.success('Assignment removed successfully');
    },
    onError: () => toast.error('Failed to remove assignment'),
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!branchId || !brandId) return;
      createMutation.mutate({ branch_id: branchId, brand_id: brandId });
    },
    [branchId, brandId, createMutation],
  );

  const getBranchName = (id: string) => branches?.find((b) => b.id === id)?.name ?? id;
  const getBrandName = (id: string) => brands?.find((b) => b.id === id)?.name ?? id;

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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Assignments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Map your locations (branches) to specific brand identities
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Assignments list card */}
        <Card className={cn("bg-card border-border rounded-xl shadow-none", canManage ? "md:col-span-2" : "md:col-span-3")}>
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-medium text-foreground">
              Active Mappings
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Linked relations directing customer touchpoints
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[#e2e8f0]">
              {assignments?.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 hover:bg-background/60 transition-colors group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <div className="p-2 bg-[#f1f5f9] rounded-lg text-muted-foreground border border-border flex items-center justify-center">
                        <GitBranch size={14} />
                      </div>
                      <span className="truncate">{getBranchName(assignment.branch_id)}</span>
                    </div>

                    <div className="flex items-center text-muted-foreground">
                      <ChevronRight size={16} strokeWidth={2.5} />
                    </div>

                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <div className="p-2 bg-[#f1f5f9] rounded-lg text-muted-foreground border border-border flex items-center justify-center">
                        <Building2 size={14} />
                      </div>
                      <span className="truncate">{getBrandName(assignment.brand_id)}</span>
                    </div>

                    {assignment.is_primary && (
                      <Badge variant="outline" className="bg-fin-orange/10/50 text-fin-orange border-fin-orange/20 text-[10px] font-semibold rounded-md py-0 px-2 h-5 flex items-center justify-center">
                        Primary
                      </Badge>
                    )}
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 transition-all"
                      onClick={() => {
                        if (window.confirm('Remove this assignment?')) {
                          removeMutation.mutate(assignment.id);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              ))}
              {assignments?.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No active mappings found. {canManage && 'Create one using the side panel.'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add Assignment form card */}
        {canManage && (
        <Card className="bg-card border-border rounded-xl shadow-none h-fit">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-medium text-foreground flex items-center gap-1.5">
              <Link2 size={16} className="text-muted-foreground" />
              Link Entity
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Connect a physical location to an identity brand
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Select Branch</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400/50"
                  required
                >
                  <option value="">Select branch...</option>
                  {branches?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Select Brand</label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400/50"
                  required
                >
                  <option value="">Select brand...</option>
                  {brands?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-primary hover:bg-[#1e293b] text-white w-full h-9 rounded-lg flex items-center justify-center gap-1.5"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus size={15} />
                  )}
                  Establish Link
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
