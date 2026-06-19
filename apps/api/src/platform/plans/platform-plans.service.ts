import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { PlatformPrismaService } from '../../core/tenant/platform-prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';

export type PlatformPlanErrorCode =
  | 'PLAN_NOT_FOUND'
  | 'TENANT_NOT_FOUND'
  | 'TRANSACTION_FAILED';

export interface PlatformPlanError {
  code: PlatformPlanErrorCode;
  message: string;
}

export interface CreatePlanInput {
  name: string;
  max_branches: number;
  max_users: number;
  max_plugins: number;
  price_monthly?: number;
  capabilities?: string[];
}

export interface UpdatePlanInput {
  max_branches?: number;
  max_users?: number;
  max_plugins?: number;
  price_monthly?: number;
  capabilities?: string[];
}

@Injectable()
export class PlatformPlansService {
  constructor(
    private readonly db: PlatformPrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

  async list(): Promise<Result<any[], PlatformPlanError>> {
    const plans = await this.db.client.subscriptionPlan.findMany({
      orderBy: { created_at: 'desc' },
    });
    return ok(plans);
  }

  async create(
    input: CreatePlanInput,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<any, PlatformPlanError>> {
    try {
      const plan = await this.db.client.subscriptionPlan.create({
        data: {
          name: input.name,
          max_branches: input.max_branches,
          max_users: input.max_users,
          max_plugins: input.max_plugins,
          price_monthly: input.price_monthly ?? null,
          capabilities: input.capabilities ?? [],
        },
      });

      if (auditMeta) {
        await this.audit.writeLog({
          actor_id: auditMeta.actor_id,
          actor_role: auditMeta.actor_role,
          action: 'plan:create',
          target_id: plan.id,
          actor_ip: auditMeta.actor_ip,
          user_agent: auditMeta.user_agent,
          details: { plan_id: plan.id, name: plan.name, max_branches: plan.max_branches, max_users: plan.max_users },
          reason: auditMeta.reason,
        });
      }

      return ok(plan);
    } catch (e: any) {
      return err({ code: 'TRANSACTION_FAILED', message: e?.message ?? 'Failed to create plan' });
    }
  }

  async update(
    id: string,
    input: UpdatePlanInput,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<any, PlatformPlanError>> {
    const existing = await this.db.client.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) {
      return err({ code: 'PLAN_NOT_FOUND', message: 'Plan not found' });
    }

    const updated = await this.db.client.subscriptionPlan.update({
      where: { id },
      data: {
        ...(input.max_branches !== undefined ? { max_branches: input.max_branches } : {}),
        ...(input.max_users !== undefined ? { max_users: input.max_users } : {}),
        ...(input.max_plugins !== undefined ? { max_plugins: input.max_plugins } : {}),
        ...(input.price_monthly !== undefined ? { price_monthly: input.price_monthly } : {}),
        ...(input.capabilities !== undefined ? { capabilities: input.capabilities } : {}),
      },
    });

    if (auditMeta) {
      await this.audit.writeLog({
        actor_id: auditMeta.actor_id,
        actor_role: auditMeta.actor_role,
        action: 'plan:update',
        target_id: id,
        actor_ip: auditMeta.actor_ip,
        user_agent: auditMeta.user_agent,
        details: { plan_id: id, input },
        reason: auditMeta.reason,
      });
    }

    return ok(updated);
  }

  async assignPlan(
    tenantId: string,
    planId: string,
    auditMeta?: { actor_id: string; actor_role: string; actor_ip: string; user_agent: string; reason?: string },
  ): Promise<Result<void, PlatformPlanError>> {
    const tenant = await this.db.client.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return err({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }

    const plan = await this.db.client.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return err({ code: 'PLAN_NOT_FOUND', message: 'Plan not found' });
    }

    const existing = await this.db.client.tenantPlan.findUnique({
      where: { tenant_id: tenantId },
    });

    if (existing) {
      await this.db.client.tenantPlan.update({
        where: { tenant_id: tenantId },
        data: { plan_id: planId },
      });
    } else {
      await this.db.client.tenantPlan.create({
        data: { tenant_id: tenantId, plan_id: planId },
      });
    }

    if (auditMeta) {
      await this.audit.writeLog({
        actor_id: auditMeta.actor_id,
        actor_role: auditMeta.actor_role,
        action: 'tenant:assign_plan',
        target_id: tenantId,
        actor_ip: auditMeta.actor_ip,
        user_agent: auditMeta.user_agent,
        details: { tenant_id: tenantId, plan_id: planId },
        reason: auditMeta.reason,
      });
    }

    return ok(undefined);
  }
}
