import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  UserPlus,
  AlertTriangle,
  Clock,
  Sparkles,
  Flame,
  Calendar,
  Building2,
  User,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { leadsApi } from '@/api/leads';
import { campaignsApi, type Campaign } from '@/api/campaigns';
import { settingsApi, type User as TeamUser } from '@/api/settings';
import { useBranch } from '@/contexts/branch.context';
import { useAuth } from '@/contexts/auth.context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91 (IN)' },
  { code: '+1', label: '🇺🇸 +1 (US/CA)' },
  { code: '+44', label: '🇬🇧 +44 (UK)' },
  { code: '+971', label: '🇦🇪 +971 (UAE)' },
  { code: '+61', label: '🇦🇺 +61 (AU)' },
  { code: '+65', label: '🇸🇬 +65 (SG)' },
  { code: '+49', label: '🇩🇪 +49 (DE)' },
  { code: '+33', label: '🇫🇷 +33 (FR)' },
];

export function CreateLeadModal({ isOpen, onClose, onSuccess }: CreateLeadModalProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { selectedBranchId, branches, isSingleBranch, selectedVerticalIds } = useBranch();

  // Form State
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('manual');
  const [campaignId, setCampaignId] = useState('');
  const [priority, setPriority] = useState<'hot' | 'normal' | 'cold'>('normal');
  const [assignedToId, setAssignedToId] = useState<string>('me');
  const [branchId, setBranchId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Follow-up scheduling
  const [scheduleFollowUp, setScheduleFollowUp] = useState(true);
  const [followUpDate, setFollowUpDate] = useState(() =>
    dayjs().add(2, 'hour').format('YYYY-MM-DDTHH:mm')
  );

  // Live duplicate state
  const [duplicateLead, setDuplicateLead] = useState<any | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch active campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns', 'active-list'],
    queryFn: () => campaignsApi.list({ status: 'active' }),
    enabled: isOpen,
    staleTime: 60_000,
  });

  // Fetch active team users for assignment
  const { data: users = [] } = useQuery<TeamUser[]>({
    queryKey: ['settings', 'users'],
    queryFn: () => settingsApi.users.list(),
    enabled: isOpen && !isSingleBranch,
    staleTime: 60_000,
  });

  // Default branch configuration
  useEffect(() => {
    if (isOpen) {
      setBranchId(selectedBranchId || branches[0]?.id || '');
      setAssignedToId('me');
    }
  }, [isOpen, selectedBranchId, branches]);

  // Reset form helper
  const resetForm = useCallback(() => {
    setName('');
    setPhone('');
    setEmail('');
    setSource('manual');
    setCampaignId('');
    setPriority('normal');
    setAssignedToId('me');
    setNotes('');
    setErrors({});
    setDuplicateLead(null);
    setFollowUpDate(dayjs().add(2, 'hour').format('YYYY-MM-DDTHH:mm'));
    nameInputRef.current?.focus();
  }, []);

  // Reset when closing
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  // Live Duplicate Check Engine
  useEffect(() => {
    const rawDigits = phone.replace(/\D/g, '');
    const cleanEmail = email.trim();

    if (rawDigits.length < 8 && (!cleanEmail || !cleanEmail.includes('@'))) {
      setDuplicateLead(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsCheckingDuplicate(true);
      try {
        const fullPhone = rawDigits.length >= 8 ? `${countryCode}${rawDigits.slice(-10)}` : undefined;
        const result = await leadsApi.checkDuplicate({
          phone: fullPhone,
          email: cleanEmail.length > 4 ? cleanEmail : undefined,
        });

        if (result.is_duplicate && result.existing_lead) {
          setDuplicateLead(result.existing_lead);
        } else {
          setDuplicateLead(null);
        }
      } catch {
        // Silently fail duplicate check without blocking form
      } finally {
        setIsCheckingDuplicate(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [phone, countryCode, email]);

  const createMutation = useMutation({
    mutationFn: (data: any) => leadsApi.create(data),
    onSuccess: (newLead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead captured successfully', {
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
    if (phone.replace(/\D/g, '').length < 7) nextErrors.phone = 'Please enter a valid phone number';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Please enter a valid email address';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const executeCreate = (isAddAnother: boolean = false) => {
    if (!validate()) return;

    const rawDigits = phone.replace(/\D/g, '');
    const formattedPhone = `${countryCode} ${rawDigits}`;

    const finalAssignedId =
      assignedToId === 'me'
        ? user?.id || null
        : assignedToId === 'unassigned'
          ? null
          : assignedToId;

    const targetVerticalId = selectedVerticalIds[0] || null;

    const payload: any = {
      name: name.trim(),
      phone: formattedPhone,
      source,
      status: priority === 'hot' ? 'hot' : 'new',
      assigned_to_id: finalAssignedId,
      vertical_id: targetVerticalId,
      ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
      ...(campaignId ? { campaign_id: campaignId } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      attributes: {
        priority,
        ...(scheduleFollowUp && followUpDate ? { follow_up_date: followUpDate } : {}),
      },
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        if (isAddAnother) {
          resetForm();
          toast.info('Form ready for next lead entry');
        } else {
          onClose();
        }
      },
    });
  };

  // Keyboard shortcut for rapid entry
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        executeCreate(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        executeCreate(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto p-0 bg-card border border-border shadow-xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/40">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <UserPlus size={16} />
              </div>
              <span>Add Prospect Lead</span>
            </DialogTitle>
            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground border-border bg-background">
              Ctrl+Enter to Save
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Capture new inquiries, walk-ins, and inbound phone contacts with live duplicate verification.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeCreate(false);
          }}
          className="p-6 space-y-4"
        >
          {/* Live Duplicate Warning */}
          {duplicateLead && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-950 flex items-start gap-3 shadow-xs animate-in fade-in slide-in-from-top-2">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
              <div className="flex-1">
                <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                  <span>Potential Duplicate Lead Found</span>
                  <Badge variant="outline" className="text-[9px] bg-amber-100 text-amber-800 border-amber-300 py-0">
                    {duplicateLead.status}
                  </Badge>
                </p>
                <p className="text-amber-800/90 mt-1 leading-relaxed">
                  <strong>{duplicateLead.name}</strong> ({duplicateLead.phone}) is already in the database.
                  {duplicateLead.assigned_to?.name && (
                    <span> Assigned to <strong>{duplicateLead.assigned_to.name}</strong>.</span>
                  )}
                </p>
                <p className="text-[10px] text-amber-700/80 mt-1.5 font-medium">
                  You can still proceed if this is an intentional secondary inquiry.
                </p>
              </div>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Full Name</span>
              <span className="text-[10px] text-red-500 font-bold">*Required</span>
            </label>
            <Input
              ref={nameInputRef}
              type="text"
              placeholder="e.g. Sarah Connor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-primary h-9 text-sm rounded-xl"
              required
            />
            {errors.name && <p className="text-xs text-red-600 font-medium">{errors.name}</p>}
          </div>

          {/* Phone & Country Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Phone Number</span>
              {isCheckingDuplicate && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Checking duplicate...
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="h-9 rounded-xl border border-border bg-background px-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary shrink-0"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Input
                type="tel"
                placeholder="e.g. 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-primary h-9 text-sm rounded-xl flex-1 font-mono"
                required
              />
            </div>
            {errors.phone && <p className="text-xs text-red-600 font-medium">{errors.phone}</p>}
          </div>

          {/* Email & Lead Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Email Address</label>
              <Input
                type="email"
                placeholder="sarah@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background border-border placeholder:text-muted-foreground focus-visible:ring-primary h-9 text-sm rounded-xl"
              />
              {errors.email && <p className="text-xs text-red-600 font-medium">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Source Channel</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
              >
                <option value="manual">Manual Entry / Direct</option>
                <option value="walk_in">Walk-in Prospect</option>
                <option value="phone_call">Phone Inquiry</option>
                <option value="whatsapp">WhatsApp Chat</option>
                <option value="referral">Referral / Alumni</option>
                <option value="meta_ad">Meta Ads (Facebook/IG)</option>
                <option value="google_ad">Google Search PPC</option>
                <option value="website_webhook">Website Landing Page</option>
              </select>
            </div>
          </div>

          {/* Priority & Campaign */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Priority Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Urgency & Priority</label>
              <div className="flex gap-1.5 pt-0.5">
                {[
                  { id: 'hot', label: '🔥 Hot', color: 'border-red-300 text-red-700 bg-red-50/70' },
                  { id: 'normal', label: '⚡ Normal', color: 'border-blue-300 text-blue-700 bg-blue-50/70' },
                  { id: 'cold', label: '❄️ Cold', color: 'border-slate-300 text-slate-700 bg-slate-50/70' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id as any)}
                    className={cn(
                      'flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center',
                      priority === p.id
                        ? cn(p.color, 'ring-2 ring-primary/20 shadow-xs')
                        : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Link to Campaign */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Marketing Campaign</label>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                disabled={campaignsLoading}
              >
                <option value="">-- Direct (No Campaign) --</option>
                {campaigns.map((camp) => (
                  <option key={camp.id} value={camp.id}>
                    {camp.name} ({camp.channel.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Smart Ownership / Assignment (Auto-hidden for Solo tenants) */}
          {!isSingleBranch && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <User size={13} className="text-muted-foreground" />
                <span>Assigned Counsellor</span>
              </label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="me">Assign to Me ({user?.name || 'Current User'})</option>
                <option value="unassigned">Unassigned (Leave in Pool)</option>
                {users
                  .filter((u) => u.id !== user?.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email || u.phone_number || 'Team Member'})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Immediate First Follow-up Scheduler */}
          <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleFollowUp}
                  onChange={(e) => setScheduleFollowUp(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                />
                <Calendar size={13} className="text-primary" />
                <span>Schedule First Follow-up Call</span>
              </label>
              {scheduleFollowUp && (
                <span className="text-[10px] text-muted-foreground">Sets automated reminder</span>
              )}
            </div>

            {scheduleFollowUp && (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { label: 'In 2h', time: dayjs().add(2, 'hour') },
                    { label: 'Today 5pm', time: dayjs().hour(17).minute(0) },
                    { label: 'Tomorrow 10am', time: dayjs().add(1, 'day').hour(10).minute(0) },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFollowUpDate(preset.time.format('YYYY-MM-DDTHH:mm'))}
                      className="px-2 py-1 rounded-md text-[11px] font-medium border border-border bg-background hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <Input
                  type="datetime-local"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="h-8 text-xs font-mono rounded-lg border-border bg-background flex-1"
                />
              </div>
            )}
          </div>

          {/* Interaction Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Initial Discovery Notes</label>
            <textarea
              rows={2}
              placeholder="Course interest, budget, questions asked, or qualification background..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Footer & Rapid Entry Actions */}
          <DialogFooter className="pt-4 border-t border-border -mx-6 -mb-6 p-4 bg-muted/40 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-9 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                disabled={createMutation.isPending}
                onClick={() => executeCreate(true)}
                className="h-9 text-xs border-border bg-background hover:bg-muted text-foreground font-semibold flex items-center gap-1.5 cursor-pointer flex-1 sm:flex-none"
                title="Saves this lead and resets the form for another entry (Cmd+Shift+Enter)"
              >
                Save & Add Another
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="h-9 text-xs bg-primary hover:bg-[#1e293b] text-white font-semibold flex items-center gap-1.5 cursor-pointer flex-1 sm:flex-none shadow-xs"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Create Lead
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
