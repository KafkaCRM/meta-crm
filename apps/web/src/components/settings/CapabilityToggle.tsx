import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { settingsApi } from '@/api/settings';

export function CapabilityToggle() {
  const queryClient = useQueryClient();

  const { data: capabilities, isLoading } = useQuery({
    queryKey: ['settings', 'capabilities'],
    queryFn: () => settingsApi.capabilities.list(),
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      settingsApi.capabilities.toggle(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'capabilities'] });
      toast.success('Capability updated');
    },
    onError: () => toast.error('Failed to update capability'),
  });

  const handleToggle = useCallback(
    (id: string, enabled: boolean) => {
      toggleMutation.mutate({ id, enabled: !enabled });
    },
    [toggleMutation],
  );

  if (isLoading) {
    return <div className="text-muted-foreground">Loading capabilities...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Capabilities</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enable or disable optional capabilities
        </p>
      </div>

      <div className="rounded-lg border divide-y">
        {capabilities?.map((cap) => (
          <div key={cap.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{cap.name}</p>
              <p className="text-xs text-muted-foreground">{cap.description}</p>
            </div>
            <button
              onClick={() => handleToggle(cap.id, cap.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                cap.enabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  cap.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
        {capabilities?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No capabilities available.
          </div>
        )}
      </div>
    </div>
  );
}
