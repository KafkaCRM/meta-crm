import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { Appointments } from '@/components/appointments';

export const appointmentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/appointments',
  component: Appointments,
});
