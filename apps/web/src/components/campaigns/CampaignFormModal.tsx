import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Loader2, Sparkles, Settings2, ChevronDown, Target, Users, 
  PhoneCall, Crown, ShieldAlert, Check, Search, ArrowRight, Shuffle, 
  Sliders, ShieldCheck, AlertCircle, X, Layers, Plus, Calendar, 
  IndianRupee, Tag, Compass, Building2, GitFork, RefreshCw, HelpCircle
} from 'lucide-react';
import { settingsApi } from '@/api/settings';
import { campaignsApi } from '@/api/campaigns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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

// Searchable User Selection Popover Component
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
    return users.filter(u => 
      (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase())
    );
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
          className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-border rounded-xl bg-background hover:bg-muted/40 transition-colors text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
        >
          <div className="flex items-center gap-2 text-muted-foreground truncate">
            {icon}
            <span className="text-xs font-semibold text-foreground">
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
            placeholder={`Search ${title.toLowerCase()} by name or email...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border-none text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 py-1"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="hover:bg-muted p-0.5 rounded text-muted-foreground">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((u) => {
              const isSelected = selectedIds.includes(u.id);
              const initials = (u.name || 'User').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleUser(u.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2.5 px-2 py-1.5 rounded-lg text-left text-xs transition-colors hover:bg-muted/60",
                    isSelected && "bg-muted font-semibold"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 border border-border shadow-xs",
                      isSelected ? activeColor : "bg-muted text-muted-foreground"
                    )}>
                      {initials}
                    </div>
                    <div className="truncate flex flex-col">
                      <span className="truncate text-foreground text-xs">{u.name}</span>
                      {u.email && <span className="truncate text-[10px] text-muted-foreground">{u.email}</span>}
                    </div>
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

const DEFAULT_CAMPAIGN_TYPES = [
  'Digital Ads',
  'Telecalling Outbound',
  'Website Inbound',
  'Referral Program',
  'Walk-in / Offline',
  'Event / Workshop',
  'Direct Inbound',
];

const MARKETING_CHANNELS = [
  { value: 'Website', label: 'Website' },
  { value: 'Google Ads', label: 'Google Ads' },
  { value: 'Meta Ads', label: 'Meta Ads' },
  { value: 'Justdial', label: 'Justdial' },
  { value: 'Shiksha', label: 'Shiksha' },
  { value: 'Walk-in', label: 'Walk-in' },
  { value: 'Direct', label: 'Direct' },
  { value: 'Referral', label: 'Referral' },
  { value: 'SMS Campaign', label: 'SMS Campaign' },
  { value: 'Email Campaign', label: 'Email Campaign' },
  { value: 'Other', label: 'Other' },
];

export function CampaignFormModal({ isOpen, onClose, onSuccess }: CampaignFormModalProps) {
  const queryClient = useQueryClient();

  // Wizard active tab
  const [activeTab, setActiveTab] = useState<'setup' | 'distribution' | 'governance'>('setup');

  // Form State - 1. Cascaded Hierarchy & Identity
  const [branchId, setBranchId] = useState('');
  const [verticalId, setVerticalId] = useState('');
  const [pipelineId, setPipelineId] = useState('');
  const [name, setName] = useState('');
  const [campaignType, setCampaignType] = useState('Digital Ads');
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [channel, setChannel] = useState('Website');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [spend, setSpend] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [status, setStatus] = useState<'active' | 'draft' | 'paused'>('active');

  // Form State - 2. Lead Distribution Engine
  const [distribution, setDistribution] = useState<'on_demand' | 'equal' | 'conditional'>('on_demand');
  const [leadsPerHandout, setLeadsPerHandout] = useState('10');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);

  // Form State - 3. Governance, Priority & Deduplication
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dupCheckScope, setDupCheckScope] = useState<'none' | 'campaign' | 'branch' | 'tenant'>('campaign');
  const [dupResolution, setDupResolution] = useState<'ignore' | 'update' | 'reopen'>('ignore');
  const [allowSpillover, setAllowSpillover] = useState(false);

  // Inline Quick Add Modals
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('');
  const [isSubmittingBranch, setIsSubmittingBranch] = useState(false);

  const [isAddVerticalOpen, setIsAddVerticalOpen] = useState(false);
  const [newVerticalName, setNewVerticalName] = useState('');
  const [isSubmittingVertical, setIsSubmittingVertical] = useState(false);

  const [isAddMasterTypeOpen, setIsAddMasterTypeOpen] = useState(false);
  const [newMasterTypeName, setNewMasterTypeName] = useState('');

  const [isAddPipelineOpen, setIsAddPipelineOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [isSubmittingPipeline, setIsSubmittingPipeline] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // 1. Fetch branches
  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list(),
    enabled: isOpen,
    staleTime: 30_000,
  });

  // 2. Fetch verticals
  const { data: verticalsData = [], isLoading: verticalsLoading } = useQuery({
    queryKey: ['settings', 'verticals'],
    queryFn: () => settingsApi.verticals.list(),
    enabled: isOpen,
    staleTime: 30_000,
  });

  // Filter verticals strictly by selected branch (supports both branch_id and camelCase branchId)
  const activeBranchId = branchId || (branches.length === 1 && branches[0] ? branches[0].id : '');
  const filteredVerticals = useMemo(() => {
    if (!activeBranchId) return [];
    return verticalsData.filter((v: any) => v.branch_id === activeBranchId || v.branchId === activeBranchId);
  }, [verticalsData, activeBranchId]);

  // 3. Fetch pipelines filtered strictly by selected vertical
  const { data: pipelines = [], isLoading: pipelinesLoading } = useQuery({
    queryKey: ['settings', 'pipelines', verticalId],
    queryFn: () => settingsApi.pipelines.list(verticalId ? { vertical_id: verticalId } : {}),
    enabled: isOpen && !!verticalId,
    staleTime: 30_000,
  });

  // 4. Fetch users for agents & managers
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['settings', 'users-all'],
    queryFn: () => settingsApi.users.list(),
    enabled: isOpen,
    staleTime: 30_000,
  });

  // 1. Auto-select branch if available and none selected
  useEffect(() => {
    if (isOpen && branches.length > 0 && branches[0]) {
      if (!branchId || !branches.some(b => b.id === branchId)) {
        setBranchId(branches[0].id);
      }
    }
  }, [isOpen, branches, branchId]);

  // 2. Auto-select vertical when branch changes or verticals load
  useEffect(() => {
    if (isOpen && filteredVerticals.length > 0 && filteredVerticals[0]) {
      if (!verticalId || !filteredVerticals.some(v => v.id === verticalId)) {
        setVerticalId(filteredVerticals[0].id);
      }
    } else if (isOpen && filteredVerticals.length === 0) {
      setVerticalId('');
    }
  }, [isOpen, filteredVerticals, verticalId]);

  // 3. Auto-select pipeline when vertical changes or pipelines load
  useEffect(() => {
    if (isOpen && pipelines.length > 0 && pipelines[0]) {
      if (!pipelineId || !pipelines.some(p => p.id === pipelineId)) {
        setPipelineId(pipelines[0].id);
      }
    } else if (isOpen && pipelines.length === 0) {
      setPipelineId('');
    }
  }, [isOpen, pipelines, pipelineId]);

  // Reset vertical and pipeline when branch changes
  const handleBranchChange = (newId: string) => {
    setBranchId(newId);
    setVerticalId('');
    setPipelineId('');
    if (errors.branchId) setErrors(prev => ({ ...prev, branchId: '' }));
  };

  // Reset pipeline when vertical changes
  const handleVerticalChange = (newId: string) => {
    setVerticalId(newId);
    setPipelineId('');
    if (errors.verticalId) setErrors(prev => ({ ...prev, verticalId: '' }));
  };

  // Reset form upon close/re-open
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setBranchId('');
      setVerticalId('');
      setPipelineId('');
      setCampaignType('Digital Ads');
      setChannel('Website');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setSpend('');
      setUtmCampaign('');
      setStatus('active');
      setDistribution('on_demand');
      setLeadsPerHandout('10');
      setSelectedAgents([]);
      setSelectedManagers([]);
      setPriority('medium');
      setDupCheckScope('campaign');
      setDupResolution('ignore');
      setAllowSpillover(false);
      setActiveTab('setup');
      setErrors({});
    }
  }, [isOpen]);

  // Quick Branch Creation
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    try {
      setIsSubmittingBranch(true);
      const created = await settingsApi.branches.create({
        name: newBranchName.trim(),
        city: newBranchCity.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'branches'] });
      setBranchId(created.id);
      setVerticalId('');
      setPipelineId('');
      setIsAddBranchOpen(false);
      setNewBranchName('');
      setNewBranchCity('');
      toast.success(`Branch "${created.name}" created and selected!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create branch');
    } finally {
      setIsSubmittingBranch(false);
    }
  };

  // Quick Vertical Creation
  const handleCreateVertical = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      toast.error('Please select a Branch first');
      return;
    }
    if (!newVerticalName.trim()) return;
    try {
      setIsSubmittingVertical(true);
      const created = await settingsApi.verticals.create({
        branch_id: branchId,
        name: newVerticalName.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'verticals'] });
      setVerticalId(created.id);
      setPipelineId('');
      setIsAddVerticalOpen(false);
      setNewVerticalName('');
      toast.success(`Vertical "${created.name}" created and selected!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create vertical');
    } finally {
      setIsSubmittingVertical(false);
    }
  };

  // Quick Pipeline Creation
  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      toast.error('Please select a Branch first');
      return;
    }
    if (!verticalId) {
      toast.error('Please select a Vertical first');
      return;
    }
    if (!newPipelineName.trim()) return;
    try {
      setIsSubmittingPipeline(true);
      const created = await settingsApi.pipelines.create({
        name: newPipelineName.trim(),
        vertical_id: verticalId,
      });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'pipelines'] });
      setPipelineId(created.id);
      setIsAddPipelineOpen(false);
      setNewPipelineName('');
      toast.success(`Pipeline "${created.name}" created under "${selectedVerticalName}"!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create pipeline');
    } finally {
      setIsSubmittingPipeline(false);
    }
  };

  // Quick Master Type Addition
  const handleAddMasterType = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMasterTypeName.trim();
    if (!trimmed) return;
    if (!DEFAULT_CAMPAIGN_TYPES.includes(trimmed) && !customTypes.includes(trimmed)) {
      setCustomTypes(prev => [...prev, trimmed]);
    }
    setCampaignType(trimmed);
    setNewMasterTypeName('');
    setIsAddMasterTypeOpen(false);
    toast.success(`Campaign type "${trimmed}" added!`);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => campaignsApi.create(data),
    onSuccess: (newCampaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign launched successfully!', {
        description: newCampaign.name,
      });
      onSuccess();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create campaign');
    },
  });

  const validate = (tabTarget?: 'setup' | 'all'): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!branchId) nextErrors.branchId = 'Branch is required';
    if (!verticalId) nextErrors.verticalId = 'Vertical is required';
    if (!pipelineId) nextErrors.pipelineId = 'Pipeline is required';
    if (!name.trim()) nextErrors.name = 'Campaign Name is required';
    if (!startDate) nextErrors.startDate = 'Start Date is required';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validate('all')) {
      setActiveTab('setup');
      toast.error('Please complete all required fields under Setup.');
      return;
    }

    const payload = {
      branch_id: branchId,
      vertical_id: verticalId,
      pipeline_id: pipelineId,
      name: name.trim(),
      channel,
      status,
      start_date: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
      end_date: endDate ? new Date(endDate).toISOString() : null,
      utm_campaign: utmCampaign.trim() || null,
      attributes: {
        spend: spend ? parseFloat(spend) : 0,
        campaign_type: campaignType,
        assign_rule: distribution, // 'on_demand' | 'equal' | 'conditional'
        leads_per_handout: parseInt(leadsPerHandout, 10) || 10,
        agent_ids: selectedAgents,
        manager_ids: selectedManagers,
        priority,
        duplicate_check: dupCheckScope,
        duplicate_action: dupResolution,
        allow_spillover: allowSpillover,
        // NeoDove / multi-tier compatibility
        selected_managers: selectedManagers,
        selected_agents: selectedAgents,
        distribution,
      },
    };

    createMutation.mutate(payload);
  };

  // Preview names
  const selectedBranchName = useMemo(() => {
    return branches.find(b => b.id === branchId)?.name || 'Branch';
  }, [branches, branchId]);

  const selectedVerticalName = useMemo(() => {
    return verticalsData.find(v => v.id === verticalId)?.name || 'Vertical';
  }, [verticalsData, verticalId]);

  const selectedPipelineName = useMemo(() => {
    return pipelines.find(p => p.id === pipelineId)?.name || 'Pipeline';
  }, [pipelines, pipelineId]);

  const allCampaignTypes = useMemo(() => {
    return [...DEFAULT_CAMPAIGN_TYPES, ...customTypes];
  }, [customTypes]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-6xl max-h-[95vh] overflow-y-auto p-0 bg-card border border-border shadow-2xl rounded-2xl flex flex-col">
        
        {/* Sleek Header */}
        <DialogHeader className="p-5 border-b border-border bg-slate-50/50 rounded-t-2xl flex flex-row items-center justify-between shrink-0">
          <div className="space-y-1">
            <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Sparkles size={18} className="text-primary font-extrabold" />
              New Campaign
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define target pipeline, marketing tracking, and lead distribution engine.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status:</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs cursor-pointer"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-grow divide-y lg:divide-y-0 lg:divide-x divide-border">
          
          {/* --- LEFT PANEL: Stepped Configuration Form --- */}
          <div className="lg:col-span-7 p-6 flex flex-col justify-between gap-6 min-h-[520px]">
            
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex-grow flex flex-col gap-5">
              
              {/* Horizontal Stepper Tabs */}
              <TabsList className="grid grid-cols-3 w-full bg-muted/60 p-1 rounded-xl h-10 border border-border shrink-0">
                <TabsTrigger value="setup" className="text-[11px] font-bold tracking-wide uppercase rounded-lg">
                  1. Setup & Channel
                </TabsTrigger>
                <TabsTrigger value="distribution" className="text-[11px] font-bold tracking-wide uppercase rounded-lg">
                  2. Distribution
                </TabsTrigger>
                <TabsTrigger value="governance" className="text-[11px] font-bold tracking-wide uppercase rounded-lg">
                  3. Rules & Safety
                </TabsTrigger>
              </TabsList>

              {/* Progress Indicator */}
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden -mt-2 shrink-0">
                <div 
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{
                    width: activeTab === 'setup' ? '33.3%' : activeTab === 'distribution' ? '66.6%' : '100%'
                  }}
                />
              </div>

              {/* ================= STEP 1: SETUP & CHANNEL ================= */}
              <TabsContent value="setup" className="space-y-4 pt-1 animate-in fade-in duration-200">
                
                {/* 1. Cascaded Hierarchy (Branch -> Vertical -> Pipeline) */}
                <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Compass size={13} className="text-primary" />
                      Target Hierarchy *
                    </span>
                    <span className="text-[10px] text-muted-foreground">Cascades Branch &rarr; Vertical &rarr; Pipeline</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Branch */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-foreground uppercase tracking-widest">
                          Branch <span className="text-red-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsAddBranchOpen(true)}
                          className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus size={11} />
                          Add Branch
                        </button>
                      </div>
                      <select
                        value={branchId}
                        onChange={(e) => handleBranchChange(e.target.value)}
                        className="w-full h-9 rounded-xl border border-border bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-medium text-foreground cursor-pointer shadow-xs"
                      >
                        <option value="" disabled>Select Branch...</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                      {errors.branchId && <p className="text-[10px] text-red-600 font-semibold">⚠️ {errors.branchId}</p>}
                    </div>

                    {/* Vertical (Filtered by Branch) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-foreground uppercase tracking-widest">
                          Vertical <span className="text-red-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsAddVerticalOpen(true)}
                          className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus size={11} />
                          Add Vertical
                        </button>
                      </div>
                      <select
                        value={verticalId}
                        onChange={(e) => handleVerticalChange(e.target.value)}
                        disabled={!branchId}
                        className="w-full h-9 rounded-xl border border-border bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-medium text-foreground shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <option value="" disabled>
                          {filteredVerticals.length === 0 ? 'No verticals in this branch' : 'Select Vertical...'}
                        </option>
                        {filteredVerticals.map((v: any) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                      {errors.verticalId && <p className="text-[10px] text-red-600 font-semibold">⚠️ {errors.verticalId}</p>}
                    </div>

                    {/* Pipeline */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-foreground uppercase tracking-widest">
                          Pipeline <span className="text-red-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsAddPipelineOpen(true)}
                          disabled={!verticalId}
                          className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus size={11} />
                          Add Pipeline
                        </button>
                      </div>
                      <select
                        value={pipelineId}
                        onChange={(e) => {
                          setPipelineId(e.target.value);
                          if (errors.pipelineId) setErrors(prev => ({ ...prev, pipelineId: '' }));
                        }}
                        disabled={!verticalId}
                        className="w-full h-9 rounded-xl border border-border bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-medium text-foreground shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <option value="" disabled>
                          {pipelines.length === 0 ? 'No pipelines for this vertical' : 'Select Pipeline...'}
                        </option>
                        {pipelines.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      {errors.pipelineId && <p className="text-[10px] text-red-600 font-semibold">⚠️ {errors.pipelineId}</p>}
                    </div>
                  </div>
                </div>

                {/* 2. Campaign Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-foreground uppercase tracking-widest flex items-center gap-1">
                    Campaign Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. AI & ML 2026, BCL WEB, Inbound Real Estate Dialing"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                    }}
                    className="h-10 text-sm rounded-xl"
                    required
                  />
                  {errors.name && <p className="text-[10px] text-red-600 font-semibold">⚠️ {errors.name}</p>}
                </div>

                {/* 3. Campaign Type & Marketing Channel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Campaign Type */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-foreground uppercase tracking-widest">
                        Campaign Type <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsAddMasterTypeOpen(true)}
                        className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus size={11} />
                        + Master
                      </button>
                    </div>
                    <select
                      value={campaignType}
                      onChange={(e) => setCampaignType(e.target.value)}
                      className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-medium text-foreground cursor-pointer shadow-xs"
                    >
                      {allCampaignTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* Marketing Channel */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-foreground uppercase tracking-widest">
                      Marketing Channel
                    </label>
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                      className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-medium text-foreground cursor-pointer shadow-xs"
                    >
                      {MARKETING_CHANNELS.map((ch) => (
                        <option key={ch.value} value={ch.value}>{ch.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-foreground uppercase tracking-widest flex items-center gap-1">
                      <Calendar size={12} className="text-muted-foreground" />
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-10 text-xs rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-foreground uppercase tracking-widest flex items-center gap-1">
                      <Calendar size={12} className="text-muted-foreground" />
                      End Date (Optional)
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                </div>

                {/* 5. Spend & UTM Tracking Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-foreground uppercase tracking-widest flex items-center gap-1">
                      <IndianRupee size={12} className="text-muted-foreground" />
                      Campaign Budget / Spend (₹)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-xs font-bold text-muted-foreground">₹</span>
                      <Input
                        type="number"
                        placeholder="e.g. 50000"
                        value={spend}
                        onChange={(e) => setSpend(e.target.value)}
                        className="pl-7 h-10 text-xs rounded-xl"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-foreground uppercase tracking-widest flex items-center gap-1">
                      <Tag size={12} className="text-muted-foreground" />
                      UTM / Tracking Code
                    </label>
                    <Input
                      type="text"
                      placeholder="utm_campaign code (digital only)"
                      value={utmCampaign}
                      onChange={(e) => setUtmCampaign(e.target.value)}
                      className="h-10 text-xs rounded-xl"
                    />
                    <span className="text-[9px] text-muted-foreground">Used for automated digital ingress & ROI attribution</span>
                  </div>
                </div>

              </TabsContent>

              {/* ================= STEP 2: LEAD DISTRIBUTION ENGINE ================= */}
              <TabsContent value="distribution" className="space-y-4 pt-1 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Shuffle size={15} className="text-primary" />
                    Lead Distribution Engine
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Choose how leads arriving in this campaign are allocated to agents and dialers.
                  </p>
                </div>

                {/* 3 Distribution Engine Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* On Demand */}
                  <div
                    onClick={() => setDistribution('on_demand')}
                    className={cn(
                      "p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 select-none shadow-xs",
                      distribution === 'on_demand'
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        <Users size={15} />
                      </div>
                      {distribution === 'on_demand' && <Check size={14} className="text-primary" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">On Demand</h4>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                        Leads stay unassigned until user clicks <strong>"Start Calling"</strong> — assigns 10 at a time.
                      </p>
                    </div>
                  </div>

                  {/* Equal */}
                  <div
                    onClick={() => setDistribution('equal')}
                    className={cn(
                      "p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 select-none shadow-xs",
                      distribution === 'equal'
                        ? "border-teal-600 bg-teal-50/10 ring-1 ring-teal-600 shadow-sm"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                        <Shuffle size={15} />
                      </div>
                      {distribution === 'equal' && <Check size={14} className="text-teal-600" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Equal</h4>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                        Distributes leads equally among assigned agents in automated <strong>round-robin</strong> order.
                      </p>
                    </div>
                  </div>

                  {/* Conditional */}
                  <div
                    onClick={() => setDistribution('conditional')}
                    className={cn(
                      "p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 select-none shadow-xs",
                      distribution === 'conditional'
                        ? "border-amber-600 bg-amber-50/10 ring-1 ring-amber-600 shadow-sm"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Sliders size={15} />
                      </div>
                      {distribution === 'conditional' && <Check size={14} className="text-amber-600" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Conditional</h4>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                        Assigns leads dynamically based on rep availability, languages, and custom conditions.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Leads per hand-out */}
                <div className="bg-muted/30 border border-border rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <PhoneCall size={13} className="text-primary" />
                        Leads per hand-out
                      </label>
                      <p className="text-[10px] text-muted-foreground">
                        Batch size handed out to an agent upon clicking Start Calling or requesting leads.
                      </p>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={leadsPerHandout}
                        onChange={(e) => setLeadsPerHandout(e.target.value)}
                        className="h-8 text-xs font-bold text-center rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {/* Agents Multi-Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-foreground uppercase tracking-widest flex items-center gap-1">
                      <Users size={12} className="text-teal-600" />
                      Assigned Calling Agents (Optional)
                    </label>
                    <span className="text-[10px] text-muted-foreground">Search by name/email</span>
                  </div>
                  <UserSelectPopover
                    title="Agents"
                    users={users}
                    selectedIds={selectedAgents}
                    onChange={setSelectedAgents}
                    placeholder="Search and select agents for this campaign..."
                    icon={<Users size={13} className="text-teal-600" />}
                    activeColor="bg-teal-100 text-teal-800 border-teal-300"
                  />
                  {selectedAgents.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedAgents.map((aId) => {
                        const u = users.find(usr => usr.id === aId);
                        return (
                          <Badge key={aId} variant="outline" className="h-6 flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-lg border-teal-200 bg-teal-50/50 text-teal-950 text-[10px] font-semibold">
                            <div className="w-4 h-4 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[8px] font-black uppercase">
                              {(u?.name || 'U')[0]}
                            </div>
                            {u?.name || 'User'}
                            <button 
                              type="button" 
                              onClick={() => setSelectedAgents(prev => prev.filter(x => x !== aId))}
                              className="text-teal-600 hover:text-red-500 ml-1 font-bold"
                            >
                              ×
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Campaign Managers */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-foreground uppercase tracking-widest flex items-center gap-1">
                      <Crown size={12} className="text-amber-500" />
                      Campaign Managers
                    </label>
                    <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      View & manage only — NOT auto-assigned leads
                    </span>
                  </div>
                  <UserSelectPopover
                    title="Managers"
                    users={users}
                    selectedIds={selectedManagers}
                    onChange={setSelectedManagers}
                    placeholder="Select who manages this campaign..."
                    icon={<Crown size={13} className="text-amber-500" />}
                    activeColor="bg-amber-100 text-amber-800 border-amber-300"
                  />
                  {selectedManagers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedManagers.map((mId) => {
                        const u = users.find(usr => usr.id === mId);
                        return (
                          <Badge key={mId} variant="outline" className="h-6 flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-lg border-amber-200 bg-amber-50/50 text-amber-900 text-[10px] font-semibold">
                            <div className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[8px] font-black uppercase">
                              {(u?.name || 'M')[0]}
                            </div>
                            {u?.name || 'User'}
                            <button 
                              type="button" 
                              onClick={() => setSelectedManagers(prev => prev.filter(x => x !== mId))}
                              className="text-amber-600 hover:text-red-500 ml-1 font-bold"
                            >
                              ×
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

              </TabsContent>

              {/* ================= STEP 3: RULES & SAFETY ================= */}
              <TabsContent value="governance" className="space-y-4 pt-1 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck size={15} className="text-primary" />
                    Operational Priority & Deduplication
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Configure dialer priority and data hygiene rules when inbound records repeat.
                  </p>
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-foreground uppercase tracking-widest block">
                    Campaign Priority
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setPriority('low')}
                      className={cn(
                        "border rounded-xl px-3 py-2.5 flex items-center justify-center gap-1.5 transition-all text-xs font-semibold cursor-pointer shadow-xs",
                        priority === 'low'
                          ? "border-blue-500 bg-blue-50/20 text-blue-900 ring-1 ring-blue-500"
                          : "border-border text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Low
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriority('medium')}
                      className={cn(
                        "border rounded-xl px-3 py-2.5 flex items-center justify-center gap-1.5 transition-all text-xs font-semibold cursor-pointer shadow-xs",
                        priority === 'medium'
                          ? "border-amber-500 bg-amber-50/20 text-amber-900 ring-1 ring-amber-500"
                          : "border-border text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Medium (Default)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriority('high')}
                      className={cn(
                        "border rounded-xl px-3 py-2.5 flex items-center justify-center gap-1.5 transition-all text-xs font-semibold cursor-pointer shadow-xs",
                        priority === 'high'
                          ? "border-rose-500 bg-rose-50/20 text-rose-950 ring-1 ring-rose-500 shadow-sm"
                          : "border-border text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      High Priority
                    </button>
                  </div>
                </div>

                {/* Check for Duplicates */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-foreground uppercase tracking-widest block">
                    Check for Duplicates
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setDupCheckScope('campaign')}
                      className={cn(
                        "border rounded-xl p-3 flex flex-col items-start gap-1 text-left transition-all cursor-pointer shadow-xs",
                        dupCheckScope === 'campaign'
                          ? "border-primary bg-primary/5 ring-1 ring-primary font-bold"
                          : "border-border text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      <span className="text-xs font-semibold text-foreground">Within This Campaign</span>
                      <span className="text-[10px] text-muted-foreground">Only flags duplicates within this specific campaign</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDupCheckScope('branch')}
                      className={cn(
                        "border rounded-xl p-3 flex flex-col items-start gap-1 text-left transition-all cursor-pointer shadow-xs",
                        dupCheckScope === 'branch'
                          ? "border-primary bg-primary/5 ring-1 ring-primary font-bold"
                          : "border-border text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      <span className="text-xs font-semibold text-foreground">Across Branch</span>
                      <span className="text-[10px] text-muted-foreground">Checks phone/email across all branch campaigns</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDupCheckScope('tenant')}
                      className={cn(
                        "border rounded-xl p-3 flex flex-col items-start gap-1 text-left transition-all cursor-pointer shadow-xs",
                        dupCheckScope === 'tenant'
                          ? "border-primary bg-primary/5 ring-1 ring-primary font-bold"
                          : "border-border text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      <span className="text-xs font-semibold text-foreground">Across Tenant (Global)</span>
                      <span className="text-[10px] text-muted-foreground">System-wide check across all branches & franchises</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDupCheckScope('none')}
                      className={cn(
                        "border rounded-xl p-3 flex flex-col items-start gap-1 text-left transition-all cursor-pointer shadow-xs",
                        dupCheckScope === 'none'
                          ? "border-primary bg-primary/5 ring-1 ring-primary font-bold"
                          : "border-border text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      <span className="text-xs font-semibold text-foreground">No Check</span>
                      <span className="text-[10px] text-muted-foreground">Always creates new lead tickets</span>
                    </button>
                  </div>
                </div>

                {/* If Duplicate Found */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-foreground uppercase tracking-widest block">
                    If Duplicate Found
                  </label>
                  <select
                    value={dupResolution}
                    onChange={(e) => setDupResolution(e.target.value as any)}
                    disabled={dupCheckScope === 'none'}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-medium text-foreground disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <option value="ignore">Ignore duplicate (Discard completely)</option>
                    <option value="update">Update existing lead (Add new notes / activity)</option>
                    <option value="reopen">Reopen lead (If already closed / won / lost)</option>
                  </select>
                </div>

                {/* Cross-Campaign Spillover */}
                <div className="flex items-start gap-3 p-3.5 border border-border rounded-xl bg-muted/20">
                  <Switch
                    id="spillover-toggle"
                    checked={allowSpillover}
                    onCheckedChange={setAllowSpillover}
                    className="mt-0.5"
                  />
                  <div className="space-y-1 cursor-pointer select-none" onClick={() => setAllowSpillover(!allowSpillover)}>
                    <label htmlFor="spillover-toggle" className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-1.5">
                      Cross-Campaign Spillover
                      {allowSpillover && (
                        <Badge variant="outline" className="text-[9px] font-bold bg-teal-50 text-teal-700 border-teal-200 py-0 px-1 rounded">
                          ACTIVE
                        </Badge>
                      )}
                    </label>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      Allows idle callers in this campaign to automatically pull leads from other campaigns sharing the same pipeline.
                    </p>
                  </div>
                </div>

              </TabsContent>

            </Tabs>

            {/* Stepper Footer Buttons */}
            <div className="flex items-center justify-between border-t border-border pt-4 mt-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (activeTab === 'governance') setActiveTab('distribution');
                  else if (activeTab === 'distribution') setActiveTab('setup');
                }}
                disabled={activeTab === 'setup'}
                className="h-9 px-4 text-xs font-semibold rounded-xl"
              >
                Back
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>

                {activeTab !== 'governance' ? (
                  <Button
                    type="button"
                    onClick={() => {
                      if (activeTab === 'setup') {
                        if (!validate('setup')) return;
                        setActiveTab('distribution');
                      } else if (activeTab === 'distribution') {
                        setActiveTab('governance');
                      }
                    }}
                    className="h-9 px-4 text-xs font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    Continue
                    <ArrowRight size={13} />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={createMutation.isPending}
                    className="h-9 px-5 text-xs font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                    Launch Campaign
                  </Button>
                )}
              </div>
            </div>

          </div>

          {/* --- RIGHT PANEL: Live Flow Simulator Canvas --- */}
          <div className="lg:col-span-5 flex flex-col bg-slate-50/50 p-5 min-h-[520px] overflow-hidden select-none">
            
            <div className="pb-3 border-b border-border mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Campaign Architecture
                </h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">Real-time simulator reflecting your configuration.</p>
              </div>
              <Badge variant="outline" className="text-[9px] bg-white text-muted-foreground py-0.5 px-2 border-border font-bold">
                SIMULATOR
              </Badge>
            </div>

            {/* Canvas Area */}
            <div className="relative flex-1 bg-background border border-border rounded-xl p-4 flex flex-col items-center justify-between min-h-[440px] bg-[#fafafa] bg-[radial-gradient(#e2e8f0_1.2px,transparent_1.2px)] [background-size:14px_14px] shadow-inner">
              
              {/* Node 1: Campaign Source & Identity */}
              <div className={cn(
                "w-full max-w-[220px] bg-card border rounded-xl p-2.5 shadow-sm text-center flex flex-col items-center justify-center relative z-10 transition-all duration-300",
                activeTab === 'setup' ? "border-primary ring-2 ring-primary/20 scale-[1.02] bg-white" : "border-border opacity-95"
              )}>
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest block">Inbound Ingress</span>
                <p className="text-xs font-bold text-foreground truncate max-w-full">
                  {name.trim() || 'Campaign Name'}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant="secondary" className="text-[8px] h-4 py-0 px-1 font-semibold">
                    {channel}
                  </Badge>
                  {spend ? (
                    <Badge variant="outline" className="text-[8px] h-4 py-0 px-1 font-mono text-emerald-700 bg-emerald-50 border-emerald-200">
                      ₹{spend}
                    </Badge>
                  ) : null}
                </div>
              </div>

              {/* Node 2: Pipeline Hierarchy */}
              <div className="w-full max-w-[220px] bg-card border border-border rounded-xl p-2.5 shadow-sm text-center relative z-10">
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest block">Target Pipeline</span>
                <p className="text-xs font-bold text-foreground truncate mt-0.5">
                  {selectedPipelineName}
                </p>
                <span className="text-[9px] text-muted-foreground block truncate">
                  {selectedBranchName} &rarr; {selectedVerticalName}
                </span>
              </div>

              {/* Node 3: Deduplication Filter */}
              {dupCheckScope !== 'none' && (
                <div className={cn(
                  "w-full max-w-[220px] bg-card border rounded-xl p-2 shadow-sm text-center relative z-10 transition-all duration-300",
                  activeTab === 'governance' ? "border-rose-500 ring-1 ring-rose-500/20 scale-[1.02]" : "border-border opacity-90"
                )}>
                  <span className="text-[8px] font-bold text-rose-600 uppercase tracking-widest block">🛡️ Deduplication Scope</span>
                  <p className="text-[10px] font-bold text-foreground mt-0.5 capitalize">
                    {dupCheckScope === 'campaign' ? 'Within Campaign' : dupCheckScope === 'branch' ? 'Across Branch' : 'Across Tenant'}
                  </p>
                  <span className="text-[8px] text-muted-foreground block">
                    Action: {dupResolution === 'ignore' ? 'Discard' : dupResolution === 'update' ? 'Update Lead' : 'Reopen Lead'}
                  </span>
                </div>
              )}

              {/* Node 4: Distribution Engine */}
              <div className={cn(
                "w-full max-w-[220px] bg-card border rounded-xl p-2.5 shadow-sm text-center relative z-10 transition-all duration-300",
                activeTab === 'distribution' ? "border-primary ring-2 ring-primary/20 scale-[1.02] bg-white" : "border-border opacity-95"
              )}>
                <span className="text-[8px] font-bold text-primary uppercase tracking-widest block">Assignment Rule</span>
                <p className="text-xs font-bold text-foreground mt-0.5 capitalize">
                  {distribution === 'on_demand' ? `On Demand (${leadsPerHandout}/pull)` : distribution === 'equal' ? 'Equal (Round-Robin)' : 'Conditional Rules'}
                </p>
              </div>

              {/* Node 5: Agent Pool */}
              <div className="w-full flex justify-center gap-3 relative z-10 p-2">
                {selectedAgents.length > 0 ? (
                  selectedAgents.slice(0, 4).map((aId) => {
                    const u = users.find(usr => usr.id === aId);
                    const initial = (u?.name || 'A').charAt(0).toUpperCase();
                    return (
                      <div key={aId} className="flex flex-col items-center text-center max-w-[70px]">
                        <div className="w-8 h-8 rounded-full border border-teal-200 bg-teal-50 text-teal-700 shadow-xs flex items-center justify-center text-xs font-extrabold relative">
                          {initial}
                          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 border-2 border-white" />
                        </div>
                        <span className="text-[8px] font-bold text-muted-foreground truncate w-full mt-1">{u?.name || 'Agent'}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="w-full max-w-[220px] bg-card border border-border rounded-xl p-2 shadow-sm text-center">
                    <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest block">Caller Pool</span>
                    <p className="text-xs font-bold text-foreground">General Dialing Pool</p>
                  </div>
                )}
                {selectedAgents.length > 4 && (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-muted border border-dashed border-border flex items-center justify-center text-muted-foreground text-xs font-bold shadow-xs">
                      +{selectedAgents.length - 4}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

      </DialogContent>

      {/* Quick Add Branch Dialog */}
      <Dialog open={isAddBranchOpen} onOpenChange={setIsAddBranchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-1.5">
              <Building2 size={16} className="text-primary" />
              Add New Branch
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBranch} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Branch Name *</label>
              <Input
                placeholder="e.g. Vikaspuri, Connaught Place, Mumbai HQ"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">City (Optional)</label>
              <Input
                placeholder="e.g. New Delhi, Mumbai"
                value={newBranchCity}
                onChange={(e) => setNewBranchCity(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddBranchOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmittingBranch || !newBranchName.trim()}>
                {isSubmittingBranch && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Create Branch
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Add Vertical Dialog */}
      <Dialog open={isAddVerticalOpen} onOpenChange={setIsAddVerticalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-1.5">
              <GitFork size={16} className="text-primary" />
              Add Vertical to {selectedBranchName}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateVertical} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Vertical Name *</label>
              <Input
                placeholder="e.g. INSTA_vkp, BCL_vkp, Study Abroad, Admissions"
                value={newVerticalName}
                onChange={(e) => setNewVerticalName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddVerticalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmittingVertical || !newVerticalName.trim()}>
                {isSubmittingVertical && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Create Vertical
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Add Pipeline Dialog */}
      <Dialog open={isAddPipelineOpen} onOpenChange={setIsAddPipelineOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-1.5">
              <Layers size={16} className="text-primary" />
              Add Pipeline
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Pipelines are dependent on a Vertical. Confirm target hierarchy below:
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePipeline} className="space-y-4 pt-2">
            <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Branch:</span>
                <span className="font-semibold text-foreground">{selectedBranchName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Vertical:</span>
                <span className="font-semibold text-foreground">{selectedVerticalName}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Pipeline Name *</label>
              <Input
                placeholder="e.g. INSTA_Piplin, BCL_Piplin, Inbound Sales Pipeline"
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddPipelineOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmittingPipeline || !newPipelineName.trim() || !verticalId}>
                {isSubmittingPipeline && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Create Pipeline
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Add Master Campaign Type Dialog */}
      <Dialog open={isAddMasterTypeOpen} onOpenChange={setIsAddMasterTypeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-1.5">
              <Tag size={16} className="text-primary" />
              Add Custom Campaign Type
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddMasterType} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Type Name *</label>
              <Input
                placeholder="e.g. Campus Drive, Billboard, Influencer Tie-up"
                value={newMasterTypeName}
                onChange={(e) => setNewMasterTypeName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddMasterTypeOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!newMasterTypeName.trim()}>
                Add Type
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </Dialog>
  );
}
