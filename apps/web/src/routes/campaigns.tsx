import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { CampaignConsole } from '@/components/campaigns/CampaignConsole';

export const campaignsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/campaigns',
  component: CampaignConsole,
});
