import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { BranchManager } from '@/components/settings/BranchManager';
import { BrandManager } from '@/components/settings/BrandManager';
import { AssignmentManager } from '@/components/settings/AssignmentManager';
import { UserManager } from '@/components/settings/UserManager';
import { RoleMatrix } from '@/components/settings/RoleMatrix';
import { WorkflowBuilder } from '@/components/settings/WorkflowBuilder';
import { FieldEditor } from '@/components/settings/FieldEditor';
import { LabelEditor } from '@/components/settings/LabelEditor';
import { CapabilityToggle } from '@/components/settings/CapabilityToggle';
import { PluginStore } from '@/components/settings/PluginStore';
import { IntegrationSettings } from '@/components/settings/IntegrationSettings';

function SettingsPage({ children }: { children: React.ReactNode }) {
  return <SettingsLayout>{children}</SettingsLayout>;
}

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: () => <SettingsPage><BranchManager /></SettingsPage>,
});

export const settingsBranchesRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'branches',
  component: () => <SettingsPage><BranchManager /></SettingsPage>,
});

export const settingsBrandsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'brands',
  component: () => <SettingsPage><BrandManager /></SettingsPage>,
});

export const settingsAssignmentsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'assignments',
  component: () => <SettingsPage><AssignmentManager /></SettingsPage>,
});

export const settingsUsersRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'users',
  component: () => <SettingsPage><UserManager /></SettingsPage>,
});

export const settingsRolesRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'roles',
  component: () => <SettingsPage><RoleMatrix /></SettingsPage>,
});

export const settingsWorkflowsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'workflows',
  component: () => <SettingsPage><WorkflowBuilder /></SettingsPage>,
});

export const settingsFieldsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'fields',
  component: () => <SettingsPage><FieldEditor /></SettingsPage>,
});

export const settingsLabelsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'labels',
  component: () => <SettingsPage><LabelEditor /></SettingsPage>,
});

export const settingsCapabilitiesRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'capabilities',
  component: () => <SettingsPage><CapabilityToggle /></SettingsPage>,
});

export const settingsPluginsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'plugins',
  component: () => <SettingsPage><PluginStore /></SettingsPage>,
});

export const settingsIntegrationsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'integrations',
  component: () => <SettingsPage><IntegrationSettings /></SettingsPage>,
});
