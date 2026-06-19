import { Injectable } from '@nestjs/common';
import { ok, err } from 'neverthrow';
import type { Result } from 'neverthrow';
import { TenantScopedPrismaService } from '../../core/tenant/tenant-scoped-prisma.service';
import { ClsService } from 'nestjs-cls';
import type { RequestScope } from '../../core/tenant/request-scope.interface';

export type ScholarshipsErrorCode = 'NOT_FOUND' | 'QUERY_FAILED' | 'DUPLICATE';
export interface ScholarshipsError { code: ScholarshipsErrorCode; message?: string }

@Injectable()
export class ScholarshipsService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
  ) {}

  private getTenantId(): string | null {
    const scope = this.cls.get<RequestScope>('scope');
    return scope?.tenant_id ?? null;
  }

  async create(data: {
    name: string; type: string; value: number;
    eligibility?: string; approval_required?: boolean;
  }): Promise<Result<any, ScholarshipsError>> {
    try {
      const tenantId = this.getTenantId();
      if (!tenantId) return err({ code: 'QUERY_FAILED', message: 'Tenant context missing' });

      const scholarship = await this.db.getClient().scholarship.create({
        data: { tenant_id: tenantId, ...data } as any,
      });
      return ok(scholarship);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findAll(params: { status?: string; search?: string; cursor?: string; limit?: number }): Promise<Result<{ data: any[]; next_cursor: string | undefined }, ScholarshipsError>> {
    try {
      const limit = Math.min(params.limit ?? 50, 100);
      const where: Record<string, unknown> = {};
      if (params.status) where.status = params.status;
      if (params.search) where.name = { contains: params.search, mode: 'insensitive' } as any;

      const scholarships = await this.db.getClient().scholarship.findMany({
        where,
        take: limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        orderBy: { created_at: 'desc' },
      });

      const hasMore = scholarships.length > limit;
      const data = hasMore ? scholarships.slice(0, limit) : scholarships;
      return ok({ data, next_cursor: hasMore ? data[data.length - 1]?.id : undefined });
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async findOne(id: string): Promise<Result<any, ScholarshipsError>> {
    try {
      const s = await this.db.getClient().scholarship.findUnique({ where: { id } });
      if (!s) return err({ code: 'NOT_FOUND', message: 'Scholarship not found' });
      return ok(s);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async update(id: string, data: Partial<{ name: string; type: string; value: number; eligibility: string; approval_required: boolean; status: string }>): Promise<Result<any, ScholarshipsError>> {
    try {
      const s = await this.db.getClient().scholarship.update({ where: { id }, data: data as any });
      return ok(s);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async remove(id: string): Promise<Result<void, ScholarshipsError>> {
    try {
      await this.db.getClient().scholarship.delete({ where: { id } });
      return ok(undefined);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async award(data: { enrollment_id: string; scholarship_id: string; amount: number; approved_by?: string }): Promise<Result<any, ScholarshipsError>> {
    try {
      const award = await this.db.getClient().studentScholarship.create({
        data: { tenant_id: this.getTenantId()!, ...data, status: 'active' } as any,
        include: { scholarship: { select: { id: true, name: true } } },
      });
      return ok(award);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async revokeAward(id: string): Promise<Result<void, ScholarshipsError>> {
    try {
      await this.db.getClient().studentScholarship.update({ where: { id }, data: { status: 'revoked' } });
      return ok(undefined);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }

  async listAwards(params: { enrollment_id?: string; scholarship_id?: string; status?: string }): Promise<Result<any[], ScholarshipsError>> {
    try {
      const where: Record<string, unknown> = {};
      if (params.enrollment_id) where.enrollment_id = params.enrollment_id;
      if (params.scholarship_id) where.scholarship_id = params.scholarship_id;
      if (params.status) where.status = params.status;

      const awards = await this.db.getClient().studentScholarship.findMany({
        where,
        include: { scholarship: { select: { id: true, name: true, type: true, value: true } } },
        orderBy: { created_at: 'desc' },
      });
      return ok(awards);
    } catch (e) {
      return err({ code: 'QUERY_FAILED', message: (e as Error).message });
    }
  }
}
