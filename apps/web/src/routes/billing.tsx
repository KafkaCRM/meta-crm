import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { Billing } from '@/components/billing';
import { CapabilityGate } from '@/components/shared/CapabilityGate';

export const billingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invoices',
  component: () => (
    <CapabilityGate
      capabilityId="capability/billing"
      capabilityName="Invoicing & Billing"
      description="Your workspace has not enabled the Invoicing module. Enable it from Capabilities settings to create invoices, track payments, and manage billing."
    >
      <Billing />
    </CapabilityGate>
  ),
});

