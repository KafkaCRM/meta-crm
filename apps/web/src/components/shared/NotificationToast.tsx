import { useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { useRealtime } from '@/hooks/useRealtime';

interface NotificationPayload {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  action_url?: string;
}

export function NotificationToast() {
  useRealtime('notification', (payload: NotificationPayload) => {
    const { type, title, message, action_url } = payload;

    switch (type) {
      case 'success':
        toast.success(title, { description: message, duration: 5000 });
        break;
      case 'warning':
        toast.warning(title, { description: message, duration: 5000 });
        break;
      case 'error':
        toast.error(title, { description: message, duration: 5000 });
        break;
      default:
        toast.info(title, { description: message, duration: 5000 });
        break;
    }
  });

  return (
    <Toaster
      position="top-right"
      expand={false}
      richColors
      closeButton
    />
  );
}
