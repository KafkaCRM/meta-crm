import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { Properties } from '@/components/properties';
import { CapabilityGate } from '@/components/shared/CapabilityGate';

export const propertiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/properties',
  component: () => (
    <CapabilityGate
      capabilityId="capability/property-listing"
      capabilityName="Property Listings"
      description="Your workspace has not enabled the Property Listings module. Enable it from Capabilities settings to manage properties, floor plans, and listing statuses."
    >
      <Properties />
    </CapabilityGate>
  ),
});

