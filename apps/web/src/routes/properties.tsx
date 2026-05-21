import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { Properties } from '@/components/properties';

export const propertiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/properties',
  component: Properties,
});
