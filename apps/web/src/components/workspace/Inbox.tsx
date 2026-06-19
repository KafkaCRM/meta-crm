import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Phone, Mail, MessageSquare, Send, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { Channel, Direction } from '@meta-crm/types';
import { settingsApi } from '@/api/settings';
import { interactionsApi } from '@/api/interactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const CHANNEL_ICONS: Record<string, any> = { whatsapp: MessageSquare, email: Mail, call: Phone, note: StickyNote, sms: MessageSquare, facebook: MessageSquare };
const CHANNEL_COLORS: Record<string, string> = { whatsapp: 'text-emerald-500', email: 'text-blue-500', call: 'text-amber-500', note: 'text-slate-400', sms: 'text-purple-500', facebook: 'text-blue-600' };

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ComposeBar({ partyId, onSent }: { partyId: string; onSent: () => void }) {
  const [channel, setChannel] = useState(Channel.Note); const [content, setContent] = useState('');
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => interactionsApi.create({ party_id: partyId, channel, direction: Direction.Outbound, content }),
    onSuccess: () => { setContent(''); qc.invalidateQueries({ queryKey: ['interactions', partyId] }); qc.invalidateQueries({ queryKey: ['inbox'] }); onSent(); },
    onError: () => toast.error('Failed to send'),
  });
  return (<div className="border-t p-3 flex items-end gap-2 bg-white">
    <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className="flex h-9 rounded-md border border-input bg-transparent px-2 py-1 text-xs w-24">
      <option value={Channel.Note}>Note</option><option value={Channel.WhatsApp}>WhatsApp</option><option value={Channel.Email}>Email</option><option value={Channel.Sms}>SMS</option>
    </select>
    <div className="flex-1"><Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type a message..." rows={1} className="min-h-[36px] resize-none" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (content.trim()) mutation.mutate(); } }} /></div>
    <Button size="icon" onClick={() => mutation.mutate()} disabled={mutation.isPending || !content.trim()}><Send size={14} /></Button>
  </div>);
}

function MessageFeed({ partyId }: { partyId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['interactions', partyId],
    queryFn: ({ pageParam }) => interactionsApi.list({ party_id: partyId, cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: any) => last.next_cursor ?? undefined,
  });
  const allMessages = data?.pages.flatMap((p: any) => p.items ?? []) ?? [];
  return (<div className="flex-1 overflow-y-auto p-4 space-y-2">
    {isLoading ? <div className="text-center text-sm text-muted-foreground py-8">Loading...</div>
      : allMessages.length === 0 ? <div className="text-center text-sm text-muted-foreground py-8">No messages yet</div>
      : <>
          {hasNextPage && <div className="text-center"><Button variant="link" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>Load older</Button></div>}
          {[...allMessages].reverse().map((item: any) => {
            const data = item.kind === 'interaction' ? item.data : item.kind === 'thread' ? item.data.messages?.slice(-1)[0] : null;
            if (!data) return null;
            const isInbound = data.direction === 'inbound';
            const Icon = CHANNEL_ICONS[data.channel] ?? MessageSquare;
            return (<div key={data.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${isInbound ? 'bg-slate-100 text-slate-900' : 'bg-blue-500 text-white'}`}>
                <div className="flex items-center gap-1 mb-0.5"><Icon size={11} className={isInbound ? CHANNEL_COLORS[data.channel] : 'text-white/70'} /><span className="text-[10px] opacity-60">{formatTime(data.created_at)}</span></div>
                <p className="whitespace-pre-wrap break-words">{data.content}</p>
              </div>
            </div>);
          })}
        </>}
  </div>);
}

export function Inbox() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['inbox'], queryFn: () => settingsApi.inbox.conversations() });
  return (<div className="flex h-[calc(100vh-3.5rem)]">
    <div className="w-80 border-r bg-white flex flex-col shrink-0">
      <div className="p-3 border-b"><h2 className="font-semibold text-sm">Conversations</h2></div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? <div className="text-center text-sm text-muted-foreground py-8">Loading...</div>
          : !data?.length ? <div className="text-center text-sm text-muted-foreground py-8">No conversations</div>
          : data.map((c: any) => {
            const Icon = CHANNEL_ICONS[c.last_channel] ?? MessageSquare;
            return (<button key={c.party_id} onClick={() => setSelected(c.party_id)}
              className={`w-full text-left px-3 py-3 border-b hover:bg-slate-50 transition-colors ${selected === c.party_id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1"><div className="font-medium text-sm truncate">{c.party_name ?? c.party_phone ?? 'Unknown'}</div>
                  <div className="flex items-center gap-1 mt-0.5"><Icon size={11} className={CHANNEL_COLORS[c.last_channel] ?? 'text-slate-400 shrink-0'} /><span className="text-xs text-muted-foreground truncate">{c.last_message ?? '—'}</span></div></div>
                <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{c.last_at ? formatTime(c.last_at) : ''}</span>
                  {c.message_count > 0 && <Badge variant="outline" className="h-4 min-w-4 px-1 text-[10px]">{c.message_count}</Badge>}
                </div>
              </div>
            </button>);
          })}
      </div>
    </div>
    <div className="flex-1 flex flex-col bg-white">
      {selected ? <>
        <div className="border-b px-4 py-2.5 bg-white"><span className="font-medium text-sm">{data?.find((c: any) => c.party_id === selected)?.party_name ?? 'Conversation'}</span></div>
        <MessageFeed partyId={selected} />
        <ComposeBar partyId={selected} onSent={() => {}} />
      </> : <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Select a conversation</div>}
    </div>
  </div>);
}
