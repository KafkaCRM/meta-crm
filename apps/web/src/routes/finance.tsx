import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { FeePlanList } from '@/components/finance/FeePlanList';
import { StudentFeeList } from '@/components/finance/StudentFeeList';
import { ScholarshipList } from '@/components/finance/ScholarshipList';
import { CapabilityGate } from '@/components/shared/CapabilityGate';

const gate = (children: React.ReactNode) => (
  <CapabilityGate
    capabilityId="capability/finance"
    capabilityName="Finance & Collections"
    description="Your workspace has not enabled the Finance module. Enable it from Capabilities settings to manage fee plans, student fees, and scholarships."
  >
    {children}
  </CapabilityGate>
);

export const feePlansRoute = createRoute({ getParentRoute: () => rootRoute, path: '/fee-plans', component: () => gate(<FeePlanList />) });
export const studentFeesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/student-fees', component: () => gate(<StudentFeeList />) });
export const scholarshipsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/scholarships', component: () => gate(<ScholarshipList />) });
