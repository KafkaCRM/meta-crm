import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type EmpErrorCode = 'NOT_FOUND' | 'DUPLICATE_CODE' | 'QUERY_FAILED';
export interface EmpError { code: EmpErrorCode; message?: string }

@Injectable()
export class EmployeesService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly cls: ClsService) {}

  private getTenantId(): string | null { return this.cls.get<RequestScope>('scope')?.tenant_id ?? null; }

  async create(data: { employee_code: string; user_id?: string; department_id?: string; designation?: string; joining_date?: string; salary?: number }): Promise<Result<any, EmpError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const existing = await this.db.getClient().employee.findFirst({ where: { employee_code: data.employee_code } });
      if (existing) return err({ code: 'DUPLICATE_CODE', message: `Employee code '${data.employee_code}' already exists` });
      return ok(await this.db.getClient().employee.create({
        data: { tenant_id: tid, ...data, joining_date: data.joining_date ? new Date(data.joining_date) : undefined } as any,
        include: { department: { select: { id: true, name: true } }, user: { select: { id: true, name: true, email: true } } },
      }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async findAll(params: { department_id?: string; status?: string; search?: string; cursor?: string; limit?: number }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, EmpError>> {
    try {
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {};
      if (params.department_id) where.department_id = params.department_id;
      if (params.status) where.status = params.status;
      if (params.search) where.OR = [{ employee_code: { contains: params.search, mode: 'insensitive' } }, { user: { name: { contains: params.search, mode: 'insensitive' } } }] as any;
      const items = await this.db.getClient().employee.findMany({ where, take: limit + 1, ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}), orderBy: { created_at: 'desc' }, include: { department: { select: { id: true, name: true } }, user: { select: { id: true, name: true, email: true } } } });
      const hasMore = items.length > limit;
      return ok({ data: hasMore ? items.slice(0, limit) : items, next_cursor: hasMore ? items[items.length - 1]?.id : undefined });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async findOne(id: string): Promise<Result<any, EmpError>> {
    try {
      const e = await this.db.getClient().employee.findUnique({ where: { id }, include: { department: { select: { id: true, name: true } }, user: { select: { id: true, name: true, email: true, phone_number: true } } } });
      if (!e) return err({ code: 'NOT_FOUND' });
      return ok(e);
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async update(id: string, data: Partial<{ employee_code: string; department_id: string; designation: string; joining_date: string; salary: number; status: string }>): Promise<Result<any, EmpError>> {
    try {
      if (data.employee_code) {
        const dup = await this.db.getClient().employee.findFirst({ where: { employee_code: data.employee_code, id: { not: id } } });
        if (dup) return err({ code: 'DUPLICATE_CODE', message: `Employee code '${data.employee_code}' already in use` });
      }
      return ok(await this.db.getClient().employee.update({ where: { id }, data: { ...data, joining_date: data.joining_date ? new Date(data.joining_date) : undefined } as any }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async remove(id: string): Promise<Result<void, EmpError>> {
    try { await this.db.getClient().employee.delete({ where: { id } }); return ok(undefined); }
    catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
