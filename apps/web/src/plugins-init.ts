import { pluginUIRegistry } from '@/lib/plugins-registry';
import { lazy } from 'react';

// Healthcare plugin UI registration
pluginUIRegistry.register(
  'healthcare',
  'CaseSidePanel',
  lazy(() => import('@/components/plugins/healthcare/CaseSidePanel'))
);
pluginUIRegistry.register(
  'healthcare',
  'CaseMainTabs',
  lazy(() => import('@/components/plugins/healthcare/CaseMainTabs'))
);

// Marketing plugin UI registration
pluginUIRegistry.register(
  'marketing',
  'CaseSidePanel',
  lazy(() => import('@/components/plugins/marketing/CaseSidePanel'))
);
pluginUIRegistry.register(
  'marketing',
  'CaseMainTabs',
  lazy(() => import('@/components/plugins/marketing/CaseMainTabs'))
);
