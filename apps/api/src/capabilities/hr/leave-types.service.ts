import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type LTDashErrorCode = 'NOT_FOUND' | 'QUERY_FAILED';
export interface LTDashError { code: LTDashErrorCode; message?: string }

@Injectable()
export class LeaveTypesService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly cls: ClsService) {}

  private getTenantId(): string | null { return this.cls.get<RequestScope>('scope')?.tenant_id ?? null; }

  async create(data: { name: string; days_per_year: number; carry_forward?: boolean }): Promise<Result<any, LTDashError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      return ok(await this.db.getClient().leaveType.create({ data: { tenant_id: tid, ...data, carry_forward: data.carry_forward ?? false } as any }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async findAll(params: { status?: string; cursor?: string; limit?: number }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, LTDashError>> {
    try {
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {}; if (params.status) where.status = params.status;
      const items = await this.db.getClient().leaveType.findMany({ where, take: limit + 1, ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}), orderBy: { created_at: 'desc' } });
      const hasMore = items.length > limit;
      return ok({ data: hasMore ? items.slice(0, limit) : items, next_cursor: hasMore ? items[items.length - 1]?.id : undefined });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async findOne(id: string): Promise<Result<any, LTDashError>> {
    try { const d = await this.db.getClient().leaveType.findUnique({ where: { id } }); if (!d) return err({ code: 'NOT_FOUND' }); return ok(d); }
    catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async update(id: string, data: Partial<{ name: string; days_per_year: number; carry_forward: boolean; status: string }>): Promise<Result<any, LTDashError>> {
    try { return ok(await this.db.getClient().leaveType.update({ where: { id }, data: data as any })); }
    catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async remove(id: string): Promise<Result<void, LTDashError>> {
    try { await this.db.getClient().leaveType.delete({ where: { id } }); return ok(undefined); }
    catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
