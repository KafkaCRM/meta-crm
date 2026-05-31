import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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

  // Form State
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('meta_ads');
  const [assignmentId, setAssignmentId] = useState('');
  const [verticalId, setVerticalId] = useState('');
  const [pipelineId, setPipelineId] = useState('wf_default_001');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0] ?? '');
  const [targetLeads, setTargetLeads] = useState('');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 1. Fetch branch-brand assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['settings', 'assignments'],
    queryFn: () => settingsApi.assignments.list(),
    enabled: isOpen,
    staleTime: 60_000,
  });

  // 2. Fetch branches and brands to resolve their names
  const { data: branches = [] } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: () => settingsApi.branches.list(),
    enabled: isOpen,
    staleTime: 60_000,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['settings', 'brands'],
    queryFn: () => settingsApi.brands.list(),
    enabled: isOpen,
    staleTime: 60_000,
  });

  // 3. Fetch active verticals
  const { data: verticals = [], isLoading: verticalsLoading } = useQuery({
    queryKey: ['settings', 'verticals'],
    queryFn: () => settingsApi.verticals.list({ status: 'active' }),
    enabled: isOpen,
    staleTime: 60_000,
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

  // Set default selection once loaded
  useEffect(() => {
    if (isOpen) {
      if (assignmentOptions.length > 0 && !assignmentId) {
        const primary = assignments.find((a) => a.is_primary);
        setAssignmentId(primary ? primary.id : assignmentOptions[0]!.id);
      }
      if (verticals.length > 0 && !verticalId) {
        setVerticalId(verticals[0]!.id);
      }
    }
  }, [isOpen, assignmentOptions, assignmentId, assignments, verticals, verticalId]);

  // Reset form when modal closes or opens
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setChannel('meta_ads');
      setAssignmentId('');
      setVerticalId('');
      setPipelineId('wf_default_001');
      setStartDate(new Date().toISOString().split('T')[0] ?? '');
      setTargetLeads('');
      setUtmSource('');
      setUtmMedium('');
      setUtmCampaign('');
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
      channel: string;
      start_date: string;
      target_leads?: number;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
    }) => campaignsApi.create(data),
    onSuccess: (newCampaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign created successfully', {
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
    if (!assignmentId) nextErrors.assignmentId = 'Branch & Brand assignment is required';
    if (!verticalId) nextErrors.verticalId = 'Vertical selection is required';
    if (!pipelineId) nextErrors.pipelineId = 'Workflow Pipeline is required';
    if (!startDate) nextErrors.startDate = 'Start Date is required';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      const activeAssignment = assignmentOptions.find((o) => o.id === assignmentId);
      if (!activeAssignment) {
        toast.error('Selected assignment is invalid');
        return;
      }

      createMutation.mutate({
        name: name.trim(),
        channel,
        branch_id: activeAssignment.branchId,
        brand_id: activeAssignment.brandId,
        vertical_id: verticalId,
        pipeline_id: pipelineId,
        start_date: new Date(startDate).toISOString(),
        ...(targetLeads ? { target_leads: parseInt(targetLeads, 10) } : {}),
        ...(utmSource ? { utm_source: utmSource.trim() } : {}),
        ...(utmMedium ? { utm_medium: utmMedium.trim() } : {}),
        ...(utmCampaign ? { utm_campaign: utmCampaign.trim() } : {}),
      });
    },
    [name, channel, assignmentId, verticalId, pipelineId, startDate, targetLeads, utmSource, utmMedium, utmCampaign, assignmentOptions, createMutation]
  );

  const isFormLoading = assignmentsLoading || verticalsLoading;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-6 bg-card border border-border">
        <DialogHeader className="pb-3 border-b border-border">
          <DialogTitle className="text-lg font-semibold text-foreground">Create Campaign</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Deploy a new marketing channel or UTM tracking tag to measure acquisition funnels.
          </DialogDescription>
        </DialogHeader>

        {isFormLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Campaign Name</label>
              <Input
                type="text"
                placeholder="e.g. Summer Admissions Drive 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-[#0f172a] h-9 text-sm"
              />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Channel */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Marketing Channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f172a] transition-colors"
                >
                  <option value="meta_ads">Meta Ads</option>
                  <option value="google_ads">Google Ads</option>
                  <option value="direct">Direct Traffic</option>
                  <option value="email">Email Campaign</option>
                  <option value="sms">SMS Campaign</option>
                  <option value="referral">Referral Link</option>
                  <option value="other">Other</option>
                </select>
                {errors.channel && <p className="text-xs text-red-600 mt-1">{errors.channel}</p>}
              </div>

              {/* Start Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-background border-border focus-visible:ring-[#0f172a] h-9 text-sm"
                />
                {errors.startDate && <p className="text-xs text-red-600 mt-1">{errors.startDate}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Assignment */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Branch & Brand</label>
                <select
                  value={assignmentId}
                  onChange={(e) => setAssignmentId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f172a] transition-colors"
                >
                  <option value="">-- Select Branch Assignment --</option>
                  {assignmentOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.assignmentId && <p className="text-xs text-red-600 mt-1">{errors.assignmentId}</p>}
              </div>

              {/* Vertical */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Academic Vertical</label>
                <select
                  value={verticalId}
                  onChange={(e) => setVerticalId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f172a] transition-colors"
                >
                  <option value="">-- Choose Vertical --</option>
                  {verticals.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                {errors.verticalId && <p className="text-xs text-red-600 mt-1">{errors.verticalId}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pipeline */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Target Pipeline</label>
                <select
                  value={pipelineId}
                  onChange={(e) => setPipelineId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f172a] transition-colors"
                >
                  <option value="wf_default_001">Admissions Pipeline</option>
                </select>
                {errors.pipelineId && <p className="text-xs text-red-600 mt-1">{errors.pipelineId}</p>}
              </div>

              {/* Target Leads */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Target Leads (Optional)</label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={targetLeads}
                  onChange={(e) => setTargetLeads(e.target.value)}
                  className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-[#0f172a] h-9 text-sm"
                />
              </div>
            </div>

            <div className="border-t border-border pt-4 mt-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">UTM Tracking Parameters (Optional)</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">UTM Source</label>
                  <Input
                    type="text"
                    placeholder="e.g. facebook"
                    value={utmSource}
                    onChange={(e) => setUtmSource(e.target.value)}
                    className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-[#0f172a] h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">UTM Medium</label>
                  <Input
                    type="text"
                    placeholder="e.g. cpc"
                    value={utmMedium}
                    onChange={(e) => setUtmMedium(e.target.value)}
                    className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-[#0f172a] h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">UTM Campaign</label>
                  <Input
                    type="text"
                    placeholder="e.g. summer-promo"
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                    className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-[#0f172a] h-8 text-xs"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                If UTM Campaign is left blank, a URL-friendly version of the Campaign Name will be generated automatically.
              </p>
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
                Create Campaign
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
