import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Sparkles, Settings2, ChevronDown, ChevronUp, DollarSign, Calendar, Target } from 'lucide-react';
import { settingsApi } from '@/api/settings';
import { campaignsApi } from '@/api/campaigns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface CampaignFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CampaignFormModal({ isOpen, onClose, onSuccess }: CampaignFormModalProps) {
  const queryClient = useQueryClient();

  // Form State - 1. Core Profile
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('meta_ads');
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0] ?? '');
  const [endDate, setEndDate] = useState('');

  // Form State - 2. Financials & Telemetry (ROI / CAC)
  const [budgetedCost, setBudgetedCost] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [targetLeads, setTargetLeads] = useState('');

  // Form State - 3. Hidden Relational Defaults (Scoped silently)
  const [assignmentId, setAssignmentId] = useState('');
  const [verticalId, setVerticalId] = useState('');
  const [pipelineId, setPipelineId] = useState('');

  // Form State - 4. Advanced Custom Tracking
  const [autoTrack, setAutoTrack] = useState(true);
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
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
    queryFn: () => settingsApi.workflows.list(),
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

  // Silent automatic setup helper for simple single-store configuration
  const ensureDefaults = useCallback(async () => {
    if (assignmentsLoading || verticalsLoading || pipelinesLoading) return;
    
    // Check if defaults are already loaded or exist
    if (assignmentOptions.length > 0 && verticals.length > 0 && pipelines.length > 0) {
      return;
    }
    
    try {
      setIsInitializing(true);
      
      let activeBranchId = branches[0]?.id;
      let activeBrandId = brands[0]?.id;
      let activeAsgId = assignments[0]?.id;
      let activeVerticalId = verticals[0]?.id;
      let activePipelineId = pipelines[0]?.id;

      // Silently create Branch if missing
      if (!activeBranchId) {
        const branchRes = await settingsApi.branches.create({
          name: 'Main Location',
          city: 'Store City',
        });
        activeBranchId = branchRes.id;
      }

      // Silently create Brand if missing
      if (!activeBrandId) {
        const brandRes = await settingsApi.brands.create({
          name: 'Primary Store Brand',
        });
        activeBrandId = brandRes.id;
      }

      // Silently create Brand-Branch Assignment link if missing
      if (!activeAsgId) {
        const assignmentRes = await settingsApi.assignments.create({
          branch_id: activeBranchId,
          brand_id: activeBrandId,
          is_primary: true,
        });
        activeAsgId = assignmentRes.id;
      }

      // Silently create Category/Vertical if missing
      if (!activeVerticalId) {
        const verticalRes = await settingsApi.verticals.create({
          brand_id: activeBrandId,
          name: 'Store Inquiries',
          status: 'active',
        });
        activeVerticalId = verticalRes.id;
      }

      // Silently fetch and initialize default pipeline workflow definition
      if (!activePipelineId) {
        const defaultWf = await settingsApi.workflows.getDefault();
        activePipelineId = defaultWf.id;
      }

      // Reload setting queries in background
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      
      // Update form selections silently
      setAssignmentId(activeAsgId);
      setVerticalId(activeVerticalId);
      setPipelineId(activePipelineId);
    } catch (err) {
      console.error('Silent defaults initialization failed', err);
    } finally {
      setIsInitializing(false);
    }
  }, [assignmentsLoading, verticalsLoading, pipelinesLoading, assignmentOptions, verticals, pipelines, branches, brands, assignments, queryClient]);

  // Silently trigger background check when opened (at most once to prevent loops)
  useEffect(() => {
    if (isOpen && !assignmentsLoading && !verticalsLoading && !pipelinesLoading && !hasAttemptedInit) {
      if (assignmentOptions.length > 0 && verticals.length > 0 && pipelines.length > 0) {
        setHasAttemptedInit(true);
        return;
      }
      setHasAttemptedInit(true);
      ensureDefaults();
    }
  }, [isOpen, assignmentsLoading, verticalsLoading, pipelinesLoading, hasAttemptedInit, assignmentOptions, verticals, pipelines, ensureDefaults]);

  // Update default states when populated
  useEffect(() => {
    if (isOpen) {
      if (assignmentOptions.length > 0 && !assignmentId) {
        const primary = assignments.find((a) => a.is_primary);
        setAssignmentId(primary ? primary.id : assignmentOptions[0]!.id);
      }
      if (verticals.length > 0 && !verticalId) {
        setVerticalId(verticals[0]!.id);
      }
      if (pipelines.length > 0 && !pipelineId) {
        setPipelineId(pipelines[0].id);
      }
    }
  }, [isOpen, assignmentOptions, assignmentId, assignments, verticals, verticalId, pipelines, pipelineId]);

  // Reset form when modal closes or opens
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setChannel('meta_ads');
      setStatus('active');
      setAssignmentId('');
      setVerticalId('');
      setPipelineId('');
      setStartDate(new Date().toISOString().split('T')[0] ?? '');
      setEndDate('');
      setBudgetedCost('');
      setActualCost('');
      setTargetLeads('');
      setUtmSource('');
      setUtmMedium('');
      setUtmCampaign('');
      setAutoTrack(true);
      setShowAdvanced(false);
      setIsInitializing(false);
      setHasAttemptedInit(false);
      setErrors({});
    }
  }, [isOpen]);

  const createMutation = useMutation({
    mutationFn: (data: {
      branch_id: string;
      brand_id: string;
      vertical_id: string;
      pipeline_id: string;
      name: string;
      status: string;
      channel: string;
      start_date: string;
      end_date?: string;
      target_leads?: number;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      attributes?: Record<string, any>;
    }) => campaignsApi.create(data),
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

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'Campaign Name is required';
    if (!channel) nextErrors.channel = 'Marketing Channel is required';
    if (!startDate) nextErrors.startDate = 'Launch Date is required';
    
    // Technical checks (will only trigger if background setup fails)
    if (!assignmentId) nextErrors.assignmentId = 'Store location link is missing';
    if (!verticalId) nextErrors.verticalId = 'Category Vertical is missing';
    if (!pipelineId) nextErrors.pipelineId = 'Workflow pipeline is missing';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      const activeAssignment = assignmentOptions.find((o) => o.id === assignmentId);
      if (!activeAssignment) {
        toast.error('Store assignment configuration is currently initializing. Please try again in a moment.');
        return;
      }

      // Automatically generate UTM tracking details under the hood
      let resolvedSource = utmSource.trim();
      let resolvedMedium = utmMedium.trim();
      let resolvedCampaign = utmCampaign.trim();

      if (autoTrack) {
        // Map channel to user-friendly UTM sources
        if (channel === 'meta_ads') resolvedSource = 'facebook';
        else if (channel === 'google_ads') resolvedSource = 'google';
        else if (channel === 'email') resolvedSource = 'newsletter';
        else if (channel === 'sms') resolvedSource = 'sms';
        else if (channel === 'referral') resolvedSource = 'referral';
        else resolvedSource = channel;

        // Map channel to standard marketing mediums
        if (channel === 'meta_ads' || channel === 'google_ads') resolvedMedium = 'cpc';
        else if (channel === 'email') resolvedMedium = 'email';
        else if (channel === 'sms') resolvedMedium = 'sms';
        else resolvedMedium = 'social';

        // Auto-generate a clean, URL-safe campaign tag name
        resolvedCampaign = name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }

      createMutation.mutate({
        name: name.trim(),
        channel,
        status,
        branch_id: activeAssignment.branchId,
        brand_id: activeAssignment.brandId,
        vertical_id: verticalId,
        pipeline_id: pipelineId,
        start_date: new Date(startDate).toISOString(),
        ...(endDate ? { end_date: new Date(endDate).toISOString() } : {}),
        ...(targetLeads ? { target_leads: parseInt(targetLeads, 10) } : {}),
        ...(resolvedSource ? { utm_source: resolvedSource } : {}),
        ...(resolvedMedium ? { utm_medium: resolvedMedium } : {}),
        ...(resolvedCampaign ? { utm_campaign: resolvedCampaign } : {}),
        // Storing financial metrics in the flexible JSON attributes field without requiring SQL migrations
        attributes: {
          budgeted_cost: budgetedCost ? parseFloat(budgetedCost) : null,
          actual_cost: actualCost ? parseFloat(actualCost) : null,
        }
      });
    },
    [name, channel, status, assignmentId, verticalId, pipelineId, startDate, endDate, targetLeads, budgetedCost, actualCost, utmSource, utmMedium, utmCampaign, autoTrack, assignmentOptions, createMutation]
  );

  const isFormLoading = assignmentsLoading || verticalsLoading || pipelinesLoading || isInitializing;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-6 bg-card border border-border">
        <DialogHeader className="pb-3 border-b border-border">
          <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles size={18} className="text-amber-500 font-extrabold" />
            Launch Marketing Campaign
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Fill in a few simple details to track your marketing spend, attribution, and target ROI.
          </DialogDescription>
        </DialogHeader>

        {isFormLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground font-semibold">Configuring your campaign workspace...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-4 animate-in fade-in duration-200">
            
            {/* --- SECTION 1: Core Profile --- */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Campaign Name</label>
                <Input
                  type="text"
                  placeholder="e.g. Summer Admissions Campaign 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-[#0f172a] h-9 text-sm"
                  required
                />
                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Where will you advertise?</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f172a] transition-colors font-medium text-foreground"
                  >
                    <option value="meta_ads">Meta Ads (Facebook & Instagram)</option>
                    <option value="google_ads">Google Search / YouTube Ads</option>
                    <option value="email">Email Broadcast</option>
                    <option value="sms">SMS Blast</option>
                    <option value="referral">Partnership Referral Link</option>
                    <option value="direct">Direct Walk-ins / General Traffic</option>
                    <option value="other">Other / Custom Channel</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Campaign Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f172a] transition-colors font-medium text-foreground"
                  >
                    <option value="active">Active (Currently Running)</option>
                    <option value="draft">Draft (Planning Phase)</option>
                    <option value="paused">Paused (Temporarily Stopped)</option>
                    <option value="completed">Completed (Finished)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={13} className="text-slate-400" />
                    Launch Date
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-background border-border focus-visible:ring-[#0f172a] h-9 text-sm text-foreground"
                    required
                  />
                  {errors.startDate && <p className="text-xs text-red-600 mt-1">{errors.startDate}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={13} className="text-slate-400" />
                    End Date (Optional)
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-background border-border focus-visible:ring-[#0f172a] h-9 text-sm text-foreground"
                  />
                </div>
              </div>
            </div>

            {/* --- SECTION 2: Financials & Goals (CAC & ROI) --- */}
            <div className="border-t border-border pt-4 mt-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Financials & Acquisition Goals</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-700 uppercase flex items-center gap-0.5">
                    <DollarSign size={10} className="text-slate-400" />
                    Budgeted Cost
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 5000"
                    value={budgetedCost}
                    onChange={(e) => setBudgetedCost(e.target.value)}
                    className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-[#0f172a] h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-700 uppercase flex items-center gap-0.5">
                    <DollarSign size={10} className="text-slate-400" />
                    Actual Cost
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 4850"
                    value={actualCost}
                    onChange={(e) => setActualCost(e.target.value)}
                    className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-[#0f172a] h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-700 uppercase flex items-center gap-0.5">
                    <Target size={10} className="text-slate-400" />
                    Lead Goal
                  </label>
                  <Input
                    type="number"
                    placeholder="e.g. 250 leads"
                    value={targetLeads}
                    onChange={(e) => setTargetLeads(e.target.value)}
                    className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-[#0f172a] h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* --- SECTION 3: Smart Link Ingestion --- */}
            <div className="border border-emerald-100 bg-emerald-50/20 rounded-xl p-3.5 mt-2 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-900">Automated Link Ingestion</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoTrack(!autoTrack)}
                  className="text-[10px] text-slate-500 font-semibold underline hover:text-slate-800"
                >
                  {autoTrack ? "Configure Manually" : "Switch to Automatic"}
                </button>
              </div>

              {autoTrack ? (
                <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                  ✨ <strong>Zero Setup Required:</strong> We will automatically generate clean tracking codes to attribute all inbound leads coming from this campaign.
                </p>
              ) : (
                <div className="space-y-2.5 pt-1">
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Customize your UTM parameters if you are using specific tracking schemas in external managers.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase">UTM Source</label>
                      <Input
                        type="text"
                        placeholder="e.g. facebook"
                        value={utmSource}
                        onChange={(e) => setUtmSource(e.target.value)}
                        className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-[#0f172a] h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase">UTM Medium</label>
                      <Input
                        type="text"
                        placeholder="e.g. cpc"
                        value={utmMedium}
                        onChange={(e) => setUtmMedium(e.target.value)}
                        className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-[#0f172a] h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase">UTM Campaign</label>
                      <Input
                        type="text"
                        placeholder="e.g. summer2026"
                        value={utmCampaign}
                        onChange={(e) => setUtmCampaign(e.target.value)}
                        className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-[#0f172a] h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* --- SECTION 4: Collapsible Advanced settings --- */}
            <div className="border-t border-border pt-3 mt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-1">
                  <Settings2 size={13} />
                  Advanced Settings (Multi-Location & Workflows)
                </span>
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showAdvanced && (
                <div className="space-y-4 pt-3 mt-1 border-l-2 border-border pl-3 animate-in slide-in-from-top-2 duration-200">
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    These parameters are pre-configured automatically for your primary store location. Modify only if you run multiple locations or custom workflows.
                  </p>
                  
                  {/* Assignment */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Business Location</label>
                    <select
                      value={assignmentId}
                      onChange={(e) => setAssignmentId(e.target.value)}
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f172a] transition-colors"
                    >
                      {assignmentOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {errors.assignmentId && <p className="text-xs text-red-600 mt-1">{errors.assignmentId}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Vertical */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Category / Vertical</label>
                      <select
                        value={verticalId}
                        onChange={(e) => setVerticalId(e.target.value)}
                        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f172a] transition-colors"
                      >
                        {verticals.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                      {errors.verticalId && <p className="text-xs text-red-600 mt-1">{errors.verticalId}</p>}
                    </div>

                    {/* Target Pipeline */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Target Workflow Pipeline</label>
                      <select
                        value={pipelineId}
                        onChange={(e) => setPipelineId(e.target.value)}
                        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f172a] transition-colors"
                      >
                        {pipelines.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {errors.pipelineId && <p className="text-xs text-red-600 mt-1">{errors.pipelineId}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 border-t border-border -mx-6 -mb-6 px-6 bg-muted flex sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-9 text-xs border-border bg-card hover:bg-muted text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="h-9 text-xs bg-primary hover:bg-[#1e293b] text-white font-medium"
              >
                {createMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                Launch Campaign
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
