import { useEffect, useRef, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { useRealtime, useRealtimeInvalidate } from '@/hooks/useRealtime';
import { useLabels } from '@/hooks/useLabels';
import { queryClient } from '@/lib/query-client';
import { Button } from '@/components/ui/button';

const MAX_VISIBLE_TOASTS = 3;
const toastQueueRef: { ids: (string | number)[] } = { ids: [] };

function enqueueToast(id: string | number) {
  toastQueueRef.ids.push(id);
  if (toastQueueRef.ids.length > MAX_VISIBLE_TOASTS) {
    const oldest = toastQueueRef.ids.shift();
    if (oldest) {
      toast.dismiss(oldest);
    }
  }
}

interface CaseAssignedPayload {
  id: string;
  title: string;
  case_id: string;
}

interface CaseStageChangedPayload {
  id: string;
  title: string;
  case_id: string;
  from_stage: string;
  to_stage: string;
}

interface InteractionReceivedPayload {
  id: string;
  channel: string;
  party_name: string;
  case_id?: string;
  interaction_id: string;
}

interface PartyMergedPayload {
  id: string;
  canonical_id: string;
  canonical_name: string;
}

interface TriggerFailedPayload {
  id: string;
  case_title: string;
  trigger_name: string;
  error: string;
}

interface WebhookDeliveryFailedPayload {
  id: string;
  url: string;
  event_type: string;
  error: string;
}

export function NotificationToast() {
  const { t } = useLabels();
  const openCaseIdsRef = useRef<Set<string>>(new Set());

  const handleCaseAssigned = useCallback(
    (payload: CaseAssignedPayload) => {
      const id = toast.custom(
        (tId) => {
          enqueueToast(tId);
          return (
            <div className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {t('notification.case.assigned') ?? 'New case assigned'}
                </p>
                <p className="text-xs text-muted-foreground">{payload.title}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0"
                onClick={() => {
                  window.location.href = `/cases/${payload.case_id}`;
                }}
              >
                {t('notification.view') ?? 'View'}
              </Button>
            </div>
          );
        },
        { duration: 6000 },
      );
    },
    [t],
  );

  const handleCaseStageChanged = useCallback(
    (payload: CaseStageChangedPayload) => {
      if (openCaseIdsRef.current.has(payload.case_id)) {
        queryClient.invalidateQueries({ queryKey: ['case', payload.case_id] });
      }

      const id = toast.info(
        `${payload.title} moved to ${payload.to_stage}`,
        { duration: 4000 },
      );
      enqueueToast(id);
    },
    [],
  );

  const handleInteractionReceived = useCallback(
    (payload: InteractionReceivedPayload) => {
      const id = toast.custom(
        (tId) => {
          enqueueToast(tId);
          return (
            <div className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {payload.channel} from {payload.party_name}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    if (payload.case_id) {
                      window.location.href = `/cases/${payload.case_id}`;
                    }
                  }}
                >
                  {t('notification.reply') ?? 'Reply'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => toast.dismiss(tId)}
                >
                  {t('notification.dismiss') ?? 'Dismiss'}
                </Button>
              </div>
            </div>
          );
        },
        { duration: 8000 },
      );
    },
    [t],
  );

  const handlePartyMerged = useCallback(
    (payload: PartyMergedPayload) => {
      const id = toast.custom(
        (tId) => {
          enqueueToast(tId);
          return (
            <div className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {t('notification.party.merged') ?? 'Contact merged'}
                </p>
                <p className="text-xs text-muted-foreground">{payload.canonical_name}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0"
                onClick={() => {
                  window.location.href = `/parties/${payload.canonical_id}`;
                }}
              >
                {t('notification.view') ?? 'View'}
              </Button>
            </div>
          );
        },
        { duration: 5000 },
      );
    },
    [t],
  );

  const handleTriggerFailed = useCallback(
    (payload: TriggerFailedPayload) => {
      const id = toast.warning(
        `${t('notification.trigger.failed') ?? 'Automation failed'} on ${payload.case_title}`,
        {
          description: payload.error,
          duration: 8000,
        },
      );
      enqueueToast(id);
    },
    [t],
  );

  const handleWebhookDeliveryFailed = useCallback(
    (payload: WebhookDeliveryFailedPayload) => {
      const id = toast.error(
        t('notification.webhook.failed') ?? 'Webhook delivery failed',
        {
          description: payload.error,
          duration: 8000,
        },
      );
      enqueueToast(id);
    },
    [t],
  );

  useRealtime<CaseAssignedPayload>('case:assigned', handleCaseAssigned);
  useRealtime<CaseStageChangedPayload>('case:stage_changed', handleCaseStageChanged);
  useRealtime<InteractionReceivedPayload>('interaction:received', handleInteractionReceived);
  useRealtime<PartyMergedPayload>('party:merged', handlePartyMerged);
  useRealtime<TriggerFailedPayload>('trigger:failed', handleTriggerFailed);
  useRealtime<WebhookDeliveryFailedPayload>('webhook:delivery_failed', handleWebhookDeliveryFailed);

  return (
    <Toaster
      position="top-right"
      expand={false}
      richColors
      closeButton
      visibleToasts={MAX_VISIBLE_TOASTS}
    />
  );
}
