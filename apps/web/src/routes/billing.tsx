import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { Billing } from '@/components/billing';

export const billingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invoices',
  component: Billing,
});
