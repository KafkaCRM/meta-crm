import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { Appointments } from '@/components/appointments';
import { CapabilityGate } from '@/components/shared/CapabilityGate';

export const appointmentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/appointments',
  component: () => (
    <CapabilityGate
      capabilityId="capability/appointment"
      capabilityName="Appointments & Scheduling"
      description="Your workspace has not enabled the Appointments module. Enable it from Capabilities settings to manage patient/client bookings, slots, and calendars."
    >
      <Appointments />
    </CapabilityGate>
  ),
});

