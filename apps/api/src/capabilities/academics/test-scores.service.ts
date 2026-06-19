import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type TestScoresErrorCode = 'NOT_FOUND' | 'DUPLICATE' | 'QUERY_FAILED';
export interface TestScoresError { code: TestScoresErrorCode; message?: string }

@Injectable()
export class TestScoresService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    return this.cls.get<RequestScope>('scope')?.tenant_id ?? null;
  }

  async record(data: { test_id: string; enrollment_id: string; marks_obtained: number; grade?: string; remarks?: string }): Promise<Result<any, TestScoresError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });

      if (scope?.vertical_ids?.length) {
        const test = await this.db.getClient().test.findUnique({
          where: { id: data.test_id },
          include: { course: { select: { vertical_id: true } } },
        });
        if (!test || !test.course.vertical_id || !scope.vertical_ids.includes(test.course.vertical_id)) {
          return err({ code: 'NOT_FOUND', message: 'Test not found' });
        }
      }

      const existing = await this.db.getClient().testScore.findUnique({
        where: { test_id_enrollment_id: { test_id: data.test_id, enrollment_id: data.enrollment_id } },
      });
      if (existing) return err({ code: 'DUPLICATE', message: 'Score already recorded for this student' });

      const score = await this.db.getClient().testScore.create({
        data: { tenant_id: tenantId, test_id: data.test_id, enrollment_id: data.enrollment_id, marks_obtained: data.marks_obtained, grade: data.grade ?? null, remarks: data.remarks ?? null } as any,
      });
      return ok(score);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async bulkRecord(data: { test_id: string; scores: { enrollment_id: string; marks_obtained: number; grade?: string; remarks?: string }[] }): Promise<Result<any, TestScoresError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });
      const created = await this.db.getClient().testScore.createMany({
        data: data.scores.map((s) => ({ tenant_id: tenantId, test_id: data.test_id, enrollment_id: s.enrollment_id, marks_obtained: s.marks_obtained, grade: s.grade ?? null, remarks: s.remarks ?? null })) as any,
        skipDuplicates: true,
      });
      return ok({ count: created.count });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async update(id: string, data: { marks_obtained?: number; grade?: string; remarks?: string }): Promise<Result<any, TestScoresError>> {
    try {
      const score = await this.db.getClient().testScore.update({ where: { id }, data });
      return ok(score);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findByTest(test_id: string): Promise<Result<any[], TestScoresError>> {
    try {
      const scores = await this.db.getClient().testScore.findMany({
        where: { test_id },
        include: { enrollment: { include: { party: { select: { name: true, phone_normalized: true } } } } },
        orderBy: { marks_obtained: 'desc' },
      });
      return ok(scores);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
