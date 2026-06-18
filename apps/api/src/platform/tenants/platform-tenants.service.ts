import { Injectable } from '@nestjs/common';
import { TenantRole } from '@meta-crm/types';
import * as bcrypt from 'bcrypt';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { PlatformPrismaService } from '../../core/tenant/platform-prisma.service';
import { AVAILABLE_CAPABILITIES } from '../../core/capability/capability.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { ProvisioningStreamService } from './provisioning-stream.service';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

const BCRYPT_COST = 12;

const CAPABILITY_MAPPINGS: Record<string, string> = {
  education: 'capability/enrollment',
  healthcare: 'capability/appointment',
  finance: 'capability/billing',
  'real-estate': 'capability/property-listing',
  retail: 'capability/order-management',
  technology: 'capability/customer-onboarding',
};

import { PLUGIN_CATALOGUE } from '../../plugins/registry/plugin-catalogue';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export type PlatformTenantErrorCode =
  | 'TENANT_NOT_FOUND'
  | 'SLUG_TAKEN'
  | 'PLAN_NOT_FOUND'
  | 'INDUSTRY_NOT_FOUND'
  | 'PLAN_LIMIT_EXCEEDED'
  | 'TRANSACTION_FAILED';

export interface PlatformTenantError {
  code: PlatformTenantErrorCode;
  message: string;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  industry: string;
  plan_id: string;
  owner: { name: string; email: string };
  capabilities?: string[];
  session_id?: string;
}

export interface CreateTenantResponse {
  tenant: { id: string; name: string; slug: string; industry: string };
  owner: { email: string; temporary_password: string };
}

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  industry: string;
  status: string;
  created_at: Date;
  branch_count: number;
  user_count: number;
}

export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  industry: string;
  status: string;
  created_at: Date;
  branch_count: number;
  user_count: number;
  plugin_list: string[];
  plugin_ids: string[];
  enabled_capabilities: string[];
  custom_limits?: Record<string, any>;
  plan?: {
    id: string;
    name: string;
    max_branches: number;
    max_users: number;
    max_plugins: number;
  } | null;
}

@Injectable()
export class PlatformTenantsService {
  constructor(
    private readonly db: PlatformPrismaService,
    private readonly audit: PlatformAuditService,
    private readonly streamService: ProvisioningStreamService,
  ) {}

  async list(params: {
    cursor?: string;
    limit?: number;
  }): Promise<Result<{ data: TenantListItem[]; next_cursor: string | undefined }, PlatformTenantError>> {
    const limit = Math.min(params.limit ?? 20, 100);
    const tenants = await this.db.client.tenant.findMany({
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
    });

    const hasMore = tenants.length > limit;
    const page = hasMore ? tenants.slice(0, limit) : tenants;

    const data: TenantListItem[] = await Promise.all(
      page.map(async (t: any) => {
        const [branchCount, userCount] = await Promise.all([
          this.db.client.branch.count({ where: { tenant_id: t.id } }),
          this.db.client.user.count({ where: { tenant_id: t.id } }),
        ]);
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          industry: t.industry,
          status: t.status,
          created_at: t.created_at,
          branch_count: branchCount,
          user_count: userCount,
        };
      }),
    );

    return ok({
      data,
      next_cursor: hasMore ? data[data.length - 1]?.id : undefined,
    });
  }

  async findOne(id: string): Promise<Result<TenantDetail, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({
      where: { id },
      include: {
        tenantPlans: {
          include: {
            plan: true,
          },
        },
      },
    });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    const [branchCount, userCount, plugins] = await Promise.all([
      this.db.client.branch.count({ where: { tenant_id: id } }),
      this.db.client.user.count({ where: { tenant_id: id } }),
      this.db.client.tenantPlugin.findMany({
        where: { tenant_id: id },
        include: { pluginRegistry: { select: { id: true, package_name: true } } },
      }),
    ]);

    const config = (tenant.config_json ?? {}) as Record<string, any>;
    const enabled_capabilities = Array.isArray(config.enabled_capabilities)
      ? (config.enabled_capabilities as string[])
      : [];
    const custom_limits = config.custom_limits ?? {};

    const activeTenantPlan = tenant.tenantPlans?.[0];
    const plan = activeTenantPlan?.plan
      ? {
          id: activeTenantPlan.plan.id,
          name: activeTenantPlan.plan.name,
          max_branches: activeTenantPlan.plan.max_branches,
          max_users: activeTenantPlan.plan.max_users,
          max_plugins: activeTenantPlan.plan.max_plugins,
        }
      : null;

    return ok({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      industry: tenant.industry,
      status: tenant.status,
      created_at: tenant.created_at,
      branch_count: branchCount,
      user_count: userCount,
      plugin_list: plugins.map((p: any) => p.pluginRegistry.package_name),
      plugin_ids: plugins.map((p: any) => p.pluginRegistry.id),
      enabled_capabilities,
      custom_limits,
      plan,
    });
  }

  async updateEntitlements(
    id: string,
    pluginIds: string[],
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<TenantDetail, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    try {
      await this.db.client.$transaction(async (tx: any) => {
        const existing = await tx.tenantPlugin.findMany({
          where: { tenant_id: id },
        });

        const existingRegIds = existing.map((p: any) => p.plugin_registry_id);

        const toDeleteRegIds = existingRegIds.filter((regId: string) => !pluginIds.includes(regId));
        const toCreateRegIds = pluginIds.filter((regId: string) => !existingRegIds.includes(regId));

        if (toDeleteRegIds.length > 0) {
          await tx.tenantPlugin.deleteMany({
            where: {
              tenant_id: id,
              plugin_registry_id: { in: toDeleteRegIds },
            },
          });
        }

        if (toCreateRegIds.length > 0) {
          await tx.tenantPlugin.createMany({
            data: toCreateRegIds.map((regId: string) => ({
              tenant_id: id,
              plugin_registry_id: regId,
              enabled: true,
            })),
          });
        }
      });

      if (auditMeta) {
        await this.audit.writeLog({
          actor_id: auditMeta.actor_id,
          actor_role: auditMeta.actor_role,
          action: 'tenant:update_entitlements',
          target_id: id,
          actor_ip: auditMeta.actor_ip,
          user_agent: auditMeta.user_agent,
          details: { tenant_id: id, plugin_ids: pluginIds },
          reason: auditMeta.reason,
        });
      }

      return this.findOne(id);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Transaction failed to update entitlements',
      });
    }
  }

  async updateCapabilities(
    id: string,
    capabilities: string[],
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<TenantDetail, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    try {
      const config = { ...((tenant.config_json ?? {}) as Record<string, any>) };
      config.enabled_capabilities = capabilities;

      await this.db.client.tenant.update({
        where: { id },
        data: {
          config_json: config,
        },
      });

      if (auditMeta) {
        await this.audit.writeLog({
          actor_id: auditMeta.actor_id,
          actor_role: auditMeta.actor_role,
          action: 'tenant:update_capabilities',
          target_id: id,
          actor_ip: auditMeta.actor_ip,
          user_agent: auditMeta.user_agent,
          details: { tenant_id: id, capabilities },
          reason: auditMeta.reason,
        });
      }

      return this.findOne(id);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Transaction failed to update capabilities',
      });
    }
  }

  async resetOwnerPassword(
    id: string,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<{ email: string; temporary_password: string }, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    const owner = await this.db.client.user.findFirst({
      where: { tenant_id: id },
      orderBy: { created_at: 'asc' },
    });

    if (!owner) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant owner user not found' });
    }

    const temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_COST);

    try {
      await this.db.client.user.update({
        where: { id: owner.id },
        data: { password_hash: passwordHash },
      });

      if (auditMeta) {
        await this.audit.writeLog({
          actor_id: auditMeta.actor_id,
          actor_role: auditMeta.actor_role,
          action: 'tenant:reset_owner_password',
          target_id: id,
          actor_ip: auditMeta.actor_ip,
          user_agent: auditMeta.user_agent,
          details: { tenant_id: id, owner_id: owner.id, owner_email: owner.email },
          reason: auditMeta.reason,
        });
      }

      return ok({
        email: owner.email || '',
        temporary_password: temporaryPassword,
      });
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to reset owner password',
      });
    }
  }

  async create(
    input: CreateTenantInput,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<CreateTenantResponse, PlatformTenantError>> {
    const sessionId = input.session_id;

    if (sessionId) {
      this.streamService.emit(sessionId, 'VALIDATE', 'Validating request parameters & checking plan compatibility', 10);
    }

    const existing = await this.db.client.tenant.findUnique({ where: { slug: input.slug } });
    if (existing) {
      const errMsg = `Slug "${input.slug}" is already taken`;
      if (sessionId) {
        this.streamService.error(sessionId, errMsg);
      }
      return err({ code: 'SLUG_TAKEN', message: errMsg });
    }

    const plan = await this.db.client.subscriptionPlan.findUnique({ where: { id: input.plan_id } });
    if (!plan) {
      const errMsg = 'Subscription plan not found';
      if (sessionId) {
        this.streamService.error(sessionId, errMsg);
      }
      return err({ code: 'PLAN_NOT_FOUND', message: errMsg });
    }

    const temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_COST);

    try {
      if (sessionId) {
        this.streamService.emit(sessionId, 'PROVISION', 'Creating tenant record, initializing core workspace metadata', 30);
      }

      const defaultCap = CAPABILITY_MAPPINGS[input.industry.toLowerCase()];
      const requestedCaps = input.capabilities || [];
      const enabledCapabilities = Array.from(
        new Set([
          ...(defaultCap ? [defaultCap] : []),
          ...requestedCaps,
        ])
      );
      const tenant = await this.db.client.$transaction(async (tx: any) => {
        const t = await tx.tenant.create({
          data: {
            name: input.name,
            slug: input.slug,
            industry: input.industry,
            config_json: enabledCapabilities.length > 0 ? { enabled_capabilities: enabledCapabilities } : {},
          },
        });

        await tx.user.create({
          data: {
            tenant_id: t.id,
            name: input.owner.name,
            email: input.owner.email,
            password_hash: passwordHash,
          },
        });

        if (sessionId) {
          this.streamService.emit(sessionId, 'BILLING', 'Initializing tenant plan subscription & database schema bindings', 50);
        }

        await tx.tenantPlan.create({
          data: {
            tenant_id: t.id,
            plan_id: input.plan_id,
          },
        });

        return t;
      });

      // Post-transaction Onboarding Automation:
      // 1. Industry Database Template Execution
      if (sessionId) {
        this.streamService.emit(sessionId, 'TEMPLATE', 'Applying industry template schemas & workflows', 70);
      }

      const templateResult = await this.applyTemplate(tenant.id, input.industry);
      if (templateResult.isErr()) {
        const errMsg = `Failed to apply industry template: ${templateResult.error.message}`;
        if (sessionId) {
          this.streamService.error(sessionId, errMsg, templateResult.error);
        }
        // Rollback / clean up all records related to this tenant to keep database consistent
        await this.db.client.labelOverride.deleteMany({ where: { tenant_id: tenant.id } }).catch(() => {});
        await this.db.client.pipelineTransition.deleteMany({ where: { pipelineDefinition: { tenant_id: tenant.id } } }).catch(() => {});
        await this.db.client.pipelineStage.deleteMany({ where: { pipelineDefinition: { tenant_id: tenant.id } } }).catch(() => {});
        await this.db.client.pipelineDefinition.deleteMany({ where: { tenant_id: tenant.id } }).catch(() => {});
        await this.db.client.fieldDefinition.deleteMany({ where: { tenant_id: tenant.id } }).catch(() => {});
        await this.db.client.tenantPlugin.deleteMany({ where: { tenant_id: tenant.id } }).catch(() => {});
        await this.db.client.tenantPlan.deleteMany({ where: { tenant_id: tenant.id } }).catch(() => {});
        await this.db.client.user.deleteMany({ where: { tenant_id: tenant.id } }).catch(() => {});
        await this.db.client.tenant.delete({ where: { id: tenant.id } }).catch(() => {});

        return err({
          code: 'TRANSACTION_FAILED',
          message: errMsg,
        });
      }

      if (sessionId) {
        this.streamService.emit(sessionId, 'PLUGINS', 'Installing & activating default plugin extensions', 90);
      }

      for (const entry of PLUGIN_CATALOGUE) {
        let registryEntry = await this.db.client.pluginRegistry.findFirst({
          where: { package_name: entry.package_name },
        });

        if (!registryEntry) {
          registryEntry = await this.db.client.pluginRegistry.create({
            data: {
              package_name: entry.package_name,
              version: entry.version,
              manifest: {
                ...entry.manifest,
                category: entry.category,
                icon: entry.icon,
              } as any,
              status: 'active',
            },
          });
        }

        const isCompatible = entry.manifest.compatible_industries.includes('*') ||
          entry.manifest.compatible_industries.some(
            (ind: string) => ind.toLowerCase() === input.industry.toLowerCase() ||
              ind.toLowerCase().replace('_', '-') === input.industry.toLowerCase()
          );

        if (isCompatible) {
          // Entitle license to the newly created tenant
          await this.db.client.tenantPlugin.create({
            data: {
              tenant_id: tenant.id,
              plugin_registry_id: registryEntry.id,
              enabled: true,
            },
          });
        }
      }

      if (auditMeta) {
        await this.audit.writeLog({
          actor_id: auditMeta.actor_id,
          actor_role: auditMeta.actor_role,
          action: 'tenant:create',
          target_id: tenant.id,
          actor_ip: auditMeta.actor_ip,
          user_agent: auditMeta.user_agent,
          details: { tenant_id: tenant.id, name: tenant.name, slug: tenant.slug, industry: tenant.industry, plan_id: input.plan_id },
          reason: auditMeta.reason,
        });
      }

      const responsePayload = {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          industry: tenant.industry,
        },
        owner: {
          email: input.owner.email,
          temporary_password: temporaryPassword,
        },
      };

      if (sessionId) {
        this.streamService.complete(sessionId, responsePayload);
      }

      return ok(responsePayload);
    } catch (e: any) {
      const errMsg = e?.message ?? 'Transaction failed';
      if (sessionId) {
        this.streamService.error(sessionId, errMsg, e);
      }
      return err({
        code: 'TRANSACTION_FAILED',
        message: errMsg,
      });
    }
  }

  async suspend(
    id: string,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<void, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    await this.db.client.tenant.update({
      where: { id },
      data: { status: 'suspended' },
    });

    if (auditMeta) {
      await this.audit.writeLog({
        actor_id: auditMeta.actor_id,
        actor_role: auditMeta.actor_role,
        action: 'tenant:suspend',
        target_id: id,
        actor_ip: auditMeta.actor_ip,
        user_agent: auditMeta.user_agent,
        details: { tenant_id: id, tenant_name: tenant.name },
        reason: auditMeta.reason,
      });
    }

    return ok(undefined);
  }

  async reactivate(
    id: string,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<void, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    await this.db.client.tenant.update({
      where: { id },
      data: { status: 'active' },
    });

    if (auditMeta) {
      await this.audit.writeLog({
        actor_id: auditMeta.actor_id,
        actor_role: auditMeta.actor_role,
        action: 'tenant:reactivate',
        target_id: id,
        actor_ip: auditMeta.actor_ip,
        user_agent: auditMeta.user_agent,
        details: { tenant_id: id, tenant_name: tenant.name },
        reason: auditMeta.reason,
      });
    }

    return ok(undefined);
  }

  async applyTemplate(
    id: string,
    industry: string,
  ): Promise<Result<void, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    try {
      const { existsSync, readFileSync } = await import('fs');
      const { join } = await import('path');
      const filePath = join(__dirname, '..', '..', 'core', 'metadata', 'templates', `${industry}.template.json`);

      if (!existsSync(filePath)) {
        return err({ code: 'INDUSTRY_NOT_FOUND', message: `No template for industry: ${industry}` });
      }

      const raw = readFileSync(filePath, 'utf-8');
      const template: any = JSON.parse(raw);

      for (const [entityType, fields] of Object.entries< any[]>(template.field_definitions ?? {})) {
        for (const fieldDef of fields) {
          const existing = await this.db.client.fieldDefinition.findFirst({
            where: { tenant_id: id, name: fieldDef.name },
          });
          if (existing) continue;

          await this.db.client.fieldDefinition.create({
            data: {
              tenant_id: id,
              entity_type: entityType,
              name: fieldDef.name,
              label: fieldDef.label,
              field_type: fieldDef.field_type,
              options: fieldDef.options ? JSON.parse(JSON.stringify(fieldDef.options)) : null,
              required: fieldDef.required ?? false,
              order: fieldDef.order ?? 0,
            },
          });
        }
      }

      const wfDef = template.pipeline_definition;
      if (wfDef) {
        let wfId: string;
        const existingWf = await this.db.client.pipelineDefinition.findFirst({
          where: { tenant_id: id, name: wfDef.name },
        });

        if (existingWf) {
          wfId = existingWf.id;
        } else {
          const created = await this.db.client.pipelineDefinition.create({
            data: {
              tenant_id: id,
              name: wfDef.name,
              entity_type: wfDef.entity_type,
            },
          });
          wfId = created.id;
        }

        const stageNameToId = new Map<string, string>();

        for (const stageDef of wfDef.stages ?? []) {
          const existingStage = await this.db.client.pipelineStage.findFirst({
            where: { pipeline_definition_id: wfId, name: stageDef.name },
          });

          if (existingStage) {
            stageNameToId.set(stageDef.name, existingStage.id);
            continue;
          }

          const created = await this.db.client.pipelineStage.create({
            data: {
              pipeline_definition_id: wfId,
              name: stageDef.name,
              order: stageDef.order,
              entry_criteria: stageDef.entry_criteria ?? [],
              sla_hours: stageDef.sla_hours ?? null,
            },
          });
          stageNameToId.set(stageDef.name, created.id);
        }

        for (const transDef of wfDef.transitions ?? []) {
          const fromId = stageNameToId.get(transDef.from_stage);
          const toId = stageNameToId.get(transDef.to_stage);
          if (!fromId || !toId) continue;

          const existingTrans = await this.db.client.pipelineTransition.findFirst({
            where: { from_stage_id: fromId, to_stage_id: toId },
          });
          if (existingTrans) continue;

          await this.db.client.pipelineTransition.create({
            data: {
              pipeline_definition_id: wfId,
              from_stage_id: fromId,
              to_stage_id: toId,
            },
          });
        }
      }

      for (const [key, value] of Object.entries< string>(template.label_overrides ?? {})) {
        await this.db.client.labelOverride.upsert({
          where: { tenant_id_label_key: { tenant_id: id, label_key: key } },
          create: { tenant_id: id, label_key: key, override_value: value },
          update: { override_value: value },
        });
      }

      // Provision default branch and vertical if not already present
      let branch = await this.db.client.branch.findFirst({
        where: { tenant_id: id, name: `${tenant.name} Headquarters` },
      });

      if (!branch) {
        branch = await this.db.client.branch.create({
          data: {
            tenant_id: id,
            name: `${tenant.name} Headquarters`,
          },
        });
      }

      let defaultVertical = await this.db.client.vertical.findFirst({
        where: { tenant_id: id, branch_id: branch.id },
      });

      if (!defaultVertical) {
        defaultVertical = await this.db.client.vertical.create({
          data: {
            tenant_id: id,
            branch_id: branch.id,
            name: 'Default Vertical',
          },
        });
      }

      // Provision the 5 universal system roles
      const industryKey = industry.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
      let memberName = 'Member';
      let managerName = 'Manager';
      let adminName = 'Administrator';

      if (industryKey === 'education') {
        memberName = 'Counsellor';
        managerName = 'Branch Head';
        adminName = 'Academic Director';
      } else if (industryKey === 'healthcare') {
        memberName = 'Coordinator';
        managerName = 'Department Head';
        adminName = 'Hospital Administrator';
      } else if (industryKey === 'real-estate' || industryKey === 'realestate') {
        memberName = 'Agent';
        managerName = 'Team Lead';
        adminName = 'Operations Head';
      } else if (industryKey === 'it-services' || industryKey === 'it_services' || industryKey === 'technology' || industryKey === 'tech') {
        memberName = 'Consultant';
        managerName = 'Practice Lead';
        adminName = 'Operations Head';
      }

      const roleDefinitions = [
        { slug: 'owner', name: 'owner', display_name: 'Owner', description: 'Tenant Owner - full capabilities and billing manage' },
        { slug: 'admin', name: 'admin', display_name: adminName, description: 'Tenant Administrator - manage all metadata and operations' },
        { slug: 'manager', name: 'manager', display_name: managerName, description: 'Tenant Manager - manage records and cases' },
        { slug: 'member', name: 'member', display_name: memberName, description: 'Tenant Member - basic record view and creation' },
        { slug: 'viewer', name: 'viewer', display_name: 'Viewer', description: 'Read-only access across contacts and cases' },
      ];

      for (const roleDef of roleDefinitions) {
        const role = await this.db.client.role.upsert({
          where: {
            tenant_id_name: {
              tenant_id: id,
              name: roleDef.name,
            },
          },
          update: {
            display_name: roleDef.display_name,
            description: roleDef.description,
            slug: roleDef.slug,
          },
          create: {
            tenant_id: id,
            name: roleDef.name,
            slug: roleDef.slug,
            display_name: roleDef.display_name,
            description: roleDef.description,
            is_system_role: true,
          },
        });

        const { SYSTEM_ROLE_MAP } = await import('@meta-crm/permissions');
        const defaultPerms = SYSTEM_ROLE_MAP[roleDef.slug as TenantRole] ?? [];

        await this.db.client.rolePermission.deleteMany({
          where: { role_id: role.id },
        });

        for (const perm of defaultPerms) {
          await this.db.client.rolePermission.create({
            data: {
              role_id: role.id,
              resource: perm.resource,
              action: perm.action,
              conditions: perm.conditions ? JSON.parse(JSON.stringify(perm.conditions)) : null,
            },
          });
        }
      }

      // Automatically assign the first tenant user to the 'owner' role
      const firstUser = await this.db.client.user.findFirst({
        where: { tenant_id: id },
        orderBy: { created_at: 'asc' },
      });

      if (firstUser) {
        const ownerRole = await this.db.client.role.findFirst({
          where: { tenant_id: id, slug: 'owner' },
        });
        if (ownerRole && defaultVertical) {
          const existingUserRole = await this.db.client.userRole.findFirst({
            where: {
              user_id: firstUser.id,
              role_id: ownerRole.id,
              assignment_id: defaultVertical.id,
            },
          });
          if (!existingUserRole) {
            await this.db.client.userRole.create({
              data: {
                user_id: firstUser.id,
                role_id: ownerRole.id,
                tenant_id: id,
                assignment_id: defaultVertical.id,
              },
            });
          }
        }
      }

      return ok(undefined);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Template application failed',
      });
    }
  }

  async updateOverrides(
    id: string,
    overrides: Record<string, any>,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<TenantDetail, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    try {
      const config = { ...((tenant.config_json ?? {}) as Record<string, any>) };
      config.custom_limits = {
        ...(config.custom_limits ?? {}),
        ...overrides,
      };

      await this.db.client.tenant.update({
        where: { id },
        data: {
          config_json: config,
        },
      });

      if (auditMeta) {
        await this.audit.writeLog({
          actor_id: auditMeta.actor_id,
          actor_role: auditMeta.actor_role,
          action: 'tenant:update_overrides',
          target_id: id,
          actor_ip: auditMeta.actor_ip,
          user_agent: auditMeta.user_agent,
          details: { tenant_id: id, overrides },
          reason: auditMeta.reason,
        });
      }

      return this.findOne(id);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to update overrides',
      });
    }
  }

  async getCapabilities(id: string): Promise<Result<any[], PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    const dbCaps = await this.db.client.tenantCapability.findMany({
      where: { tenant_id: id },
    });

    const dbEnabledMap = new Map<string, boolean>();
    for (const c of dbCaps) {
      dbEnabledMap.set(c.capability_id, c.enabled);
    }

    const config = (tenant.config_json ?? {}) as Record<string, any>;
    const configEnabled = Array.isArray(config.enabled_capabilities) ? config.enabled_capabilities : [];

    const caps = AVAILABLE_CAPABILITIES.map((cap) => {
      let enabled = false;
      if (dbEnabledMap.has(cap.id)) {
        enabled = dbEnabledMap.get(cap.id)!;
      } else {
        enabled = configEnabled.includes(cap.id);
      }
      return {
        ...cap,
        enabled,
      };
    });

    return ok(caps);
  }

  async enableCapability(
    tenantId: string,
    capabilityId: string,
    userId: string,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<{ id: string; enabled: boolean }, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    const exists = AVAILABLE_CAPABILITIES.some(c => c.id === capabilityId);
    if (!exists) {
      return err({ code: 'INDUSTRY_NOT_FOUND', message: `Capability ${capabilityId} not found` });
    }

    await this.db.client.tenantCapability.upsert({
      where: {
        tenant_id_capability_id: {
          tenant_id: tenantId,
          capability_id: capabilityId,
        },
      },
      update: {
        enabled: true,
        enabled_by: userId,
        enabled_at: new Date(),
      },
      create: {
        tenant_id: tenantId,
        capability_id: capabilityId,
        enabled: true,
        enabled_by: userId,
      },
    });

    const config = { ...((tenant.config_json ?? {}) as Record<string, any>) };
    const enabledSet = new Set<string>(
      Array.isArray(config.enabled_capabilities) ? config.enabled_capabilities : []
    );
    enabledSet.add(capabilityId);
    config.enabled_capabilities = Array.from(enabledSet);

    await this.db.client.tenant.update({
      where: { id: tenantId },
      data: { config_json: config },
    });

    if (auditMeta) {
      await this.audit.writeLog({
        actor_id: auditMeta.actor_id,
        actor_role: auditMeta.actor_role,
        action: 'tenant:enable_capability',
        target_id: tenantId,
        actor_ip: auditMeta.actor_ip,
        user_agent: auditMeta.user_agent,
        details: { tenant_id: tenantId, capability_id: capabilityId },
        reason: auditMeta.reason,
      });
    }

    return ok({ id: capabilityId, enabled: true });
  }

  async disableCapability(
    tenantId: string,
    capabilityId: string,
    userId: string,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<{ id: string; enabled: boolean }, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    const exists = AVAILABLE_CAPABILITIES.some(c => c.id === capabilityId);
    if (!exists) {
      return err({ code: 'INDUSTRY_NOT_FOUND', message: `Capability ${capabilityId} not found` });
    }

    await this.db.client.tenantCapability.upsert({
      where: {
        tenant_id_capability_id: {
          tenant_id: tenantId,
          capability_id: capabilityId,
        },
      },
      update: {
        enabled: false,
        enabled_by: userId,
        enabled_at: new Date(),
      },
      create: {
        tenant_id: tenantId,
        capability_id: capabilityId,
        enabled: false,
        enabled_by: userId,
      },
    });

    const config = { ...((tenant.config_json ?? {}) as Record<string, any>) };
    const enabledSet = new Set<string>(
      Array.isArray(config.enabled_capabilities) ? config.enabled_capabilities : []
    );
    enabledSet.delete(capabilityId);
    config.enabled_capabilities = Array.from(enabledSet);

    await this.db.client.tenant.update({
      where: { id: tenantId },
      data: { config_json: config },
    });

    if (auditMeta) {
      await this.audit.writeLog({
        actor_id: auditMeta.actor_id,
        actor_role: auditMeta.actor_role,
        action: 'tenant:disable_capability',
        target_id: tenantId,
        actor_ip: auditMeta.actor_ip,
        user_agent: auditMeta.user_agent,
        details: { tenant_id: tenantId, capability_id: capabilityId },
        reason: auditMeta.reason,
      });
    }

    return ok({ id: capabilityId, enabled: false });
  }

  async getPlugins(id: string): Promise<Result<any[], PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    const allRegistryPlugins = await this.db.client.pluginRegistry.findMany({
      where: { status: 'active' },
    });

    const tenantPlugins = await this.db.client.tenantPlugin.findMany({
      where: { tenant_id: id },
    });

    const installedMap = new Map<string, boolean>();
    for (const tp of tenantPlugins) {
      installedMap.set(tp.plugin_registry_id, tp.enabled);
    }

    const plugins = allRegistryPlugins.map((p: any) => ({
      id: p.id,
      package_name: p.package_name,
      version: p.version,
      manifest: p.manifest,
      status: p.status,
      created_at: p.created_at,
      installed: installedMap.get(p.id) ?? false,
    }));

    return ok(plugins);
  }

  async installPlugin(
    tenantId: string,
    pluginId: string,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<{ id: string; installed: boolean }, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tenantPlans: {
          include: { plan: true },
        },
      },
    });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    const config = (tenant.config_json ?? {}) as Record<string, any>;
    const customMaxPlugins = config.custom_limits?.max_plugins;

    const plan = tenant.tenantPlans?.[0]?.plan;
    const maxPlugins = typeof customMaxPlugins === 'number'
      ? customMaxPlugins
      : (plan ? plan.max_plugins : 5);

    const installedCount = await this.db.client.tenantPlugin.count({
      where: { tenant_id: tenantId, enabled: true },
    });

    const existing = await this.db.client.tenantPlugin.findFirst({
      where: { tenant_id: tenantId, plugin_registry_id: pluginId },
    });

    if (existing?.enabled) {
      return ok({ id: pluginId, installed: true });
    }

    if (installedCount >= maxPlugins) {
      return err({
        code: 'PLAN_LIMIT_EXCEEDED',
        message: `Plan plugin limit of ${maxPlugins} exceeded (currently using ${installedCount})`,
      });
    }

    if (existing) {
      await this.db.client.tenantPlugin.update({
        where: { id: existing.id },
        data: { enabled: true, installed_at: new Date() },
      });
    } else {
      await this.db.client.tenantPlugin.create({
        data: {
          tenant_id: tenantId,
          plugin_registry_id: pluginId,
          enabled: true,
        },
      });
    }

    if (auditMeta) {
      await this.audit.writeLog({
        actor_id: auditMeta.actor_id,
        actor_role: auditMeta.actor_role,
        action: 'tenant:install_plugin',
        target_id: tenantId,
        actor_ip: auditMeta.actor_ip,
        user_agent: auditMeta.user_agent,
        details: { tenant_id: tenantId, plugin_id: pluginId },
        reason: auditMeta.reason,
      });
    }

    return ok({ id: pluginId, installed: true });
  }

  async uninstallPlugin(
    tenantId: string,
    pluginId: string,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<{ id: string; installed: boolean }, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    const existing = await this.db.client.tenantPlugin.findFirst({
      where: { tenant_id: tenantId, plugin_registry_id: pluginId },
    });

    if (existing) {
      await this.db.client.tenantPlugin.update({
        where: { id: existing.id },
        data: { enabled: false },
      });
    } else {
      await this.db.client.tenantPlugin.create({
        data: {
          tenant_id: tenantId,
          plugin_registry_id: pluginId,
          enabled: false,
        },
      });
    }

    if (auditMeta) {
      await this.audit.writeLog({
        actor_id: auditMeta.actor_id,
        actor_role: auditMeta.actor_role,
        action: 'tenant:uninstall_plugin',
        target_id: tenantId,
        actor_ip: auditMeta.actor_ip,
        user_agent: auditMeta.user_agent,
        details: { tenant_id: tenantId, plugin_id: pluginId },
        reason: auditMeta.reason,
      });
    }

    return ok({ id: pluginId, installed: false });
  }

  async getHierarchy(tenantId: string): Promise<Result<{ branches: any[] }, PlatformTenantError>> {
    try {
      const tenant = await this.db.client.tenant.findUnique({
        where: { id: tenantId },
      });
      if (!tenant) {
        return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
      }

      const branches = await this.db.client.branch.findMany({
        where: { tenant_id: tenantId },
        orderBy: { name: 'asc' },
      });

      const branchesWithHierarchy = await Promise.all(
        branches.map(async (b: any) => {
          const verticals = await this.db.client.vertical.findMany({
            where: { tenant_id: tenantId, branch_id: b.id },
            orderBy: { name: 'asc' },
          });

          const verticalsWithStats = verticals.map((v: any) => ({
            id: v.id,
            name: v.name,
            stats: {
              total_leads: 0,
              conversion_rate: 0,
            },
          }));

          return {
            id: b.id,
            name: b.name,
            city: b.city,
            verticals: verticalsWithStats,
          };
        }),
      );

      return ok({ branches: branchesWithHierarchy });
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Failed to retrieve tenant hierarchy',
      });
    }
  }
}
