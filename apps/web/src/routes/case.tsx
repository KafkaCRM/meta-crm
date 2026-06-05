import { useMemo } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { rootRoute } from '../routes';
import { CaseKanban, CaseDetail, CaseForm } from '@/components/case';
import { settingsApi } from '@/api/settings';

export const casesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cases',
  validateSearch: (search: Record<string, unknown>) => ({
    workflowId: search.workflowId ? String(search.workflowId) : undefined,
  }),
  component: CasePageWrapper,
});

function CasePageWrapper() {
  const search = casesRoute.useSearch();
  const navigate = useNavigate();
  
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['settings', 'pipelines'],
    queryFn: () => settingsApi.pipelines.list(),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-fin-orange border-t-transparent" />
        <div className="text-muted-foreground text-sm font-medium">Loading active pipeline...</div>
      </div>
    );
  }

  const activeWfId = search.workflowId || workflows[0]?.id;

  if (!activeWfId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-card border rounded-xl m-4">
        <p className="font-semibold text-foreground">No pipelines configured</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
          Please go to Pipeline Settings to create a custom pipeline roadmap.
        </p>
      </div>
    );
  }

  // If there's no workflowId in the URL but we found one, redirect to keep the URL clean and synchronized
  if (!search.workflowId && workflows[0]?.id) {
    navigate({ to: '/cases', search: { workflowId: workflows[0].id }, replace: true });
  }

  return <CaseKanban pipelineDefinitionId={activeWfId} />;
}

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
        <div className="text-muted-foreground text-sm">Loading details...</div>
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
