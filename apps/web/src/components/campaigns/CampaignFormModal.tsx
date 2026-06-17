import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Loader2, Sparkles, Settings2, ChevronDown, ChevronUp, Target, Users, 
  PhoneCall, Crown, ShieldAlert, Check, Search, ArrowRight, Shuffle, 
  Sliders, ShieldCheck, HeartHandshake, AlertTriangle, AlertCircle, X, HelpCircle, Layers
} from 'lucide-react';
import { settingsApi } from '@/api/settings';
import { campaignsApi } from '@/api/campaigns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface CampaignFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Custom Searchable User Selection Popover Component for Enterprise UX
interface UserSelectPopoverProps {
  title: string;
  users: any[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  icon: React.ReactNode;
  activeColor: string;
}

function UserSelectPopover({ title, users, selectedIds, onChange, placeholder, icon, activeColor }: UserSelectPopoverProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredUsers = useMemo(() => {
    return users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
  }, [users, search]);

  const toggleUser = (userId: string) => {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter(id => id !== userId));
    } else {
      onChange([...selectedIds, userId]);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-border rounded-xl bg-background hover:bg-slate-50/50 transition-colors text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <div className="flex items-center gap-2 text-muted-foreground truncate">
            {icon}
            <span className="text-xs font-semibold text-slate-700">
              {selectedIds.length > 0 
                ? `${selectedIds.length} chosen` 
                : placeholder
              }
            </span>
          </div>
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 border border-border rounded-xl shadow-lg bg-popover z-[9999]" align="start">
        <div className="p-2 border-b border-border flex items-center gap-1.5 bg-muted/40 rounded-t-xl">
          <Search size={13} className="text-muted-foreground ml-1" />
          <input
            type="text"
            placeholder={`Search ${title.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border-none text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 py-1"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="hover:bg-slate-100 p-0.5 rounded text-muted-foreground">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((u) => {
              const isSelected = selectedIds.includes(u.id);
              const initials = u.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleUser(u.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2.5 px-2 py-1.5 rounded-lg text-left text-xs transition-colors hover:bg-slate-50",
                    isSelected && "bg-slate-50/70 font-semibold"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 border border-border shadow-xs",
                      isSelected ? activeColor : "bg-slate-100 text-slate-600"
                    )}>
                      {initials}
                    </div>
                    <span className="truncate text-foreground">{u.name}</span>
                  </div>
                  {isSelected && <Check size={13} className="text-primary shrink-0" />}
                </button>
              );
            })
          ) : (
            <p className="text-[10px] text-muted-foreground text-center py-6 font-semibold">No users match your query</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CampaignFormModal({ isOpen, onClose, onSuccess }: CampaignFormModalProps) {
  const queryClient = useQueryClient();

  // Multi-step Active tab tracker (for progresive disclosure & flowchart coordination)
  const [activeTab, setActiveTab] = useState('basics');

  // Form State - 1. Basics & Pipeline
  const [name, setName] = useState('');
  const [status, setStatus] = useState('active');
  const [pipelineId, setPipelineId] = useState('');

  // Form State - 2. Performance Target
  const [targetLeads, setTargetLeads] = useState('');

  // Form State - 3. Operational Hierarchy (NeoDove 3-Tiered Access)
  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);
  const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  // Form State - 4. Routing & Spillover Configurations
  const [distribution, setDistribution] = useState<'on_demand' | 'round_robin' | 'conditional'>('on_demand');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [allowSpillover, setAllowSpillover] = useState(false);

  // Form State - 5. Data Safety / Deduplication Rules
  const [dupCheckScope, setDupCheckScope] = useState<'none' | 'campaign' | 'pipeline' | 'global'>('none');
  const [dupResolution, setDupResolution] = useState<'ignore' | 'merge' | 'create_new' | 'reopen'>('ignore');

  // Form State - Location & Vertical
  const [branchId, setBranchId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [verticalId, setVerticalId] = useState('');

  const [isInitializing, setIsInitializing] = useState(false);
  const [hasAttemptedInit, setHasAttemptedInit] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 1. Fetch branch-brand assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['settings', 'assignments'],
    queryFn: () => settingsApi.assignments.list(),
    enabled: isOpen,
    staleTime: 30_000,
  });

  // 2. Fetch branches and brands to resolve their names
  const { data: branches = [] } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list(),
    enabled: isOpen,
    staleTime: 30_000,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['settings', 'brands'],
    queryFn: () => settingsApi.brands.list(),
    enabled: isOpen,
    staleTime: 30_000,
  });

  // 3. Fetch active verticals
  const { data: verticals = [], isLoading: verticalsLoading } = useQuery({
    queryKey: ['settings', 'verticals'],
    queryFn: () => settingsApi.verticals.list({ status: 'active' }),
    enabled: isOpen,
    staleTime: 30_000,
  });

  // 4. Fetch pipelines (workflows)
  const { data: pipelines = [], isLoading: pipelinesLoading } = useQuery({
    queryKey: ['settings', 'pipelines'],
    queryFn: () => settingsApi.pipelines.list(),
    enabled: isOpen,
    staleTime: 30_000,
  });

  // 5. Fetch all users for assignments
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['settings', 'users-all'],
    queryFn: () => settingsApi.users.list(),
    enabled: isOpen,
    staleTime: 30_000,
  });

  // Build resolved assignments options
  const assignmentOptions = useMemo(() => {
    return assignments.map((asg) => {
      const branchName = branches.find((b) => b.id === asg.branch_id)?.name ?? `Branch (${asg.branch_id})`;
      const brandName = brands.find((b) => b.id === asg.brand_id)?.name ?? `Brand (${asg.brand_id})`;
      return {
        id: asg.id,
        branchId: asg.branch_id,
        brandId: asg.brand_id,
        label: `${branchName} · ${brandName} ${asg.is_primary ? '(Primary)' : ''}`,
      };
    });
  }, [assignments, branches, brands]);

  // Filtered pipelines based on selected vertical
  const filteredPipelines = useMemo(() => {
    if (!verticalId) return pipelines;
    return pipelines.filter((p: any) => !p.vertical_id || p.vertical_id === verticalId);
  }, [pipelines, verticalId]);

  // Show team access step only if there are multiple users
  const showAccessTab = users.length > 1;

  // Silent default initialization helper
  const ensureDefaults = useCallback(async () => {
    if (assignmentsLoading || verticalsLoading || pipelinesLoading) return;
    if (branches.length > 0 && brands.length > 0 && verticals.length > 0 && pipelines.length > 0) return;
    
    try {
      setIsInitializing(true);
      
      let activeBranchId = branches[0]?.id;
      let activeBrandId = brands[0]?.id;
      let activeVerticalId = verticals[0]?.id;
      let activePipelineId = pipelines[0]?.id;

      if (!activeBranchId) {
        const branchRes = await settingsApi.branches.create({
          name: 'Main Location',
          city: 'Store City',
        });
        activeBranchId = branchRes.id;
      }

      if (!activeBrandId) {
        const brandRes = await settingsApi.brands.create({
          name: 'Primary Store Brand',
        });
        activeBrandId = brandRes.id;
      }

      if (!activeVerticalId) {
        const verticalRes = await settingsApi.verticals.create({
          brand_id: activeBrandId,
          name: 'Store Inquiries',
          status: 'active',
        });
        activeVerticalId = verticalRes.id;
      }

      if (!activePipelineId) {
        const defaultWf = await settingsApi.pipelines.getDefault();
        activePipelineId = defaultWf.id;
      }

      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      
      setBranchId(activeBranchId);
      setBrandId(activeBrandId);
      setVerticalId(activeVerticalId);
      setPipelineId(activePipelineId);
    } catch (err) {
      console.error('Silent defaults initialization failed', err);
    } finally {
      setIsInitializing(false);
    }
  }, [assignmentsLoading, verticalsLoading, pipelinesLoading, verticals, pipelines, branches, brands, queryClient]);

  // Silently trigger background check when opened
  useEffect(() => {
    if (isOpen && !assignmentsLoading && !verticalsLoading && !pipelinesLoading && !hasAttemptedInit) {
      if (branches.length > 0 && brands.length > 0 && verticals.length > 0 && pipelines.length > 0) {
        setHasAttemptedInit(true);
        return;
      }
      setHasAttemptedInit(true);
      ensureDefaults();
    }
  }, [isOpen, assignmentsLoading, verticalsLoading, pipelinesLoading, hasAttemptedInit, branches, brands, verticals, pipelines, ensureDefaults]);

  // Sync default options
  useEffect(() => {
    if (isOpen) {
      if (branches.length > 0 && !branchId) {
        setBranchId(branches[0]?.id || '');
      }
      if (brands.length > 0 && !brandId) {
        setBrandId(brands[0]?.id || '');
      }
      if (verticals.length > 0 && !verticalId) {
        setVerticalId(verticals[0]?.id || '');
      }
    }
  }, [isOpen, branches, branchId, brands, brandId, verticals, verticalId]);

  // Auto-sync pipeline if it becomes invalid for the selected vertical or when loaded
  useEffect(() => {
    if (isOpen && filteredPipelines.length > 0) {
      if (!pipelineId || !filteredPipelines.some((p: any) => p.id === pipelineId)) {
        setPipelineId(filteredPipelines[0].id);
      }
    }
  }, [isOpen, filteredPipelines, pipelineId]);

  // Reset form upon close/re-open
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setStatus('active');
      setBranchId('');
      setBrandId('');
      setVerticalId('');
      setPipelineId('');
      setTargetLeads('');
      setSelectedManagers([]);
      setSelectedSupervisors([]);
      setSelectedAgents([]);
      setDistribution('on_demand');
      setPriority('medium');
      setAllowSpillover(false);
      setDupCheckScope('none');
      setDupResolution('ignore');
      setIsInitializing(false);
      setHasAttemptedInit(false);
      setActiveTab('basics');
      setErrors({});
    }
  }, [isOpen]);

  const createMutation = useMutation({
    onSuccess: (newCampaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign launched successfully!', {
        description: newCampaign.name,
      });
      onSuccess();
    },
    mutationFn: (data: {
      branch_id: string;
      brand_id: string;
      vertical_id: string;
      pipeline_id: string;
      name: string;
      status: string;
      channel: string;
      start_date: string;
      target_leads?: number;
      attributes?: Record<string, any>;
    }) => campaignsApi.create(data),
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create campaign');
    },
  });

  const validate = (tab?: string): boolean => {
    const nextErrors: Record<string, string> = {};
    
    // Validate all critical fields on basics step or final submit to prevent invalid transitions
    if (!tab || tab === 'basics' || tab === 'submit') {
      if (!name.trim()) nextErrors.name = 'Campaign Name is required';
      if (!pipelineId) nextErrors.pipelineId = 'Target Pipeline is required';
      if (branches.length > 1 && !branchId) nextErrors.branchId = 'Branch is required';
      if (brands.length > 1 && !brandId) nextErrors.brandId = 'Brand is required';
      if (verticals.length > 1 && !verticalId) nextErrors.verticalId = 'Category Vertical is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNextStep = () => {
    if (activeTab === 'basics') {
      if (!validate('basics')) return;
      if (showAccessTab) {
        setActiveTab('agents');
      } else {
        setActiveTab('routing');
      }
    } else if (activeTab === 'agents') {
      setActiveTab('routing');
    } else if (activeTab === 'routing') {
      setActiveTab('dupes');
    }
  };

  const handlePrevStep = () => {
    if (activeTab === 'agents') {
      setActiveTab('basics');
    } else if (activeTab === 'routing') {
      if (showAccessTab) {
        setActiveTab('agents');
      } else {
        setActiveTab('basics');
      }
    } else if (activeTab === 'dupes') {
      setActiveTab('routing');
    }
  };

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!validate('submit')) {
        setActiveTab('basics');
        toast.error('Please correct errors under the basic settings.');
        return;
      }

      let finalManagers = selectedManagers;
      let finalSupervisors = selectedSupervisors;
      let finalAgents = selectedAgents;

      // Auto-assign when the team access tab is dynamically hidden (single user)
      if (!showAccessTab && users.length > 0) {
        const primaryUserId = users[0]?.id || '';
        finalManagers = [primaryUserId];
        finalSupervisors = [primaryUserId];
        finalAgents = [primaryUserId];
      }

      createMutation.mutate({
        name: name.trim(),
        channel: 'direct',
        status,
        branch_id: branchId,
        brand_id: brandId,
        vertical_id: verticalId,
        pipeline_id: pipelineId,
        start_date: new Date().toISOString(),
        ...(targetLeads ? { target_leads: parseInt(targetLeads, 10) } : {}),
        attributes: {
          selected_managers: finalManagers,
          selected_supervisors: finalSupervisors,
          selected_agents: finalAgents,
          distribution,
          priority,
          allow_spillover: allowSpillover,
          dup_check_scope: dupCheckScope,
          dup_resolution: dupResolution,
        }
      });
    },
    [
      name, status, branchId, brandId, verticalId, pipelineId, targetLeads, 
      createMutation, selectedManagers, 
      selectedSupervisors, selectedAgents, distribution, priority, allowSpillover, 
      dupCheckScope, dupResolution, showAccessTab, users, branches, brands, verticals
    ]
  );

  const isFormLoading = assignmentsLoading || verticalsLoading || pipelinesLoading || usersLoading || isInitializing;

  // Selected pipeline label
  const selectedPipelineName = useMemo(() => {
    const p = pipelines.find((wf: any) => wf.id === pipelineId);
    return p ? p.name : 'Target Pipeline';
  }, [pipelines, pipelineId]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-6xl max-h-[95vh] overflow-y-auto p-0 bg-card border border-border shadow-2xl rounded-2xl flex flex-col">
        
        {/* Sleek Custom Header */}
        <DialogHeader className="p-5 border-b border-border bg-slate-50/50 rounded-t-2xl flex flex-row items-center justify-between shrink-0">
          <div className="space-y-1">
            <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles size={18} className="text-amber-500 font-extrabold animate-pulse" />
              Configure Outbound Campaign
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define target pipelines, dialer agent groups, and queue routing parameters.
            </DialogDescription>
          </div>
        </DialogHeader>

        {isFormLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 flex-grow">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground font-semibold">Pre-configuring custom distribution pools...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-grow divide-y lg:divide-y-0 lg:divide-x divide-border">
            
            {/* --- LEFT PANEL: Stepped Configuration form --- */}
            <div className="lg:col-span-7 p-6 flex flex-col h-full justify-between gap-6 min-h-[500px]">
              
              <Tabs value={activeTab} onValueChange={(v) => validate() && setActiveTab(v)} className="w-full flex-grow flex flex-col gap-6">
                
                {/* Horizontal Wizard Stepper Controls */}
                <TabsList className={cn(
                  "grid w-full bg-slate-100/70 p-1 rounded-xl h-10 border border-slate-200/50 shrink-0",
                  showAccessTab ? "grid-cols-4" : "grid-cols-3"
                )}>
                  <TabsTrigger value="basics" className="text-[11px] font-bold tracking-wide uppercase rounded-lg">
                    1. Basics
                  </TabsTrigger>
                  {showAccessTab && (
                    <TabsTrigger value="agents" className="text-[11px] font-bold tracking-wide uppercase rounded-lg">
                      2. Access
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="routing" className="text-[11px] font-bold tracking-wide uppercase rounded-lg">
                    {showAccessTab ? '3. Routing' : '2. Routing'}
                  </TabsTrigger>
                  <TabsTrigger value="dupes" className="text-[11px] font-bold tracking-wide uppercase rounded-lg">
                    {showAccessTab ? '4. Safety' : '3. Safety'}
                  </TabsTrigger>
                </TabsList>

                {/* --- PROGRESS BAR GAUGE --- */}
                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden -mt-2 shrink-0">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-primary transition-all duration-300 rounded-full"
                    style={{
                      width: showAccessTab 
                        ? (activeTab === 'basics' ? '25%' :
                           activeTab === 'agents' ? '50%' :
                           activeTab === 'routing' ? '75%' : '100%')
                        : (activeTab === 'basics' ? '33.3%' :
                           activeTab === 'routing' ? '66.6%' : '100%')
                    }}
                  />
                </div>

                <div className="flex-grow min-h-[300px]">
                  {/* STEP 1 CONTENT: BASICS & PIPELINE */}
                  <TabsContent value="basics" className="space-y-4 pt-1 animate-in fade-in duration-200">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        <Settings2 size={15} className="text-slate-500" />
                        Campaign Profile & Target Pipeline
                      </h3>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        Identify the campaign name and connect it to a sales funnel pipeline.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Name */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                          Campaign Name <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Input
                            type="text"
                            placeholder="e.g. Inbound Real Estate Dialing Queue"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-background border-border placeholder:text-muted-foreground/60 h-10 text-sm pl-3 shadow-xs rounded-xl focus-visible:ring-[#0f172a]"
                            required
                          />
                        </div>
                        {errors.name && <p className="text-[10px] text-red-600 mt-1 font-semibold">⚠️ {errors.name}</p>}
                      </div>

                      {/* Brand/Branch & Vertical Grid */}
                      {/* Branch & Brand Select */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Branch Selection */}
                        {branches.length > 1 ? (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">
                              Branch <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={branchId}
                              onChange={(e) => setBranchId(e.target.value)}
                              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-medium text-foreground cursor-pointer shadow-xs"
                              required
                            >
                              <option value="" disabled>Select Branch...</option>
                              {branches.map((b: any) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                            {errors.branchId && <p className="text-[10px] text-red-600 mt-1 font-semibold">⚠️ {errors.branchId}</p>}
                          </div>
                        ) : branches.length === 1 ? (
                          <div className="bg-slate-100/50 border border-slate-200/50 rounded-xl p-2.5 flex items-center justify-between h-10">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none">Branch</span>
                              <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[150px] leading-none">{branches[0]?.name || ''}</span>
                            </div>
                            <Badge variant="outline" className="text-[8px] scale-90 origin-right bg-slate-50 text-slate-500 py-0 px-1 border-slate-200">Auto</Badge>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">
                              Branch <span className="text-red-500">*</span>
                            </label>
                            <select
                              value=""
                              disabled
                              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm transition-colors font-medium text-muted-foreground opacity-55 cursor-not-allowed shadow-xs"
                            >
                              <option value="">No Branches Found</option>
                            </select>
                            {errors.branchId && <p className="text-[10px] text-red-600 mt-1 font-semibold">⚠️ {errors.branchId}</p>}
                          </div>
                        )}

                        {/* Brand Selection */}
                        {brands.length > 1 ? (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">
                              Brand <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={brandId}
                              onChange={(e) => setBrandId(e.target.value)}
                              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-medium text-foreground cursor-pointer shadow-xs"
                              required
                            >
                              <option value="" disabled>Select Brand...</option>
                              {brands.map((b: any) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                            {errors.brandId && <p className="text-[10px] text-red-600 mt-1 font-semibold">⚠️ {errors.brandId}</p>}
                          </div>
                        ) : brands.length === 1 ? (
                          <div className="bg-slate-100/50 border border-slate-200/50 rounded-xl p-2.5 flex items-center justify-between h-10">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none">Brand</span>
                              <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[150px] leading-none">{brands[0]?.name || ''}</span>
                            </div>
                            <Badge variant="outline" className="text-[8px] scale-90 origin-right bg-slate-50 text-slate-500 py-0 px-1 border-slate-200">Auto</Badge>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">
                              Brand <span className="text-red-500">*</span>
                            </label>
                            <select
                              value=""
                              disabled
                              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm transition-colors font-medium text-muted-foreground opacity-55 cursor-not-allowed shadow-xs"
                            >
                              <option value="">No Brands Found</option>
                            </select>
                            {errors.brandId && <p className="text-[10px] text-red-600 mt-1 font-semibold">⚠️ {errors.brandId}</p>}
                          </div>
                        )}
                      </div>

                      {/* Vertical & Pipeline Selection */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Vertical Selection */}
                        {verticals.length > 1 ? (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">
                              Category / Vertical <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={verticalId}
                              onChange={(e) => setVerticalId(e.target.value)}
                              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-medium text-foreground cursor-pointer shadow-xs"
                              required
                            >
                              <option value="" disabled>Select Vertical...</option>
                              {verticals.map((v: any) => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </select>
                            {errors.verticalId && <p className="text-[10px] text-red-600 mt-1 font-semibold">⚠️ {errors.verticalId}</p>}
                          </div>
                        ) : verticals.length === 1 ? (
                          <div className="bg-slate-100/50 border border-slate-200/50 rounded-xl p-2.5 flex items-center justify-between h-10">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none">Category / Vertical</span>
                              <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[150px] leading-none">{verticals[0]?.name || ''}</span>
                            </div>
                            <Badge variant="outline" className="text-[8px] scale-90 origin-right bg-slate-50 text-slate-500 py-0 px-1 border-slate-200">Auto</Badge>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">
                              Category / Vertical <span className="text-red-500">*</span>
                            </label>
                            <select
                              value=""
                              disabled
                              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm transition-colors font-medium text-muted-foreground opacity-55 cursor-not-allowed shadow-xs"
                            >
                              <option value="">No Verticals Found</option>
                            </select>
                            {errors.verticalId && <p className="text-[10px] text-red-600 mt-1 font-semibold">⚠️ {errors.verticalId}</p>}
                          </div>
                        )}

                        {/* Pipeline Selection */}
                        {filteredPipelines.length > 1 ? (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">
                              Target Pipeline <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={pipelineId}
                              onChange={(e) => setPipelineId(e.target.value)}
                              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-medium text-foreground cursor-pointer shadow-xs"
                              required
                            >
                              <option value="" disabled>Select Pipeline...</option>
                              {filteredPipelines.map((p: any) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                            {errors.pipelineId && <p className="text-[10px] text-red-600 mt-1 font-semibold">⚠️ {errors.pipelineId}</p>}
                          </div>
                        ) : filteredPipelines.length === 1 ? (
                          <div className="bg-slate-100/50 border border-slate-200/50 rounded-xl p-2.5 flex items-center justify-between h-10">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none">Target Pipeline</span>
                              <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[150px] leading-none">{filteredPipelines[0]?.name || ''}</span>
                            </div>
                            <Badge variant="outline" className="text-[8px] scale-90 origin-right bg-slate-50 text-slate-500 py-0 px-1 border-slate-200">Auto</Badge>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">
                              Target Pipeline <span className="text-red-500">*</span>
                            </label>
                            <select
                              value=""
                              disabled
                              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm transition-colors font-medium text-muted-foreground opacity-55 cursor-not-allowed shadow-xs"
                            >
                              <option value="">No Pipelines Found</option>
                            </select>
                            {errors.pipelineId && <p className="text-[10px] text-red-600 mt-1 font-semibold">⚠️ {errors.pipelineId}</p>}
                          </div>
                        )}
                      </div>

                      {/* Campaign State & Lead Goal */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Campaign State</label>
                          <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-medium text-foreground cursor-pointer shadow-xs"
                          >
                            <option value="active">Active (Running)</option>
                            <option value="draft">Draft (Planning)</option>
                            <option value="paused">Paused</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>

                        {/* Lead Goal */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                            <Target size={12} className="text-slate-400" />
                            Target Lead Ingress Goal (Optional)
                          </label>
                          <div className="relative flex items-center">
                            <Input
                              type="number"
                              placeholder="e.g. 500 leads"
                              value={targetLeads}
                              onChange={(e) => setTargetLeads(e.target.value)}
                              className="bg-background border-border placeholder:text-muted-foreground/60 h-10 text-sm shadow-xs rounded-xl focus-visible:ring-primary pr-12 w-full"
                            />
                            <span className="absolute right-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Leads</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* STEP 2 CONTENT: OPERATIONAL HIERARCHY */}
                  <TabsContent value="agents" className="space-y-4 pt-1 animate-in fade-in duration-200">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        <Users size={15} className="text-slate-500" />
                        Access Hierarchies & Assigned Callers
                      </h3>
                      <p className="text-[11px] text-muted-foreground leading-normal font-medium">
                        NeoDove three-tiered structure matching campaign administrators, queue leaders, and dialing agents.
                      </p>
                    </div>

                    <div className="space-y-5">
                      {/* Managers Select */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                            <Crown size={12} className="text-amber-500" />
                            Campaign Managers
                          </label>
                          <span className="text-[9px] text-muted-foreground">Executive oversight</span>
                        </div>
                        <UserSelectPopover
                          title="Managers"
                          users={users}
                          selectedIds={selectedManagers}
                          onChange={setSelectedManagers}
                          placeholder="Select campaign managers..."
                          icon={<Crown size={13} className="text-amber-500" />}
                          activeColor="bg-amber-100 text-amber-800 border-amber-300"
                        />
                        {selectedManagers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1.5">
                            {selectedManagers.map((mId) => {
                              const u = users.find((usr) => usr.id === mId);
                              return (
                                <Badge key={mId} variant="outline" className="h-6 flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-lg border-amber-200/50 bg-amber-50/30 text-amber-900 text-[10px] font-semibold">
                                  <div className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[8px] font-black uppercase">
                                    {u?.name ? u.name[0] : 'U'}
                                  </div>
                                  {u?.name || 'User'}
                                  <button type="button" onClick={() => setSelectedManagers(prev => prev.filter(x => x !== mId))} className="text-amber-500 hover:text-red-500 ml-1 font-bold">×</button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Supervisors Select */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                            <ShieldAlert size={12} className="text-blue-500" />
                            Campaign Supervisors
                          </label>
                          <span className="text-[9px] text-muted-foreground">On-the-floor queue leads</span>
                        </div>
                        <UserSelectPopover
                          title="Supervisors"
                          users={users}
                          selectedIds={selectedSupervisors}
                          onChange={setSelectedSupervisors}
                          placeholder="Select team supervisors..."
                          icon={<ShieldAlert size={13} className="text-blue-500" />}
                          activeColor="bg-blue-100 text-blue-800 border-blue-300"
                        />
                        {selectedSupervisors.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1.5">
                            {selectedSupervisors.map((sId) => {
                              const u = users.find((usr) => usr.id === sId);
                              return (
                                <Badge key={sId} variant="outline" className="h-6 flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-lg border-blue-200/50 bg-blue-50/30 text-blue-900 text-[10px] font-semibold">
                                  <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[8px] font-black uppercase">
                                    {u?.name ? u.name[0] : 'U'}
                                  </div>
                                  {u?.name || 'User'}
                                  <button type="button" onClick={() => setSelectedSupervisors(prev => prev.filter(x => x !== sId))} className="text-blue-500 hover:text-red-500 ml-1 font-bold">×</button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Dialer Agents Select */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                            <PhoneCall size={12} className="text-emerald-500" />
                            Assigned Dialer Agents
                          </label>
                          <span className="text-[9px] text-muted-foreground">Active outbound callers</span>
                        </div>
                        <UserSelectPopover
                          title="Dialer Agents"
                          users={users}
                          selectedIds={selectedAgents}
                          onChange={setSelectedAgents}
                          placeholder="Select queue callers..."
                          icon={<PhoneCall size={13} className="text-emerald-500" />}
                          activeColor="bg-emerald-100 text-emerald-800 border-emerald-300"
                        />
                        {selectedAgents.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1.5">
                            {selectedAgents.map((aId) => {
                              const u = users.find((usr) => usr.id === aId);
                              return (
                                <Badge key={aId} variant="outline" className="h-6 flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-lg border-emerald-200/50 bg-emerald-50/30 text-emerald-950 text-[10px] font-semibold">
                                  <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[8px] font-black uppercase">
                                    {u?.name ? u.name[0] : 'U'}
                                  </div>
                                  {u?.name || 'User'}
                                  <button type="button" onClick={() => setSelectedAgents(prev => prev.filter(x => x !== aId))} className="text-emerald-500 hover:text-red-500 ml-1 font-bold">×</button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* STEP 3 CONTENT: INGESTION & DISTRIBUTION RULES */}
                  <TabsContent value="routing" className="space-y-4 pt-1 animate-in fade-in duration-200">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        <Shuffle size={15} className="text-slate-500" />
                        Queue Routing & Lead Distribution Mode
                      </h3>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        Control how new leads are funneled into agent dialers and prevent caller idleness.
                      </p>
                    </div>

                    <div className="space-y-5">
                      {/* Distribution Mode Cards */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest block">Lead Distribution Mode</label>
                        <div className="grid grid-cols-3 gap-3">
                          {/* On Demand */}
                          <button
                            type="button"
                            onClick={() => setDistribution('on_demand')}
                            className={cn(
                              "border rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer h-24 hover:bg-slate-50/40 hover:shadow-xs",
                              distribution === 'on_demand' 
                                ? "border-slate-800 ring-1 ring-slate-800 bg-slate-50/50 text-foreground font-bold shadow-xs" 
                                : "border-border text-muted-foreground"
                            )}
                          >
                            <Users size={16} className={cn("transition-colors", distribution === 'on_demand' ? "text-slate-800" : "text-slate-400")} />
                            <div className="space-y-0.5">
                              <span className="text-[11px] block font-semibold text-slate-850">On-Demand</span>
                              <span className="text-[9px] block text-muted-foreground scale-95 font-medium leading-none">Manual Pull</span>
                            </div>
                          </button>

                          {/* Round Robin */}
                          <button
                            type="button"
                            onClick={() => setDistribution('round_robin')}
                            className={cn(
                              "border rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer h-24 hover:bg-slate-50/40 hover:shadow-xs",
                              distribution === 'round_robin' 
                                ? "border-teal-600 ring-1 ring-teal-600 bg-teal-50/5 text-teal-950 font-bold shadow-xs" 
                                : "border-border text-muted-foreground"
                            )}
                          >
                            <Shuffle size={16} className={cn("transition-colors", distribution === 'round_robin' ? "text-teal-600 animate-spin-slow" : "text-slate-400")} />
                            <div className="space-y-0.5">
                              <span className="text-[11px] block font-semibold text-slate-850">Round-Robin</span>
                              <span className="text-[9px] block text-muted-foreground scale-95 font-medium leading-none">Auto-Assign</span>
                            </div>
                          </button>

                          {/* Conditional */}
                          <button
                            type="button"
                            onClick={() => setDistribution('conditional')}
                            className={cn(
                              "border rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer h-24 hover:bg-slate-50/40 hover:shadow-xs",
                              distribution === 'conditional' 
                                ? "border-indigo-600 ring-1 ring-indigo-600 bg-indigo-50/5 text-indigo-950 font-bold shadow-xs" 
                                : "border-border text-muted-foreground"
                            )}
                          >
                            <Sliders size={16} className={cn("transition-colors", distribution === 'conditional' ? "text-indigo-600" : "text-slate-400")} />
                            <div className="space-y-0.5">
                              <span className="text-[11px] block font-semibold text-slate-850">Conditional</span>
                              <span className="text-[9px] block text-muted-foreground scale-95 font-medium leading-none">Skill-Based</span>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Campaign Priority Selector Cards */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest block">Campaign Call Priority</label>
                        <div className="grid grid-cols-3 gap-3">
                          {/* Low */}
                          <button
                            type="button"
                            onClick={() => setPriority('low')}
                            className={cn(
                              "border rounded-xl px-2 py-2 flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer hover:bg-slate-50/50",
                              priority === 'low' 
                                ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50/10 text-blue-900 font-semibold" 
                                : "border-border text-muted-foreground"
                            )}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Low Queue
                          </button>

                          {/* Medium */}
                          <button
                            type="button"
                            onClick={() => setPriority('medium')}
                            className={cn(
                              "border rounded-xl px-2 py-2 flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer hover:bg-slate-50/50",
                              priority === 'medium' 
                                ? "border-amber-500 ring-1 ring-amber-500 bg-amber-50/10 text-amber-900 font-semibold" 
                                : "border-border text-muted-foreground"
                            )}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Medium
                          </button>

                          {/* High */}
                          <button
                            type="button"
                            onClick={() => setPriority('high')}
                            className={cn(
                              "border rounded-xl px-2 py-2 flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer hover:bg-slate-50/50",
                              priority === 'high' 
                                ? "border-rose-500 ring-1 ring-rose-500 bg-rose-50/10 text-rose-950 font-semibold shadow-xs" 
                                : "border-border text-muted-foreground"
                            )}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            High Priority
                          </button>
                        </div>
                      </div>

                      {/* Dynamic Ingress Spillover Switch Card */}
                      <div className={cn(
                        "flex items-start gap-4 p-4 border rounded-xl transition-all duration-300",
                        allowSpillover 
                          ? "border-teal-200 bg-teal-50/5/30 shadow-xs" 
                          : "border-border bg-slate-50/10"
                      )}>
                        <Switch
                          id="allow-spillover"
                          checked={allowSpillover}
                          onCheckedChange={setAllowSpillover}
                          className="mt-0.5"
                        />
                        <div className="space-y-1.5 cursor-pointer select-none" onClick={() => setAllowSpillover(!allowSpillover)}>
                          <label htmlFor="allow-spillover" className="text-xs font-bold text-slate-800 uppercase tracking-widest cursor-pointer flex items-center gap-1.5">
                            Cross-Campaign Spillover
                            {allowSpillover && (
                              <Badge variant="outline" className="text-[9px] font-bold bg-teal-50 text-teal-700 border-teal-200 py-0 px-1 rounded">
                                ACTIVE 🌀
                              </Badge>
                            )}
                          </label>
                          <p className="text-[10px] text-muted-foreground leading-normal font-medium">
                            Allows idle callers in this campaign to automatically retrieve inbound leads from other campaigns sharing the same pipeline, preventing dialer caller downtime.
                          </p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* STEP 4 CONTENT: DATA INTEGRITY & DEDUPLICATION */}
                  <TabsContent value="dupes" className="space-y-4 pt-1 animate-in fade-in duration-200">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck size={15} className="text-slate-500" />
                        Protection Safeguards & Lead Deduplication
                      </h3>
                      <p className="text-[11px] text-muted-foreground leading-normal font-medium">
                        Prevent redundant client records and resolve inbound duplicate contacts.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Duplicate Checking Scope */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest block">Duplicate Checking Filter</label>
                        <div className="grid grid-cols-2 gap-3">
                          {/* None */}
                          <button
                            type="button"
                            onClick={() => {
                              setDupCheckScope('none');
                              setDupResolution('ignore');
                            }}
                            className={cn(
                              "border rounded-xl p-3 flex flex-col items-start gap-1 text-left transition-all cursor-pointer hover:bg-slate-50/50",
                              dupCheckScope === 'none' 
                                ? "border-slate-800 ring-1 ring-slate-800 bg-slate-50/20 font-bold" 
                                : "border-border text-muted-foreground"
                            )}
                          >
                            <AlertCircle size={15} className={cn("mb-1", dupCheckScope === 'none' ? "text-slate-800" : "text-slate-400")} />
                            <span className="text-[11px] font-semibold text-slate-850">No Filter</span>
                            <span className="text-[9px] text-muted-foreground scale-95 font-medium leading-none">Accept all incoming leads</span>
                          </button>

                          {/* Campaign */}
                          <button
                            type="button"
                            onClick={() => setDupCheckScope('campaign')}
                            className={cn(
                              "border rounded-xl p-3 flex flex-col items-start gap-1 text-left transition-all cursor-pointer hover:bg-slate-50/50",
                              dupCheckScope === 'campaign' 
                                ? "border-slate-800 ring-1 ring-slate-800 bg-slate-50/20 font-bold" 
                                : "border-border text-muted-foreground"
                            )}
                          >
                            <Target size={15} className={cn("mb-1", dupCheckScope === 'campaign' ? "text-slate-800" : "text-slate-400")} />
                            <span className="text-[11px] font-semibold text-slate-850">Within Campaign</span>
                            <span className="text-[9px] text-muted-foreground scale-95 font-medium leading-none">Discard if phone exists here</span>
                          </button>

                          {/* Pipeline */}
                          <button
                            type="button"
                            onClick={() => setDupCheckScope('pipeline')}
                            className={cn(
                              "border rounded-xl p-3 flex flex-col items-start gap-1 text-left transition-all cursor-pointer hover:bg-slate-50/50",
                              dupCheckScope === 'pipeline' 
                                ? "border-slate-800 ring-1 ring-slate-800 bg-slate-50/20 font-bold" 
                                : "border-border text-muted-foreground"
                            )}
                          >
                            <Layers size={15} className={cn("mb-1", dupCheckScope === 'pipeline' ? "text-slate-800" : "text-slate-400")} />
                            <span className="text-[11px] font-semibold text-slate-850">Within Pipeline</span>
                            <span className="text-[9px] text-muted-foreground scale-95 font-medium leading-none">Checks active pipeline</span>
                          </button>

                          {/* Global */}
                          <button
                            type="button"
                            onClick={() => setDupCheckScope('global')}
                            className={cn(
                              "border rounded-xl p-3 flex flex-col items-start gap-1 text-left transition-all cursor-pointer hover:bg-slate-50/50",
                              dupCheckScope === 'global' 
                                ? "border-rose-600 ring-1 ring-rose-600 bg-rose-50/5 font-bold" 
                                : "border-border text-muted-foreground"
                            )}
                          >
                            <ShieldCheck size={15} className={cn("mb-1", dupCheckScope === 'global' ? "text-rose-600" : "text-slate-400")} />
                            <span className="text-[11px] font-semibold text-slate-850">Global Scoping</span>
                            <span className="text-[9px] text-muted-foreground scale-95 font-medium leading-none">Checks across all campaigns</span>
                          </button>
                        </div>
                      </div>

                      {/* Duplicate Resolution Selection */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                          Duplicate Ingress Resolution
                        </label>
                        <select
                          value={dupResolution}
                          onChange={(e) => setDupResolution(e.target.value as any)}
                          disabled={dupCheckScope === 'none'}
                          className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-medium text-foreground disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                        >
                          <option value="ignore">Ignore duplicate (Discard completely)</option>
                          <option value="merge">Merge duplicates (Consolidate caller details)</option>
                          <option value="create_new">Create duplicate ticket (Forces new record)</option>
                          <option value="reopen">Merge & Re-Open closed lead items</option>
                        </select>
                      </div>
                    </div>
                  </TabsContent>
                </div>

              </Tabs>

              {/* Wizard Navigational Footer */}
              <div className="flex items-center justify-between border-t border-border pt-4 mt-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevStep}
                  disabled={activeTab === 'basics'}
                  className="h-9 px-4 text-xs font-semibold border-border bg-card hover:bg-slate-50 text-slate-700 rounded-xl transition-all disabled:opacity-50"
                >
                  Back
                </Button>

                {activeTab !== 'dupes' ? (
                  <Button
                    type="button"
                    onClick={handleNextStep}
                    className="h-9 px-4 text-xs font-semibold bg-primary hover:bg-[#1e293b] text-white rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.01]"
                  >
                    Continue
                    <ArrowRight size={13} />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={createMutation.isPending}
                    className="h-9 px-4 text-xs font-semibold bg-primary hover:bg-[#1e293b] text-white rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.01]"
                  >
                    {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Launch Outbound Campaign
                  </Button>
                )}
              </div>

            </div>

            {/* --- RIGHT PANEL: Live "Visual Flow" Preview Canvas --- */}
            <div className="lg:col-span-5 flex flex-col h-full bg-slate-50/40 p-5 min-h-[500px] overflow-hidden select-none flex-grow">
              
              <div className="pb-3 border-b border-border mb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live "Visual Flow" Preview
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Progressive coordinate highlights matching config tabs.</p>
                </div>
                <Badge variant="outline" className="text-[9px] bg-white text-slate-600 py-0.5 px-2 border-border font-bold">
                  SIMULATOR 👁️
                </Badge>
              </div>

              {/* Blueprint Dot Grid Canvas */}
              <div className="relative flex-1 bg-background border border-border rounded-xl p-4 flex flex-col items-center justify-between min-h-[460px] bg-[#fafafa] bg-[radial-gradient(#e2e8f0_1.2px,transparent_1.2px)] [background-size:14px_14px] shadow-inner">
                
                {/* SVG Style sheet inside */}
                <style>{`
                  @keyframes lead-flow-dash {
                    to {
                      stroke-dashoffset: -20;
                    }
                  }
                  .lead-flow-line {
                    stroke-dasharray: 6, 4;
                    animation: lead-flow-dash 1s linear infinite;
                  }
                  .animate-pulse-glow {
                    animation: pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                  }
                  @keyframes pulse-glow {
                    0%, 100% {
                      box-shadow: 0 0 0 0px rgba(59, 130, 246, 0.4);
                    }
                    50% {
                      box-shadow: 0 0 12px 4px rgba(59, 130, 246, 0.2);
                    }
                  }
                `}</style>

                {/* Node 1: Inbound Lead Source (Highlighted on 'basics' step) */}
                <div className={cn(
                  "w-full max-w-[210px] bg-card border rounded-xl p-2.5 shadow-sm text-center flex flex-col items-center justify-center relative z-10 transition-all duration-300",
                  activeTab === 'basics' 
                    ? "border-primary ring-2 ring-primary/20 scale-[1.03] shadow-md bg-white animate-pulse-glow" 
                    : "border-border opacity-90"
                )}>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Campaign Source</span>
                  <div className="flex items-center gap-1 justify-center max-w-full">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {name.trim() ? `${name.trim()} Ingest 📥` : 'Campaign Ingestion 📥'}
                    </p>
                  </div>
                </div>

                {/* Dynamic Spillover Ingress Label (Left-aligned) */}
                {allowSpillover && (
                  <div className={cn(
                    "absolute left-3 top-[170px] z-10 bg-teal-50 text-teal-800 border px-2 py-1.5 rounded-xl text-[9px] font-bold shadow-xs transition-all duration-300 max-w-[110px] text-left",
                    activeTab === 'routing' ? "border-teal-400 scale-[1.03] ring-1 ring-teal-200" : "border-teal-200"
                  )}>
                    <span className="flex h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse mb-0.5 inline-block mr-1" />
                    <strong>Spillover 🌀</strong> Inbound backlog shared from pipeline.
                  </div>
                )}

                {/* Flow Lines & SVG Layer */}
                <div className="absolute inset-0 z-0 pointer-events-none">
                  <svg viewBox="0 0 350 480" width="100%" height="100%" className="w-full h-full text-slate-350" fill="none">
                    
                    {/* Path 1: Source to Duplicity Check (or Splitter) */}
                    {dupCheckScope !== 'none' ? (
                      <>
                        {/* Source (x: 175, y: 52) -> Duplicity (x: 175, y: 155) */}
                        <path d="M 175 52 L 175 145" stroke={activeTab === 'basics' ? '#3b82f6' : '#cbd5e1'} strokeWidth="2" className="lead-flow-line" />
                        
                        {/* Duplicity (x: 175, y: 200) -> Splitter (x: 175, y: 280) */}
                        <path d="M 175 198 L 175 272" stroke={activeTab === 'dupes' ? '#ef4444' : '#cbd5e1'} strokeWidth="2" className="lead-flow-line" />
                        
                        {/* Duplicate Blocked Path branching off to Left (x: 60, y: 170) */}
                        <path d="M 175 170 C 130 170, 90 170, 70 170" stroke="#f87171" strokeWidth="2.2" strokeDasharray="4,4" className="text-red-400" />
                      </>
                    ) : (
                      /* Direct Source to Splitter (x: 175, y: 280) */
                      <path d="M 175 52 L 175 272" stroke={activeTab === 'basics' ? '#3b82f6' : '#cbd5e1'} strokeWidth="2" className="lead-flow-line" />
                    )}

                    {/* Path 2: Cross-Campaign Spillover Source (x: 50, y: 215) -> Splitter (x: 175, y: 295) */}
                    {allowSpillover && (
                      <path
                        d="M 50 215 C 50 295, 120 295, 175 295"
                        stroke={activeTab === 'routing' ? '#0d9488' : '#cbd5e1'}
                        strokeWidth="2"
                        strokeDasharray="6,4"
                        className="lead-flow-line"
                      />
                    )}

                    {/* Path 3: Splitter to Agents (Multiple branches) */}
                    {selectedAgents.length > 0 ? (
                      selectedAgents.slice(0, 3).map((_, idx) => {
                        const startX = 175;
                        const startY = 320;
                        const endY = 412;
                        let endX = 175;
                        const total = selectedAgents.slice(0, 3).length;
                        if (total === 2) {
                          endX = idx === 0 ? 100 : 250;
                        } else if (total === 3) {
                          endX = idx === 0 ? 70 : idx === 1 ? 175 : 280;
                        }
                        
                        const controlY = startY + 40;
                        return (
                          <path
                            key={idx}
                            d={`M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`}
                            stroke={activeTab === 'agents' ? '#10b981' : (distribution === 'round_robin' ? '#14b8a6' : '#6366f1')}
                            strokeWidth="2.2"
                            className="lead-flow-line"
                          />
                        );
                      })
                    ) : (
                      /* Splitter to Generic Agent Pool */
                      <path d="M 175 320 L 175 412" stroke={activeTab === 'agents' ? '#10b981' : '#cbd5e1'} strokeWidth="2" className="lead-flow-line" />
                    )}
                  </svg>
                </div>

                {/* Node 2: Deduplication Filter (Conditionally Rendered) (Highlighted on 'dupes' step) */}
                {dupCheckScope !== 'none' ? (
                  <div className={cn(
                    "relative w-full max-w-[210px] flex items-center justify-center relative z-10 transition-all duration-300",
                    activeTab === 'dupes' 
                      ? "border-red-500 ring-2 ring-red-500/20 scale-[1.03] shadow-md bg-white animate-pulse-glow" 
                      : "border-border opacity-90"
                  )}>
                    {/* Blocked branch tag */}
                    <div className="absolute right-[102%] top-1/2 -translate-y-1/2 bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase select-none tracking-widest shadow-xs">
                      {dupResolution === 'ignore' ? 'Discard 🚫' :
                       dupResolution === 'merge' ? 'Merge 🤝' :
                       dupResolution === 'reopen' ? 'Reopen 🔄' : 'Duplicate 📋'}
                    </div>

                    <div className="w-full bg-card border border-border rounded-xl p-2.5 shadow-sm text-center relative z-10">
                      <span className="text-[8px] font-bold text-red-500/80 uppercase tracking-widest block">🛡️ Duplicity Filter</span>
                      <p className="text-[10px] font-bold text-slate-800 mt-0.5 capitalize truncate">
                        {dupCheckScope === 'campaign' ? 'Within Campaign' :
                         dupCheckScope === 'pipeline' ? 'Within Pipeline' : 'Across System'}
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Node 3: Lead Distribution Splitter (Highlighted on 'routing' step) */}
                <div className={cn(
                  "w-full max-w-[210px] bg-card border rounded-xl p-2.5 shadow-sm text-center relative z-10 transition-all duration-300",
                  activeTab === 'routing' 
                    ? "border-teal-500 ring-2 ring-teal-500/20 scale-[1.03] shadow-md bg-white animate-pulse-glow" 
                    : "border-border opacity-90"
                )}>
                  <span className="text-[8px] font-bold text-teal-600 uppercase tracking-widest block">{selectedPipelineName}</span>
                  <p className="text-xs font-bold text-slate-850 truncate max-w-full">
                    {distribution === 'round_robin' ? 'Round-Robin Auto 🔄' :
                     distribution === 'conditional' ? 'Conditional Routing 🔀' : 'On-Demand Pool 📥'}
                  </p>
                </div>

                {/* Node 4: Agent Pool / Assigned Callers (Highlighted on 'agents' step) */}
                <div className={cn(
                  "w-full flex justify-center gap-4 relative z-10 transition-all duration-300 p-2 rounded-2xl",
                  activeTab === 'agents' 
                    ? "scale-[1.03] bg-emerald-50/5 shadow-xs border border-dashed border-emerald-300 ring-2 ring-emerald-500/10" 
                    : ""
                )}>
                  {selectedAgents.length > 0 ? (
                    selectedAgents.slice(0, 3).map((aId) => {
                      const u = users.find((usr) => usr.id === aId);
                      const initial = u?.name ? u.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : 'A';
                      return (
                        <div key={aId} className="flex flex-col items-center text-center max-w-[80px]">
                          <div className={cn(
                            "w-9 h-9 rounded-full border shadow-xs flex items-center justify-center text-xs font-extrabold relative transition-colors",
                            activeTab === 'agents' ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-teal-50 border-teal-200 text-teal-700"
                          )}>
                            {initial}
                            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 border-2 border-white" />
                          </div>
                          <span className="text-[9px] font-bold text-slate-700 truncate w-full mt-1.5">{u?.name || 'Agent'}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="w-full max-w-[210px] bg-card border border-border rounded-xl p-2.5 shadow-sm text-center">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Receiver</span>
                      <p className="text-xs font-bold text-slate-800 truncate max-w-full">General Caller Pool 👥</p>
                    </div>
                  )}
                  {selectedAgents.length > 3 && (
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-500 text-xs font-bold shadow-xs">
                        +{selectedAgents.length - 3}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 mt-1.5">More</span>
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
