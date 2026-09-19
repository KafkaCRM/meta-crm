import { pluginUIRegistry } from '@/lib/plugins-registry';
import { lazy } from 'react';

// Healthcare plugin UI registration
const healthcareSidePanel = lazy(() => import('@/components/plugins/healthcare/CaseSidePanel'));
const healthcareMainTabs = lazy(() => import('@/components/plugins/healthcare/CaseMainTabs'));

const healthcareAliases = [
  'healthcare',
  '@meta-crm/plugin-healthcare',
  'appointment-scheduler',
  'prescription-tracker',
  '@meta-crm/plugin-appointment-scheduler',
  '@meta-crm/plugin-prescription-tracker',
];

for (const alias of healthcareAliases) {
  pluginUIRegistry.register(alias, 'CaseSidePanel', healthcareSidePanel);
  pluginUIRegistry.register(alias, 'CaseMainTabs', healthcareMainTabs);
}

// Marketing plugin UI registration
const marketingSidePanel = lazy(() => import('@/components/plugins/marketing/CaseSidePanel'));
const marketingMainTabs = lazy(() => import('@/components/plugins/marketing/CaseMainTabs'));

const marketingAliases = [
  'marketing',
  '@meta-crm/plugin-marketing',
  'email-campaigns',
  'sms-notifications',
  'whatsapp-integration',
  'whatsapp',
  '@meta-crm/plugin-email-campaigns',
  '@meta-crm/plugin-sms-notifications',
  '@meta-crm/plugin-whatsapp',
];

for (const alias of marketingAliases) {
  pluginUIRegistry.register(alias, 'CaseSidePanel', marketingSidePanel);
  pluginUIRegistry.register(alias, 'CaseMainTabs', marketingMainTabs);
}
