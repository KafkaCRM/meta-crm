import { useMemo } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { rootRoute } from '../routes';
import { CaseKanban, CaseDetail, CaseForm } from '@/components/case';
import { settingsApi } from '@/api/settings';

export const casesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cases',
  component: () => <CaseKanban workflowDefinitionId="wf_default_001" />,
});

export const casesNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cases/new',
  component: () => <CaseForm />,
  validateSearch: (search: Record<string, unknown>) => ({
    party_id: search.party_id ? String(search.party_id) : undefined,
  }),
});

export const caseDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cases/$id',
  component: CaseDetailPage,
});

function CaseDetailPage() {
  const { id } = caseDetailRoute.useParams();
  const navigate = useNavigate();

  const pluginsQuery = useQuery({
    queryKey: ['settings', 'plugins'],
    queryFn: () => settingsApi.plugins.list(),
  });

  const capabilitiesQuery = useQuery({
    queryKey: ['settings', 'capabilities'],
    queryFn: () => settingsApi.capabilities.list(),
  });

  const activePlugins = useMemo(() => {
    return pluginsQuery.data?.filter((p) => p.enabled && p.installed).map((p) => p.id) ?? [];
  }, [pluginsQuery.data]);

  const activeCapabilities = useMemo(() => {
    return capabilitiesQuery.data?.filter((c) => c.enabled).map((c) => c.id) ?? [];
  }, [capabilitiesQuery.data]);

  const isLoading = pluginsQuery.isLoading || capabilitiesQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[#9c9fa5] text-sm">Loading details...</div>
      </div>
    );
  }

  return (
    <CaseDetail
      caseId={id}
      activePlugins={activePlugins}
      activeCapabilities={activeCapabilities}
      onBack={() => navigate({ to: '/cases' })}
    />
  );
}
