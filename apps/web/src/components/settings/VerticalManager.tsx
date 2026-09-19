import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Layers,
  Building2,
  Search,
  CheckCircle2,
  Briefcase,
  SlidersHorizontal,
  Workflow,
} from 'lucide-react';
import { settingsApi, type Vertical, type Branch } from '@/api/settings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePermissions } from '@/hooks/usePermissions';
import dayjs from 'dayjs';

export function VerticalManager() {
  const { can } = usePermissions();
  const canManage = can('manage', 'Vertical');
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVertical, setEditingVertical] = useState<Vertical | null>(null);
  const [formData, setFormData] = useState({ branch_id: '', name: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('__ALL__');

  const { data: verticals = [], isLoading: loadingVerticals } = useQuery({
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
      toast.success('Business practice / vertical registered');
      setIsDialogOpen(false);
      setFormData({ branch_id: '', name: '' });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create vertical'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string } }) =>
      settingsApi.verticals.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'verticals'] });
      toast.success('Vertical updated successfully');
      setIsDialogOpen(false);
      setEditingVertical(null);
      setFormData({ branch_id: '', name: '' });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update vertical'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => settingsApi.verticals.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'verticals'] });
      toast.success('Vertical deleted successfully');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete vertical'),
  });

  const openCreateDialog = () => {
    setEditingVertical(null);
    setFormData({ branch_id: branches[0]?.id || '', name: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (v: Vertical) => {
    setEditingVertical(v);
    setFormData({ branch_id: v.branch_id, name: v.name });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.branch_id) {
      toast.error('Please specify a vertical name and associated branch');
      return;
    }

    if (editingVertical) {
      updateMutation.mutate({ id: editingVertical.id, data: { name: formData.name } });
    } else {
      createMutation.mutate({ branch_id: formData.branch_id, name: formData.name });
    }
  };

  const getBranchName = useCallback(
    (branchId: string) => {
      return branches.find((b) => b.id === branchId)?.name || 'Unknown Location';
    },
    [branches]
  );

  // Filtered verticals based on search & branch filter
  const filteredVerticals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return verticals.filter((v) => {
      const matchesSearch = !q || v.name.toLowerCase().includes(q);
      const matchesBranch = selectedBranchFilter === '__ALL__' || v.branch_id === selectedBranchFilter;
      return matchesSearch && matchesBranch;
    });
  }, [verticals, searchQuery, selectedBranchFilter]);

  if (loadingVerticals) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-medium">Loading lines of business & verticals…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1240px]">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Lines of Business & Practice Verticals
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono font-bold bg-primary/5 text-primary border-primary/20">
              {verticals.length} {verticals.length === 1 ? 'Vertical' : 'Verticals'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Configure service divisions, medical practices, academic programs, or business segments mapped across your branches
          </p>
        </div>

        {canManage && (
          <Button
            onClick={openCreateDialog}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all self-start sm:self-auto"
          >
            <Plus size={15} strokeWidth={2.5} />
            Add Business Vertical
          </Button>
        )}
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-card border border-border/70 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium">Configured Practices</span>
            <Briefcase size={15} className="text-primary" />
          </div>
          <p className="text-xl font-bold text-foreground">{verticals.length}</p>
        </div>

        <div className="p-3.5 bg-card border border-border/70 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium">Mapped Branches</span>
            <Building2 size={15} className="text-indigo-500" />
          </div>
          <p className="text-xl font-bold text-foreground">{branches.length}</p>
        </div>

        <div className="p-3.5 bg-card border border-border/70 rounded-xl shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium">Pipeline Resolution</span>
            <CheckCircle2 size={15} className="text-emerald-600" />
          </div>
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active Across Matrix
          </p>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/60 border border-border/60 rounded-xl p-2 px-3">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search verticals by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-background/50 border-border/60 rounded-lg focus-visible:ring-1"
            />
          </div>

          <div className="w-48 hidden md:block">
            <Select value={selectedBranchFilter} onValueChange={setSelectedBranchFilter}>
              <SelectTrigger size="sm" className="h-8 text-xs bg-background/50 border-border/60 rounded-lg">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-popover shadow-md">
                <SelectItem value="__ALL__" className="text-xs cursor-pointer">
                  All Locations
                </SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs cursor-pointer">
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground font-medium self-end sm:self-auto">
          Showing {filteredVerticals.length} of {verticals.length} verticals
        </div>
      </div>

      {/* 4. Enterprise Vertical Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredVerticals.map((vertical) => {
          const branchName = getBranchName(vertical.branch_id);

          return (
            <Card
              key={vertical.id}
              className="bg-card border-border/80 hover:border-border hover:shadow-md transition-all duration-200 rounded-2xl overflow-hidden flex flex-col justify-between group"
            >
              <CardHeader className="p-4 pb-3 border-b border-border/40 bg-muted/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                      <Layers size={16} />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-bold text-foreground truncate">
                        {vertical.name}
                      </CardTitle>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 truncate">
                        <Building2 size={12} className="shrink-0 text-muted-foreground/70" />
                        <span className="truncate">{branchName}</span>
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-lg cursor-pointer"
                        onClick={() => openEditDialog(vertical)}
                        title="Edit vertical"
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-7 w-7 rounded-lg cursor-pointer"
                        onClick={() => {
                          if (window.confirm(`Delete vertical practice "${vertical.name}"?`)) {
                            deleteMutation.mutate(vertical.id);
                          }
                        }}
                        title="Delete vertical"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Operates as an independent practice stream for lead attribution, pipelines, and reporting.
                  </p>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 font-mono">
                    {vertical.created_at && <span>{dayjs(vertical.created_at).format('DD MMM YYYY')}</span>}
                  </div>
                  <Badge variant="outline" className="text-[9px] font-semibold text-emerald-600 bg-emerald-50/50 border-emerald-200">
                    Operational
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredVerticals.length === 0 && (
          <div className="col-span-full py-16 text-center space-y-3 border border-dashed border-border rounded-2xl bg-muted/10">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Layers size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No vertical practices match your criteria</p>
              <p className="text-xs text-muted-foreground mt-0.5">Try clearing filters or configure a new practice line.</p>
            </div>
            {canManage && (
              <Button onClick={openCreateDialog} size="sm" variant="outline" className="cursor-pointer text-xs">
                <Plus size={14} className="mr-1.5" /> Configure Practice
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 5. Create / Edit Vertical Modal Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl shadow-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              {editingVertical ? 'Edit Vertical Practice' : 'Register New Business Vertical'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingVertical
                ? 'Update the operational designation of this line of business.'
                : 'Map a distinct division or practice to an existing physical branch.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {!editingVertical && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80">
                  Target Branch Location <span className="text-destructive">*</span>
                </label>
                <Select
                  value={formData.branch_id}
                  onValueChange={(val) => setFormData((f) => ({ ...f, branch_id: val }))}
                >
                  <SelectTrigger className="h-9 text-xs border-border bg-background">
                    <SelectValue placeholder="Select target branch location..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border bg-popover shadow-md">
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="text-xs cursor-pointer">
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground/80">
                Vertical / Practice Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Higher Ed Admissions, Dental Surgery, Corporate Law"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                required
                className="h-9 text-xs border-border bg-background focus-visible:ring-1"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="h-9 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold cursor-pointer shadow-xs"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                )}
                {editingVertical ? 'Save Modifications' : 'Register Vertical'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
