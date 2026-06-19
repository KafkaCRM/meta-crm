import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type TestsErrorCode = 'NOT_FOUND' | 'QUERY_FAILED';
export interface TestsError { code: TestsErrorCode; message?: string }

@Injectable()
export class TestsService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    return this.cls.get<RequestScope>('scope')?.tenant_id ?? null;
  }

  async create(data: {
    course_id: string; batch_id?: string; name: string; type?: string;
    max_marks: number; grading_scheme?: any; held_on?: string;
  }): Promise<Result<any, TestsError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });
      const test = await this.db.getClient().test.create({
        data: {
          tenant_id: tenantId, course_id: data.course_id,
          batch_id: data.batch_id ?? null, name: data.name,
          type: data.type ?? 'exam', max_marks: data.max_marks,
          grading_scheme: data.grading_scheme ?? {},
          held_on: data.held_on ? new Date(data.held_on) : null,
        } as any,
      });
      return ok(test);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findAll(params: { course_id?: string; batch_id?: string; cursor?: string; limit?: number }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, TestsError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {};
      if (params.course_id) where.course_id = params.course_id;
      if (params.batch_id) where.batch_id = params.batch_id;
      if (scope?.vertical_ids?.length) where.course = { vertical_id: { in: scope.vertical_ids } };
      const tests = await this.db.getClient().test.findMany({
        where, take: limit + 1, ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        orderBy: { held_on: 'desc' },
        include: { course: { select: { name: true, code: true } }, _count: { select: { scores: true } } },
      });
      const hasMore = tests.length > limit;
      return ok({ data: hasMore ? tests.slice(0, limit) : tests, next_cursor: hasMore ? tests[limit - 1]?.id : undefined });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findOne(id: string): Promise<Result<any, TestsError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const test = await this.db.getClient().test.findUnique({
        where: { id },
        include: {
          course: { select: { id: true, name: true, vertical_id: true } },
          scores: {
            include: { enrollment: { include: { party: { select: { name: true, phone_normalized: true } } } } },
            orderBy: { marks_obtained: 'desc' },
          },
        },
      });
      if (!test) return err({ code: 'NOT_FOUND', message: 'Test not found' });
      if (scope?.vertical_ids?.length && (!test.course.vertical_id || !scope.vertical_ids.includes(test.course.vertical_id))) {
        return err({ code: 'NOT_FOUND', message: 'Test not found' });
      }
      return ok(test);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async update(id: string, data: Partial<{ name: string; type: string; max_marks: number; grading_scheme: any; held_on: string }>): Promise<Result<any, TestsError>> {
    try {
      const patch: Record<string, unknown> = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.type !== undefined) patch.type = data.type;
      if (data.max_marks !== undefined) patch.max_marks = data.max_marks;
      if (data.grading_scheme !== undefined) patch.grading_scheme = data.grading_scheme;
      if (data.held_on !== undefined) patch.held_on = new Date(data.held_on);
      const test = await this.db.getClient().test.update({ where: { id }, data: patch as any });
      return ok(test);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async remove(id: string): Promise<Result<void, TestsError>> {
    try {
      await this.db.getClient().test.delete({ where: { id } });
      return ok(undefined);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
