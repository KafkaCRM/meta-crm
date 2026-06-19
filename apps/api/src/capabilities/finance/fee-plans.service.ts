import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type FeePlansErrorCode = 'NOT_FOUND' | 'DUPLICATE' | 'QUERY_FAILED';
export interface FeePlansError { code: FeePlansErrorCode; message?: string }

@Injectable()
export class FeePlansService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    const scope = this.cls.get<RequestScope>('scope');
    return scope?.tenant_id ?? null;
  }

  async create(data: {
    name: string; course_id: string; total_fee: number;
    description?: string; installments?: { name: string; amount: number; due_days: number; late_fee?: number }[];
  }): Promise<Result<any, FeePlansError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });

      const plan = await this.db.getClient().feePlan.create({
        data: {
          tenant_id: tenantId,
          name: data.name,
          course_id: data.course_id,
          total_fee: data.total_fee,
          description: data.description,
          installments: data.installments ? {
            create: data.installments.map((inst) => ({
              tenant_id: tenantId,
              name: inst.name,
              amount: inst.amount,
              due_days: inst.due_days,
              late_fee: inst.late_fee ?? 0,
            })),
          } : undefined,
        } as any,
        include: { installments: true, course: { select: { id: true, name: true, code: true } } },
      });
      return ok(plan);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findAll(params: { course_id?: string; status?: string; search?: string; cursor?: string; limit?: number }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, FeePlansError>> {
    try {
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {};
      if (params.course_id) where.course_id = params.course_id;
      if (params.status) where.status = params.status;
      if (params.search) where.name = { contains: params.search, mode: 'insensitive' } as any;

      const plans = await this.db.getClient().feePlan.findMany({
        where,
        take: limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        orderBy: { created_at: 'desc' },
        include: { installments: true, course: { select: { id: true, name: true, code: true } } },
      });

      const hasMore = plans.length > limit;
      const data = hasMore ? plans.slice(0, limit) : plans;
      return ok({ data, next_cursor: hasMore ? data[data.length - 1]?.id : undefined });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findOne(id: string): Promise<Result<any, FeePlansError>> {
    try {
      const plan = await this.db.getClient().feePlan.findUnique({
        where: { id },
        include: {
          installments: { orderBy: { due_days: 'asc' } },
          course: { select: { id: true, name: true, code: true } },
        },
      });
      if (!plan) return err({ code: 'NOT_FOUND', message: 'Fee plan not found' });
      return ok(plan);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async update(id: string, data: Partial<{ name: string; description: string; total_fee: number; status: string }>): Promise<Result<any, FeePlansError>> {
    try {
      const plan = await this.db.getClient().feePlan.update({ where: { id }, data: data as any });
      return ok(plan);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async remove(id: string): Promise<Result<void, FeePlansError>> {
    try {
      await this.db.getClient().feePlan.delete({ where: { id } });
      return ok(undefined);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
