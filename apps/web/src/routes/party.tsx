import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { PartyList, PartyDetail, PartyForm } from '@/components/party';

export const partiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/parties',
  component: PartyList,
});

export const partiesNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/parties/new',
  component: () => <PartyForm />,
  validateSearch: (search: Record<string, string>) => ({
    source: search.source,
    lead_id: search.lead_id,
  }),
});

export const partyDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/parties/$id',
  component: PartyDetailPage,
});

export const partyEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/parties/$id/edit',
  component: PartyEditPage,
});

function PartyDetailPage() {
  const { id } = partyDetailRoute.useParams();
  return <PartyDetail partyId={id} />;
}

function PartyEditPage() {
  const { id } = partyEditRoute.useParams();
  const { data: party, isLoading } = useQuery({
    queryKey: ['parties', id],
    queryFn: () => partiesApi.get(id),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!party) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Party not found</p>
      </div>
    );
  }

  return <PartyForm party={party} />;
}

import { useQuery } from '@tanstack/react-query';
import { partiesApi } from '@/api/parties';
