import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type PayslipDashErrorCode = 'NOT_FOUND' | 'QUERY_FAILED' | 'DUPLICATE';
export interface PayslipDashError { code: PayslipDashErrorCode; message?: string }

@Injectable()
export class PayslipsService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly cls: ClsService) {}

  private getTenantId(): string | null { return this.cls.get<RequestScope>('scope')?.tenant_id ?? null; }

  async create(data: {
    employee_id: string; month: number; year: number;
    basic?: number; hra?: number; allowances?: number; deductions?: number; net_pay: number;
  }): Promise<Result<any, PayslipDashError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const existing = await this.db.getClient().payslip.findUnique({ where: { employee_id_month_year: { employee_id: data.employee_id, month: data.month, year: data.year } } });
      if (existing) return err({ code: 'DUPLICATE', message: 'Payslip already exists for this period' });
      return ok(await this.db.getClient().payslip.create({
        data: { tenant_id: tid, ...data } as any,
        include: { employee: { include: { user: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } } } },
      }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async findAll(params: { employee_id?: string; month?: number; year?: number; status?: string; cursor?: string; limit?: number }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, PayslipDashError>> {
    try {
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {};
      if (params.employee_id) where.employee_id = params.employee_id;
      if (params.month != null) where.month = params.month;
      if (params.year != null) where.year = params.year;
      if (params.status) where.status = params.status;
      const items = await this.db.getClient().payslip.findMany({ where, take: limit + 1, ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}), orderBy: [{ year: 'desc' }, { month: 'desc' }], include: { employee: { include: { user: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } } } } });
      const hasMore = items.length > limit;
      return ok({ data: hasMore ? items.slice(0, limit) : items, next_cursor: hasMore ? items[items.length - 1]?.id : undefined });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async findOne(id: string): Promise<Result<any, PayslipDashError>> {
    try { const d = await this.db.getClient().payslip.findUnique({ where: { id }, include: { employee: { include: { user: { select: { id: true, name: true, email: true } }, department: { select: { id: true, name: true } } } } } }); if (!d) return err({ code: 'NOT_FOUND' }); return ok(d); }
    catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async updateStatus(id: string, status: string): Promise<Result<any, PayslipDashError>> {
    try {
      const data: any = { status };
      if (status === 'generated') data.generated_at = new Date();
      if (status === 'paid') data.paid_at = new Date();
      return ok(await this.db.getClient().payslip.update({ where: { id }, data }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
