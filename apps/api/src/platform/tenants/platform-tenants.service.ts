import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { PlatformPrismaService } from '../../core/tenant/platform-prisma.service';

const BCRYPT_COST = 12;

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
  case_count: number;
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
}

@Injectable()
export class PlatformTenantsService {
  constructor(private readonly db: PlatformPrismaService) {}

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
        const [branchCount, userCount, caseCount] = await Promise.all([
          this.db.client.branch.count({ where: { tenant_id: t.id } }),
          this.db.client.user.count({ where: { tenant_id: t.id } }),
          this.db.client.case.count({ where: { tenant_id: t.id } }),
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
          case_count: caseCount,
        };
      }),
    );

    return ok({
      data,
      next_cursor: hasMore ? data[data.length - 1]?.id : undefined,
    });
  }

  async findOne(id: string): Promise<Result<TenantDetail, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
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
    });
  }

  async updateEntitlements(
    id: string,
    pluginIds: string[],
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

      return this.findOne(id);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Transaction failed to update entitlements',
      });
    }
  }

  async create(input: CreateTenantInput): Promise<Result<CreateTenantResponse, PlatformTenantError>> {
    const existing = await this.db.client.tenant.findUnique({ where: { slug: input.slug } });
    if (existing) {
      return err({ code: 'SLUG_TAKEN', message: `Slug "${input.slug}" is already taken` });
    }

    const plan = await this.db.client.subscriptionPlan.findUnique({ where: { id: input.plan_id } });
    if (!plan) {
      return err({ code: 'PLAN_NOT_FOUND', message: 'Subscription plan not found' });
    }

    const temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_COST);

    try {
      const tenant = await this.db.client.$transaction(async (tx: any) => {
        const t = await tx.tenant.create({
          data: {
            name: input.name,
            slug: input.slug,
            industry: input.industry,
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

        await tx.tenantPlan.create({
          data: {
            tenant_id: t.id,
            plan_id: input.plan_id,
          },
        });

        return t;
      });

      return ok({
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
      });
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Transaction failed',
      });
    }
  }

  async suspend(id: string): Promise<Result<void, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    await this.db.client.tenant.update({
      where: { id },
      data: { status: 'suspended' },
    });

    return ok(undefined);
  }

  async reactivate(id: string): Promise<Result<void, PlatformTenantError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    await this.db.client.tenant.update({
      where: { id },
      data: { status: 'active' },
    });

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

      const wfDef = template.workflow_definition;
      if (wfDef) {
        let wfId: string;
        const existingWf = await this.db.client.workflowDefinition.findFirst({
          where: { tenant_id: id, name: wfDef.name },
        });

        if (existingWf) {
          wfId = existingWf.id;
        } else {
          const created = await this.db.client.workflowDefinition.create({
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
          const existingStage = await this.db.client.workflowStage.findFirst({
            where: { workflow_definition_id: wfId, name: stageDef.name },
          });

          if (existingStage) {
            stageNameToId.set(stageDef.name, existingStage.id);
            continue;
          }

          const created = await this.db.client.workflowStage.create({
            data: {
              workflow_definition_id: wfId,
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

          const existingTrans = await this.db.client.workflowTransition.findFirst({
            where: { from_stage_id: fromId, to_stage_id: toId },
          });
          if (existingTrans) continue;

          await this.db.client.workflowTransition.create({
            data: {
              workflow_definition_id: wfId,
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

      return ok(undefined);
    } catch (e: any) {
      return err({
        code: 'TRANSACTION_FAILED',
        message: e?.message ?? 'Template application failed',
      });
    }
  }
}
