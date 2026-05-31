import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import { useAuth } from '@/contexts/auth.context';

export function useCapabilities() {
  const { user } = useAuth();

  const { data: capabilities = [], isLoading } = useQuery({
    queryKey: ['settings', 'capabilities', user?.id],
    queryFn: () => settingsApi.capabilities.list(),
    enabled: !!user,
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
