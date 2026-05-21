import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import type { RequestScope } from '../tenant/request-scope.interface';
import { FrontendPluginManifestSchema, type FrontendPluginManifest } from '@meta-crm/types';

export type PluginErrorCode = 'NOT_FOUND' | 'TENANT_NOT_FOUND' | 'ALREADY_INSTALLED' | 'PLAN_LOCKED' | 'LIMIT_EXCEEDED';

export interface PluginError {
  code: PluginErrorCode;
  message?: string;
}

const PLAN_LEVELS: Record<string, number> = {
  'Free': 1,
  'Growth': 2,
  'Enterprise': 3,
};

@Injectable()
export class PluginService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  async listPlugins(): Promise<Result<any[], PluginError>> {
    const scope = this.cls.get<RequestScope>('scope');
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const tenant = await this.db.getClient().tenant.findFirst({
      where: { id: scope.tenant_id },
    });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    const registries = await this.db.getClient().pluginRegistry.findMany({
      where: { status: 'active' },
    });

    const tenantPlugins = await this.db.getClient().tenantPlugin.findMany({
      where: { tenant_id: scope.tenant_id },
    });

    const plugins: any[] = [];

    for (const reg of registries) {
      try {
        const manifest = FrontendPluginManifestSchema.parse(reg.manifest);
        
        // Check industry compatibility
        const isCompatible = 
          manifest.compatible_industries.includes('*') ||
          manifest.compatible_industries.map((i: string) => i.toLowerCase()).includes(tenant.industry.toLowerCase());

        if (!isCompatible) {
          continue;
        }

        const tenantPlugin = tenantPlugins.find((tp: any) => tp.plugin_registry_id === reg.id);

        plugins.push({
          id: reg.id,
          name: manifest.name,
          description: manifest.description || '',
          version: reg.version,
          enabled: tenantPlugin ? tenantPlugin.enabled : false,
          requires_plan: manifest.requires_plan || null,
          installed: !!tenantPlugin,
        });
      } catch (e) {
        // Skip invalid manifests
        continue;
      }
    }

    return ok(plugins);
  }

  async installPlugin(id: string): Promise<Result<any, PluginError>> {
    const scope = this.cls.get<RequestScope>('scope');
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const tenant = await this.db.getClient().tenant.findFirst({
      where: { id: scope.tenant_id },
    });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    const registry = await this.db.getClient().pluginRegistry.findFirst({
      where: { id, status: 'active' },
    });
    if (!registry) {
      return err({ code: 'NOT_FOUND', message: 'Plugin not found' });
    }

    let manifest: FrontendPluginManifest;
    try {
      manifest = FrontendPluginManifestSchema.parse(registry.manifest);
    } catch (e) {
      return err({ code: 'NOT_FOUND', message: 'Invalid plugin manifest' });
    }

    // Check industry compatibility
    const isCompatible = 
      manifest.compatible_industries.includes('*') ||
      manifest.compatible_industries.map((i: string) => i.toLowerCase()).includes(tenant.industry.toLowerCase());

    if (!isCompatible) {
      return err({ code: 'PLAN_LOCKED', message: 'Plugin is not compatible with tenant industry' });
    }

    // Check if already installed
    const existing = await this.db.getClient().tenantPlugin.findFirst({
      where: { tenant_id: scope.tenant_id, plugin_registry_id: id },
    });
    if (existing) {
      return err({ code: 'ALREADY_INSTALLED', message: 'Plugin is already installed' });
    }

    // Check plan requirements
    const tenantPlan = await this.db.getClient().tenantPlan.findFirst({
      where: { tenant_id: scope.tenant_id },
      include: { plan: true },
    });

    const activePlanName = tenantPlan?.plan?.name || 'Free';

    if (manifest.requires_plan) {
      const currentLevel = PLAN_LEVELS[activePlanName] || 1;
      const requiredLevel = PLAN_LEVELS[manifest.requires_plan] || 1;
      if (currentLevel < requiredLevel) {
        return err({ code: 'PLAN_LOCKED', message: `Requires ${manifest.requires_plan} plan` });
      }
    }

    // Check plugin limit
    if (tenantPlan) {
      const installedCount = await this.db.getClient().tenantPlugin.count({
        where: { tenant_id: scope.tenant_id },
      });
      if (installedCount >= tenantPlan.plan.max_plugins) {
        return err({ code: 'LIMIT_EXCEEDED', message: 'Plugin limit exceeded for your current plan' });
      }
    }

    const tenantPlugin = await this.db.getClient().tenantPlugin.create({
      data: {
        tenant_id: scope.tenant_id,
        plugin_registry_id: id,
        enabled: true,
      },
    });

    return ok({
      id: registry.id,
      name: manifest.name,
      description: manifest.description || '',
      version: registry.version,
      enabled: tenantPlugin.enabled,
      requires_plan: manifest.requires_plan || null,
      installed: true,
    });
  }

  async uninstallPlugin(id: string): Promise<Result<any, PluginError>> {
    const scope = this.cls.get<RequestScope>('scope');
    if (!scope?.tenant_id) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant context missing' });
    }

    const tenantPlugin = await this.db.getClient().tenantPlugin.findFirst({
      where: { tenant_id: scope.tenant_id, plugin_registry_id: id },
    });
    if (!tenantPlugin) {
      return err({ code: 'NOT_FOUND', message: 'Plugin is not installed' });
    }

    await this.db.getClient().tenantPlugin.delete({
      where: { id: tenantPlugin.id },
    });

    return ok({
      id,
      installed: false,
    });
  }
}
