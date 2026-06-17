import { useEffect } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { rootRoute } from '../routes';
import { LeadKanban } from '@/components/leads/LeadKanban';
import { settingsApi } from '@/api/settings';

export const pipelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pipeline',
  validateSearch: (search: Record<string, unknown>) => ({
    pipelineId: search.pipelineId ? String(search.pipelineId) : undefined,
  }),
  component: PipelinePage,
});

function PipelinePage() {
  const search = pipelineRoute.useSearch();
  const navigate = useNavigate();

  const { data: pipelines = [], isLoading } = useQuery({
    queryKey: ['settings', 'pipelines'],
    queryFn: () => settingsApi.pipelines.list(),
  });

  useEffect(() => {
    if (!isLoading && !search.pipelineId && pipelines.length > 0) {
      navigate({ to: '/pipeline', search: { pipelineId: pipelines[0].id }, replace: true });
    }
  }, [isLoading, search.pipelineId, pipelines, navigate]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <div className="text-muted-foreground text-sm font-medium">Loading pipeline...</div>
      </div>
    );
  }

  const activePipelineId = search.pipelineId || (pipelines as any[])?.[0]?.id;

  if (!activePipelineId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-card border rounded-xl m-4">
        <p className="font-semibold text-foreground">No pipelines configured</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
          Go to Pipeline Settings to create a pipeline.
        </p>
      </div>
    );
  }

  return <LeadKanban pipelineDefinitionId={activePipelineId} />;
}
