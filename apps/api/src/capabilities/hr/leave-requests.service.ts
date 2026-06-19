import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type LRAnsErrorCode = 'NOT_FOUND' | 'QUERY_FAILED' | 'OVERLAP';
export interface LRAnsError { code: LRAnsErrorCode; message?: string }

@Injectable()
export class LeaveRequestsService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly cls: ClsService) {}

  private getTenantId(): string | null { return this.cls.get<RequestScope>('scope')?.tenant_id ?? null; }

  async create(data: { employee_id: string; leave_type_id: string; from_date: string; to_date: string; reason?: string }): Promise<Result<any, LRAnsError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const fd = new Date(data.from_date); const td = new Date(data.to_date);
      if (fd > td) return err({ code: 'OVERLAP', message: 'from_date must be before to_date' });
      const overlap = await this.db.getClient().leaveRequest.findFirst({
        where: { employee_id: data.employee_id, status: { in: ['pending', 'approved'] }, from_date: { lte: td }, to_date: { gte: fd } },
      });
      if (overlap) return err({ code: 'OVERLAP', message: 'Overlapping leave request exists' });
      return ok(await this.db.getClient().leaveRequest.create({
        data: { tenant_id: tid, ...data, from_date: fd, to_date: td } as any,
        include: { leaveType: { select: { id: true, name: true } }, employee: { include: { user: { select: { id: true, name: true } } } } },
      }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async findAll(params: { employee_id?: string; status?: string; from_date?: string; to_date?: string; cursor?: string; limit?: number }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, LRAnsError>> {
    try {
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {};
      if (params.employee_id) where.employee_id = params.employee_id;
      if (params.status) where.status = params.status;
      if (params.from_date || params.to_date) {
        const dateFilter: Record<string, unknown> = {};
        if (params.from_date) dateFilter.gte = new Date(params.from_date);
        if (params.to_date) dateFilter.lte = new Date(params.to_date);
        where.from_date = dateFilter;
      }
      const items = await this.db.getClient().leaveRequest.findMany({ where, take: limit + 1, ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}), orderBy: { created_at: 'desc' }, include: { leaveType: { select: { id: true, name: true } }, employee: { include: { user: { select: { id: true, name: true } } } } } });
      const hasMore = items.length > limit;
      return ok({ data: hasMore ? items.slice(0, limit) : items, next_cursor: hasMore ? items[items.length - 1]?.id : undefined });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async findOne(id: string): Promise<Result<any, LRAnsError>> {
    try { const d = await this.db.getClient().leaveRequest.findUnique({ where: { id }, include: { leaveType: { select: { id: true, name: true } }, employee: { include: { user: { select: { id: true, name: true } } } } } }); if (!d) return err({ code: 'NOT_FOUND' }); return ok(d); }
    catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async approve(id: string, approvedBy: string): Promise<Result<any, LRAnsError>> {
    try { return ok(await this.db.getClient().leaveRequest.update({ where: { id }, data: { status: 'approved', approved_by: approvedBy } })); }
    catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async reject(id: string): Promise<Result<any, LRAnsError>> {
    try { return ok(await this.db.getClient().leaveRequest.update({ where: { id }, data: { status: 'rejected' } })); }
    catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async remove(id: string): Promise<Result<void, LRAnsError>> {
    try { await this.db.getClient().leaveRequest.delete({ where: { id } }); return ok(undefined); }
    catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
