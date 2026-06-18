import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
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
  const { selectedBranchId, selectedVerticalIds, isLoading: branchLoading } = useBranch();
  const pipelineVerticalIds = selectedBranchId ? selectedVerticalIds : [];
  const hasBranchFilter = !!selectedBranchId && pipelineVerticalIds.length > 0;

  const { data: pipelines = [] } = useQuery({
    queryKey: ['settings', 'pipelines', selectedBranchId || 'all', ...pipelineVerticalIds],
    queryFn: () => settingsApi.pipelines.list(hasBranchFilter ? { vertical_ids: pipelineVerticalIds.join(',') } : undefined),
    enabled: !selectedBranchId || selectedVerticalIds.length > 0,
  });

  const [selectedPipelineId, setSelectedPipelineId] = useState(
    initialPipelineId || (pipelines as any[])?.[0]?.id || '',
  );

  useEffect(() => {
    if (initialPipelineId && initialPipelineId !== selectedPipelineId) {
      setSelectedPipelineId(initialPipelineId);
    }
  }, [initialPipelineId]);

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
            {stages.map((stage: any) => {
              const stageLeads = leadsByStage[stage.id] ?? [];
              return (
                <div
                  key={stage.id}
                  className="flex-shrink-0 w-72"
                >
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
                    className="space-y-2 min-h-[200px] rounded-xl bg-muted/30 border border-dashed border-border/50 p-2"
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
                          onClick={() => navigate({ to: '/leads/$id', params: { id: lead.id } })}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DndContext>
      )}
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
  const hoursSinceCreation = dayjs().diff(dayjs(lead.created_at), 'hour');
  const isStale = hoursSinceCreation > 24 && lead.status !== 'converted';

  return (
    <Card
      className="bg-card border-border rounded-lg shadow-none hover:shadow-sm transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{lead.name}</p>
            <p className="text-xs text-muted-foreground font-mono truncate">{lead.phone}</p>
          </div>
          {lead.status === 'converted' && (
            <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Promoted
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="bg-muted px-1.5 py-0.5 rounded font-medium">{lead.source}</span>
          {lead.duplicate_risk && (
            <span className="text-amber-600 flex items-center gap-0.5">
              <AlertTriangle size={10} />
              Dupe
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
          <div className="flex items-center gap-1">
            <Clock size={10} />
            <span className={cn(isStale ? 'text-red-500 font-semibold' : '')}>
              {dayjs(lead.created_at).fromNow()}
            </span>
          </div>
          {lead.assigned_to && (
            <div className="flex items-center gap-1">
              <User size={10} />
              <span className="truncate max-w-[80px]">{lead.assigned_to.name}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
