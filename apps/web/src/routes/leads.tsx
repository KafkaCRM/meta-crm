import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { LeadList } from '@/components/leads';
import { LeadDetailFull } from '@/components/leads/LeadDetailFull';

export const leadsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leads',
  component: LeadList,
});

export const leadDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leads/$id',
  component: LeadDetailPage,
});

function LeadDetailPage() {
  const { id } = leadDetailRoute.useParams();
  return <LeadDetailFull leadId={id} />;
}
