import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { Onboardings } from '@/components/onboardings';

export const onboardingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboardings',
  component: Onboardings,
});
