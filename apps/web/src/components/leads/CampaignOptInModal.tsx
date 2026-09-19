import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignsApi, type Campaign } from '@/api/campaigns';
import { leadsApi } from '@/api/leads';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Check, Loader2, Target, Globe, MessageSquare, Mail, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

interface CampaignOptInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: string[];
  leadNames?: string[];
  currentCampaignId?: string | null;
  onSuccess?: () => void;
}

export function CampaignOptInModal({
  open,
  onOpenChange,
  leadIds,
  leadNames = [],
  currentCampaignId,
  onSuccess,
}: CampaignOptInModalProps) {
  const queryClient = useQueryClient();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(currentCampaignId || null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.list(),
    enabled: open,
  });

  const optInMutation = useMutation({
    mutationFn: async (campaignId: string | null) => {
      if (leadIds.length === 1) {
        return leadsApi.update(leadIds[0]!, { campaign_id: campaignId });
      }
      return leadsApi.bulkAction({
        action: 'enroll_campaign',
        lead_ids: leadIds,
        campaign_id: campaignId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      const targetCampaign = campaigns.find((c) => c.id === selectedCampaignId);
      if (selectedCampaignId && targetCampaign) {
        toast.success(
          `Enrolled ${leadIds.length === 1 ? (leadNames[0] || 'lead') : `${leadIds.length} leads`} into "${targetCampaign.name}"`
        );
      } else {
        toast.success(`Removed ${leadIds.length === 1 ? 'lead' : `${leadIds.length} leads`} from campaign`);
      }
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update campaign enrollment');
    },
  });

  const handleConfirm = () => {
    optInMutation.mutate(selectedCampaignId);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel.toLowerCase()) {
      case 'meta_ad':
      case 'facebook':
      case 'instagram':
        return <Globe className="w-3.5 h-3.5 text-blue-500" />;
      case 'whatsapp':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />;
      case 'email':
      case 'newsletter':
        return <Mail className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <Megaphone className="w-3.5 h-3.5 text-primary" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-border bg-card">
        <DialogHeader className="p-5 pb-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                {leadIds.length === 1 ? 'Opt-in Lead to Campaign' : `Bulk Opt-in (${leadIds.length} Leads)`}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {leadIds.length === 1
                  ? `Enroll ${leadNames[0] ? `"${leadNames[0]}"` : 'this lead'} into an automated nurture or outbound campaign.`
                  : `Assign ${leadIds.length} selected leads to an active campaign for targeted outreach.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            <span>Select Active Campaign</span>
            <span>Channel</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Loading available campaigns…
            </div>
          ) : campaigns.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-border rounded-xl">
              <Megaphone className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-xs font-semibold text-foreground">No Campaigns Created</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Go to the Campaigns page to launch your first marketing or drip campaign.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {campaigns.map((camp) => {
                const isSelected = selectedCampaignId === camp.id;
                return (
                  <button
                    key={camp.id}
                    type="button"
                    onClick={() => setSelectedCampaignId(camp.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-xs'
                        : 'border-border bg-card hover:bg-muted/30 hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors border ${
                          isSelected
                            ? 'bg-primary border-primary text-white'
                            : 'border-muted-foreground/30 bg-background'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-foreground block truncate">
                          {camp.name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                            <Target className="w-2.5 h-2.5" />
                            Target: {camp.target_leads || 'Ongoing'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">•</span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 capitalize font-medium">
                            {camp.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Badge variant="outline" className="text-[10px] capitalize gap-1 px-2 py-0.5 flex-shrink-0">
                      {getChannelIcon(camp.channel)}
                      {camp.channel.replace('_', ' ')}
                    </Badge>
                  </button>
                );
              })}

              {/* Option to clear campaign */}
              {currentCampaignId && (
                <button
                  type="button"
                  onClick={() => setSelectedCampaignId(null)}
                  className={`w-full text-left p-2.5 rounded-xl border border-dashed transition-all flex items-center justify-between text-xs cursor-pointer ${
                    selectedCampaignId === null
                      ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600'
                      : 'border-border text-muted-foreground hover:bg-muted/20'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <X className="w-3.5 h-3.5" />
                    Un-enroll (Clear campaign association)
                  </span>
                  {selectedCampaignId === null && <Check className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border bg-muted/10 flex items-center justify-between sm:justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs text-muted-foreground h-8"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={optInMutation.isPending || (campaigns.length === 0 && !currentCampaignId)}
            className="h-8 text-xs font-semibold gap-1.5 shadow-sm"
          >
            {optInMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {selectedCampaignId ? 'Confirm Enrollment' : 'Clear Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
