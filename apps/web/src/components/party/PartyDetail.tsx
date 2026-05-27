import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { PartySource, MergeStatus, Channel, Direction, EventType } from '@meta-crm/types';
import type { PartyResponse, CaseResponse } from '@meta-crm/types';
import { usePermissions } from '@/hooks/usePermissions';
import { useLabels } from '@/hooks/useLabels';
import { useRealtime } from '@/hooks/useRealtime';
import { partiesApi } from '@/api/parties';
import { interactionsApi } from '@/api/interactions';
import { queryClient } from '@/lib/query-client';
import { MergeWizard } from './MergeWizard';
import { Button } from '@/components/ui/button';
import { RecordLayout } from '@/components/shared';
import { StagePath } from '../case/StagePath';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Edit, GitMerge, Phone, Mail, Building2, Calendar,
  FileText, Pencil, Check, X, Send, Pin, PinOff, MessageSquare,
  ChevronDown, ChevronRight, ArrowUpRight, ArrowDownLeft,
  Loader2, Plus,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SOURCE_COLORS: Record<string, string> = {
  [PartySource.WhatsApp]: 'bg-[#0bdf50]/10 text-[#0a7f2e] border-[#0bdf50]/20',
  [PartySource.JustDial]: 'bg-[#ff8c00]/10 text-[#cc7000] border-[#ff8c00]/20',
  [PartySource.Facebook]: 'bg-[#1877f2]/10 text-[#1565c0] border-[#1877f2]/20',
  [PartySource.Manual]: 'bg-[#94a3b8]/10 text-[#64748b] border-[#94a3b8]/20',
  [PartySource.WebForm]: 'bg-[#8b5cf6]/10 text-[#7c3aed] border-[#8b5cf6]/20',
  [PartySource.Api]: 'bg-[#ff5600]/10 text-[#cc4400] border-[#ff5600]/20',
};

function SourceBadge({ source }: { source: string }) {
  const cls = SOURCE_COLORS[source] ?? 'bg-[#94a3b8]/10 text-[#64748b] border-[#94a3b8]/20';
  const label = source === PartySource.WhatsApp ? 'WhatsApp' : source === PartySource.JustDial ? 'JustDial' : source === PartySource.Facebook ? 'Facebook' : source === PartySource.WebForm ? 'Web Form' : source === PartySource.Manual ? 'Manual' : source;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-[#3b82f6]/10 text-[#2563eb] border-[#3b82f6]/20',
  contacted: 'bg-[#3b82f6]/10 text-[#2563eb] border-[#3b82f6]/20',
  qualified: 'bg-[#f59e0b]/10 text-[#d97706] border-[#f59e0b]/20',
  negotiation: 'bg-[#f59e0b]/10 text-[#d97706] border-[#f59e0b]/20',
  won: 'bg-[#0bdf50]/10 text-[#0a7f2e] border-[#0bdf50]/20',
  enrolled: 'bg-[#0bdf50]/10 text-[#0a7f2e] border-[#0bdf50]/20',
  lost: 'bg-[#c41c1c]/10 text-[#c41c1c] border-[#c41c1c]/20',
  dropped: 'bg-[#c41c1c]/10 text-[#c41c1c] border-[#c41c1c]/20',
};

function StageBadge({ stage }: { stage: string }) {
  const cls = STAGE_COLORS[stage] ?? 'bg-[#94a3b8]/10 text-[#64748b] border-[#94a3b8]/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${cls}`}>
      {stage}
    </span>
  );
}

const CHANNEL_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  [Channel.WhatsApp]: { icon: <MessageSquare size={13} />, color: 'text-[#0bdf50]' },
  [Channel.Email]: { icon: <Mail size={13} />, color: 'text-[#3b82f6]' },
  [Channel.Call]: { icon: <Phone size={13} />, color: 'text-[#8b5cf6]' },
  [Channel.Note]: { icon: <FileText size={13} />, color: 'text-[#94a3b8]' },
  [Channel.Sms]: { icon: <MessageSquare size={13} />, color: 'text-[#65b5ff]' },
};

interface TimelineItem {
  id: string;
  type: 'interaction' | 'event';
  channel?: string;
  direction?: string;
  content?: string;
  event_type?: string;
  from_stage?: string;
  to_stage?: string;
  timestamp: string;
  pinned?: boolean;
  thread_id?: string;
  threadCount?: number;
  threadMessages?: TimelineItem[];
}

interface PartyDetailProps {
  partyId: string;
}

export function PartyDetail({ partyId }: PartyDetailProps) {
  const { can } = usePermissions();
  const { t } = useLabels();
  const navigate = useNavigate();
  const [showMergeWizard, setShowMergeWizard] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [composeChannel, setComposeChannel] = useState<string>('note');
  const [composeMessage, setComposeMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<TimelineItem[]>([]);
  const [realtimeItems, setRealtimeItems] = useState<TimelineItem[]>([]);

  const { data: party, isLoading } = useQuery<PartyResponse>({
    queryKey: ['parties', partyId],
    queryFn: () => partiesApi.get(partyId),
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      partiesApi.update(id, data as any),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['parties', id] });
      const previous = queryClient.getQueryData<PartyResponse>(['parties', id]);
      queryClient.setQueryData<PartyResponse>(['parties', id], (old) =>
        old ? { ...old, ...data } : old,
      );
      return { previous };
    },
    onError: (err, { id }, context) => {
      queryClient.setQueryData(['parties', id], context?.previous);
      toast.error('Failed to update contact');
    },
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['parties', id] });
    },
  });

  const handleSaveField = useCallback(
    (field: string) => {
      if (!party || !editValue.trim()) {
        setEditingField(null);
        return;
      }
      updateMutation.mutate({
        id: party.id,
        data: { [field]: editValue.trim() },
      });
      setEditingField(null);
    },
    [party, editValue, updateMutation],
  );

  const {
    data: timelinePages,
    isLoading: timelineLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['interactions', 'party', partyId],
    queryFn: ({ pageParam }) =>
      interactionsApi.list({
        party_id: partyId,
        cursor: pageParam ?? undefined,
        limit: 20,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: !!partyId,
    staleTime: 10_000,
  });

  const handleSend = useCallback(async () => {
    if (!composeMessage.trim() || !party) return;
    setSendingMessage(true);

    const optimisticId = `opt_${Date.now()}`;
    const optimisticItem: TimelineItem = {
      id: optimisticId,
      type: 'interaction',
      channel: composeChannel,
      direction: Direction.Outbound,
      content: composeMessage.trim(),
      timestamp: new Date().toISOString(),
    };
    setOptimisticMessages((prev) => [...prev, optimisticItem]);
    setComposeMessage('');

    try {
      await interactionsApi.create({
        party_id: party.id,
        channel: composeChannel as Channel,
        direction: Direction.Outbound,
        content: optimisticItem.content!,
      });
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      queryClient.invalidateQueries({ queryKey: ['interactions', 'party', partyId] });
      toast.success('Message sent');
    } catch {
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      toast.error('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  }, [composeMessage, composeChannel, party, partyId]);

  // Real-time: append incoming interactions to timeline
  useRealtime<any>('interaction:received', (payload) => {
    if (payload.party_id === partyId) {
      const newItem: TimelineItem = {
        id: `temp_${Date.now()}`,
        type: 'interaction',
        channel: payload.channel,
        direction: Direction.Inbound,
        content: payload.content,
        timestamp: new Date().toISOString(),
      };
      setRealtimeItems((prev) => [newItem, ...prev]);
    }
  });

  useEffect(() => {
    setRealtimeItems([]);
    setOptimisticMessages([]);
  }, [partyId]);

  const cases = useMemo(() => (party as any)?.cases ?? [], [party]);

  const timelineItems = useMemo((): TimelineItem[] => {
    const items: TimelineItem[] = [];

    // Add case events
    for (const c of cases) {
      const events = (c as any).caseEvents ?? [];
      for (const event of events) {
        items.push({
          id: event.id,
          type: 'event',
          event_type: event.event_type,
          from_stage: event.from_stage,
          to_stage: event.to_stage,
          timestamp: event.occurred_at,
        });
      }
    }

    // Add queried interactions
    const dbItems = timelinePages?.pages.flatMap((page) => page.items) ?? [];
    for (const dbItem of dbItems) {
      if (dbItem.kind === 'interaction') {
        const i = dbItem.data as any;
        items.push({
          id: i.id,
          type: 'interaction',
          channel: i.channel,
          direction: i.direction,
          content: i.content,
          timestamp: i.created_at,
          pinned: i.is_pinned,
          thread_id: i.thread_id || undefined,
        });
      } else if (dbItem.kind === 'thread') {
        const thread = dbItem.data as any;
        for (const i of thread.messages) {
          items.push({
            id: i.id,
            type: 'interaction',
            channel: i.channel,
            direction: i.direction,
            content: i.content,
            timestamp: i.created_at,
            pinned: i.is_pinned,
            thread_id: thread.thread_id,
          });
        }
      }
    }

    // Add optimistic messages
    items.push(...optimisticMessages);

    // Add real-time messages
    items.push(...realtimeItems);

    // Deduplicate by ID
    const seen = new Set<string>();
    const uniqueItems = items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    // Sort by timestamp DESC
    uniqueItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Group by thread_id
    const threaded: TimelineItem[] = [];
    const threadMap = new Map<string, TimelineItem[]>();
    for (const item of uniqueItems) {
      if (item.thread_id) {
        if (!threadMap.has(item.thread_id)) threadMap.set(item.thread_id, []);
        threadMap.get(item.thread_id)!.push(item);
      } else {
        threaded.push(item);
      }
    }
    for (const [threadId, messages] of threadMap) {
      const sorted = messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const last = sorted[sorted.length - 1]!;
      threaded.push({
        ...last,
        threadCount: sorted.length,
        threadMessages: sorted,
      });
    }

    // Sort again
    threaded.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Pinned first
    const pinned = threaded.filter((i) => i.pinned);
    const unpinned = threaded.filter((i) => !i.pinned);
    return [...pinned, ...unpinned];
  }, [cases, timelinePages, optimisticMessages, realtimeItems]);

  if (isLoading) {
    return (
      <div className="space-y-5 max-w-[1280px]">
        <Skeleton className="h-8 w-64 bg-[#e2e8f0]" />
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-4">
            <Skeleton className="h-64 w-full bg-[#e2e8f0] rounded-xl" />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-40 bg-[#e2e8f0] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!party) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-[#94a3b8]">Contact not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px]">
      {/* Back + page header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <button
            onClick={() => navigate({ to: '/parties' })}
            className="flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#0f172a] transition-colors mb-2"
          >
            <ArrowLeft size={14} />
            All {t('party.plural')?.toLowerCase() ?? 'contacts'}
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0f172a] flex items-center justify-center text-white font-medium text-sm">
              {party.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-medium text-[#0f172a] tracking-tight">{party.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-[#94a3b8] capitalize">{party.type}</span>
                <span className="text-[#e2e8f0]">·</span>
                <SourceBadge source={party.source} />
                {party.merge_status === MergeStatus.Merged && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#c41c1c]/10 text-[#c41c1c] border border-[#c41c1c]/20">
                    Merged
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {can('manage', 'Party') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMergeWizard(true)}
              className="border-[#e2e8f0] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a] rounded-lg h-8"
            >
              <GitMerge size={14} className="mr-1.5" />
              Merge
            </Button>
          )}
          {can('update', 'Party') && (
            <Button
              size="sm"
              onClick={() => navigate({ to: '/parties/$id/edit', params: { id: party.id } })}
              className="bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-lg h-8"
            >
              <Edit size={14} className="mr-1.5" />
              Edit
            </Button>
          )}
        </div>
      </div>
      
      <StagePath 
        currentStage={(party as any).stage || 'new'} 
        stages={['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost']} 
        onStageSelect={(stage) => updateMutation.mutate({ id: party.id, data: { stage } })} 
      />

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Left column (60%): Timeline + ComposeBar */}
        <div className="lg:col-span-3 space-y-0">
          <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none overflow-hidden">
            <CardHeader className="pb-2 px-4 pt-3">
              <CardTitle className="text-sm font-semibold text-[#0f172a]">
                Timeline
              </CardTitle>
            </CardHeader>
            <Separator className="bg-[#e2e8f0]" />
            <div className="max-h-[500px] overflow-auto">
              {timelineItems.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <MessageSquare size={24} className="text-[#94a3b8] mb-2" />
                  <p className="text-sm text-[#94a3b8]">No interactions yet</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-[#e2e8f0]">
                    {timelineItems.map((item) => (
                      <TimelineItemRenderer
                        key={item.id}
                        item={item}
                        expandedThreads={expandedThreads}
                        setExpandedThreads={setExpandedThreads}
                        canPin={can('manage', 'Case')}
                      />
                    ))}
                  </div>
                  {hasNextPage && (
                    <div className="p-3 text-center border-t border-[#e2e8f0]">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="w-full border-[#e2e8f0] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a] rounded-lg h-8"
                      >
                        {isFetchingNextPage ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          'Load More Activity'
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ComposeBar */}
            <div className="border-t border-[#e2e8f0] p-3 bg-[#faf9f7]">
              <div className="flex items-end gap-2">
                <Select value={composeChannel} onValueChange={setComposeChannel}>
                  <SelectTrigger className="h-8 w-[100px] bg-white border-[#e2e8f0] text-xs shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex-1 relative">
                  <Textarea
                    value={composeMessage}
                    onChange={(e) => setComposeMessage(e.target.value)}
                    placeholder="Type a message…"
                    className="pr-10 min-h-[36px] max-h-[120px] resize-none bg-white border-[#e2e8f0] text-sm"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!composeMessage.trim() || sendingMessage}
                  className="h-8 w-8 p-0 bg-[#0f172a] hover:bg-[#1e293b] shrink-0"
                >
                  {sendingMessage ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right column (40%): Party info + Cases + Related */}
        <div className="lg:col-span-2 space-y-4">
          <RecordLayout objectType="Party" record={party} t={t} />

          {/* Cases list */}
          <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[#0f172a]">
                {t('case.plural') ?? 'Cases'} ({cases.length})
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => navigate({ to: '/cases/new', search: { party_id: party.id } })}
              >
                <Plus size={12} className="mr-1" />
                New Case
              </Button>
            </CardHeader>
            <Separator className="bg-[#e2e8f0]" />
            <CardContent className="pt-4">
              {cases.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <FileText size={18} className="text-[#94a3b8] mb-2" />
                  <p className="text-sm text-[#94a3b8]">No cases linked</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cases.map((c: CaseResponse) => (
                    <button
                      key={c.id}
                      className="flex w-full items-center justify-between rounded-lg border border-[#e2e8f0] p-3 text-left hover:bg-[#f8fafc] transition-colors"
                      onClick={() => navigate({ to: '/cases/$id', params: { id: c.id } })}
                    >
                      <div>
                        <p className="text-sm font-medium text-[#0f172a]">{c.title}</p>
                        <p className="text-xs text-[#94a3b8] mt-0.5 capitalize">{(c as any).type}</p>
                      </div>
                      <StageBadge stage={(c as any).stage} />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related parties */}
          <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0f172a]">
                Related Parties
              </CardTitle>
            </CardHeader>
            <Separator className="bg-[#e2e8f0]" />
            <CardContent className="pt-4">
              {((party as any).relationships ?? []).length === 0 ? (
                <p className="text-sm text-[#94a3b8] text-center py-4">No related parties</p>
              ) : (
                <div className="space-y-2">
                  {((party as any).relationships ?? []).map((rel: any) => (
                    <button
                      key={rel.related_party_id}
                      className="flex w-full items-center justify-between rounded-lg border border-[#e2e8f0] p-3 text-left hover:bg-[#f8fafc] transition-colors"
                      onClick={() => navigate({ to: '/parties/$id', params: { id: rel.related_party_id } })}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#0f172a] flex items-center justify-center text-white text-xs font-medium">
                          {rel.related_party_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#0f172a]">{rel.related_party_name}</p>
                          <p className="text-xs text-[#94a3b8] capitalize">{rel.relationship_type}</p>
                        </div>
                      </div>
                      <ArrowUpRight size={13} className="text-[#94a3b8]" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {showMergeWizard && (
        <MergeWizard
          party={party}
          onClose={() => setShowMergeWizard(false)}
          onMergeComplete={() => {
            setShowMergeWizard(false);
            queryClient.invalidateQueries({ queryKey: ['parties', partyId] });
            toast.success('Parties merged successfully');
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline item renderer                                             */
/* ------------------------------------------------------------------ */

interface TimelineItemRendererProps {
  item: TimelineItem;
  expandedThreads: Set<string>;
  setExpandedThreads: React.Dispatch<React.SetStateAction<Set<string>>>;
  canPin: boolean;
}

function TimelineItemRenderer({ item, expandedThreads, setExpandedThreads, canPin }: TimelineItemRendererProps) {
  const isThread = !!item.threadMessages && item.threadMessages.length > 1;
  const isExpanded = item.thread_id ? expandedThreads.has(item.thread_id) : false;

  if (item.type === 'event') {
    return (
      <div className="px-4 py-2.5 bg-[#faf9f7]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#94a3b8]" />
          <p className="text-xs text-[#94a3b8]">
            {item.event_type === EventType.StageChanged
              ? `Stage changed: ${item.from_stage ?? '?'} → ${item.to_stage ?? '?'}`
              : item.event_type}
          </p>
          <span className="text-[10px] text-[#94a3b8] ml-auto">
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  }

  const channelInfo = CHANNEL_ICONS[item.channel ?? ''] ?? { icon: <MessageSquare size={13} />, color: 'text-[#94a3b8]' };
  const isInbound = item.direction === Direction.Inbound;

  return (
    <div className={`px-4 py-3 ${item.pinned ? 'bg-[#faf9f7]' : ''}`}>
      <div className={`flex gap-2.5 ${isInbound ? '' : 'flex-row-reverse'}`}>
        <div className={`shrink-0 mt-0.5 ${channelInfo.color}`}>
          {channelInfo.icon}
        </div>
        <div className={`flex-1 min-w-0 ${isInbound ? '' : 'text-right'}`}>
          <div className="flex items-center gap-1.5 mb-1">
            {item.pinned && <Pin size={10} className="text-amber-500" />}
            <span className="text-xs text-[#94a3b8] capitalize">
              {item.channel === Channel.WhatsApp ? 'WhatsApp' : item.channel}
            </span>
            <span className="text-[10px] text-[#94a3b8]">
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {isThread ? (
            <div>
              <button
                className="flex items-center gap-1.5 text-sm text-[#0f172a] hover:text-[#3b82f6] transition-colors"
                onClick={() => {
                  setExpandedThreads((prev) => {
                    const next = new Set(prev);
                    if (item.thread_id) {
                      next.has(item.thread_id) ? next.delete(item.thread_id) : next.add(item.thread_id);
                    }
                    return next;
                  });
                }}
              >
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span className="truncate max-w-[300px]">
                  {item.content?.slice(0, 80)}
                </span>
                <span className="text-xs text-[#94a3b8]">
                  {item.threadCount} messages
                </span>
              </button>
              {isExpanded && item.threadMessages && (
                <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-[#e2e8f0]">
                  {item.threadMessages.map((msg) => (
                    <p key={msg.id} className="text-sm text-[#64748b]">
                      {msg.content}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={`inline-block max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              isInbound
                ? 'bg-[#f8fafc] text-[#0f172a] rounded-tl-sm'
                : 'bg-[#0f172a] text-white rounded-tr-sm'
            }`}>
              {item.content}
              {item.id.startsWith('opt_') && (
                <span className="text-[10px] opacity-60 ml-1">Sending...</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Editable detail field                                              */
/* ------------------------------------------------------------------ */

interface DetailFieldProps {
  label: string;
  value: string;
  field: string;
  editing: boolean;
  editValue: string;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onEditValueChange: (value: string) => void;
  canUpdate: boolean;
  icon?: React.ReactNode;
}

function EditableDetailField({
  label, value, field, editing, editValue,
  onEdit, onSave, onCancel, onEditValueChange, canUpdate, icon,
}: DetailFieldProps) {
  if (editing && canUpdate) {
    return (
      <div className="flex items-center gap-3">
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <div className="flex items-center gap-2 flex-1">
          <Input
            type="text"
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            className="h-8 text-sm bg-[#f8fafc] border-[#e2e8f0] focus-visible:ring-[#0f172a]/30"
            autoFocus
            onBlur={onSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave();
              if (e.key === 'Escape') onCancel();
            }}
          />
          <button onClick={onSave} className="text-[#0bdf50] hover:opacity-70">
            <Check size={14} />
          </button>
          <button onClick={onCancel} className="text-[#94a3b8] hover:opacity-70">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 group">
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#94a3b8]">{label}</p>
        <div className="flex items-center gap-1.5">
          <p className="text-sm text-[#0f172a]">{value}</p>
          {canUpdate && (
            <button
              onClick={onEdit}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-[#94a3b8] hover:text-[#0f172a]"
            >
              <Pencil size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
