import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { FranchisePage } from '@/pages/FranchisePage';

export const franchiseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/franchise',
  component: FranchisePage,
});
