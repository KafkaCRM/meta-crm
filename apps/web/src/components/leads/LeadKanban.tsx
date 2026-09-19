import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { leadsApi, type LeadResponse } from '@/api/leads';
import { settingsApi } from '@/api/settings';
import { useBranch } from '@/contexts/branch.context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Phone,
  MessageSquare,
  Clock,
  User,
  Plus,
  Loader2,
  ChevronRight,
  AlertTriangle,
  GraduationCap,
  Flame,
  Zap,
  Snowflake,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { cn } from '@/lib/utils';

dayjs.extend(relativeTime);

interface LeadKanbanProps {
  pipelineDefinitionId?: string;
}

export function LeadKanban({ pipelineDefinitionId: initialPipelineId }: LeadKanbanProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedBranchIds, selectedVerticalIds, isLoading: branchLoading } = useBranch();
  const hasBranchFilter = selectedBranchIds.length > 0;

  const { data: pipelines = [] } = useQuery({
    queryKey: ['settings', 'pipelines', selectedBranchIds.slice().sort().join(',') || 'all', ...selectedVerticalIds],
    queryFn: () => settingsApi.pipelines.list(hasBranchFilter ? { branch_ids: selectedBranchIds.join(',') } : undefined),
    enabled: !hasBranchFilter || selectedVerticalIds.length > 0 || !branchLoading,
  });

  const [selectedPipelineId, setSelectedPipelineId] = useState(
    initialPipelineId || (pipelines as any[])?.[0]?.id || '',
  );

  useEffect(() => {
    if (initialPipelineId && initialPipelineId !== selectedPipelineId) {
      setSelectedPipelineId(initialPipelineId);
    }
  }, [initialPipelineId]);

  useEffect(() => {
    if (pipelines.length > 0) {
      if (!selectedPipelineId || !pipelines.some((p: any) => p.id === selectedPipelineId)) {
        setSelectedPipelineId(pipelines[0].id);
      }
    }
  }, [pipelines, selectedPipelineId]);

  const activePipelineId = selectedPipelineId || (pipelines as any[])?.[0]?.id;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['leads', 'by-stage', activePipelineId],
    queryFn: () => leadsApi.byStage(activePipelineId!),
    enabled: !!activePipelineId,
    staleTime: 15_000,
    retry: 1,
  });

  const transitionMutation = useMutation({
    mutationFn: ({ leadId, toStageId }: { leadId: string; toStageId: string }) =>
      leadsApi.transitionStage(leadId, toStageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'by-stage'] });
    },
    onError: () => toast.error('Failed to move lead'),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const leadId = String(active.id);
      const toStageId = String(over.id);
      transitionMutation.mutate({ leadId, toStageId });
    },
    [transitionMutation],
  );

  const stages = data?.stages ?? [];
  const leadsByStage = data?.leads ?? {};

  if (!activePipelineId && pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
        <p className="font-semibold text-foreground">No pipelines configured</p>
        <p className="text-xs text-muted-foreground mt-1">
          Go to Settings → Pipelines to create one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pipeline selector */}
      {pipelines.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Pipeline:</span>
          <Select value={activePipelineId} onValueChange={setSelectedPipelineId}>
            <SelectTrigger className="h-8 w-56 border-border text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(pipelines as any[]).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertTriangle size={28} className="text-rose-500/60 mb-3" />
          <p className="font-semibold text-foreground">Failed to load pipeline</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </div>
      ) : stages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-semibold text-foreground">No stages configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            Configure pipeline stages in Settings first.
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {stages.map((stage: any) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                stageLeads={leadsByStage[stage.id] ?? []}
                onCardClick={(leadId) => navigate({ to: '/leads/$id', params: { id: leadId } })}
              />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}

function KanbanColumn({
  stage,
  stageLeads,
  onCardClick,
}: {
  stage: any;
  stageLeads: any[];
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  return (
    <div className="flex-shrink-0 w-72">
      {/* Stage header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{stage.name}</span>
          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {stageLeads.length}
          </span>
        </div>
        {stage.terminal_outcome && (
          <Badge variant={stage.terminal_outcome === 'won' ? 'success' : 'destructive'} className="text-[9px]">
            {stage.terminal_outcome}
          </Badge>
        )}
      </div>

      {/* Drop zone + cards */}
      <div
        ref={setNodeRef}
        className={cn(
          'space-y-2 min-h-[300px] rounded-xl bg-muted/30 border border-dashed p-2 transition-colors',
          isOver ? 'border-primary bg-primary/10' : 'border-border/50',
        )}
      >
        {stageLeads.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-[10px] text-muted-foreground italic">
            Drop leads here
          </div>
        ) : (
          stageLeads.map((lead: any) => (
            <LeadKanbanCard
              key={lead.id}
              lead={lead}
              stageId={stage.id}
              onClick={() => onCardClick(lead.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function LeadKanbanCard({
  lead,
  stageId,
  onClick,
}: {
  lead: any;
  stageId: string;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead, stageId },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  const attrs = (lead.attributes || {}) as Record<string, any>;
  const course = attrs.course || null;
  const scoreNum = Number(attrs.score || (lead.status === 'hot' ? 85 : lead.status === 'warm' ? 60 : 38));
  const whatsappNum = attrs.whatsapp_number || lead.phone;
  const nextFollowUp = attrs.next_follow_up_date || null;
  const isOverdue = nextFollowUp && dayjs(nextFollowUp).isBefore(dayjs());
  const hoursSinceCreation = dayjs().diff(dayjs(lead.created_at || lead.createdAt), 'hour');
  const isStale = hoursSinceCreation > 24 && lead.status !== 'converted';

  const cleanWhatsApp = (whatsappNum || lead.phone || '').replace(/\D/g, '');
  const waLink = `https://wa.me/${cleanWhatsApp.startsWith('91') ? cleanWhatsApp : `91${cleanWhatsApp}`}?text=${encodeURIComponent(
    `Hello ${lead.name}, I am reaching out from our admissions team regarding your course inquiry.`
  )}`;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Card
        className={cn(
          'group bg-card border-border rounded-xl shadow-none hover:shadow-md hover:border-primary/40 transition-all cursor-grab active:cursor-grabbing relative overflow-hidden',
          isDragging && 'opacity-50 ring-2 ring-primary shadow-lg',
        )}
        onClick={onClick}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-bold text-foreground truncate">{lead.name}</p>
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold border shrink-0',
                    scoreNum >= 75
                      ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                      : scoreNum >= 50
                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                  )}
                >
                  {scoreNum >= 75 ? (
                    <Flame size={10} className="text-rose-500" />
                  ) : scoreNum >= 50 ? (
                    <Zap size={10} className="text-amber-500" />
                  ) : (
                    <Snowflake size={10} className="text-blue-500" />
                  )}
                  {scoreNum}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate">{lead.phone}</p>
            </div>

            {lead.status === 'converted' ? (
              <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Promoted
              </span>
            ) : (
              <div
                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <a
                  href={`tel:${lead.phone}`}
                  className="p-1 rounded-md bg-muted hover:bg-primary hover:text-white transition-colors text-muted-foreground"
                  title="Call"
                >
                  <Phone size={11} />
                </a>
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 rounded-md bg-muted hover:bg-emerald-600 hover:text-white transition-colors text-muted-foreground"
                  title="WhatsApp"
                >
                  <MessageSquare size={11} />
                </a>
              </div>
            )}
          </div>

          {course && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary bg-primary/5 border border-primary/15 px-2 py-0.5 rounded-md w-fit max-w-full truncate">
              <GraduationCap size={12} className="shrink-0" />
              <span className="truncate">{course}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
            <span className="bg-muted px-1.5 py-0.5 rounded-md font-medium capitalize">{lead.source}</span>
            {lead.duplicate_risk && (
              <span className="text-amber-600 flex items-center gap-0.5 font-semibold">
                <AlertTriangle size={10} />
                Dupe
              </span>
            )}
            {isOverdue && (
              <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5 font-bold">
                <Clock size={10} />
                Overdue
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 border-t border-border/50">
            <div className="flex items-center gap-1">
              <Clock size={10} />
              <span className={cn(isStale ? 'text-amber-600 font-medium' : '')}>
                {dayjs(lead.created_at || lead.createdAt).fromNow()}
              </span>
            </div>
            {(lead.assigned_to || lead.assignedTo) && (
              <div className="flex items-center gap-1">
                <User size={10} />
                <span className="truncate max-w-[85px] font-medium text-foreground">
                  {(lead.assigned_to || lead.assignedTo)?.name}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
