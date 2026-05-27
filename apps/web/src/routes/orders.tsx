import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { Orders } from '@/components/orders';
import { CapabilityGate } from '@/components/shared/CapabilityGate';

export const ordersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders',
  component: () => (
    <CapabilityGate
      capabilityId="capability/order-management"
      capabilityName="Order Management"
      description="Your workspace has not enabled the Order Management module. Enable it from Capabilities settings to create orders, track line items, and manage payment statuses."
    >
      <Orders />
    </CapabilityGate>
  ),
});

