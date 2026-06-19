import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type StudyMaterialsErrorCode = 'NOT_FOUND' | 'QUERY_FAILED';
export interface StudyMaterialsError { code: StudyMaterialsErrorCode; message?: string }

@Injectable()
export class StudyMaterialsService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    return this.cls.get<RequestScope>('scope')?.tenant_id ?? null;
  }

  async create(data: { course_id: string; batch_id?: string; title: string; description?: string; type: string; url: string }): Promise<Result<any, StudyMaterialsError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });
      const scope = this.cls.get<RequestScope>('scope');
      const item = await this.db.getClient().studyMaterial.create({
        data: { tenant_id: tenantId, course_id: data.course_id, batch_id: data.batch_id ?? null, title: data.title, description: data.description, type: data.type, url: data.url, uploaded_by: scope?.user_id ?? null } as any,
      });
      return ok(item);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findAll(params: { course_id?: string; batch_id?: string; cursor?: string; limit?: number }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, StudyMaterialsError>> {
    try {
      const scope = this.cls.get<RequestScope>('scope');
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {};
      if (params.course_id) where.course_id = params.course_id;
      if (params.batch_id) where.batch_id = params.batch_id;
      if (scope?.vertical_ids?.length) where.course = { vertical_id: { in: scope.vertical_ids } };
      const items = await this.db.getClient().studyMaterial.findMany({
        where, take: limit + 1, ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        orderBy: { created_at: 'desc' },
        include: { course: { select: { name: true } } },
      });
      const hasMore = items.length > limit;
      return ok({ data: hasMore ? items.slice(0, limit) : items, next_cursor: hasMore ? items[limit - 1]?.id : undefined });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async remove(id: string): Promise<Result<void, StudyMaterialsError>> {
    try { await this.db.getClient().studyMaterial.delete({ where: { id } }); return ok(undefined); }
    catch (e) { return err({ code: 'QUERY_FAILED', message: (e as Error).message }); }
  }
}
