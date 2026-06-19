import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type AssignmentsErrorCode = 'NOT_FOUND' | 'QUERY_FAILED';
export interface AssignmentsError { code: AssignmentsErrorCode; message?: string }

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    return this.cls.get<RequestScope>('scope')?.tenant_id ?? null;
  }

  async create(data: { course_id: string; batch_id?: string; title: string; description?: string; due_date?: string; max_marks?: number }): Promise<Result<any, AssignmentsError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });
      const assignment = await this.db.getClient().assignment.create({
        data: { tenant_id: tenantId, course_id: data.course_id, batch_id: data.batch_id ?? null, title: data.title, description: data.description, due_date: data.due_date ? new Date(data.due_date) : null, max_marks: data.max_marks ?? null } as any,
        include: { course: { select: { name: true, code: true } } },
      });
      return ok(assignment);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findAll(params: { course_id?: string; batch_id?: string; cursor?: string; limit?: number }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, AssignmentsError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {};
      if (params.course_id) where.course_id = params.course_id;
      if (params.batch_id) where.batch_id = params.batch_id;
      if (scope?.vertical_ids?.length) where.course = { vertical_id: { in: scope.vertical_ids } };
      const items = await this.db.getClient().assignment.findMany({
        where, take: limit + 1, ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        orderBy: { created_at: 'desc' },
        include: { course: { select: { name: true, code: true } }, _count: { select: { submissions: true } } },
      });
      const hasMore = items.length > limit;
      return ok({ data: hasMore ? items.slice(0, limit) : items, next_cursor: hasMore ? items[limit - 1]?.id : undefined });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findOne(id: string): Promise<Result<any, AssignmentsError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const item = await this.db.getClient().assignment.findUnique({
        where: { id },
        include: {
          course: { select: { id: true, name: true, vertical_id: true } },
          submissions: {
            include: { enrollment: { include: { party: { select: { name: true } } } } },
            orderBy: { submitted_at: 'desc' },
          },
        },
      });
      if (!item) return err({ code: 'NOT_FOUND', message: 'Assignment not found' });
      if (scope?.vertical_ids?.length && (!item.course.vertical_id || !scope.vertical_ids.includes(item.course.vertical_id))) {
        return err({ code: 'NOT_FOUND', message: 'Assignment not found' });
      }
      return ok(item);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async update(id: string, data: Partial<{ title: string; description: string; due_date: string; max_marks: number }>): Promise<Result<any, AssignmentsError>> {
    try {
      const patch: Record<string, unknown> = {};
      if (data.title !== undefined) patch.title = data.title;
      if (data.description !== undefined) patch.description = data.description;
      if (data.due_date !== undefined) patch.due_date = new Date(data.due_date);
      if (data.max_marks !== undefined) patch.max_marks = data.max_marks;
      const item = await this.db.getClient().assignment.update({ where: { id }, data: patch as any });
      return ok(item);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async remove(id: string): Promise<Result<void, AssignmentsError>> {
    try { await this.db.getClient().assignment.delete({ where: { id } }); return ok(undefined); }
    catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
