import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type AttnDashErrorCode = 'NOT_FOUND' | 'QUERY_FAILED' | 'DUPLICATE';
export interface AttnDashError { code: AttnDashErrorCode; message?: string }

@Injectable()
export class EmployeeAttendanceService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly cls: ClsService) {}

  private getTenantId(): string | null { return this.cls.get<RequestScope>('scope')?.tenant_id ?? null; }

  async mark(data: { employee_id: string; date: string; check_in?: string; check_out?: string; status?: string; notes?: string }): Promise<Result<any, AttnDashError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const dateObj = new Date(data.date);
      const existing = await this.db.getClient().employeeAttendance.findUnique({ where: { employee_id_date: { employee_id: data.employee_id, date: dateObj } } });
      if (existing) return err({ code: 'DUPLICATE', message: 'Attendance already marked for this date' });
      return ok(await this.db.getClient().employeeAttendance.create({
        data: { tenant_id: tid, employee_id: data.employee_id, date: dateObj, check_in: data.check_in ? new Date(data.check_in) : undefined, check_out: data.check_out ? new Date(data.check_out) : undefined, status: data.status ?? 'present', notes: data.notes } as any,
      }));
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async bulkMark(data: { records: { employee_id: string; status: string; check_in?: string; check_out?: string; notes?: string }[]; date: string }): Promise<Result<any, AttnDashError>> {
    try {
      const tid = this.getTenantId(); if (!tid) return err({ code: 'QUERY_FAILED', message: 'No tenant' });
      const dateObj = new Date(data.date);
      const created = await this.db.getClient().employeeAttendance.createMany({
        data: data.records.map((r) => ({ tenant_id: tid, employee_id: r.employee_id, date: dateObj, status: r.status, check_in: r.check_in ? new Date(r.check_in) : undefined, check_out: r.check_out ? new Date(r.check_out) : undefined, notes: r.notes })),
        skipDuplicates: true,
      });
      return ok(created);
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async findByDate(params: { date: string; department_id?: string }): Promise<Result<any[], AttnDashError>> {
    try {
      const dateObj = new Date(params.date);
      const where: Record<string, unknown> = { date: dateObj };
      if (params.department_id) where.employee = { department_id: params.department_id };
      const items = await this.db.getClient().employeeAttendance.findMany({ where, include: { employee: { include: { user: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } } } }, orderBy: { employee: { user: { name: 'asc' } } } });
      return ok(items);
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }

  async report(params: { employee_id: string; from_date?: string; to_date?: string }): Promise<Result<any, AttnDashError>> {
    try {
      const where: Record<string, unknown> = { employee_id: params.employee_id };
      if (params.from_date || params.to_date) {
        const dateFilter: Record<string, unknown> = {};
        if (params.from_date) dateFilter.gte = new Date(params.from_date);
        if (params.to_date) dateFilter.lte = new Date(params.to_date);
        where.date = dateFilter;
      }
      const records = await this.db.getClient().employeeAttendance.findMany({ where, orderBy: { date: 'asc' } });
      const total = records.length;
      const present = records.filter((r: any) => r.status === 'present').length;
      const absent = records.filter((r: any) => r.status === 'absent').length;
      const late = records.filter((r: any) => r.status === 'late').length;
      return ok({ records, summary: { total, present, absent, late, percentage: total ? Math.round((present / total) * 100) : 0 } });
    } catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
