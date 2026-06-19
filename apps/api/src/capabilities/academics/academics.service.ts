import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';

export type EnrollmentErrorCode = 'QUERY_FAILED';

export interface EnrollmentError {
  code: EnrollmentErrorCode;
  message?: string;
}

export interface EnrollmentStats {
  total: number;
  by_stage: { stage_name: string; count: number }[];
  by_course: { course_name: string; count: number }[];
  avg_days_to_fee_paid: number | null;
}

@Injectable()
export class EnrollmentService {
  constructor(private readonly db: TenantScopedPrismaService) {}

  async listEnrollments(params: {
    cursor?: string;
    limit?: number;
    stage?: string;
  }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, EnrollmentError>> {
    try {
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {};
      if (params.stage) where.stage = params.stage;

      const enrollments = await this.db.getClient().lead.findMany({
        where,
        take: limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        orderBy: { created_at: 'desc' },
        include: { party: true },
      });

      const hasMore = enrollments.length > limit;
      const data = hasMore ? enrollments.slice(0, limit) : enrollments;

      return ok({
        data,
        next_cursor: hasMore ? data[data.length - 1]?.id : undefined,
      });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async getStats(): Promise<Result<EnrollmentStats, EnrollmentError>> {
    try {
      const total = await this.db.getClient().lead.count({});

      const byStageRaw = await this.db.getClient().lead.groupBy({
        by: ['stage'],
        _count: { id: true },
      });

      const byStage = byStageRaw.map((g) => ({
        stage_name: g.stage ?? 'unknown',
        count: g._count.id,
      }));

      const allEnrollments = await this.db.getClient().lead.findMany({
        select: { attributes: true, created_at: true },
      });

      const courseCounts = new Map<string, number>();
      let feePaidCount = 0;
      let totalDaysToFeePaid = 0;

      for (const enrollment of allEnrollments) {
        const attrs = (enrollment.attributes ?? {}) as Record<string, unknown>;
        const courseName = (attrs['course_name'] as string) ?? 'unknown';
        courseCounts.set(courseName, (courseCounts.get(courseName) ?? 0) + 1);
      }

      const byCourse = Array.from(courseCounts.entries()).map(([course_name, count]) => ({
        course_name,
        count,
      }));

      return ok({
        total,
        by_stage: byStage,
        by_course: byCourse,
        avg_days_to_fee_paid: feePaidCount > 0 ? totalDaysToFeePaid / feePaidCount : null,
      });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
