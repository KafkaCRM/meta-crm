import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';

export function useCapabilities() {
  const { data: capabilities = [], isLoading } = useQuery({
    queryKey: ['settings', 'capabilities'],
    queryFn: () => settingsApi.capabilities.list(),
    staleTime: 30_000,
  });

  const isEnabled = (capabilityId: string) => {
    return capabilities.some((cap) => cap.id === capabilityId && cap.enabled);
  };

  return {
    capabilities,
    isLoading,
    isEnabled,
  };
}
