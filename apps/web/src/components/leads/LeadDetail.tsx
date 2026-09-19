import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/api/leads';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';
import {
  ShieldAlert,
  ArrowRight,
  UserCheck,
  Phone,
  Mail,
  Calendar,
  Megaphone,
  GitBranch,
  Layers,
  GitFork,
  GraduationCap,
  MapPin,
  Clock,
  MessageSquare,
  AlertCircle,
  Copy,
  User,
  Flame,
  Zap,
  Snowflake,
  ExternalLink,
  Check,
  Send,
  Coins,
  Tag,
} from 'lucide-react';
import { CampaignOptInModal } from './CampaignOptInModal';
import dayjs from 'dayjs';

interface LeadDetailProps {
  leadId: string;
  onClose?: () => void;
  onChanged?: () => void;
}

export function LeadDetail({ leadId, onClose, onChanged }: LeadDetailProps) {
  const queryClient = useQueryClient();
  const [showConvertForm, setShowConvertForm] = useState(false);
  const [optInOpen, setOptInOpen] = useState(false);
  const [verticalId, setVerticalId] = useState('');
  const [newNote, setNewNote] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => leadsApi.get(leadId),
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ['settings', 'verticals'],
    queryFn: () => settingsApi.verticals.list(),
  });

  // Set default vertical from first option
  useMemo(() => {
    if (verticals.length > 0 && !verticalId) {
      setVerticalId(verticals[0]?.id || '');
    }
  }, [verticals, verticalId]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => leadsApi.update(leadId, data),
    onSuccess: () => {
      toast.success('Lead updated successfully');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onChanged?.();
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Failed to update lead');
    },
  });

  const convertMutation = useMutation({
    mutationFn: (data: { vertical_id: string }) => leadsApi.convert(leadId, data),
    onSuccess: () => {
      toast.success('Lead promoted to Contact!');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (onChanged) onChanged();
      setShowConvertForm(false);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Failed to promote lead');
    },
  });

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const existingNotes = lead?.notes || '';
    const timestamp = dayjs().format('DD MMM YYYY, hh:mm A');
    const updatedNotes = existingNotes
      ? `${existingNotes}\n\n[${timestamp}] ${newNote.trim()}`
      : `[${timestamp}] ${newNote.trim()}`;

    updateMutation.mutate({ notes: updatedNotes });
    setNewNote('');
  };

  const handleConvert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verticalId) {
      toast.error('Please select a Vertical');
      return;
    }
    convertMutation.mutate({
      vertical_id: verticalId,
    });
  };

  if (leadLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-sm text-muted-foreground gap-3">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Loading lead profile...</span>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-destructive bg-destructive/10 rounded-xl border border-destructive/20 m-4">
        <ShieldAlert size={18} />
        <span>Lead not found or has been removed.</span>
      </div>
    );
  }

  const attrs = (lead.attributes || {}) as Record<string, any>;
  const branchName =
    lead.vertical?.branch?.name ||
    lead.campaign?.branch?.name ||
    (lead as any).branch?.name ||
    attrs.branch_name ||
    '—';
  const verticalName = lead.vertical?.name || attrs.vertical_name || '—';
  const pipelineName = lead.pipelineDefinition?.name || attrs.pipeline_name || '—';
  const course = attrs.course || null;
  const trainingMode = attrs.training_mode || null;
  const courseFee = attrs.course_fee || null;
  const altPhone = attrs.alternate_phone || null;
  const whatsappNum = attrs.whatsapp_number || lead.phone;
  const parentsPhone = attrs.parents_number || null;
  const city = attrs.city || null;
  const dob = attrs.dob || null;
  const disposition = attrs.last_call_disposition || 'New Lead';
  const nextFollowUp = attrs.next_follow_up_date || null;
  const scoreNum = Number(attrs.score || (lead.status === 'hot' ? 85 : lead.status === 'warm' ? 60 : 38));
  const isDuplicate = Boolean(attrs.is_duplicate || (lead as any).duplicate_risk);
  const isSlaBreached = Boolean(attrs.sla_breached);
  const isConverted = lead.status === 'converted';

  const stageName =
    lead.pipelineDefinition?.stages?.find((s: any) => s.id === lead.stage)?.name ?? lead.stage ?? 'New';

  const knownKeys = new Set([
    'branch_id',
    'branch_name',
    'vertical_id',
    'vertical_name',
    'pipeline_id',
    'pipeline_name',
    'course',
    'training_mode',
    'course_fee',
    'alternate_phone',
    'whatsapp_number',
    'parents_number',
    'city',
    'dob',
    'last_call_disposition',
    'next_follow_up_date',
    'score',
    'score_label',
    'sla_breached',
    'is_duplicate',
    'duplicate_lead_id',
    'raw_status',
    'raw_source',
  ]);
  const customEntries = Object.entries(attrs).filter(
    ([k, v]) => !knownKeys.has(k) && v !== null && v !== undefined && v !== ''
  );

  const isOverdue = nextFollowUp && dayjs(nextFollowUp).isBefore(dayjs());
  const cleanWhatsApp = (whatsappNum || lead.phone || '').replace(/\D/g, '');
  const waLink = `https://wa.me/${cleanWhatsApp.startsWith('91') ? cleanWhatsApp : `91${cleanWhatsApp}`}?text=${encodeURIComponent(
    `Hello ${lead.name}, I am reaching out from our admissions team regarding your interest in ${course || 'our courses'}. How can we assist you today?`
  )}`;

  return (
    <div className="space-y-6 pb-6">
      {/* 1. Profile Header & Quick Actions */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-primary flex items-center justify-center font-bold text-lg border border-primary/20 shadow-xs">
                {lead.name.charAt(0).toUpperCase()}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-card ${
                  isConverted
                    ? 'bg-emerald-500'
                    : lead.status === 'hot'
                    ? 'bg-rose-500 ring-2 ring-rose-500/20'
                    : lead.status === 'contacted'
                    ? 'bg-amber-500'
                    : lead.status === 'lost'
                    ? 'bg-slate-400'
                    : 'bg-blue-500'
                }`}
              />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-foreground leading-tight">{lead.name}</h2>
                {isDuplicate && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold">
                    Duplicate
                  </Badge>
                )}
                {isSlaBreached && (
                  <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 text-[10px] font-bold">
                    SLA Breached
                  </Badge>
                )}
              </div>

              {/* Status Selector & Score */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Select
                  value={lead.status}
                  onValueChange={(val) => updateMutation.mutate({ status: val })}
                  disabled={updateMutation.isPending || isConverted}
                >
                  <SelectTrigger className="h-7 text-xs font-semibold px-2.5 rounded-lg border-border bg-background/50 capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                    <SelectItem value="hot">Hot</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="converted" disabled>
                      Converted (Use Promote)
                    </SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                    <SelectItem value="junk">Junk</SelectItem>
                  </SelectContent>
                </Select>

                {/* Lead Score Pill */}
                <div
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border ${
                    scoreNum >= 75
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      : scoreNum >= 50
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                  }`}
                >
                  {scoreNum >= 75 ? (
                    <Flame size={12} className="text-rose-500" />
                  ) : scoreNum >= 50 ? (
                    <Zap size={12} className="text-amber-500" />
                  ) : (
                    <Snowflake size={12} className="text-blue-500" />
                  )}
                  <span>Score: {scoreNum}</span>
                </div>

                <Badge variant="outline" className="text-xs font-medium capitalize text-muted-foreground">
                  Source: {lead.source}
                </Badge>
              </div>
            </div>
          </div>

          {/* Quick Communication Micro-Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-start">
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-colors"
            >
              <Phone size={13} />
              <span>Call</span>
            </a>

            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
            >
              <MessageSquare size={13} />
              <span>WhatsApp</span>
            </a>

            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Send Email"
              >
                <Mail size={14} />
              </a>
            )}

            <Button
              onClick={() => setOptInOpen(true)}
              variant="outline"
              size="sm"
              className="h-8 text-xs font-semibold border-border hover:bg-muted"
            >
              <Megaphone size={13} className="mr-1 text-primary" />
              Opt-in
            </Button>
          </div>
        </div>

        {/* Cascading Route Bar */}
        <div className="mt-4 pt-3.5 border-t border-border flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider mr-1">
            Hierarchy:
          </span>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 border border-border/80 font-medium text-foreground">
            <GitBranch size={11} className="text-primary" />
            <span>{branchName}</span>
          </div>
          <span className="text-muted-foreground/40">›</span>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 border border-border/80 font-medium text-foreground">
            <Layers size={11} className="text-emerald-500" />
            <span>{verticalName}</span>
          </div>
          <span className="text-muted-foreground/40">›</span>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 border border-border/80 font-medium text-foreground">
            <GitFork size={11} className="text-purple-500" />
            <span>{pipelineName}</span>
          </div>
          {lead.campaign && (
            <>
              <span className="text-muted-foreground/40">›</span>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 font-semibold text-primary">
                <Megaphone size={11} />
                <span>{lead.campaign.name}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. Academic Program & Commercials Card (if applicable) */}
      {(course || trainingMode || courseFee) && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <GraduationCap size={15} className="text-primary" />
              <span>Course & Program Details</span>
            </div>
            {trainingMode && (
              <Badge variant="outline" className="text-[11px] font-medium bg-background">
                {trainingMode}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {course && (
              <div className="p-3 rounded-xl bg-background/60 border border-border/60">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-0.5">
                  Course Interest
                </span>
                <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <GraduationCap size={14} className="text-primary" />
                  {course}
                </span>
              </div>
            )}

            {courseFee && (
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400 block mb-0.5">
                  Quoted Course Fee
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  ₹{Number(courseFee).toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Comprehensive Contact Details */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <User size={15} className="text-primary" />
          <span>Contact Channels</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Primary Mobile */}
          <div className="p-2.5 rounded-xl bg-background/60 border border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Phone size={14} className="text-primary" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                  Primary Mobile
                </span>
                <span className="font-mono font-bold text-foreground text-sm">{lead.phone}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(lead.phone, 'Mobile')}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
              title="Copy phone"
            >
              {copiedField === 'Mobile' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
          </div>

          {/* WhatsApp */}
          <div className="p-2.5 rounded-xl bg-background/60 border border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MessageSquare size={14} className="text-emerald-500" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                  WhatsApp Number
                </span>
                <span className="font-mono font-bold text-foreground text-sm">{whatsappNum}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(whatsappNum, 'WhatsApp')}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
              title="Copy WhatsApp"
            >
              {copiedField === 'WhatsApp' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
          </div>

          {/* Alternate Phone */}
          {altPhone && (
            <div className="p-2.5 rounded-xl bg-background/60 border border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Phone size={14} className="text-muted-foreground" />
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                    Alternate Phone
                  </span>
                  <span className="font-mono font-medium text-foreground">{altPhone}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(altPhone, 'Alt Phone')}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
              >
                {copiedField === 'Alt Phone' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
            </div>
          )}

          {/* Parents Number */}
          {parentsPhone && (
            <div className="p-2.5 rounded-xl bg-background/60 border border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <User size={14} className="text-purple-500" />
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                    Parent / Guardian Contact
                  </span>
                  <span className="font-mono font-medium text-foreground">{parentsPhone}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(parentsPhone, 'Parent Contact')}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
              >
                {copiedField === 'Parent Contact' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
            </div>
          )}

          {/* Email */}
          <div className="p-2.5 rounded-xl bg-background/60 border border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <Mail size={14} className="text-blue-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                  Email Address
                </span>
                <span className="font-medium text-foreground truncate block">
                  {lead.email || <span className="text-muted-foreground italic">Not provided</span>}
                </span>
              </div>
            </div>
            {lead.email && (
              <button
                type="button"
                onClick={() => handleCopy(lead.email!, 'Email')}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors shrink-0"
              >
                {copiedField === 'Email' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
            )}
          </div>

          {/* City / Location */}
          {city && (
            <div className="p-2.5 rounded-xl bg-background/60 border border-border/60 flex items-center gap-2.5">
              <MapPin size={14} className="text-rose-500 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                  City / Location
                </span>
                <span className="font-medium text-foreground">{city}</span>
              </div>
            </div>
          )}

          {/* Date of Birth */}
          {dob && (
            <div className="p-2.5 rounded-xl bg-background/60 border border-border/60 flex items-center gap-2.5">
              <Calendar size={14} className="text-amber-500 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                  Date of Birth
                </span>
                <span className="font-medium text-foreground">{dayjs(dob).format('DD MMMM YYYY')}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Sales Cockpit: Counsellor, Disposition & Follow-Up */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Clock size={15} className="text-primary" />
          <span>Follow-up & Disposition</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Counsellor */}
          <div className="p-3 rounded-xl bg-background/60 border border-border/60">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">
              Lead Counsellor
            </span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                {(lead.assignedTo?.name || lead.assigned_to?.name || 'U').charAt(0)}
              </div>
              <span className="font-semibold text-foreground">
                {lead.assignedTo?.name || lead.assigned_to?.name || <span className="text-muted-foreground italic font-normal">Unassigned</span>}
              </span>
            </div>
          </div>

          {/* Pipeline Stage */}
          <div className="p-3 rounded-xl bg-background/60 border border-border/60">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">
              Pipeline Stage
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
              {stageName}
            </span>
          </div>

          {/* Disposition */}
          <div className="p-3 rounded-xl bg-background/60 border border-border/60">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">
              Last Call Disposition
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-muted text-foreground border border-border">
              {disposition}
            </span>
          </div>

          {/* Next Follow-Up */}
          <div
            className={`p-3 rounded-xl border ${
              isOverdue
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
                : 'bg-background/60 border-border/60'
            }`}
          >
            <span
              className={`text-[10px] uppercase font-bold tracking-wider block mb-1 ${
                isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
              }`}
            >
              Next Follow-up
            </span>
            <span className={`font-semibold flex items-center gap-1.5 ${isOverdue ? 'font-bold' : 'text-foreground'}`}>
              <Calendar size={13} className={isOverdue ? 'text-rose-500' : 'text-muted-foreground'} />
              {nextFollowUp ? (
                <span>{dayjs(nextFollowUp).format('DD MMM YYYY, hh:mm A')}</span>
              ) : (
                <span className="text-muted-foreground italic font-normal">Not scheduled</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Custom Attributes Card */}
      {customEntries.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Tag size={15} className="text-primary" />
            <span>Custom Attributes</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {customEntries.map(([k, v]) => (
              <div key={k} className="p-2.5 rounded-xl bg-background/60 border border-border/60">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-0.5 capitalize">
                  {k.replace(/_/g, ' ')}
                </span>
                <span className="font-semibold text-foreground">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Notes & Timeline Activity Log */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <MessageSquare size={15} className="text-primary" />
            <span>Notes & Activity</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Ingested on {dayjs(lead.createdAt || lead.created_at).format('DD MMM YYYY, hh:mm A')}
          </span>
        </div>

        {/* Existing notes */}
        {lead.notes ? (
          <div className="p-3.5 rounded-xl bg-background/60 border border-border/80 text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {lead.notes}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-muted/20 border border-dashed border-border text-center text-xs text-muted-foreground">
            No notes logged yet for this lead.
          </div>
        )}

        {/* Add quick note */}
        <div className="pt-2 flex items-center gap-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Type a new update or call summary..."
            className="text-xs min-h-[38px] max-h-24 resize-none bg-background rounded-xl border-border"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddNote();
              }
            }}
          />
          <Button
            type="button"
            onClick={handleAddNote}
            disabled={!newNote.trim() || updateMutation.isPending}
            size="sm"
            className="h-9 px-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shrink-0"
          >
            <Send size={13} className="mr-1" />
            Post
          </Button>
        </div>
      </div>

      {/* 6. Conversion / Promotion Section */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
        {isConverted ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <UserCheck size={18} />
                <span className="text-xs font-bold uppercase tracking-wider">Converted Contact</span>
              </div>
              {lead.party_id && (
                <Link
                  to={`/parties/$id`}
                  params={{ id: lead.party_id }}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  onClick={onClose}
                >
                  <span>View Contact Profile</span>
                  <ArrowRight size={13} />
                </Link>
              )}
            </div>
            <p className="text-xs text-emerald-600/90 dark:text-emerald-400/90">
              This lead has graduated from sales pipeline and is a full contact in your workspace.
            </p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Ready to Enroll or Convert?
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Convert this lead into a permanent Contact and Student Profile.
              </p>
            </div>

            {!showConvertForm ? (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    const defaultVerticalId = verticalId || verticals[0]?.id || '';
                    convertMutation.mutate({
                      vertical_id: defaultVerticalId,
                    });
                  }}
                  disabled={convertMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 h-9 text-xs rounded-xl font-bold"
                >
                  <UserCheck size={14} />
                  <span>Convert to Contact</span>
                </Button>
                <Button
                  onClick={() => setShowConvertForm(true)}
                  variant="outline"
                  size="sm"
                  className="border-border text-foreground hover:bg-muted h-9 text-xs rounded-xl font-semibold"
                >
                  Settings...
                </Button>
              </div>
            ) : (
              <form onSubmit={handleConvert} className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={verticalId} onValueChange={setVerticalId}>
                  <SelectTrigger className="h-9 w-44 border-border bg-background text-xs">
                    <SelectValue placeholder="Select vertical..." />
                  </SelectTrigger>
                  <SelectContent>
                    {verticals.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConvertForm(false)}
                  className="h-9 text-xs text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={convertMutation.isPending}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs font-bold rounded-xl"
                >
                  {convertMutation.isPending ? 'Converting...' : 'Confirm'}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Campaign Opt-In Modal */}
      <CampaignOptInModal
        open={optInOpen}
        onOpenChange={setOptInOpen}
        leadIds={[lead.id]}
        leadNames={[lead.name]}
        currentCampaignId={lead.campaign?.id || null}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          onChanged?.();
        }}
      />
    </div>
  );
}
