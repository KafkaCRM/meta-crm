import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, UserPlus } from 'lucide-react';
import { leadsApi } from '@/api/leads';
import { campaignsApi, type Campaign } from '@/api/campaigns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateLeadModal({ isOpen, onClose, onSuccess }: CreateLeadModalProps) {
  const queryClient = useQueryClient();

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('manual');
  const [campaignId, setCampaignId] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch active campaigns to allow linking
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns', 'active-list'],
    queryFn: () => campaignsApi.list({ status: 'active' }),
    enabled: isOpen,
    staleTime: 60_000,
  });

  // Reset form when modal closes or opens
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setPhone('');
      setEmail('');
      setSource('manual');
      setCampaignId('');
      setNotes('');
      setErrors({});
    }
  }, [isOpen]);

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      phone: string;
      email?: string;
      source: string;
      campaign_id?: string;
      notes?: string;
    }) => leadsApi.create(data),
    onSuccess: (newLead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead created successfully', {
        description: `${newLead.name} (${newLead.phone})`,
      });
      onSuccess();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create lead');
    },
  });

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'Name is required';
    if (!phone.trim()) nextErrors.phone = 'Phone number is required';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Please enter a valid email address';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      createMutation.mutate({
        name: name.trim(),
        phone: phone.trim(),
        source,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(campaignId ? { campaign_id: campaignId } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
    },
    [name, phone, email, source, campaignId, notes, createMutation]
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-6 bg-card border border-border">
        <DialogHeader className="pb-3 border-b border-border">
          <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <UserPlus size={20} className="text-primary" />
            Add Prospect Lead
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Manually enter a new lead into the system. Perfect for walk-ins, phone inquiries, or referrals.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Full Name</label>
            <Input
              type="text"
              placeholder="e.g. Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-[#0f172a] h-9 text-sm"
              required
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Phone Number</label>
              <Input
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-[#0f172a] h-9 text-sm"
                required
              />
              {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Email (Optional)</label>
              <Input
                type="email"
                placeholder="e.g. jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-[#0f172a] h-9 text-sm"
              />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Source */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Lead Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f172a] transition-colors"
              >
                <option value="manual">Manual Entry / Direct</option>
                <option value="referral">Referral</option>
                <option value="phone_call">Phone Call</option>
                <option value="whatsapp">WhatsApp Inquiry</option>
                <option value="walk_in">Walk-in Prospect</option>
                <option value="web_form">Web Form Submission</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Campaign association */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Link to Campaign</label>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f172a] transition-colors"
                disabled={campaignsLoading}
              >
                <option value="">-- No Campaign (Direct) --</option>
                {campaigns.map((camp) => (
                  <option key={camp.id} value={camp.id}>
                    {camp.name} ({camp.channel.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Interaction Notes</label>
            <textarea
              rows={3}
              placeholder="Enter brief context, inquiries made, course preferences, or next steps..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0f172a] transition-colors resize-none"
            />
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
              className="h-9 text-xs bg-primary hover:bg-[#1e293b] text-white font-medium flex items-center gap-1.5"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Add Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
