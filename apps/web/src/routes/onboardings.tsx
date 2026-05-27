import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { Onboardings } from '@/components/onboardings';
import { CapabilityGate } from '@/components/shared/CapabilityGate';

export const onboardingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboardings',
  component: () => (
    <CapabilityGate
      capabilityId="capability/customer-onboarding"
      capabilityName="Customer Onboarding"
      description="Your workspace has not enabled the Customer Onboarding module. Enable it from Capabilities settings to manage multi-step onboarding workflows and track setup progress."
    >
      <Onboardings />
    </CapabilityGate>
  ),
});

