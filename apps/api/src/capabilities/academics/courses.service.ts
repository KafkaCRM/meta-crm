import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type CoursesErrorCode = 'NOT_FOUND' | 'DUPLICATE_CODE' | 'QUERY_FAILED';
export interface CoursesError { code: CoursesErrorCode; message?: string }

@Injectable()
export class CoursesService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    const scope = this.cls.get<RequestScope>('scope');
    return scope?.tenant_id ?? null;
  }

  async create(data: {
    name: string; code: string; vertical_id?: string; description?: string;
    category?: string; duration_value?: number; duration_unit?: string;
    mode?: string; fee?: number; syllabus?: any;
  }): Promise<Result<any, CoursesError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });

      const existing = await this.db.getClient().course.findFirst({
        where: { code: data.code },
      });
      if (existing) return err({ code: 'DUPLICATE_CODE', message: `Course code '${data.code}' already exists` });

      const course = await this.db.getClient().course.create({
        data: {
          tenant_id: tenantId,
          name: data.name, code: data.code,
          vertical_id: data.vertical_id ?? null,
          description: data.description, category: data.category,
          duration_value: data.duration_value, duration_unit: data.duration_unit,
          mode: data.mode ?? 'offline',
          fee: data.fee, syllabus: data.syllabus ?? {},
        } as any,
      });
      return ok(course);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findAll(params: {
    vertical_id?: string; status?: string; search?: string;
    cursor?: string; limit?: number;
  }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, CoursesError>> {
    try {
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {};
      if (params.vertical_id) where.vertical_id = params.vertical_id;
      if (params.status) where.status = params.status;
      if (params.search) where.name = { contains: params.search, mode: 'insensitive' } as any;

      const courses = await this.db.getClient().course.findMany({
        where,
        take: limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        orderBy: { created_at: 'desc' },
        include: { _count: { select: { batches: true, enrollments: true } } },
      });

      const hasMore = courses.length > limit;
      const data = hasMore ? courses.slice(0, limit) : courses;
      return ok({ data, next_cursor: hasMore ? data[data.length - 1]?.id : undefined });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findOne(id: string): Promise<Result<any, CoursesError>> {
    try {
      const course = await this.db.getClient().course.findUnique({
        where: { id },
        include: {
          batches: { orderBy: { start_date: 'desc' } },
          _count: { select: { enrollments: true } },
        },
      });
      if (!course) return err({ code: 'NOT_FOUND', message: 'Course not found' });
      return ok(course);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async update(id: string, data: Partial<{
    name: string; code: string; description: string; category: string;
    duration_value: number; duration_unit: string; mode: string;
    fee: number; syllabus: any; status: string;
  }>): Promise<Result<any, CoursesError>> {
    try {
      if (data.code) {
        const dup = await this.db.getClient().course.findFirst({
          where: { code: data.code, id: { not: id } },
        });
        if (dup) return err({ code: 'DUPLICATE_CODE', message: `Course code '${data.code}' already in use` });
      }

      const course = await this.db.getClient().course.update({ where: { id }, data: data as any });
      return ok(course);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async remove(id: string): Promise<Result<void, CoursesError>> {
    try {
      await this.db.getClient().course.delete({ where: { id } });
      return ok(undefined);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
