import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Plus, Trash2, GripVertical, ChevronRight, Loader2, Play, AlertCircle, 
  Clock, ShieldAlert, Settings, Info, ArrowLeft, Flag, CheckCircle, 
  XCircle, Sliders, ChevronDown, Activity, Sparkles 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { settingsApi } from '@/api/settings';

interface Stage {
  id: string;
  name: string;
  order: number;
  sla_hours?: number | null;
  terminal_outcome?: 'won' | 'lost' | null;
  entry_criteria?: any[];
}

export function WorkflowBuilder() {
  const { can } = usePermissions();
  const canManage = can('manage', 'Workflow');
  const queryClient = useQueryClient();

  // Mode state: 'list' (all pipelines) or 'edit' (stage builder)
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  
  // Pipeline management states
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [activePipelineName, setActivePipelineName] = useState('');
  const [activePipelineVertical, setActivePipelineVertical] = useState<{ name: string; branchName: string } | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedVerticalId, setSelectedVerticalId] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pipelineToDelete, setPipelineToDelete] = useState<{ id: string; name: string } | null>(null);

  // Option B Stage Builder states
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  // 1. Query - List all pipelines
  const { data: pipelines = [], isLoading: listLoading, refetch: refetchPipelines } = useQuery({
    queryKey: ['settings', 'pipelines-all'],
    queryFn: () => settingsApi.pipelines.list(),
    staleTime: 30_000,
  });

  // Branch and vertical queries for create dialog
  const { data: branches = [] } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list(),
    staleTime: 30_000,
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ['settings', 'verticals', selectedBranchId],
    queryFn: () => settingsApi.verticals.list(selectedBranchId ? { branch_id: selectedBranchId } : undefined),
    staleTime: 30_000,
    enabled: !!selectedBranchId,
  });

  // 2. Query - Fetch current selected pipeline details
  const { data: activePipeline, isLoading: pipelineDetailsLoading } = useQuery({
    queryKey: ['settings', 'pipeline-details', activePipelineId],
    queryFn: () => settingsApi.pipelines.getDefault(), // Fallback check or get
    enabled: false, // Triggered manually on Edit click
  });

  // 3. Mutation - Create custom pipeline
  const createPipelineMutation = useMutation({
    mutationFn: (data: { name: string; vertical_id?: string }) => settingsApi.pipelines.create(data),
    onSuccess: (created) => {
      toast.success(`Pipeline "${created.name}" created successfully!`);
      setIsCreateModalOpen(false);
      setNewPipelineName('');
      setSelectedBranchId('');
      setSelectedVerticalId('');
      refetchPipelines();
      
      // Auto-enter editing mode for the new pipeline
      handleEditPipeline(created.id, created.name, created.stages || []);
    },
    onError: (err: any) => {
      const msg = err instanceof Error ? err.message : err?.response?.data?.message || 'Failed to create pipeline';
      toast.error(msg);
    },
  });

  const handleCreatePipeline = () => {
    if (!newPipelineName.trim()) return;
    const isDuplicate = pipelines.some(
      (p: any) => p.name.trim().toLowerCase() === newPipelineName.trim().toLowerCase()
    );
    if (isDuplicate) {
      toast.error(`A pipeline named "${newPipelineName.trim()}" already exists. Please choose a unique name.`);
      return;
    }
    if (!selectedBranchId) {
      toast.error('Please select a branch.');
      return;
    }
    if (!selectedVerticalId) {
      toast.error('Please select a vertical.');
      return;
    }
    createPipelineMutation.mutate({ name: newPipelineName.trim(), vertical_id: selectedVerticalId });
  };

  // Mutation - Delete custom pipeline
  const deletePipelineMutation = useMutation({
    mutationFn: (id: string) => settingsApi.pipelines.delete(id),
    onSuccess: () => {
      toast.success('Pipeline deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      refetchPipelines();
      setIsDeleteModalOpen(false);
      setPipelineToDelete(null);
    },
    onError: (err: any) => {
      const msg = err instanceof Error ? err.message : err?.response?.data?.message || 'Failed to delete pipeline';
      toast.error(msg, {
        description: 'Ensure it is not the only pipeline, and no active campaigns or leads are linked to it.',
      });
      setIsDeleteModalOpen(false);
      setPipelineToDelete(null);
    },
  });

  const handleDeletePipeline = (id: string, name: string) => {
    setPipelineToDelete({ id, name });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (pipelineToDelete) {
      deletePipelineMutation.mutate(pipelineToDelete.id);
    }
  };

  // 4. Mutation - Save pipeline changes
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!activePipelineId) return Promise.reject(new Error('No pipeline loaded'));
      // Keep structural integrity but map stages cleanly
      return settingsApi.pipelines.update(activePipelineId, { 
        name: activePipelineName, 
        stages: stages.map((s, idx) => ({ ...s, order: idx })), 
        transitions: [] // Handled dynamically or seeded
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Pipeline published successfully!');
    },
    onError: () => toast.error('Failed to save pipeline changes'),
  });

  // Set local state when editing a pipeline
  const handleEditPipeline = (id: string, name: string, pipelineStages: Stage[], verticalInfo?: { verticalName: string; branchName: string } | null) => {
    setActivePipelineId(id);
    setActivePipelineName(name);
    setActivePipelineVertical(verticalInfo ? { name: verticalInfo.verticalName, branchName: verticalInfo.branchName } : null);
    
    // Order stages chronologically
    const sorted = [...pipelineStages].sort((a, b) => a.order - b.order);
    
    // Ensure Closed Won and Closed Lost are always present by default
    const won = sorted.find((s) => s.terminal_outcome === 'won');
    const lost = sorted.find((s) => s.terminal_outcome === 'lost');
    
    const finalStages = [...sorted];
    if (!won) {
      finalStages.push({
        id: `stage_won_${Date.now()}`,
        name: 'Closed Won',
        order: finalStages.length,
        terminal_outcome: 'won',
        entry_criteria: [],
      });
    }
    if (!lost) {
      finalStages.push({
        id: `stage_lost_${Date.now()}_lost`,
        name: 'Closed Lost',
        order: finalStages.length,
        terminal_outcome: 'lost',
        entry_criteria: [],
      });
    }
    
    // Maintain correct order index sequence (standard stages first, then terminal outcomes)
    const standard = finalStages.filter((s) => !s.terminal_outcome);
    const terminal = finalStages.filter((s) => s.terminal_outcome);
    const reordered = [
      ...standard.map((s, idx) => ({ ...s, order: idx })),
      ...terminal.map((s, idx) => ({ ...s, order: standard.length + idx })),
    ];
    
    setStages(reordered);
    
    // Default select the first stage if available
    if (reordered.length > 0) {
      setSelectedStageId(reordered[0]!.id);
    } else {
      setSelectedStageId(null);
    }
    
    setMode('edit');
  };

  // Stage CRUD - Add new stage
  const handleAddStage = () => {
    const newStageId = `stage_${Date.now()}`;
    const stage: Stage = {
      id: newStageId,
      name: 'New Stage',
      order: stages.length,
      sla_hours: null,
      terminal_outcome: null,
      entry_criteria: [],
    };
    
    setStages((prev) => {
      const standard = prev.filter((s) => !s.terminal_outcome);
      const terminal = prev.filter((s) => s.terminal_outcome);
      
      const updatedStandard = [...standard, stage].map((s, idx) => ({ ...s, order: idx }));
      const updatedTerminal = terminal.map((s, idx) => ({ ...s, order: updatedStandard.length + idx }));
      
      return [...updatedStandard, ...updatedTerminal];
    });
    
    setSelectedStageId(newStageId);
    toast.success('Added new stage. Configure it in the right panel!');
  };

  // Stage CRUD - Insert stage in between standard stages
  const handleInsertStage = (afterIndex: number) => {
    const newStage: Stage = {
      id: `stage_${Date.now()}`,
      name: 'New Stage',
      order: afterIndex + 1,
      sla_hours: null,
      terminal_outcome: null,
      entry_criteria: [],
    };

    setStages((prev) => {
      const updated = [...prev];
      const standard = updated.filter((s) => !s.terminal_outcome);
      const terminal = updated.filter((s) => s.terminal_outcome);

      // Insert at target index + 1
      standard.splice(afterIndex + 1, 0, newStage);

      // Re-order standard stages
      const orderedStandard = standard.map((s, idx) => ({ ...s, order: idx }));
      
      // Re-order terminal stages to always follow standard stages
      const orderedTerminal = terminal.map((s, idx) => ({ ...s, order: orderedStandard.length + idx }));

      return [...orderedStandard, ...orderedTerminal];
    });

    setSelectedStageId(newStage.id);
    toast.success('Inserted new stage. Configure it in the right panel!');
  };

  // Stage CRUD - Remove stage
  const handleRemoveStage = (id: string) => {
    if (stages.length <= 1) {
      toast.error('A pipeline must contain at least one stage.');
      return;
    }
    
    setStages((prev) => prev.filter((s) => s.id !== id));
    
    // Fallback selection
    if (selectedStageId === id) {
      const remaining = stages.filter((s) => s.id !== id);
      setSelectedStageId(remaining[0]?.id ?? null);
    }
    
    toast.success('Stage removed from track');
  };

  // Stage CRUD - Update individual stage settings
  const handleUpdateStageProperty = (id: string, property: keyof Stage, value: any) => {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [property]: value } : s))
    );
  };

  // Compute standard stages vs terminal won/lost outcomes
  const standardStages = useMemo(() => {
    return stages.filter((s) => !s.terminal_outcome);
  }, [stages]);

  const wonOutcomeStages = useMemo(() => {
    return stages.filter((s) => s.terminal_outcome === 'won');
  }, [stages]);

  const lostOutcomeStages = useMemo(() => {
    return stages.filter((s) => s.terminal_outcome === 'lost');
  }, [stages]);

  const activeStage = useMemo(() => {
    return stages.find((s) => s.id === selectedStageId) ?? null;
  }, [stages, selectedStageId]);

  if (listLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground font-semibold">Loading Pipelines...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1200px] animate-in fade-in duration-200">
      
      {/* ── MODE: LIST ALL PIPELINES ─────────────────────────────────────── */}
      {mode === 'list' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pipeline Settings</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configure visual sales funnels, lead journeys, and conversion metrics for your campaigns.
              </p>
            </div>
            {canManage && (
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-primary hover:bg-[#1e293b] text-white h-9 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus size={15} />
                Create Pipeline
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {pipelines.map((pipe: any) => (
              <Card key={pipe.id} className="bg-card border border-border rounded-xl shadow-none hover:shadow-xs transition-shadow">
                <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold text-foreground">{pipe.name}</CardTitle>
                    <CardDescription className="text-xs capitalize text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                      Active Lead Pipeline
                    </CardDescription>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePipeline(pipe.id, pipe.name);
                      }}
                      className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors rounded-lg shrink-0 cursor-pointer"
                      title="Delete Pipeline"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {pipe.vertical && (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                        {pipe.vertical.name}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {pipe.stages?.map((stage: any) => (
                      <Badge 
                        key={stage.id} 
                        variant="outline" 
                        className={cn(
                          "text-[10px] py-0 px-2 rounded-md font-medium tracking-wide",
                          stage.terminal_outcome === 'won' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          stage.terminal_outcome === 'lost' ? "bg-red-50 text-red-700 border-red-100" :
                          "bg-slate-50 text-slate-600 border-slate-100"
                        )}
                      >
                        {stage.name}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-3.5 mt-1 text-xs">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                      {pipe.stages?.length || 0} stages configured
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditPipeline(pipe.id, pipe.name, pipe.stages || [], pipe.vertical ? { verticalName: pipe.vertical.name, branchName: pipe.vertical.branch?.name ?? '' } : null)}
                      className="border-border text-foreground hover:bg-muted font-semibold h-8 rounded-lg text-xs"
                    >
                      Design Pipeline
                      <ChevronRight size={13} className="ml-0.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {pipelines.length === 0 && (
              <div className="sm:col-span-2 py-24 text-center border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center bg-card">
                <Sliders size={32} className="text-muted-foreground/30 mb-2" />
                <p className="font-semibold text-foreground text-sm">No Pipelines configured yet</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xs leading-relaxed">
                  Click the "Create Pipeline" button to configure your first customer journey stages.
                </p>
              </div>
            )}
          </div>

          {/* Creation Dialog */}
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogContent className="sm:max-w-md p-6 bg-card border border-border">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles size={16} className="text-amber-500 font-extrabold" />
                  Create Lead Pipeline
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Define a new process journey map (e.g. Sales Funnel, Admissions, Customer Care).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Branch</label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => {
                      setSelectedBranchId(e.target.value);
                      setSelectedVerticalId('');
                    }}
                    className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-1 text-sm shadow-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Select a branch...</option>
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Vertical</label>
                  <select
                    value={selectedVerticalId}
                    onChange={(e) => setSelectedVerticalId(e.target.value)}
                    disabled={!selectedBranchId}
                    className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-1 text-sm shadow-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  >
                    <option value="">{selectedBranchId ? 'Select a vertical...' : 'Select a branch first'}</option>
                    {verticals.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Pipeline Name</label>
                  <Input
                    type="text"
                    placeholder="e.g. Admissions Funnel 2026"
                    value={newPipelineName}
                    onChange={(e) => setNewPipelineName(e.target.value)}
                    className="bg-background border-border h-9 text-sm"
                    required
                  />
                </div>
              </div>
              <DialogFooter className="pt-4 border-t border-border mt-4 -mx-6 -mb-6 px-6 bg-muted">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-9 text-xs border-border bg-card text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleCreatePipeline}
                  disabled={createPipelineMutation.isPending || !newPipelineName.trim()}
                  className="h-9 text-xs bg-primary hover:bg-[#1e293b] text-white"
                >
                  {createPipelineMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                  Create & Design
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
            <DialogContent className="sm:max-w-md p-6 bg-card border border-border">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle size={18} className="text-red-605 text-red-600" />
                  Delete Pipeline
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Are you sure you want to permanently delete the pipeline <strong className="text-slate-800 font-bold">"{pipelineToDelete?.name}"</strong>? 
                  This will also remove all stage configurations and SLA limits associated with it. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-start gap-3 p-3.5 border border-dashed border-red-200 bg-red-50/5 rounded-xl mt-3">
                <ShieldAlert size={16} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-800 leading-normal font-semibold">
                  Warning: Deletion will fail if any active calling campaigns or client leads are currently linked to this pipeline.
                </p>
              </div>
              <DialogFooter className="pt-4 border-t border-border mt-4 -mx-6 -mb-6 px-6 bg-muted flex sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setPipelineToDelete(null);
                  }}
                  className="h-9 text-xs border-border bg-card text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deletePipelineMutation.isPending}
                  className="h-9 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
                >
                  {deletePipelineMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  Delete Pipeline
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ── MODE: OPTION B SPLIT-SCREEN STAGE BUILDER ───────────────────── */}
      {mode === 'edit' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-3 duration-250">
          
          {/* Editor Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMode('list');
                  refetchPipelines();
                }}
                className="border-border text-muted-foreground hover:bg-muted p-2 rounded-lg h-9 w-9"
              >
                <ArrowLeft size={16} />
              </Button>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                  {activePipelineName}
                  <Badge variant="outline" className="text-[10px] py-0 px-2 rounded-md font-bold bg-amber-50 text-amber-700 border-amber-100 uppercase tracking-wide">
                    Designing
                  </Badge>
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                  {activePipelineVertical && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                      {activePipelineVertical.branchName} / {activePipelineVertical.name}
                    </span>
                  )}
                  <span>Set up stages and configure terminal Won/Lost outcomes.</span>
                </p>
              </div>
            </div>

            {canManage && (
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="bg-primary hover:bg-[#1e293b] text-white h-9 rounded-lg text-xs font-semibold"
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Publish Changes
              </Button>
            )}
          </div>

          {/* Option B Split-Screen Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            
            {/* --- LEFT PANEL: Flowchart Canvas --- */}
            <div className="md:col-span-2 space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Flowchart Canvas</h3>
              
              <div className="relative min-h-[650px] max-h-[750px] border border-border bg-[#fbfbfa] bg-[radial-gradient(#d3cfc9_1px,transparent_1px)] [background-size:16px_16px] rounded-xl p-5 flex flex-col items-center overflow-y-auto shadow-inner select-none gap-0.5">
                
                {/* Flow Inbound Port Indicator */}
                <div className="relative w-full max-w-[240px] bg-background border border-dashed border-slate-300 rounded-lg py-1.5 px-3 text-center flex flex-col items-center justify-center shrink-0">
                  <div className="flex items-center gap-1.5 justify-center">
                    <Activity size={12} className="text-slate-400 animate-pulse" />
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Lead Inbound</span>
                  </div>
                  <div className="absolute -bottom-1 w-2 h-2 rounded-full bg-slate-300 border border-slate-400" />
                </div>

                <div className="flex flex-col items-center justify-center my-1 shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-slate-300 animate-pulse">
                    <path d="M12 2V22M12 22L7 17M12 22L17 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Standard Flowchart Node Cards */}
                {standardStages.map((stage, index) => (
                  <div key={stage.id} className="flex flex-col items-center w-full shrink-0">
                    <div 
                      onClick={() => setSelectedStageId(stage.id)}
                      className={cn(
                        "relative w-full max-w-[340px] bg-card border rounded-xl p-3 cursor-pointer transition-all duration-200 text-center flex flex-col items-center justify-center min-h-[68px] hover:shadow-sm",
                        selectedStageId === stage.id 
                          ? "border-primary ring-2 ring-primary/10 scale-[1.02] shadow-sm font-semibold" 
                          : "border-border hover:border-slate-400 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {/* Node Connection Ports */}
                      <div className="absolute -top-1 w-2 h-2 rounded-full bg-slate-300 border border-slate-400 z-10" />
                      <div className="absolute -bottom-1 w-2 h-2 rounded-full bg-slate-300 border border-slate-400 z-10" />

                      <span className="text-[8px] font-bold text-primary/45 uppercase tracking-widest block -mt-0.5 mb-0.5">Stage {index + 1}</span>
                      <p className="text-xs text-foreground font-semibold truncate max-w-full px-1">{stage.name}</p>
                      {stage.sla_hours && (
                        <span className="text-[9px] font-mono text-slate-500 font-bold flex items-center gap-0.5 mt-0.5 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">
                          <Clock size={8} /> {stage.sla_hours}h limit
                        </span>
                      )}
                    </div>

                    {/* Node Connecting Arrow with Hoverable Plus button */}
                    {index < standardStages.length - 1 ? (
                      <div className="relative group w-full flex flex-col items-center justify-center h-8 shrink-0 my-1">
                        <svg width="20" height="24" viewBox="0 0 24 24" fill="none" className="text-slate-350 group-hover:text-primary transition-colors">
                          <path d="M12 2V22M12 22L7 17M12 22L17 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <button
                          type="button"
                          onClick={() => handleInsertStage(index)}
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center justify-center h-6 w-6 rounded-full bg-primary hover:bg-[#1e293b] text-white shadow-md border border-white hover:scale-110 transition-all duration-150 cursor-pointer z-20 animate-in fade-in zoom-in-75 duration-100"
                          title="Insert stage here"
                        >
                          <Plus size={11} className="stroke-[3px]" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-2 shrink-0" />
                    )}
                  </div>
                ))}

                {/* Plus Icon Node Creator Button at bottom of track */}
                <button
                  type="button"
                  onClick={handleAddStage}
                  className="w-full max-w-[340px] min-h-[48px] border-2 border-dashed border-slate-200 hover:border-primary bg-background hover:bg-slate-50/50 rounded-xl flex items-center justify-center transition-all duration-200 group cursor-pointer mb-3 active:scale-98"
                  title="Add new stage"
                >
                  <Plus size={18} className="text-slate-400 group-hover:text-primary stroke-[3px] group-hover:scale-110 transition-all" />
                </button>

                {/* React Flow Style: SVG Branching Bezier Curve Fork */}
                <div className="flex flex-col items-center justify-center mt-2 mb-2 w-full max-w-[340px] shrink-0">
                  <svg width="100%" height="40" viewBox="0 0 200 40" fill="none" className="text-slate-300 w-full">
                    <path d="M100 0 V15 C100 25, 40 25, 40 40 M100 15 C100 25, 160 25, 160 40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="100" cy="0" r="4" className="fill-slate-300 stroke-slate-400" strokeWidth="1" />
                    <circle cx="40" cy="40" r="4" className="fill-emerald-400 stroke-emerald-500" strokeWidth="1" />
                    <circle cx="160" cy="40" r="4" className="fill-red-400 stroke-red-500" strokeWidth="1" />
                  </svg>
                </div>

                {/* 2-Column Grid splitting into Won (Green Success) and Lost (Red Failure) flowchart nodes */}
                <div className="grid grid-cols-2 gap-4 w-full pt-1 shrink-0">
                  {/* Left Column: Success Branch (Green Node) */}
                  <div className="space-y-2.5 border border-dashed border-emerald-200 bg-emerald-50/5 rounded-xl p-3 flex flex-col justify-start items-center">
                    <span className="text-[8px] font-extrabold text-emerald-600 uppercase tracking-widest mb-1 select-none">Won Outcome</span>

                    {wonOutcomeStages.map((stage) => (
                      <div 
                        key={stage.id}
                        onClick={() => setSelectedStageId(stage.id)}
                        className={cn(
                          "relative w-full bg-emerald-50/15 border rounded-lg p-2.5 cursor-pointer transition-all duration-200 text-center flex flex-col items-center justify-center min-h-[64px] hover:shadow-xs",
                          selectedStageId === stage.id 
                            ? "border-emerald-500 ring-2 ring-emerald-500/20 scale-[1.02] shadow-sm font-semibold text-emerald-950" 
                            : "border-emerald-200 hover:border-emerald-400 text-emerald-800"
                        )}
                      >
                        <div className="absolute -top-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-500 z-10" />
                        <span className="text-[7px] font-bold text-emerald-600/60 uppercase tracking-widest block -mt-1.5 mb-0.5">Success Node</span>
                        <div className="flex items-center gap-1.5 justify-center max-w-full">
                          <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                          <span className="text-xs font-bold truncate">{stage.name}</span>
                        </div>
                      </div>
                    ))}

                    {wonOutcomeStages.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setStages((prev) => [
                            ...prev,
                            { id: `stage_won_${Date.now()}`, name: 'Closed Won', order: prev.length, terminal_outcome: 'won', entry_criteria: [] }
                          ]);
                        }}
                        className="w-full text-center text-[10px] text-emerald-600 font-semibold flex items-center justify-center gap-1 py-3 px-2 hover:bg-emerald-100/30 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/5 cursor-pointer hover:border-emerald-400 transition-all active:scale-95"
                      >
                        <Plus size={10} />
                        Add Won Node
                      </button>
                    )}
                  </div>

                  {/* Right Column: Failure Branch (Red Node) */}
                  <div className="space-y-2.5 border border-dashed border-red-200 bg-red-50/5 rounded-xl p-3 flex flex-col justify-start items-center">
                    <span className="text-[8px] font-extrabold text-red-600 uppercase tracking-widest mb-1 select-none">Lost Outcome</span>

                    {lostOutcomeStages.map((stage) => (
                      <div 
                        key={stage.id}
                        onClick={() => setSelectedStageId(stage.id)}
                        className={cn(
                          "relative w-full bg-red-50/15 border rounded-lg p-2.5 cursor-pointer transition-all duration-200 text-center flex flex-col items-center justify-center min-h-[64px] hover:shadow-xs",
                          selectedStageId === stage.id 
                            ? "border-red-500 ring-2 ring-red-500/20 scale-[1.02] shadow-sm font-semibold text-red-950" 
                            : "border-red-200 hover:border-red-400 text-red-800"
                        )}
                      >
                        <div className="absolute -top-1 w-2.5 h-2.5 rounded-full bg-red-400 border border-red-500 z-10" />
                        <span className="text-[7px] font-bold text-red-600/60 uppercase tracking-widest block -mt-1.5 mb-0.5">Failure Node</span>
                        <div className="flex items-center gap-1.5 justify-center max-w-full">
                          <XCircle size={12} className="text-red-500 shrink-0" />
                          <span className="text-xs font-bold truncate">{stage.name}</span>
                        </div>
                      </div>
                    ))}

                    {lostOutcomeStages.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setStages((prev) => [
                            ...prev,
                            { id: `stage_lost_${Date.now()}`, name: 'Closed Lost', order: prev.length, terminal_outcome: 'lost', entry_criteria: [] }
                          ]);
                        }}
                        className="w-full text-center text-[10px] text-red-600 font-semibold flex items-center justify-center gap-1 py-3 px-2 hover:bg-red-100/30 rounded-lg border border-dashed border-red-300 bg-red-50/5 cursor-pointer hover:border-red-400 transition-all active:scale-95"
                      >
                        <Plus size={10} />
                        Add Lost Node
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* --- RIGHT PANEL: Stage Configurator --- */}
            <div className="md:col-span-1 space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Stage Configurator</h3>

              {activeStage ? (
                <Card className="bg-card border border-border rounded-xl shadow-none p-5 space-y-5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between pb-3.5 border-b border-border">
                    <div>
                      <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
                        {activeStage.name}
                        {activeStage.terminal_outcome && (
                          <Badge className={cn(
                            "text-[8px] py-0 px-2 rounded-md font-extrabold uppercase tracking-wide border",
                            activeStage.terminal_outcome === 'won' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"
                          )}>
                            {activeStage.terminal_outcome === 'won' ? 'Won Outcome' : 'Lost Outcome'}
                          </Badge>
                        )}
                      </h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Configure details, thresholds, and triggers for this stage.</p>
                    </div>

                    {!activeStage.terminal_outcome && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveStage(activeStage.id)}
                        className="border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 h-8 rounded-lg text-xs"
                      >
                        <Trash2 size={13} className="mr-1.5" />
                        Delete Stage
                      </Button>
                    )}
                  </div>

                  {/* Config Fields */}
                  <div className="space-y-4">
                    {/* Stage Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Stage Display Name</label>
                      <Input
                        type="text"
                        value={activeStage.name}
                        onChange={(e) => handleUpdateStageProperty(activeStage.id, 'name', e.target.value)}
                        className="bg-background border-border h-9 text-sm"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                        Timing Limit SLA (Optional)
                        <HelpCircleTooltip text="The maximum amount of hours a lead can sit in this stage before a timing warning triggers for managers." />
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g. 48 hours"
                        value={activeStage.sla_hours || ''}
                        onChange={(e) => handleUpdateStageProperty(activeStage.id, 'sla_hours', e.target.value ? parseInt(e.target.value, 10) : null)}
                        className="bg-background border-border h-9 text-sm font-mono"
                      />
                    </div>

                  </div>
                </Card>
              ) : (
                <div className="py-24 text-center border border-dashed border-border rounded-xl flex flex-col items-center justify-center bg-card">
                  <Info size={28} className="text-muted-foreground/30 mb-2" />
                  <p className="font-semibold text-foreground text-sm">Select a Stage to edit</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Click any node on the Left Pipeline Track to configure its details.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Tooltip Helper Component
function HelpCircleTooltip({ text }: { text: string }) {
  return (
    <div className="relative group inline-block ml-0.5">
      <Info size={11} className="text-slate-400 hover:text-slate-600 cursor-help" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 bg-slate-800 text-white text-[10px] font-normal leading-normal p-2 rounded-lg shadow-md z-50">
        {text}
      </div>
    </div>
  );
}
