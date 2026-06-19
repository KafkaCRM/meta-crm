import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type AttendanceErrorCode = 'NOT_FOUND' | 'DUPLICATE' | 'QUERY_FAILED';
export interface AttendanceError { code: AttendanceErrorCode; message?: string }

@Injectable()
export class AttendanceService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    const scope = this.cls.get<RequestScope>('scope');
    return scope?.tenant_id ?? null;
  }

  async mark(data: {
    batch_id: string; enrollment_id: string; date: string;
    status: string; marked_by_id?: string; remarks?: string;
  }): Promise<Result<any, AttendanceError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });

      if (scope?.vertical_ids?.length) {
        const batch = await this.db.getClient().batch.findUnique({
          where: { id: data.batch_id },
          include: { course: { select: { vertical_id: true } } },
        });
        if (!batch || !batch.course.vertical_id || !scope.vertical_ids.includes(batch.course.vertical_id)) {
          return err({ code: 'NOT_FOUND', message: 'Batch not found' });
        }
      }

      const existing = await this.db.getClient().attendance.findUnique({
        where: {
          batch_id_enrollment_id_date: {
            batch_id: data.batch_id,
            enrollment_id: data.enrollment_id,
            date: new Date(data.date),
          },
        },
      });
      if (existing) return err({ code: 'DUPLICATE', message: 'Attendance already marked for this student on this date' });

      const attendance = await this.db.getClient().attendance.create({
        data: {
          tenant_id: tenantId,
          batch_id: data.batch_id,
          enrollment_id: data.enrollment_id,
          date: new Date(data.date),
          status: data.status,
          marked_by_id: data.marked_by_id ?? null,
          remarks: data.remarks ?? null,
        } as any,
      });
      return ok(attendance);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async bulkMark(data: {
    batch_id: string; date: string;
    records: { enrollment_id: string; status: string; remarks?: string }[];
    marked_by_id?: string;
  }): Promise<Result<any, AttendanceError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });

      if (scope?.vertical_ids?.length) {
        const batch = await this.db.getClient().batch.findUnique({
          where: { id: data.batch_id },
          include: { course: { select: { vertical_id: true } } },
        });
        if (!batch || !batch.course.vertical_id || !scope.vertical_ids.includes(batch.course.vertical_id)) {
          return err({ code: 'NOT_FOUND', message: 'Batch not found' });
        }
      }

      const created = await this.db.getClient().attendance.createMany({
        data: data.records.map((r) => ({
          tenant_id: tenantId,
          batch_id: data.batch_id,
          enrollment_id: r.enrollment_id,
          date: new Date(data.date),
          status: r.status,
          marked_by_id: data.marked_by_id ?? null,
          remarks: r.remarks ?? null,
        })) as any,
        skipDuplicates: true,
      });
      return ok({ count: created.count });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async update(id: string, data: {
    status?: string; remarks?: string;
  }): Promise<Result<any, AttendanceError>> {
    try {
      const attendance = await this.db.getClient().attendance.update({
        where: { id },
        data,
      });
      return ok(attendance);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findByBatchAndDate(params: {
    batch_id: string; date: string;
  }): Promise<Result<any[], AttendanceError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const where: Record<string, unknown> = {
        batch_id: params.batch_id,
        date: new Date(params.date),
      };
      if (scope?.vertical_ids?.length) {
        where.batch = { course: { vertical_id: { in: scope.vertical_ids } } };
      }

      const records = await this.db.getClient().attendance.findMany({
        where,
        include: {
          enrollment: {
            include: {
              party: { select: { id: true, name: true, phone_normalized: true } },
            },
          },
        },
        orderBy: { enrollment: { roll_number: 'asc' } },
      });
      return ok(records);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async reportByBatch(params: {
    batch_id: string; from_date?: string; to_date?: string;
  }): Promise<Result<any, AttendanceError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const where: Record<string, unknown> = { batch_id: params.batch_id };
      if (params.from_date) where.date = { ...(where.date as any ?? {}), gte: new Date(params.from_date) };
      if (params.to_date) where.date = { ...(where.date as any ?? {}), lte: new Date(params.to_date) };
      if (scope?.vertical_ids?.length) {
        where.batch = { course: { vertical_id: { in: scope.vertical_ids } } };
      }

      const records = await this.db.getClient().attendance.findMany({
        where,
        include: {
          enrollment: {
            include: { party: { select: { id: true, name: true } } },
          },
        },
        orderBy: [{ enrollment: { roll_number: 'asc' } }, { date: 'asc' }],
      });

      const byStudent = new Map<string, { name: string; present: number; absent: number; late: number; leave: number; total: number }>();
      for (const r of records) {
        const key = r.enrollment_id;
        if (!byStudent.has(key)) {
          byStudent.set(key, {
            name: r.enrollment.party.name,
            present: 0, absent: 0, late: 0, leave: 0, total: 0,
          });
        }
        const s = byStudent.get(key)!;
        s.total++;
        if (r.status === 'present') s.present++;
        else if (r.status === 'absent') s.absent++;
        else if (r.status === 'late') s.late++;
        else if (r.status === 'leave') s.leave++;
      }

      return ok({
        batch_id: params.batch_id,
        total_days: new Set(records.map((r) => r.date.toISOString().slice(0, 10))).size,
        students: Array.from(byStudent.entries()).map(([enrollment_id, stats]) => ({
          enrollment_id, ...stats,
          percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
        })),
      });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
