import { useRef, useMemo, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  MessageSquare,
  Mail,
  Phone,
  StickyNote,
  Share2,
  ArrowDownLeft,
  ArrowUpRight,
  Pin,
  ChevronDown,
  ChevronRight,
  Activity,
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { cn } from '@/lib/utils';
import type { TimelineItem, InteractionDto, CaseEventDto } from '@meta-crm/types';
import { Channel, Direction } from '@meta-crm/types';

dayjs.extend(relativeTime);

interface TimelineProps {
  items: TimelineItem[];
  isLoading: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  [Channel.WhatsApp]: <MessageSquare className="h-4 w-4" />,
  [Channel.Email]: <Mail className="h-4 w-4" />,
  [Channel.Call]: <Phone className="h-4 w-4" />,
  [Channel.Note]: <StickyNote className="h-4 w-4" />,
  [Channel.Sms]: <Share2 className="h-4 w-4" />,
  [Channel.Facebook]: <Share2 className="h-4 w-4" />,
};

const ITEM_HEIGHT = 80;
const THREAD_HEADER_HEIGHT = 48;
const SYSTEM_EVENT_HEIGHT = 40;

type DisplayItem =
  | { type: 'pinned-interaction'; interaction: InteractionDto; height: number }
  | { type: 'thread'; threadId: string; messages: InteractionDto[]; height: number }
  | { type: 'standalone-interaction'; interaction: InteractionDto; height: number }
  | { type: 'system-event'; event: CaseEventDto; height: number };

function buildDisplayItems(items: TimelineItem[]): DisplayItem[] {
  const pinned: DisplayItem[] = [];
  const threaded = new Map<string, InteractionDto[]>();
  const standalone: InteractionDto[] = [];
  const systemEvents: CaseEventDto[] = [];

  for (const item of items) {
    if (item.kind === 'interaction') {
      const interaction = item.data as InteractionDto;
      if (interaction.is_pinned) {
        pinned.push({ type: 'pinned-interaction', interaction, height: ITEM_HEIGHT });
      } else if (interaction.thread_id) {
        const existing = threaded.get(interaction.thread_id) ?? [];
        existing.push(interaction);
        threaded.set(interaction.thread_id, existing);
      } else {
        standalone.push(interaction);
      }
    } else if (item.kind === 'system_event') {
      systemEvents.push(item.data as CaseEventDto);
    }
  }

  const displayItems: DisplayItem[] = [...pinned];

  for (const [threadId, messages] of threaded) {
    const sorted = [...messages].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    displayItems.push({
      type: 'thread',
      threadId,
      messages: sorted,
      height: THREAD_HEADER_HEIGHT + Math.min(sorted.length, 3) * ITEM_HEIGHT,
    });
  }

  for (const interaction of standalone) {
    displayItems.push({ type: 'standalone-interaction', interaction, height: ITEM_HEIGHT });
  }

  for (const event of systemEvents) {
    displayItems.push({ type: 'system-event', event, height: SYSTEM_EVENT_HEIGHT });
  }

  displayItems.sort((a, b) => {
    if (a.type === 'pinned-interaction') return -1;
    if (b.type === 'pinned-interaction') return 1;
    const timeA = getTimestamp(a);
    const timeB = getTimestamp(b);
    return new Date(timeB).getTime() - new Date(timeA).getTime();
  });

  return displayItems;
}

function getTimestamp(item: DisplayItem): string {
  switch (item.type) {
    case 'pinned-interaction':
    case 'standalone-interaction':
      return item.interaction.created_at;
    case 'thread':
      return item.messages[item.messages.length - 1]?.created_at ?? '';
    case 'system-event':
      return item.event.occurred_at;
  }
}

function InteractionRow({ interaction }: { interaction: InteractionDto }) {
  const isInbound = interaction.direction === Direction.Inbound;
  const icon = CHANNEL_ICONS[interaction.channel] ?? <MessageSquare className="h-4 w-4" />;

  return (
    <div className="flex items-start gap-3 px-3 py-2">
      <div
        className={cn(
          'flex-shrink-0 mt-0.5 p-1.5 rounded-full',
          isInbound
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
            : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
        )}
      >
        {isInbound ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-xs text-muted-foreground">
            {interaction.channel} · {dayjs(interaction.created_at).fromNow()}
          </span>
        </div>
        <p className="text-sm mt-1 line-clamp-2">{interaction.content}</p>
      </div>
    </div>
  );
}

function ThreadRow({ messages }: { messages: InteractionDto[] }) {
  const [expanded, setExpanded] = useState(false);
  const channel = messages[0]?.channel ?? Channel.Note;
  const icon = CHANNEL_ICONS[channel] ?? <MessageSquare className="h-4 w-4" />;
  const lastMessage = messages[messages.length - 1];
  const preview = lastMessage?.content.slice(0, 80) ?? '';

  return (
    <div className="border-l-2 border-muted pl-3 mx-3 my-1">
      <button
        className="flex items-center gap-2 w-full px-2 py-2 text-left hover:bg-muted/50 rounded"
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium">{messages.length} messages</span>
        <span className="text-xs text-muted-foreground">
          {channel} · {dayjs(lastMessage?.created_at).fromNow()}
        </span>
      </button>

      {expanded && (
        <div className="mt-1">
          {messages.map((msg) => (
            <InteractionRow key={msg.id} interaction={msg} />
          ))}
        </div>
      )}

      {!expanded && (
        <p className="text-xs text-muted-foreground px-2 pb-1 line-clamp-1">{preview}</p>
      )}
    </div>
  );
}

function SystemEventRow({ event }: { event: CaseEventDto }) {
  const eventType = (event as any).event_type ?? '';

  const getLabel = () => {
    switch (eventType) {
      case 'stage_changed':
        return `Stage changed: ${(event as any).from_stage ?? '?'} → ${(event as any).to_stage ?? '?'}`;
      case 'assignment_changed':
        return 'Assignment changed';
      case 'case_created':
        return 'Case created';
      case 'trigger_failed':
        return `Trigger failed: ${(event as any).payload?.trigger ?? 'unknown'}`;
      default:
        return eventType;
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground bg-muted/30 mx-4 my-1 rounded">
      <Activity className="h-3 w-3" />
      <span>{getLabel()}</span>
      <span className="ml-auto">{dayjs(event.occurred_at).fromNow()}</span>
    </div>
  );
}

export function Timeline({ items, isLoading, hasNextPage, fetchNextPage }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayItems = useMemo(() => buildDisplayItems(items), [items]);

  const virtualizer = useVirtualizer({
    count: displayItems.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => displayItems[index]?.height ?? ITEM_HEIGHT,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    if (scrollHeight - scrollTop - clientHeight < 200 && hasNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (displayItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No interactions yet. Send a message to start the timeline.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="overflow-auto flex-1" onScroll={handleScroll}>
      {paddingTop > 0 && <div style={{ height: `${paddingTop}px` }} />}

      {virtualItems.map((virtualRow) => {
        const item = displayItems[virtualRow.index];
        if (!item) return null;

        return (
          <div key={virtualRow.index} data-index={virtualRow.index}>
            {item.type === 'pinned-interaction' && (
              <div className="flex items-start gap-2 px-3 py-2 border-l-2 border-amber-400 bg-amber-50/50 dark:bg-amber-900/10">
                <Pin className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <InteractionRow interaction={item.interaction} />
                </div>
              </div>
            )}

            {item.type === 'thread' && (
              <ThreadRow messages={item.messages} />
            )}

            {item.type === 'standalone-interaction' && (
              <InteractionRow interaction={item.interaction} />
            )}

            {item.type === 'system-event' && (
              <SystemEventRow event={item.event} />
            )}
          </div>
        );
      })}

      {paddingBottom > 0 && <div style={{ height: `${paddingBottom}px` }} />}
    </div>
  );
}
