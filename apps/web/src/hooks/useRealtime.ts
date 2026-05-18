import { useEffect } from 'react';
import { subscribe } from '@/lib/socket';
import { queryClient } from '@/lib/query-client';

export function useRealtime<T = unknown>(event: string, handler: (data: T) => void) {
  useEffect(() => {
    const unsubscribe = subscribe<T>(event, (data) => {
      handler(data);
    });

    return unsubscribe;
  }, [event, handler]);
}

export function useRealtimeInvalidate(event: string, queryKey?: string[]) {
  useEffect(() => {
    const unsubscribe = subscribe(event, () => {
      if (queryKey) {
        queryClient.invalidateQueries({ queryKey });
      } else {
        queryClient.invalidateQueries();
      }
    });

    return unsubscribe;
  }, [event, queryKey]);
}
