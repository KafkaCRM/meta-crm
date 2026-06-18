import { createRoute, Outlet, redirect } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { BranchManager } from '@/components/settings/BranchManager';
import { VerticalManager } from '@/components/settings/VerticalManager';
import { BrandManager } from '@/components/settings/BrandManager';
import { UserManager } from '@/components/settings/UserManager';
import { RoleMatrix } from '@/components/settings/RoleMatrix';
import { WorkflowBuilder } from '@/components/settings/WorkflowBuilder';
import { FieldEditor } from '@/components/settings/FieldEditor';
import { LabelEditor } from '@/components/settings/LabelEditor';
import { CapabilityToggle } from '@/components/settings/CapabilityToggle';
import { PluginStore } from '@/components/settings/PluginStore';
import { ObjectManager } from '@/components/settings/ObjectManager';
import { SetupAuditTrail } from '@/components/settings/SetupAuditTrail';
import { LayoutBuilder } from '@/components/settings/LayoutBuilder';

function SettingsPage({ children }: { children: React.ReactNode }) {
  return <SettingsLayout>{children}</SettingsLayout>;
}

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: () => (
    <SettingsPage>
      <Outlet />
    </SettingsPage>
  ),
});

export const settingsBranchesRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'branches',
  component: BranchManager,
});

export const settingsVerticalsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'verticals',
  component: VerticalManager,
});

export const settingsBrandsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'brands',
  beforeLoad: () => {
    throw redirect({ to: '/settings/verticals' });
  },
});

export const settingsUsersRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'users',
  component: UserManager,
});

export const settingsRolesRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'roles',
  component: RoleMatrix,
});

export const settingsPipelinesRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'pipelines',
  component: WorkflowBuilder,
});

export const settingsWorkflowsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'workflows',
  beforeLoad: () => {
    throw redirect({ to: '/settings/pipelines' });
  },
});

export const settingsFieldsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'fields',
  component: FieldEditor,
});

export const settingsLabelsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'labels',
  component: LabelEditor,
});

export const settingsCapabilitiesRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'capabilities',
  component: CapabilityToggle,
});

export const settingsPluginsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'plugins',
  component: PluginStore,
});

export const settingsIntegrationsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'integrations',
  beforeLoad: () => {
    throw redirect({ to: '/integrations' });
  },
});

export const settingsObjectsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'objects',
  component: ObjectManager,
});

export const settingsAuditTrailRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'audit-trail',
  component: SetupAuditTrail,
});

export const settingsLayoutBuilderRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'layout-builder',
  component: LayoutBuilder,
});
