import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { leadsApi, type LeadResponse, type LeadEventResponse } from '@/api/leads';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  User,
  FileText,
  Circle,
  Send,
  Plus,
  AlertTriangle,
  TrendingUp,
  UserCheck,
  ChevronRight,
  Megaphone,
  GitBranch,
  Layers,
  GitFork,
  GraduationCap,
  MapPin,
  Clock,
  MessageSquare,
  Copy,
  Check,
  Flame,
  Zap,
  Snowflake,
  ShieldAlert,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { CampaignOptInModal } from './CampaignOptInModal';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface LeadDetailFullProps {
  leadId: string;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  lead_created: <Plus size={14} className="text-blue-500" />,
  stage_changed: <TrendingUp size={14} className="text-amber-500" />,
  promoted: <UserCheck size={14} className="text-emerald-500" />,
  interaction_logged: <Phone size={14} className="text-primary" />,
  lead_updated: <FileText size={14} className="text-purple-500" />,
};

function EventBadge({ event }: { event: LeadEventResponse }) {
  if (event.event_type === 'lead_created') {
    return <span className="text-xs text-muted-foreground">Lead created</span>;
  }
  if (event.event_type === 'stage_changed') {
    return (
      <span className="text-xs text-muted-foreground">
        Stage changed: <strong className="text-foreground">{event.from_stage ?? '—'}</strong> →{' '}
        <strong className="text-foreground">{event.to_stage ?? '—'}</strong>
      </span>
    );
  }
  if (event.event_type === 'promoted') {
    return <span className="text-xs font-semibold text-emerald-600">Promoted to Contact</span>;
  }
  if (event.event_type === 'interaction_logged') {
    return (
      <span className="text-xs text-muted-foreground">
        Interaction logged: <span className="font-semibold text-foreground capitalize">{event.metadata?.type || 'Activity'}</span>
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground capitalize">{event.event_type.replace(/_/g, ' ')}</span>;
}

export function LeadDetailFull({ leadId }: LeadDetailFullProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [showPipelineDialog, setShowPipelineDialog] = useState(false);
  const [optInOpen, setOptInOpen] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [promoteVerticalId, setPromoteVerticalId] = useState('');
  const [noteText, setNoteText] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: lead, isLoading } = useQuery<LeadResponse>({
    queryKey: ['lead', leadId],
    queryFn: () => leadsApi.get(leadId),
    staleTime: 15_000,
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ['settings', 'verticals'],
    queryFn: () => settingsApi.verticals.list(),
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ['settings', 'pipelines'],
    queryFn: () => settingsApi.pipelines.list(),
  });

  const addToPipelineMutation = useMutation({
    mutationFn: ({ leadId, pipelineId }: { leadId: string; pipelineId: string }) =>
      leadsApi.addToPipeline(leadId, pipelineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      toast.success('Lead added to pipeline');
      setShowPipelineDialog(false);
    },
    onError: () => toast.error('Failed to add to pipeline'),
  });

  const transitionMutation = useMutation({
    mutationFn: (toStageId: string) => leadsApi.transitionStage(leadId, toStageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      toast.success('Stage updated successfully');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update stage'),
  });

  const convertMutation = useMutation({
    mutationFn: (data: { vertical_id: string; assigned_to_id?: string }) =>
      leadsApi.convert(leadId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      toast.success('Lead promoted to Contact!');
      setShowPromoteDialog(false);
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to promote lead'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<LeadResponse>) => leadsApi.update(leadId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      toast.success('Lead updated successfully');
    },
    onError: () => toast.error('Failed to update lead'),
  });

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    const existing = lead?.notes || '';
    const timestamp = dayjs().format('DD MMM YYYY, hh:mm A');
    const updatedNotes = existing
      ? `${existing}\n\n[${timestamp}] ${noteText.trim()}`
      : `[${timestamp}] ${noteText.trim()}`;

    await updateMutation.mutateAsync({ notes: updatedNotes } as any);
    setNoteText('');
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-[1280px] mx-auto p-6">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-4">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert size={36} className="text-destructive mb-3" />
        <h3 className="text-lg font-bold text-foreground">Lead not found</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          This lead record does not exist or you may not have access to view it.
        </p>
        <Button onClick={() => navigate({ to: '/leads' })} variant="outline">
          Back to Leads Directory
        </Button>
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
  const isOverdue = nextFollowUp && dayjs(nextFollowUp).isBefore(dayjs());

  const cleanWhatsApp = (whatsappNum || lead.phone || '').replace(/\D/g, '');
  const waLink = `https://wa.me/${cleanWhatsApp.startsWith('91') ? cleanWhatsApp : `91${cleanWhatsApp}`}?text=${encodeURIComponent(
    `Hello ${lead.name}, I am reaching out from our admissions team regarding your interest in ${course || 'our courses'}. How can we assist you today?`
  )}`;

  const events = lead.events ?? [];
  const pipeline = lead.pipelineDefinition;

  return (
    <div className="max-w-[1280px] mx-auto p-4 sm:p-6 space-y-6">
      {/* 1. Header Navigation & Identity */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate({ to: '/leads' })}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3 cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Back to Leads</span>
          </button>

          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-primary flex items-center justify-center font-bold text-xl border border-primary/20 shadow-xs">
                {lead.name.charAt(0).toUpperCase()}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background ${
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
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">{lead.name}</h1>
                <Badge variant={isConverted ? 'success' : 'default'} className="capitalize">
                  {lead.status}
                </Badge>
                {isDuplicate && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs font-bold">
                    Duplicate
                  </Badge>
                )}
                {isSlaBreached && (
                  <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 text-xs font-bold">
                    SLA Breached
                  </Badge>
                )}
              </div>

              {/* Status Selector & Score Bar */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <Select
                    value={lead.status}
                    onValueChange={(val) => updateMutation.mutate({ status: val })}
                    disabled={updateMutation.isPending || isConverted}
                  >
                    <SelectTrigger className="h-7 text-xs font-semibold px-2.5 rounded-lg border-border bg-card capitalize">
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
                </div>

                {/* Score Pill */}
                <div
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold border ${
                    scoreNum >= 75
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      : scoreNum >= 50
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                  }`}
                >
                  {scoreNum >= 75 ? (
                    <Flame size={13} className="text-rose-500" />
                  ) : scoreNum >= 50 ? (
                    <Zap size={13} className="text-amber-500" />
                  ) : (
                    <Snowflake size={13} className="text-blue-500" />
                  )}
                  <span>Score: {scoreNum}</span>
                </div>

                <Badge variant="outline" className="text-xs capitalize font-medium text-muted-foreground">
                  Source: {lead.source}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Strip */}
        <div className="flex items-center gap-2 flex-wrap self-end md:self-start">
          <a
            href={`tel:${lead.phone}`}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-colors"
          >
            <Phone size={14} />
            <span>Call</span>
          </a>

          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <MessageSquare size={14} />
            <span>WhatsApp</span>
          </a>

          <Button
            onClick={() => setOptInOpen(true)}
            variant="outline"
            size="sm"
            className="h-9 text-xs font-semibold border-border hover:bg-muted rounded-xl"
          >
            <Megaphone size={14} className="mr-1.5 text-primary" />
            Opt-in Campaign
          </Button>

          {!isConverted && (
            <>
              {!lead.pipeline_definition_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPipelineDialog(true)}
                  className="border-border text-foreground hover:bg-muted h-9 text-xs rounded-xl font-semibold"
                >
                  <TrendingUp size={14} className="mr-1.5" />
                  Assign Pipeline
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  if (verticals.length === 0) {
                    toast.error('No verticals configured');
                    return;
                  }
                  setPromoteVerticalId(verticals[0]?.id ?? '');
                  setShowPromoteDialog(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs rounded-xl font-bold shadow-xs"
              >
                <UserCheck size={14} className="mr-1.5" />
                Promote to Contact
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 2. Cascading Hierarchy Breadcrumb Strip */}
      <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider mr-1">
          Branch & Routing Path:
        </span>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/80 font-medium text-foreground">
          <GitBranch size={13} className="text-primary" />
          <span>{branchName}</span>
        </div>
        <span className="text-muted-foreground/40 font-bold">›</span>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/80 font-medium text-foreground">
          <Layers size={13} className="text-emerald-500" />
          <span>{verticalName}</span>
        </div>
        <span className="text-muted-foreground/40 font-bold">›</span>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/80 font-medium text-foreground">
          <GitFork size={13} className="text-purple-500" />
          <span>{pipelineName}</span>
        </div>
        {lead.campaign && (
          <>
            <span className="text-muted-foreground/40 font-bold">›</span>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 font-semibold text-primary">
              <Megaphone size={13} />
              <span>{lead.campaign.name}</span>
            </div>
          </>
        )}
      </div>

      {/* 3. Interactive Pipeline Stage Stepper (if pipeline attached) */}
      {pipeline && pipeline.stages && pipeline.stages.length > 0 && (
        <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <TrendingUp size={15} className="text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {pipeline.name} Stages
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Current Stage:{' '}
                <strong className="text-foreground">
                  {pipeline.stages.find((s) => s.id === lead.stage)?.name ?? lead.stage ?? 'Not set'}
                </strong>
              </span>
            </div>

            {/* Stage Steps Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {pipeline.stages.map((stage, idx) => {
                const isActive = stage.id === lead.stage;
                const isPast = (pipeline.stages || []).findIndex((s) => s.id === lead.stage) > idx;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => {
                      if (!isActive) {
                        transitionMutation.mutate(stage.id);
                      }
                    }}
                    disabled={transitionMutation.isPending || isConverted}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20'
                        : isPast
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/15'
                        : 'bg-background hover:bg-muted/50 border-border text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                        Step {idx + 1}
                      </span>
                      {isPast && <Check size={12} className="text-emerald-600 dark:text-emerald-400" />}
                    </div>
                    <span className="text-xs font-semibold truncate w-full">{stage.name}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Main Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left Column (3/5): Timeline & Notes */}
        <div className="lg:col-span-3 space-y-6">
          {/* Notes Log & Composer */}
          <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="pb-3 px-5 pt-4 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                <span>Notes & Interaction Journal</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {lead.notes ? (
                <div className="p-4 rounded-xl bg-background border border-border text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                  {lead.notes}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-2">
                  No notes recorded yet. Type below to add an interaction summary.
                </p>
              )}

              {/* Note Composer */}
              {!isConverted && (
                <div className="flex items-end gap-2 pt-2 border-t border-border">
                  <Textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Write a new update, call note, or follow-up summary..."
                    className="min-h-[42px] max-h-32 text-xs bg-background rounded-xl border-border resize-none"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddNote();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleAddNote}
                    disabled={!noteText.trim() || updateMutation.isPending}
                    className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shrink-0 shadow-xs"
                  >
                    <Send size={14} className="mr-1.5" />
                    Post
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="pb-3 px-5 pt-4 border-b border-border">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                <span>Activity & Audit Trail</span>
              </CardTitle>
            </CardHeader>
            <div className="max-h-[460px] overflow-y-auto divide-y divide-border">
              {events.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
                  <FileText size={28} className="text-muted-foreground/50 mb-2" />
                  <p className="text-sm">No activity recorded yet</p>
                </div>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5 p-1 rounded-md bg-muted/60">
                        {EVENT_ICONS[event.event_type] ?? <Circle size={14} className="text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <EventBadge event={event} />
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {dayjs(event.occurred_at).format('DD MMM YYYY, h:mm A')} · {dayjs(event.occurred_at).fromNow()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Column (2/5): Dossier & Contact Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Academic & Course Program Card */}
          {(course || trainingMode || courseFee) && (
            <Card className="border-border bg-card rounded-2xl shadow-xs">
              <CardHeader className="pb-3 px-5 pt-4 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <GraduationCap size={16} className="text-primary" />
                  <span>Academic Interest</span>
                </CardTitle>
                {trainingMode && (
                  <Badge variant="outline" className="text-[11px] font-medium bg-background">
                    {trainingMode}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                {course && (
                  <div className="p-3 rounded-xl bg-background border border-border">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-0.5">
                      Course Target
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
                      Expected Fee
                    </span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{Number(courseFee).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Contact Details Card */}
          <Card className="border-border bg-card rounded-2xl shadow-xs">
            <CardHeader className="pb-3 px-5 pt-4 border-b border-border">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <User size={16} className="text-primary" />
                <span>Contact Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3 text-xs">
              {/* Primary Mobile */}
              <div className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Phone size={14} className="text-primary shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                      Primary Phone
                    </span>
                    <span className="font-mono font-bold text-foreground text-sm">{lead.phone}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(lead.phone, 'Mobile')}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                  title="Copy Phone"
                >
                  {copiedField === 'Mobile' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>

              {/* WhatsApp Number */}
              <div className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <MessageSquare size={14} className="text-emerald-500 shrink-0" />
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
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                >
                  {copiedField === 'WhatsApp' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>

              {/* Alternate Phone */}
              {altPhone && (
                <div className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Phone size={14} className="text-muted-foreground shrink-0" />
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
                    className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                  >
                    {copiedField === 'Alt Phone' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              )}

              {/* Parents Number */}
              {parentsPhone && (
                <div className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <User size={14} className="text-purple-500 shrink-0" />
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
                    className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                  >
                    {copiedField === 'Parent Contact' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              )}

              {/* Email */}
              <div className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between">
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
                    className="text-muted-foreground hover:text-foreground p-1 rounded-md shrink-0"
                  >
                    {copiedField === 'Email' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                )}
              </div>

              {/* City */}
              {city && (
                <div className="p-2.5 rounded-xl bg-background border border-border flex items-center gap-2.5">
                  <MapPin size={14} className="text-rose-500 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                      City / Location
                    </span>
                    <span className="font-medium text-foreground">{city}</span>
                  </div>
                </div>
              )}

              {/* DOB */}
              {dob && (
                <div className="p-2.5 rounded-xl bg-background border border-border flex items-center gap-2.5">
                  <Calendar size={14} className="text-amber-500 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                      Date of Birth
                    </span>
                    <span className="font-medium text-foreground">{dayjs(dob).format('DD MMMM YYYY')}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Counsellor, Disposition & Follow-Up Card */}
          <Card className="border-border bg-card rounded-2xl shadow-xs">
            <CardHeader className="pb-3 px-5 pt-4 border-b border-border">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                <span>Sales Cockpit</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                <span className="text-muted-foreground">Lead Counsellor:</span>
                <span className="font-bold text-foreground">
                  {lead.assignedTo?.name || lead.assigned_to?.name || <span className="text-muted-foreground italic font-normal">Unassigned</span>}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                <span className="text-muted-foreground">Last Call Disposition:</span>
                <Badge variant="outline" className="font-semibold bg-card">
                  {disposition}
                </Badge>
              </div>

              <div
                className={`flex items-center justify-between p-2.5 rounded-xl border ${
                  isOverdue
                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
                    : 'bg-background border-border'
                }`}
              >
                <span className={isOverdue ? 'font-bold' : 'text-muted-foreground'}>Next Follow-up:</span>
                <span className={isOverdue ? 'font-bold' : 'font-semibold text-foreground'}>
                  {nextFollowUp ? dayjs(nextFollowUp).format('DD MMM YYYY, h:mm A') : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border">
                <span className="text-muted-foreground">Ingested Date:</span>
                <span className="font-medium text-foreground">
                  {dayjs(lead.createdAt || lead.created_at).format('DD MMM YYYY, h:mm A')}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Promoted Contact Card (if converted) */}
          {isConverted && lead.party && (
            <Card className="border-border bg-emerald-500/5 border-emerald-500/20 rounded-2xl shadow-xs">
              <CardHeader className="pb-3 px-5 pt-4 border-b border-emerald-500/20">
                <CardTitle className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <UserCheck size={16} className="text-emerald-600" />
                  <span>Promoted Contact Profile</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-foreground">{lead.party.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {lead.party.phone_raw || lead.party.phoneRaw}
                    </p>
                  </div>
                  <Link
                    to="/parties/$id"
                    params={{ id: lead.party.id }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <span>View Profile</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Promote to Contact Dialog */}
      <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Promote Lead to Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Assign to Vertical</Label>
              <Select value={promoteVerticalId} onValueChange={setPromoteVerticalId}>
                <SelectTrigger className="h-9 border-border bg-background">
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
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPromoteDialog(false)}
              className="border-border text-foreground rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={() => convertMutation.mutate({ vertical_id: promoteVerticalId })}
              disabled={!promoteVerticalId || convertMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold"
            >
              {convertMutation.isPending ? 'Promoting...' : 'Confirm & Promote'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Pipeline Dialog */}
      <Dialog open={showPipelineDialog} onOpenChange={setShowPipelineDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add to Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Pipeline</Label>
              <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                <SelectTrigger className="h-9 border-border bg-background">
                  <SelectValue placeholder="Select pipeline..." />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPipelineDialog(false)}
              className="border-border text-foreground rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={() => addToPipelineMutation.mutate({ leadId, pipelineId: selectedPipelineId })}
              disabled={!selectedPipelineId || addToPipelineMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold"
            >
              {addToPipelineMutation.isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        }}
      />
    </div>
  );
}
