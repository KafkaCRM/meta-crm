import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MapPin,
  Building2,
  Search,
  CheckCircle2,
  Layers,
  Globe2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { settingsApi, type Branch, type Vertical } from '@/api/settings';
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
import { usePermissions } from '@/hooks/usePermissions';

export function BranchManager() {
  const { can } = usePermissions();
  const canManage = can('manage', 'Branch');
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', city: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list(),
    staleTime: 30_000,
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ['settings', 'verticals'],
    queryFn: () => settingsApi.verticals.list(),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; address?: string; city?: string }) =>
      settingsApi.branches.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] });
      toast.success('Location deployed successfully');
      setIsDialogOpen(false);
      setFormData({ name: '', address: '', city: '' });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create branch'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; address?: string; city?: string } }) =>
      settingsApi.branches.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] });
      toast.success('Branch details updated');
      setIsDialogOpen(false);
      setEditingBranch(null);
      setFormData({ name: '', address: '', city: '' });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update branch'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.branches.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] });
      toast.success('Branch location deactivated');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to deactivate branch'),
  });

  const openCreateDialog = () => {
    setEditingBranch(null);
    setFormData({ name: '', address: '', city: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address ?? '',
      city: branch.city ?? '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingBranch) {
      updateMutation.mutate({ id: editingBranch.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Compute verticals count per branch
  const verticalsCountByBranch = useMemo(() => {
    const map: Record<string, number> = {};
    verticals.forEach((v) => {
      map[v.branch_id] = (map[v.branch_id] || 0) + 1;
    });
    return map;
  }, [verticals]);

  // Unique cities count
  const uniqueCities = useMemo(() => {
    const cities = new Set(branches.map((b) => b.city).filter(Boolean));
    return cities.size;
  }, [branches]);

  // Filtered branches based on search
  const filteredBranches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.city && b.city.toLowerCase().includes(q)) ||
        (b.address && b.address.toLowerCase().includes(q))
    );
  }, [branches, searchQuery]);

  if (loadingBranches) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-medium">Loading physical branch directory…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1240px]">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Branch & Location Management
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono font-bold bg-primary/5 text-primary border-primary/20">
              {branches.length} {branches.length === 1 ? 'Location' : 'Locations'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Manage enterprise physical offices, retail outlets, clinics, and geographic operational hubs
          </p>
        </div>

        {canManage && (
          <Button
            onClick={openCreateDialog}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all self-start sm:self-auto"
          >
            <Plus size={15} strokeWidth={2.5} />
            Deploy New Location
          </Button>
        )}
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-card border border-border/70 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium">Active Branches</span>
            <Building2 size={15} className="text-primary" />
          </div>
          <p className="text-xl font-bold text-foreground">{branches.length}</p>
        </div>

        <div className="p-3.5 bg-card border border-border/70 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium">Mapped Practices</span>
            <Layers size={15} className="text-indigo-500" />
          </div>
          <p className="text-xl font-bold text-foreground">{verticals.length}</p>
        </div>

        <div className="p-3.5 bg-card border border-border/70 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium">Cities Covered</span>
            <Globe2 size={15} className="text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-foreground">{uniqueCities || 1}</p>
        </div>

        <div className="p-3.5 bg-card border border-border/70 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium">Operational Status</span>
            <CheckCircle2 size={15} className="text-emerald-600" />
          </div>
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Healthy & Synced
          </p>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex items-center justify-between gap-3 bg-card/60 border border-border/60 rounded-xl p-2 px-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search branches by name, city, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-background/50 border-border/60 rounded-lg focus-visible:ring-1"
          />
        </div>
        <div className="text-[11px] text-muted-foreground font-medium hidden sm:block">
          Showing {filteredBranches.length} of {branches.length} locations
        </div>
      </div>

      {/* 4. Enterprise Branch Grid Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredBranches.map((branch, index) => {
          const isHQ = index === 0;
          const linkedVerticalsCount = verticalsCountByBranch[branch.id] || 0;

          return (
            <Card
              key={branch.id}
              className="bg-card border-border/80 hover:border-border hover:shadow-md transition-all duration-200 rounded-2xl overflow-hidden flex flex-col justify-between group"
            >
              <CardHeader className="p-4 pb-3 border-b border-border/40 bg-muted/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                      <Building2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <CardTitle className="text-sm font-bold text-foreground truncate">
                          {branch.name}
                        </CardTitle>
                      </div>
                      {isHQ && (
                        <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0 h-4 bg-primary/10 text-primary border border-primary/20 mt-0.5">
                          Primary HQ
                        </Badge>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-lg cursor-pointer"
                        onClick={() => openEditDialog(branch)}
                        title="Edit location"
                      >
                        <Pencil size={13} />
                      </Button>
                      {!isHQ && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-7 w-7 rounded-lg cursor-pointer"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to deactivate ${branch.name}?`)) {
                              removeMutation.mutate(branch.id);
                            }
                          }}
                          title="Deactivate location"
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin size={13} className="text-muted-foreground/70 shrink-0 mt-0.5" />
                    <span className="leading-snug">
                      {branch.address || branch.city ? (
                        <>
                          {branch.address && <span>{branch.address}</span>}
                          {branch.address && branch.city && <span className="mx-1">·</span>}
                          {branch.city && <span className="font-medium text-foreground/80">{branch.city}</span>}
                        </>
                      ) : (
                        <span className="italic text-muted-foreground/60">No physical address specified</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Layers size={13} className="text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {linkedVerticalsCount} {linkedVerticalsCount === 1 ? 'Vertical' : 'Verticals'}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-semibold text-emerald-600 bg-emerald-50/50 border-emerald-200">
                    Operational
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredBranches.length === 0 && (
          <div className="col-span-full py-16 text-center space-y-3 border border-dashed border-border rounded-2xl bg-muted/10">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Building2 size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No branches match your query</p>
              <p className="text-xs text-muted-foreground mt-0.5">Try clearing your search filter or deploy a new branch.</p>
            </div>
            {canManage && (
              <Button onClick={openCreateDialog} size="sm" variant="outline" className="cursor-pointer text-xs">
                <Plus size={14} className="mr-1.5" /> Deploy Branch
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 5. Create / Edit Branch Modal Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl shadow-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              {editingBranch ? 'Edit Location Details' : 'Deploy New Physical Location'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingBranch
                ? 'Update address details and operational naming for this branch.'
                : 'Configure a new branch for teams, leads, inventory, and pipelines.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground/80">
                Branch Location Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. London Central HQ, New York Downtown"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                required
                className="h-9 text-xs border-border bg-background focus-visible:ring-1"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground/80">Street Address</label>
              <Input
                type="text"
                placeholder="e.g. 100 Financial District Way, Suite 300"
                value={formData.address}
                onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
                className="h-9 text-xs border-border bg-background focus-visible:ring-1"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground/80">City / Jurisdiction</label>
              <Input
                type="text"
                placeholder="e.g. London, San Francisco, Dubai"
                value={formData.city}
                onChange={(e) => setFormData((f) => ({ ...f, city: e.target.value }))}
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
                {editingBranch ? 'Save Modifications' : 'Deploy Location'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
