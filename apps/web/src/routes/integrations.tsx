import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { IntegrationsLayout } from '@/components/integrations/IntegrationsLayout';

export const integrationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/integrations',
  component: IntegrationsLayout,
});
