import { createRoute, Outlet, redirect } from '@tanstack/react-router';
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
import { ObjectManager } from '@/components/settings/ObjectManager';
import { SetupAuditTrail } from '@/components/settings/SetupAuditTrail';
import { LayoutBuilder } from '@/components/settings/LayoutBuilder';
import { IndustrySettings } from '@/components/settings/IndustrySettings';

function SettingsPage({ children }: { children: React.ReactNode }) {
  return <SettingsLayout>{children}</SettingsLayout>;
}

export const settingsIndustryRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'industry',
  component: IndustrySettings,
});

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

export const settingsBrandsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'brands',
  component: BrandManager,
});

export const settingsAssignmentsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'assignments',
  component: AssignmentManager,
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

export const settingsWorkflowsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'workflows',
  component: WorkflowBuilder,
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
  component: IntegrationSettings,
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
