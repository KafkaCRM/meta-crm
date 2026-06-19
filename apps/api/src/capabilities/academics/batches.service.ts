import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type BatchesErrorCode = 'NOT_FOUND' | 'DUPLICATE_CODE' | 'CAPACITY_FULL' | 'QUERY_FAILED';
export interface BatchesError { code: BatchesErrorCode; message?: string }

@Injectable()
export class BatchesService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    const scope = this.cls.get<RequestScope>('scope');
    return scope?.tenant_id ?? null;
  }

  async create(data: {
    course_id: string; name: string; code: string; branch_id?: string;
    trainer_id?: string; room?: string; start_date?: string; end_date?: string;
    schedule_json?: any; capacity?: number;
  }): Promise<Result<any, BatchesError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });

      const existing = await this.db.getClient().batch.findFirst({
        where: { code: data.code },
      });
      if (existing) return err({ code: 'DUPLICATE_CODE', message: `Batch code '${data.code}' already exists` });

      const batch = await this.db.getClient().batch.create({
        data: {
          tenant_id: tenantId,
          course_id: data.course_id, name: data.name, code: data.code,
          branch_id: data.branch_id ?? null, trainer_id: data.trainer_id ?? null,
          room: data.room ?? null, capacity: data.capacity ?? null,
          start_date: data.start_date ? new Date(data.start_date) : null,
          end_date: data.end_date ? new Date(data.end_date) : null,
          schedule_json: data.schedule_json ?? {},
        } as any,
        include: { course: { select: { name: true, code: true } } },
      });
      return ok(batch);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findAll(params: {
    course_id?: string; branch_id?: string; status?: string; trainer_id?: string;
    cursor?: string; limit?: number;
  }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, BatchesError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {};
      if (params.course_id) where.course_id = params.course_id;
      if (params.branch_id) where.branch_id = params.branch_id;
      if (params.status) where.status = params.status;
      if (params.trainer_id) where.trainer_id = params.trainer_id;
      if (scope?.vertical_ids?.length) where.course = { vertical_id: { in: scope.vertical_ids } };

      const batches = await this.db.getClient().batch.findMany({
        where,
        take: limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        orderBy: { start_date: 'desc' },
        include: {
          course: { select: { id: true, name: true, code: true } },
          _count: { select: { enrollments: true, attendances: true } },
        },
      });

      const hasMore = batches.length > limit;
      const data = hasMore ? batches.slice(0, limit) : batches;
      return ok({ data, next_cursor: hasMore ? data[data.length - 1]?.id : undefined });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findOne(id: string): Promise<Result<any, BatchesError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const batch = await this.db.getClient().batch.findUnique({
        where: { id },
        include: {
          course: { select: { id: true, name: true, code: true, fee: true, vertical_id: true } },
          enrollments: {
            include: { party: { select: { id: true, name: true, phone_normalized: true } } },
            orderBy: { roll_number: 'asc' },
          },
        },
      });
      if (!batch) return err({ code: 'NOT_FOUND', message: 'Batch not found' });
      if (scope?.vertical_ids?.length && (!batch.course.vertical_id || !scope.vertical_ids.includes(batch.course.vertical_id))) {
        return err({ code: 'NOT_FOUND', message: 'Batch not found' });
      }
      return ok(batch);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async update(id: string, data: Partial<{
    name: string; code: string; trainer_id: string; room: string;
    start_date: string; end_date: string; schedule_json: any;
    capacity: number; status: string;
  }>): Promise<Result<any, BatchesError>> {
    try {
      const patch: Record<string, unknown> = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.code !== undefined) patch.code = data.code;
      if (data.trainer_id !== undefined) patch.trainer_id = data.trainer_id;
      if (data.room !== undefined) patch.room = data.room;
      if (data.start_date !== undefined) patch.start_date = new Date(data.start_date);
      if (data.end_date !== undefined) patch.end_date = new Date(data.end_date);
      if (data.schedule_json !== undefined) patch.schedule_json = data.schedule_json;
      if (data.capacity !== undefined) patch.capacity = data.capacity;
      if (data.status !== undefined) patch.status = data.status;

      const batch = await this.db.getClient().batch.update({ where: { id }, data: patch as any });
      return ok(batch);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async remove(id: string): Promise<Result<void, BatchesError>> {
    try {
      await this.db.getClient().batch.delete({ where: { id } });
      return ok(undefined);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
