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
  Loader2,
  ChevronRight,
  Megaphone,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
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
};

function EventBadge({ event }: { event: LeadEventResponse }) {
  if (event.event_type === 'lead_created') {
    return <span className="text-xs text-muted-foreground">Lead created</span>;
  }
  if (event.event_type === 'stage_changed') {
    return (
      <span className="text-xs text-muted-foreground">
        Stage changed: {event.from_stage ?? '—'} → {event.to_stage ?? '—'}
      </span>
    );
  }
  if (event.event_type === 'promoted') {
    return <span className="text-xs font-semibold text-emerald-600">Promoted to Contact</span>;
  }
  return <span className="text-xs text-muted-foreground">{event.event_type}</span>;
}

export function LeadDetailFull({ leadId }: LeadDetailFullProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [showPipelineDialog, setShowPipelineDialog] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [promoteAssignmentId, setPromoteAssignmentId] = useState('');
  const [promoteAssignedToId, setPromoteAssignedToId] = useState('');
  const [noteText, setNoteText] = useState('');

  const { data: lead, isLoading } = useQuery<LeadResponse>({
    queryKey: ['lead', leadId],
    queryFn: () => leadsApi.get(leadId),
    staleTime: 15_000,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['settings', 'assignments'],
    queryFn: () => settingsApi.assignments.list(),
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

  const convertMutation = useMutation({
    mutationFn: (data: { branch_brand_assignment_id: string; assigned_to_id?: string }) =>
      leadsApi.convert(leadId, data),
    onSuccess: (res) => {
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
      toast.success('Lead updated');
    },
    onError: () => toast.error('Failed to update'),
  });

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await updateMutation.mutateAsync({ notes: noteText.trim() } as any);
    setNoteText('');
  };

  const isConverted = lead?.status === 'converted';

  if (isLoading) {
    return (
      <div className="space-y-5 max-w-[1280px]">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Lead not found</p>
      </div>
    );
  }

  const events = lead.events ?? [];
  const pipeline = lead.pipelineDefinition;

  return (
    <div className="max-w-[1280px]">
      {/* Back + header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <button
            onClick={() => navigate({ to: '/leads' })}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft size={14} />
            All Leads
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm">
              {lead.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-medium text-foreground tracking-tight">{lead.name}</h1>
                <Badge variant={isConverted ? 'success' : 'default'} className="capitalize">
                  {lead.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
                <span>Source: {lead.source}</span>
                {lead.campaign_id && <><span className="text-border">·</span><span>Campaign: {lead.campaign_id}</span></>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isConverted && (
            <>
              {!lead.pipeline_definition_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPipelineDialog(true)}
                  className="border-border text-muted-foreground h-8"
                >
                  <TrendingUp size={14} className="mr-1.5" />
                  Add to Pipeline
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  if (assignments.length === 0) {
                    toast.error('No branch/brand assignments configured');
                    return;
                  }
                  setPromoteAssignmentId(assignments[0]?.id ?? '');
                  setShowPromoteDialog(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
              >
                <UserCheck size={14} className="mr-1.5" />
                Promote to Contact
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Pipeline stage bar */}
      {pipeline && lead.stage && (
        <div className="mb-5">
          <Card className="bg-card border-border rounded-xl shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {pipeline.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  Stage: {pipeline.stages.find(s => s.id === lead.stage)?.name ?? lead.stage}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {pipeline.stages.map((stage, idx) => {
                  const isActive = stage.id === lead.stage;
                  const isPast = pipeline.stages.findIndex(s => s.id === lead.stage) > idx;
                  return (
                    <div key={stage.id} className="flex items-center flex-1">
                      <div className={`h-2 flex-1 rounded-full transition-colors ${
                        isActive ? 'bg-primary' : isPast ? 'bg-emerald-400' : 'bg-muted'
                      }`} />
                      {idx < pipeline.stages.length - 1 && (
                        <div className={`w-1 h-1 rounded-full mx-0.5 ${
                          isActive || isPast ? 'bg-primary' : 'bg-muted'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                {pipeline.stages.map(stage => (
                  <span key={stage.id} className={`text-[9px] font-medium ${
                    stage.id === lead.stage ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {stage.name}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main layout */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Left: Timeline */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="bg-card border-border rounded-xl shadow-none overflow-hidden">
            <CardHeader className="pb-2 px-4 pt-3">
              <CardTitle className="text-sm font-semibold text-foreground">Timeline</CardTitle>
            </CardHeader>
            <Separator />
            <div className="max-h-[500px] overflow-auto">
              {events.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <FileText size={24} className="text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {events.map((event) => (
                    <div key={event.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5">
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
                  ))}
                </div>
              )}
            </div>

            {/* Notes composer */}
            {!isConverted && (
              <div className="border-t border-border p-3 bg-muted/30">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note..."
                    className="min-h-[36px] max-h-[120px] resize-none bg-card border-border text-sm"
                    rows={1}
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
                    disabled={!noteText.trim()}
                    className="h-8 w-8 p-0 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                  >
                    <Send size={14} />
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Notes display */}
          {lead.notes && (
            <Card className="bg-card border-border rounded-xl shadow-none">
              <CardHeader className="pb-2 px-4 pt-3">
                <CardTitle className="text-sm font-semibold text-foreground">Notes</CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Info panels */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact info */}
          <Card className="bg-card border-border rounded-xl shadow-none">
            <CardHeader className="pb-2 px-4 pt-3">
              <CardTitle className="text-sm font-semibold text-foreground">Contact Details</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2.5 text-sm">
                <Phone size={14} className="text-muted-foreground shrink-0" />
                <span className="font-mono font-medium text-foreground">{lead.phone}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Mail size={14} className="text-muted-foreground shrink-0" />
                <span className="text-foreground">{lead.email ?? 'No email'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Calendar size={14} className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{dayjs(lead.created_at).format('DD MMM YYYY, h:mm A')}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <User size={14} className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  {lead.assigned_to?.name ?? <span className="italic">Unassigned</span>}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Campaign attribution */}
          {lead.campaign_id && (
            <Card className="bg-card border-border rounded-xl shadow-none">
              <CardHeader className="pb-2 px-4 pt-3">
                <CardTitle className="text-sm font-semibold text-foreground">Campaign</CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Megaphone size={14} className="text-muted-foreground" />
                    <span className="text-foreground font-medium">{lead.campaign_id}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Source: {lead.source}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Form attributes */}
          {lead.attributes && Object.keys(lead.attributes).length > 0 && (
            <Card className="bg-card border-border rounded-xl shadow-none">
              <CardHeader className="pb-2 px-4 pt-3">
                <CardTitle className="text-sm font-semibold text-foreground">Form Attributes</CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="p-4 space-y-2">
                {Object.entries(lead.attributes).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-foreground">{String(val)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Duplicate warning */}
          {(lead as any).duplicate_risk && (
            <Card className="bg-card border border-amber-200 rounded-xl shadow-none">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Potential Duplicate</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    A contact with this phone number already exists in your workspace.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Promoted party card */}
          {isConverted && lead.party && (
            <Card className="bg-card border-border rounded-xl shadow-none">
              <CardHeader className="pb-2 px-4 pt-3">
                <CardTitle className="text-sm font-semibold text-foreground">Promoted Contact</CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <UserCheck size={16} className="text-emerald-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{lead.party.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.party.phone_raw}</p>
                  </div>
                  <Link
                    to="/parties/$id"
                    params={{ id: lead.party.id }}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    View <ChevronRight size={12} />
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Promote Dialog */}
      <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Promote to Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Branch / Brand Assignment</Label>
              <Select value={promoteAssignmentId} onValueChange={setPromoteAssignmentId}>
                <SelectTrigger className="h-9 border-border">
                  <SelectValue placeholder="Select assignment..." />
                </SelectTrigger>
                <SelectContent>
                  {assignments.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.brand?.name ?? 'Brand'} — {a.branch?.name ?? 'Branch'}
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
              className="border-border text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={() => convertMutation.mutate({ branch_brand_assignment_id: promoteAssignmentId })}
              disabled={!promoteAssignmentId || convertMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {convertMutation.isPending ? 'Promoting...' : 'Confirm & Promote'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Pipeline Dialog */}
      <Dialog open={showPipelineDialog} onOpenChange={setShowPipelineDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Pipeline</Label>
              <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                <SelectTrigger className="h-9 border-border">
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
              className="border-border text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={() => addToPipelineMutation.mutate({ leadId, pipelineId: selectedPipelineId })}
              disabled={!selectedPipelineId || addToPipelineMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {addToPipelineMutation.isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


