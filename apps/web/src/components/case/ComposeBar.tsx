import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send, MessageSquare, Mail, Phone, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CreateInteractionDto } from '@meta-crm/types';
import { Channel, Direction } from '@meta-crm/types';
import { interactionsApi } from '@/api/interactions';

interface ComposeBarProps {
  caseId: string;
  partyId: string;
  availableChannels: Channel[];
  onSent?: () => void;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  note: <StickyNote className="h-4 w-4" />,
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  call: 'Call',
  note: 'Note',
};

export function ComposeBar({ caseId, partyId, availableChannels, onSent }: ComposeBarProps) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [content, setContent] = useState('');
  const [channel, setChannel] = useState<Channel>(availableChannels[0] ?? Channel.Note);

  useEffect(() => {
    if (availableChannels.length > 0 && !availableChannels.includes(channel)) {
      setChannel(availableChannels[0]!);
    }
  }, [availableChannels, channel]);

  const createMutation = useMutation({
    mutationFn: (data: CreateInteractionDto) => interactionsApi.create(data),
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['interactions', 'case', caseId] });
      toast.success('Message sent');
      onSent?.();
    },
    onError: () => {
      toast.error('Failed to send message');
    },
  });

  const handleSend = useCallback(() => {
    if (!content.trim() || createMutation.isPending) return;

    createMutation.mutate({
      party_id: partyId,
      case_id: caseId,
      channel,
      direction: Direction.Outbound,
      content: content.trim(),
    });
  }, [content, channel, caseId, partyId, createMutation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="border-t bg-card px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        {availableChannels.map((ch) => (
          <button
            key={ch}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              channel === ch
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
            onClick={() => setChannel(ch)}
          >
            {CHANNEL_ICONS[ch]}
            {CHANNEL_LABELS[ch] ?? ch}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Type a ${CHANNEL_LABELS[channel] ?? 'message'}...`}
          className="flex-1 rounded-md border border-input px-3 py-2 text-sm resize-none min-h-[40px] max-h-[120px]"
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || createMutation.isPending}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            content.trim() && !createMutation.isPending
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
        >
          {createMutation.isPending ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-1">
        Press Ctrl+Enter to send
      </p>
    </div>
  );
}
