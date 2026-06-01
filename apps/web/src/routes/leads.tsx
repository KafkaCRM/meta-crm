import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { LeadList } from '@/components/leads';

export const leadsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leads',
  component: LeadList,
});
