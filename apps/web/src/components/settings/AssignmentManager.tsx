import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { settingsApi } from '@/api/settings';

export function AssignmentManager() {
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
      toast.success('Assignment created');
      setBranchId('');
      setBrandId('');
    },
    onError: () => toast.error('Failed to create assignment'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.assignments.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'assignments'] });
      toast.success('Assignment removed');
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
    return <div className="text-muted-foreground">Loading assignments...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Assignments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Link branches to brands
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium">Add Assignment</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="rounded-md border border-input px-3 py-2 text-sm"
            required
          >
            <option value="">Select branch...</option>
            {branches?.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="rounded-md border border-input px-3 py-2 text-sm"
            required
          >
            <option value="">Select brand...</option>
            {brands?.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </form>

      <div className="rounded-lg border divide-y">
        {assignments?.map((assignment) => (
          <div key={assignment.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{getBranchName(assignment.branch_id)}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-sm font-medium">{getBrandName(assignment.brand_id)}</span>
              {assignment.is_primary && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Primary</span>
              )}
            </div>
            <button
              onClick={() => {
                if (window.confirm('Remove this assignment?')) {
                  removeMutation.mutate(assignment.id);
                }
              }}
              className="p-1 rounded hover:bg-muted"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          </div>
        ))}
        {assignments?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No assignments yet. Link a branch to a brand above.
          </div>
        )}
      </div>
    </div>
  );
}
