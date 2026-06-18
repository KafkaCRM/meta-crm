import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantScopedPrismaService } from '../tenant/tenant-scoped-prisma.service';
import { PlatformPrismaService } from '../tenant/platform-prisma.service';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';

export interface CreateBranchInput {
  name: string;
  address?: string;
  city?: string;
}

export interface UpdateBranchInput {
  name?: string;
  address?: string;
  city?: string;
}

@Injectable()
export class BranchService {
  constructor(
    private readonly tenantDb: TenantScopedPrismaService,
    private readonly platformDb: PlatformPrismaService,
  ) {}

  async getMaxBranchLimit(tenantId: string): Promise<number> {
    const tenant = await this.platformDb.client.tenant.findUnique({
      where: { id: tenantId },
      include: { tenantPlans: { include: { plan: true } } },
    });

    if (!tenant) return 1;

    const config = (tenant.config_json ?? {}) as Record<string, any>;
    const customMaxBranches = config.custom_limits?.max_branches;

    if (typeof customMaxBranches === 'number') {
      return customMaxBranches;
    }

    const activePlan = tenant.tenantPlans?.[0]?.plan;
    return activePlan?.max_branches ?? 1;
  }

  async list(tenantId: string) {
    return this.tenantDb.getClient().branch.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
    });
  }

  async create(tenantId: string, input: CreateBranchInput) {
    const maxBranches = await this.getMaxBranchLimit(tenantId);
    const currentCount = await this.tenantDb.getClient().branch.count({
      where: { tenant_id: tenantId },
    });

    if (currentCount >= maxBranches) {
      throw new ForbiddenException(
        `Branch limit reached. You are using ${currentCount} of ${maxBranches} branches. Contact admin to upgrade.`,
      );
    }

    return this.tenantDb.getClient().branch.create({
      data: {
        tenant_id: tenantId,
        name: input.name,
        address: input.address,
        city: input.city,
      },
    });
  }

  async update(tenantId: string, id: string, input: UpdateBranchInput) {
    const branch = await this.tenantDb.getClient().branch.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return this.tenantDb.getClient().branch.update({
      where: { id },
      data: {
        name: input.name,
        address: input.address,
        city: input.city,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const branch = await this.tenantDb.getClient().branch.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    await this.tenantDb.getClient().branch.delete({
      where: { id },
    });

    return { message: 'Branch removed successfully' };
  }
}
