import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type DeptErrorCode = 'NOT_FOUND' | 'QUERY_FAILED';
export interface DeptError { code: DeptErrorCode; message?: string }

@Injectable()
export class DepartmentsService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly cls: ClsService) {}

  private getTenantId(): string | null { return this.cls.get<RequestScope>('scope')?.tenant_id ?? null; }

  async create(data: { name: string; description?: string }): Promise<Result<any, DeptError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      return ok(await this.db.getClient().department.create({ data: { tenant_id: tid, ...data } as any }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async findAll(params: { status?: string; cursor?: string; limit?: number }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, DeptError>> {
    try {
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {};
      if (params.status) where.status = params.status;
      const items = await this.db.getClient().department.findMany({ where, take: limit + 1, ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}), orderBy: { created_at: 'desc' }, include: { _count: { select: { employees: true } } } });
      const hasMore = items.length > limit;
      return ok({ data: hasMore ? items.slice(0, limit) : items, next_cursor: hasMore ? items[items.length - 1]?.id : undefined });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async findOne(id: string): Promise<Result<any, DeptError>> {
    try {
      const d = await this.db.getClient().department.findUnique({ where: { id } });
      if (!d) return err({ code: 'NOT_FOUND' });
      return ok(d);
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async update(id: string, data: Partial<{ name: string; description: string; status: string }>): Promise<Result<any, DeptError>> {
    try { return ok(await this.db.getClient().department.update({ where: { id }, data: data as any })); }
    catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async remove(id: string): Promise<Result<void, DeptError>> {
    try { await this.db.getClient().department.delete({ where: { id } }); return ok(undefined); }
    catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
