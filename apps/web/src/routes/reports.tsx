import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { ReportsPage } from '@/components/reports/ReportsPage';

export const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reports',
  component: ReportsPage,
});
