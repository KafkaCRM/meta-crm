import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { Orders } from '@/components/orders';

export const ordersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders',
  component: Orders,
});
