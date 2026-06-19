import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { CallLogList } from '@/components/telephony/CallLogList';
import { CapabilityGate } from '@/components/shared/CapabilityGate';

const gate = (children: React.ReactNode) => (
  <CapabilityGate
    capabilityId="capability/telephony"
    capabilityName="Telephony"
    description="Your workspace has not enabled the Telephony module. Enable it from Capabilities settings to manage call logs and Twilio integration."
  >
    {children}
  </CapabilityGate>
);

export const callLogsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/call-logs', component: () => gate(<CallLogList />) });
