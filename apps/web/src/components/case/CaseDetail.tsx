import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, User } from 'lucide-react';
import type { CaseDto, WorkflowStageDto, TimelineItem } from '@meta-crm/types';
import { Channel, Direction } from '@meta-crm/types';
import { casesApi } from '@/api/cases';
import { interactionsApi } from '@/api/interactions';
import { useRealtime } from '@/hooks/useRealtime';
import { usePermissions } from '@/hooks/usePermissions';
import { StageBar } from './StageBar';
import { CaseAttributePanel } from './CaseAttributePanel';
import { Timeline } from './Timeline';
import { ComposeBar } from './ComposeBar';
import { PluginSlot, usePluginTabs } from '@/lib/plugins';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface CaseDetailProps {
  caseId: string;
  onBack?: () => void;
  activePlugins?: string[];
  activeCapabilities?: string[];
}

const ATTRIBUTE_FIELDS = [
  { key: 'course', label: 'Course', type: 'select' as const, options: ['B.Tech', 'MBA', 'B.Com', 'B.Sc', 'M.Tech'] },
  { key: 'priority', label: 'Priority', type: 'select' as const, options: ['high', 'medium', 'low'] },
  { key: 'fee_structure', label: 'Fee Structure', type: 'text' as const },
  { key: 'notes', label: 'Notes', type: 'text' as const },
];

export function CaseDetail({
  caseId,
  onBack,
  activePlugins = [],
  activeCapabilities = [],
}: CaseDetailProps) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const [realtimeItems, setRealtimeItems] = useState<TimelineItem[]>([]);

  const { data: caseData, isLoading: caseLoading } = useQuery<CaseDto>({
    queryKey: ['cases', caseId],
    queryFn: () => casesApi.get(caseId, { include: 'campaign' }),
    staleTime: 30_000,
  });

  const { data: stages, isLoading: stagesLoading } = useQuery<WorkflowStageDto[]>({
    queryKey: ['workflows', 'stages', caseData?.workflow_definition_id],
    queryFn: () => casesApi.listStages(caseData!.workflow_definition_id),
    enabled: !!caseData?.workflow_definition_id,
    staleTime: 60_000,
  });

  const {
    data: timelinePages,
    isLoading: timelineLoading,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['interactions', 'case', caseId],
    queryFn: ({ pageParam }) =>
      interactionsApi.list({
        case_id: caseId,
        cursor: pageParam ?? undefined,
        limit: 20,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: !!caseId,
    staleTime: 10_000,
  });

  const combinedItems = useMemo(() => {
    const historical = timelinePages?.pages.flatMap((page) => page.items) ?? [];
    const all = [...realtimeItems, ...historical];
    const seen = new Set<string>();
    return all.filter((item) => {
      let id: string;
      if (item.kind === 'thread') {
        id = `thread_${item.data.thread_id}`;
      } else if (item.kind === 'interaction') {
        id = `interaction_${item.data.id}`;
      } else {
        id = `event_${(item.data as any).id ?? Math.random().toString()}`;
      }
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [realtimeItems, timelinePages]);

  useEffect(() => {
    setRealtimeItems([]);
  }, [caseId]);

  useRealtime('interaction:received', (payload: { case_id?: string; party_id?: string; channel: string; content: string }) => {
    if (payload.case_id === caseId) {
      const newItem: TimelineItem = {
        kind: 'interaction',
        data: {
          id: `temp_${Date.now()}`,
          tenant_id: caseData?.tenant_id ?? '',
          party_id: payload.party_id ?? '',
          case_id: caseId,
          channel: payload.channel as Channel,
          direction: Direction.Inbound,
          content: payload.content,
          thread_id: null,
          is_pinned: false,
          pinned_by: null,
          metadata: {},
          created_at: new Date().toISOString(),
        },
      };
      setRealtimeItems((prev) => [newItem, ...prev]);
    }
  });

  const transitionMutation = useMutation({
    mutationFn: (toStageId: string) =>
      casesApi.transitionStage(caseId, { to_stage_id: toStageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases', caseId] });
      toast.success('Stage updated');
    },
    onError: (error: { code?: string; message?: string; unmet?: string[] }) => {
      if (error.code === 'CRITERIA_UNMET' && error.unmet) {
        toast.error('Cannot transition', {
          description: (
            <ul className="mt-1 list-disc list-inside">
              {error.unmet.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          ),
        });
      } else {
        toast.error('Stage transition failed', {
          description: error.message ?? 'An unexpected error occurred',
        });
      }
    },
  });

  const allowedTransitions = useMemo(() => {
    if (!caseData || !stages) return [];
    const currentOrder = stages.find((s) => s.id === caseData.stage)?.order ?? 0;
    return stages
      .filter((s) => s.order > currentOrder)
      .map((s) => s.id);
  }, [caseData, stages]);

  if (caseLoading || stagesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading case details...</div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Case not found</div>
      </div>
    );
  }

  const currentStage = stages?.find((s) => s.id === caseData.stage);

  const { tabs: pluginTabs } = usePluginTabs({ caseId, caseData }, activePlugins);

  const hasAcademicCapability = activeCapabilities.some(
    (c) => c === 'capability/enrollment' || c === 'capability-enrollment'
  );

  return (
    <div className="flex flex-col h-[calc(100vh-60px)]">
      <div className="flex-shrink-0 border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1 rounded hover:bg-muted"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h1 className="text-lg font-semibold">{caseData.title}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>{caseData.type}</span>
                <span>·</span>
                <span>{currentStage?.name ?? 'Unknown stage'}</span>
                {(caseData as any).campaign && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                      Campaign: {(caseData as any).campaign.name} ({(caseData as any).campaign.channel})
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {caseData.assigned_to_id ? (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                Assigned
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Unassigned</span>
            )}
          </div>
        </div>

        {stages && stages.length > 0 && (
          <StageBar
            stages={stages}
            currentStageId={caseData.stage}
            caseData={caseData}
            onTransition={(toStageId) => transitionMutation.mutate(toStageId)}
            allowedTransitions={allowedTransitions}
          />
        )}
      </div>

      <Tabs defaultValue="timeline" className="flex-1 flex flex-col overflow-hidden gap-0">
        {/* Tabs navigation for left panel */}
        <div className="flex-shrink-0 bg-surface-1 border-b border-hairline px-4 py-2 flex items-center justify-between">
          <TabsList className="bg-transparent border-b-0 p-0 gap-2 flex">
            <TabsTrigger
              value="timeline"
              className="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors text-ink-muted hover:bg-surface-2 hover:text-ink data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Activity Timeline
            </TabsTrigger>
            {hasAcademicCapability && (
              <TabsTrigger
                value="academic"
                className="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors text-ink-muted hover:bg-surface-2 hover:text-ink data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Academic Documents
              </TabsTrigger>
            )}
            {pluginTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors text-ink-muted hover:bg-surface-2 hover:text-ink data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 bg-surface-1">
            <TabsContent value="timeline" className="flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden m-0">
              <div className="flex-1 overflow-hidden flex flex-col">
                <Timeline
                  items={combinedItems}
                  isLoading={timelineLoading}
                  hasNextPage={hasNextPage ?? false}
                  fetchNextPage={fetchNextPage}
                />
              </div>

              {can('create', 'Interaction') && caseData.party_id && (
                <ComposeBar
                  caseId={caseId}
                  partyId={caseData.party_id}
                  availableChannels={[Channel.WhatsApp, Channel.Email, Channel.Note]}
                />
              )}
            </TabsContent>

            {hasAcademicCapability && (
              <TabsContent value="academic" className="flex-1 overflow-auto p-4 data-[state=inactive]:hidden m-0">
                <PluginSlot anchor="CaseMainTabs" activePlugins={activePlugins} contextData={{ caseId, caseData }} />
              </TabsContent>
            )}

            {pluginTabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="flex-1 overflow-auto p-4 data-[state=inactive]:hidden m-0">
                <tab.Component caseId={caseId} caseData={caseData} />
              </TabsContent>
            ))}
          </div>

          <div className="w-80 border-l overflow-auto flex-shrink-0 p-4 space-y-4 bg-canvas">
            <CaseAttributePanel
              caseData={caseData}
              fields={ATTRIBUTE_FIELDS}
            />
            <PluginSlot anchor="CaseSidePanel" activePlugins={activePlugins} contextData={{ caseId, caseData }} />
          </div>
        </div>
      </Tabs>
    </div>
  );
}
