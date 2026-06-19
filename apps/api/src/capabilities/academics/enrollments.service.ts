import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type EnrollmentsErrorCode = 'NOT_FOUND' | 'CAPACITY_FULL' | 'ALREADY_ENROLLED' | 'QUERY_FAILED';
export interface EnrollmentsError { code: EnrollmentsErrorCode; message?: string }

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    const scope = this.cls.get<RequestScope>('scope');
    return scope?.tenant_id ?? null;
  }

  async enroll(data: {
    party_id: string; batch_id?: string; course_id?: string;
    student_id?: string; roll_number?: string;
    parent_name?: string; parent_phone?: string;
  }): Promise<Result<any, EnrollmentsError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });

      if (data.batch_id) {
        const existing = await this.db.getClient().enrollment.findFirst({
          where: { party_id: data.party_id, batch_id: data.batch_id, status: 'active' },
        });
        if (existing) return err({ code: 'ALREADY_ENROLLED', message: 'Student is already enrolled in this batch' });

        const batch = await this.db.getClient().batch.findUnique({
          where: { id: data.batch_id },
          include: { course: { select: { vertical_id: true } } },
        });
        if (!batch) return err({ code: 'NOT_FOUND', message: 'Batch not found' });
        if (scope?.vertical_ids?.length && (!batch.course.vertical_id || !scope.vertical_ids.includes(batch.course.vertical_id))) {
          return err({ code: 'NOT_FOUND', message: 'Batch not found' });
        }
        if (batch.capacity && batch.enrolled_count >= batch.capacity) {
          return err({ code: 'CAPACITY_FULL', message: 'Batch has reached maximum capacity' });
        }

        const enrollment = await this.db.getClient().enrollment.create({
          data: {
            tenant_id: tenantId,
            party_id: data.party_id, batch_id: data.batch_id,
            course_id: batch.course_id,
            student_id: data.student_id ?? null, roll_number: data.roll_number ?? null,
            parent_name: data.parent_name ?? null, parent_phone: data.parent_phone ?? null,
          } as any,
        });

        await this.db.getClient().batch.update({
          where: { id: data.batch_id },
          data: { enrolled_count: { increment: 1 } },
        });

        return ok(enrollment);
      }

      if (scope?.vertical_ids?.length && data.course_id) {
        const course = await this.db.getClient().course.findUnique({
          where: { id: data.course_id },
          select: { vertical_id: true },
        });
        if (!course || !course.vertical_id || !scope.vertical_ids.includes(course.vertical_id)) {
          return err({ code: 'NOT_FOUND', message: 'Course not found' });
        }
      }

      const enrollment = await this.db.getClient().enrollment.create({
        data: {
          tenant_id: tenantId,
          party_id: data.party_id, course_id: data.course_id ?? null,
          student_id: data.student_id ?? null, roll_number: data.roll_number ?? null,
          parent_name: data.parent_name ?? null, parent_phone: data.parent_phone ?? null,
        } as any,
      });
      return ok(enrollment);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findAll(params: {
    batch_id?: string; course_id?: string; status?: string; party_id?: string;
    cursor?: string; limit?: number;
  }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, EnrollmentsError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {};
      if (params.batch_id) where.batch_id = params.batch_id;
      if (params.course_id) where.course_id = params.course_id;
      if (params.status) where.status = params.status;
      if (params.party_id) where.party_id = params.party_id;
      if (scope?.vertical_ids?.length) {
        where.OR = [
          { course: { vertical_id: { in: scope.vertical_ids } } },
          { batch: { course: { vertical_id: { in: scope.vertical_ids } } } },
        ];
      }

      const enrollments = await this.db.getClient().enrollment.findMany({
        where,
        take: limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        orderBy: { created_at: 'desc' },
        include: {
          party: { select: { id: true, name: true, phone_normalized: true, email: true } },
          batch: { select: { id: true, name: true, code: true } },
          course: { select: { id: true, name: true, code: true } },
        },
      });

      const hasMore = enrollments.length > limit;
      const data = hasMore ? enrollments.slice(0, limit) : enrollments;
      return ok({ data, next_cursor: hasMore ? data[data.length - 1]?.id : undefined });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findOne(id: string): Promise<Result<any, EnrollmentsError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const enrollment = await this.db.getClient().enrollment.findUnique({
        where: { id },
        include: {
          party: true,
          batch: { include: { course: { select: { id: true, vertical_id: true } } } },
          course: { select: { id: true, vertical_id: true } },
          attendances: { orderBy: { date: 'desc' }, take: 30 },
        },
      });
      if (!enrollment) return err({ code: 'NOT_FOUND', message: 'Enrollment not found' });
      if (scope?.vertical_ids?.length) {
        const vertId = enrollment.course?.vertical_id ?? enrollment.batch?.course?.vertical_id;
        if (!vertId || !scope.vertical_ids.includes(vertId)) {
          return err({ code: 'NOT_FOUND', message: 'Enrollment not found' });
        }
      }
      return ok(enrollment);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async transfer(id: string, new_batch_id: string): Promise<Result<any, EnrollmentsError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const enrollment = await this.db.getClient().enrollment.findUnique({
        where: { id },
        include: { course: { select: { vertical_id: true } } },
      });
      if (!enrollment) return err({ code: 'NOT_FOUND', message: 'Enrollment not found' });
      if (scope?.vertical_ids?.length) {
        const vertId = enrollment.course?.vertical_id;
        if (!vertId || !scope.vertical_ids.includes(vertId)) {
          return err({ code: 'NOT_FOUND', message: 'Enrollment not found' });
        }
      }

      const newBatch = await this.db.getClient().batch.findUnique({
        where: { id: new_batch_id },
        include: { course: { select: { vertical_id: true } } },
      });
      if (!newBatch) return err({ code: 'NOT_FOUND', message: 'New batch not found' });
      if (scope?.vertical_ids?.length && (!newBatch.course.vertical_id || !scope.vertical_ids.includes(newBatch.course.vertical_id))) {
        return err({ code: 'NOT_FOUND', message: 'New batch not found' });
      }

      const updated = await this.db.getClient().enrollment.update({
        where: { id },
        data: { batch_id: new_batch_id, status: 'active' },
      });

      if (enrollment.batch_id) {
        await this.db.getClient().batch.update({
          where: { id: enrollment.batch_id },
          data: { enrolled_count: { decrement: 1 } },
        });
      }
      await this.db.getClient().batch.update({
        where: { id: new_batch_id },
        data: { enrolled_count: { increment: 1 } },
      });

      return ok(updated);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async withdraw(id: string): Promise<Result<void, EnrollmentsError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const enrollment = await this.db.getClient().enrollment.findUnique({
        where: { id },
        include: { course: { select: { vertical_id: true } } },
      });
      if (!enrollment) return err({ code: 'NOT_FOUND', message: 'Enrollment not found' });
      if (scope?.vertical_ids?.length) {
        const vertId = enrollment.course?.vertical_id;
        if (!vertId || !scope.vertical_ids.includes(vertId)) {
          return err({ code: 'NOT_FOUND', message: 'Enrollment not found' });
        }
      }

      await this.db.getClient().enrollment.update({
        where: { id },
        data: { status: 'dropped' },
      });

      if (enrollment.batch_id) {
        await this.db.getClient().batch.update({
          where: { id: enrollment.batch_id },
          data: { enrolled_count: { decrement: 1 } },
        });
      }

      return ok(undefined);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
