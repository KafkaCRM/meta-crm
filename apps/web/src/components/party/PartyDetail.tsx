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

function SourceBadge({ source }: { source: string }) {
  let variant: 'success' | 'warning' | 'info' | 'secondary' | 'outline' = 'outline';
  if (source === PartySource.WhatsApp) variant = 'success';
  else if (source === PartySource.JustDial) variant = 'warning';
  else if (source === PartySource.Facebook) variant = 'info';
  else if (source === PartySource.WebForm) variant = 'secondary';
  
  const label = source === PartySource.WhatsApp ? 'WhatsApp' : source === PartySource.JustDial ? 'JustDial' : source === PartySource.Facebook ? 'Facebook' : source === PartySource.WebForm ? 'Web Form' : source === PartySource.Manual ? 'Manual' : source;
  
  return (
    <Badge variant={variant} className="capitalize shrink-0">
      {label}
    </Badge>
  );
}

function StageBadge({ stage }: { stage: string }) {
  let variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' = 'secondary';
  if (stage === 'won' || stage === 'enrolled') variant = 'success';
  else if (stage === 'lost' || stage === 'dropped') variant = 'destructive';
  else if (stage === 'qualified' || stage === 'negotiation') variant = 'warning';
  else if (stage === 'new' || stage === 'contacted') variant = 'default';
  
  return (
    <Badge variant={variant} className="capitalize shrink-0">
      {stage}
    </Badge>
  );
}

const CHANNEL_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  [Channel.WhatsApp]: { icon: <MessageSquare size={13} />, color: 'text-emerald-500' },
  [Channel.Email]: { icon: <Mail size={13} />, color: 'text-fin-orange' },
  [Channel.Call]: { icon: <Phone size={13} />, color: 'text-violet-500' },
  [Channel.Note]: { icon: <FileText size={13} />, color: 'text-muted-foreground' },
  [Channel.Sms]: { icon: <MessageSquare size={13} />, color: 'text-sky-500' },
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

  const { data: duplicateCandidates } = useQuery({
    queryKey: ['parties', 'candidates', party?.phone_normalized],
    queryFn: () => partiesApi.listCandidates(party?.phone_normalized),
    enabled: !!party?.phone_normalized,
    staleTime: 30_000,
  });

  const duplicates = useMemo(() => {
    if (!party || !duplicateCandidates?.data) return [];
    return duplicateCandidates.data.filter(
      (c) => c.id !== party.id && c.merge_status !== 'merged'
    );
  }, [duplicateCandidates, party]);

  const { data: mergedIntoParty } = useQuery<PartyResponse>({
    queryKey: ['parties', party?.merged_into_id],
    queryFn: () => partiesApi.get(party!.merged_into_id!),
    enabled: !!(party?.merge_status === 'merged' && party?.merged_into_id),
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
        <p className="text-muted-foreground">Contact not found</p>
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
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft size={14} />
            All {t('party.plural')?.toLowerCase() ?? 'contacts'}
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm">
              {party.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-medium text-foreground tracking-tight">{party.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-muted-foreground capitalize">{party.type}</span>
                <span className="text-border">·</span>
                <SourceBadge source={party.source} />
                {party.merge_status === MergeStatus.Merged && (
                  <Badge variant="destructive" className="capitalize">
                    Merged
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {can('manage', 'Party') && party.merge_status !== 'merged' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMergeWizard(true)}
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg h-8"
            >
              <GitMerge size={14} className="mr-1.5" />
              Merge
            </Button>
          )}
          {can('update', 'Party') && party.merge_status !== 'merged' && (
            <Button
              size="sm"
              onClick={() => navigate({ to: '/parties/$id/edit', params: { id: party.id } })}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-8"
            >
              <Edit size={14} className="mr-1.5" />
              Edit
            </Button>
          )}
        </div>
      </div>
      
      {party.merge_status !== 'merged' && (
        <StagePath 
          currentStage={(party as any).stage || 'new'} 
          stages={['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost']} 
          onStageSelect={(stage) => updateMutation.mutate({ id: party.id, data: { stage } })} 
        />
      )}

      {/* Merged Warning Banner */}
      {party.merge_status === 'merged' && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <GitMerge size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-destructive">This Profile has been Merged</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                All cases, interactions, and details have been transferred to{' '}
                <span className="font-semibold text-foreground">
                  {mergedIntoParty?.name || 'the canonical profile'}
                </span>.
              </p>
            </div>
          </div>
          {party.merged_into_id && (
            <Button
              onClick={() => navigate({ to: '/parties/$id', params: { id: party.merged_into_id! } })}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 h-9 text-xs font-bold shadow-xs flex items-center gap-1.5"
            >
              View Canonical Profile
              <ArrowLeft size={14} className="rotate-180" />
            </Button>
          )}
        </div>
      )}

      {/* Duplicate Warning Banner */}
      {party.merge_status !== 'merged' && duplicates.length > 0 && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <GitMerge size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">Potential Duplicates Found</h4>
              <p className="text-xs text-amber-700 mt-0.5">
                We found {duplicates.length} other contact{duplicates.length > 1 ? 's' : ''} with the same phone number.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowMergeWizard(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 h-9 text-xs font-bold shadow-xs flex items-center gap-1.5 border border-transparent"
          >
            <GitMerge size={14} />
            Compare & Merge
          </Button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Left column (60%): Timeline + ComposeBar */}
        <div className="lg:col-span-3 space-y-0">
          <Card className="bg-card border-border rounded-xl shadow-none overflow-hidden">
            <CardHeader className="pb-2 px-4 pt-3">
              <CardTitle className="text-sm font-semibold text-foreground">
                Timeline
              </CardTitle>
            </CardHeader>
            <Separator />
            <div className="max-h-[500px] overflow-auto">
              {timelineItems.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <MessageSquare size={24} className="text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No interactions yet</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-border">
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
                    <div className="p-3 text-center border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="w-full border-border text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg h-8"
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
            {party.merge_status !== 'merged' && (
              <div className="border-t border-border p-3 bg-muted/30">
                <div className="flex items-end gap-2">
                  <Select value={composeChannel} onValueChange={setComposeChannel}>
                    <SelectTrigger className="h-8 w-[100px] bg-card border-border text-xs shrink-0">
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
                      className="pr-10 min-h-[36px] max-h-[120px] resize-none bg-card border-border text-sm"
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
                    className="h-8 w-8 p-0 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                  >
                    {sendingMessage ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right column (40%): Party info + Cases + Related */}
        <div className="lg:col-span-2 space-y-4">
          <RecordLayout objectType="Party" record={party} t={t} />

          {/* Cases list */}
          <Card className="bg-card border-border rounded-xl shadow-none">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">
                {t('case.plural') ?? 'Cases'} ({cases.length})
              </CardTitle>
              {party.merge_status !== 'merged' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => navigate({ to: '/cases/new', search: { party_id: party.id } })}
                >
                  <Plus size={12} className="mr-1" />
                  New Case
                </Button>
              )}
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              {cases.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <FileText size={18} className="text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No cases linked</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cases.map((c: CaseResponse) => (
                    <button
                      key={c.id}
                      className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate({ to: '/cases/$id', params: { id: c.id } })}
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 capitalize">{(c as any).type}</p>
                      </div>
                      <StageBadge stage={(c as any).stage} />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related parties */}
          <Card className="bg-card border-border rounded-xl shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">
                Related Parties
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              {((party as any).relationships ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No related parties</p>
              ) : (
                <div className="space-y-2">
                  {((party as any).relationships ?? []).map((rel: any) => (
                    <button
                      key={rel.related_party_id}
                      className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate({ to: '/parties/$id', params: { id: rel.related_party_id } })}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
                          {rel.related_party_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{rel.related_party_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{rel.relationship_type}</p>
                        </div>
                      </div>
                      <ArrowUpRight size={13} className="text-muted-foreground" />
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
      <div className="px-4 py-2.5 bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {item.event_type === EventType.StageChanged
              ? `Stage changed: ${item.from_stage ?? '?'} → ${item.to_stage ?? '?'}`
              : item.event_type}
          </p>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  }

  const channelInfo = CHANNEL_ICONS[item.channel ?? ''] ?? { icon: <MessageSquare size={13} />, color: 'text-muted-foreground' };
  const isInbound = item.direction === Direction.Inbound;

  return (
    <div className={`px-4 py-3 ${item.pinned ? 'bg-muted/30' : ''}`}>
      <div className={`flex gap-2.5 ${isInbound ? '' : 'flex-row-reverse'}`}>
        <div className={`shrink-0 mt-0.5 ${channelInfo.color}`}>
          {channelInfo.icon}
        </div>
        <div className={`flex-1 min-w-0 ${isInbound ? '' : 'text-right'}`}>
          <div className="flex items-center gap-1.5 mb-1">
            {item.pinned && <Pin size={10} className="text-amber-500" />}
            <span className="text-xs text-muted-foreground capitalize">
              {item.channel === Channel.WhatsApp ? 'WhatsApp' : item.channel}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {isThread ? (
            <div>
              <button
                className="flex items-center gap-1.5 text-sm text-foreground hover:text-indigo-650 transition-colors cursor-pointer"
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
                <span className="text-xs text-muted-foreground">
                  {item.threadCount} messages
                </span>
              </button>
              {isExpanded && item.threadMessages && (
                <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-border">
                  {item.threadMessages.map((msg) => (
                    <p key={msg.id} className="text-sm text-muted-foreground">
                      {msg.content}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={`inline-block max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              isInbound
                ? 'bg-muted/50 text-foreground rounded-tl-sm'
                : 'bg-primary text-primary-foreground rounded-tr-sm'
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
            className="h-8 text-sm bg-muted/40 border-border focus-visible:ring-primary/30"
            autoFocus
            onBlur={onSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave();
              if (e.key === 'Escape') onCancel();
            }}
          />
          <button onClick={onSave} className="text-[#0bdf50] hover:opacity-70 cursor-pointer">
            <Check size={14} />
          </button>
          <button onClick={onCancel} className="text-muted-foreground hover:opacity-70 cursor-pointer">
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
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1.5">
          <p className="text-sm text-foreground">{value}</p>
          {canUpdate && (
            <button
              onClick={onEdit}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Pencil size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
